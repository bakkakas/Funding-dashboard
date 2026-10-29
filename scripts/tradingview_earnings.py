"""Public TradingView Earnings-page revenue/EPS pairs, not locked Estimates metrics."""
import datetime as dt
import math
import re
import json
import urllib.request

FIELDS = ['currency', 'earnings_fq_h', 'revenues_fq_h', 'earnings_fy_h', 'revenues_fy_h']
URL = 'https://www.tradingview.com/symbols/NASDAQ-OTLY/financials-earnings/'

def finite(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None

def parse_otly(payload):
    item = next((r for r in payload.get('data', []) if r.get('s') == 'NASDAQ:OTLY'), None)
    if not item or len(item.get('d', [])) != len(FIELDS):
        raise ValueError('OTLY earnings response incomplete')
    data = dict(zip(FIELDS, item['d']))
    if data['currency'] != 'USD':
        raise ValueError('Unexpected OTLY reporting currency')
    def records(frequency):
        rows = {}
        for field, label, scale, unit in [('revenues', '매출액', 1e6, 'USD(백만)'), ('earnings', 'EPS', 1, 'USD / 주 (ADS)')]:
            values = data[f'{field}_{frequency}_h']
            if not isinstance(values, list):
                raise ValueError('Earnings history missing')
            reported = [r['FiscalPeriod'] for r in values if r.get('IsReported') and finite(r.get('Actual')) is not None]
            if not reported:
                raise ValueError('No dated reported earnings')
            latest = max(reported)
            # Match the dashboard's near-term window, not distant forecasts.
            futures = sorted({r['FiscalPeriod'] for r in values if r['FiscalPeriod'] > latest})[:2]
            for r in values:
                fiscal = r.get('FiscalPeriod', '')
                if not re.fullmatch(r'20\d{2}' + (r'-Q[1-4]' if frequency == 'fq' else ''), fiscal):
                    raise ValueError('Invalid fiscal period')
                if fiscal > latest and fiscal not in futures:
                    continue
                actual = finite(r.get('Actual')) if r.get('IsReported') is True else None
                estimate = finite(r.get('Estimate'))
                if actual is None and estimate is None:
                    continue
                period = fiscal[:4] + (f'-{int(fiscal[-1])*3:02}' if frequency == 'fq' else '')
                row = rows.setdefault(period, {'period':period,'fiscalPeriod':fiscal,'basis':'TradingView 발표·컨센서스 (제공처 기준 · EPS는 ADS당)','directComparison':True,'metrics':[]})
                row['metrics'].append({'label':label,'actual':actual/scale if actual is not None else None,'estimate':estimate/scale if estimate is not None else None,'unit':unit,'announcedAt':None,'sourceType':r.get('Type')})
        return sorted(rows.values(), key=lambda r:r['period'], reverse=True)
    meta = {'schemaVersion':1,'source':'TradingView · Earnings','url':URL,'refreshMode':'scheduled-cache','asOf':dt.datetime.now(dt.timezone.utc).isoformat(),'note':'공개 Earnings 표의 매출·EPS 예상과 발표값. 분기는 회계 분기말이며 발표일이 아닙니다. EPS는 제공처의 ADS 기준을 그대로 사용합니다. 영업이익·순이익 예상치는 연결되지 않았습니다.'}
    result = {**meta,'rows':records('fq')}
    if all(isinstance(data[key], list) for key in ['earnings_fy_h','revenues_fy_h']):
        result['annual'] = {**meta,'rows':records('fy')}
    return result

def collect_otly(_ticker='OTLY'):
    body = json.dumps({'symbols':{'tickers':['NASDAQ:OTLY'],'query':{'types':[]}},'columns':FIELDS}).encode()
    req=urllib.request.Request('https://scanner.tradingview.com/america/scan',data=body,headers={'Content-Type':'application/json','User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=30) as response:
        return parse_otly(json.load(response))
