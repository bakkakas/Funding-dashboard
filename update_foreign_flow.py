#!/usr/bin/env python3
import json, re, time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode

START_DATE=date(2016,1,1); OUTPUT=Path(__file__).with_name('foreign_flow_data.json')
STOCKS={'005930':'삼성전자','000660':'SK하이닉스'}
MARKETS=('KOSPI','KOSDAQ')
KST=timezone(timedelta(hours=9))

FLOW_BASIS = 'KRX+NXT'
TREND_URL = 'https://m.stock.naver.com/front-api/stock/domestic/trend'


def num(value, pct=False):
    if value is None: return None
    value = str(value).replace(',', '').replace('%', '').replace('+', '').strip()
    return (float(value) if pct else int(value)) if value and value != 'N/A' else None


def parse_stock_trend_row(row):
    day = str(row.get('localTradedAt', ''))
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
        raise ValueError('Missing stock flow business date')
    date.fromisoformat(day)
    markets = {name: row.get(name.lower()) for name in ('KRX', 'NXT') if row.get(name.lower()) is not None}
    if not markets: raise ValueError('Missing exchange data')
    totals = {'foreignNetVolume': 0, 'organizationNetVolume': 0, 'individualNetVolume': 0, 'tradingVolume': 0}
    exchange_foreign = {}
    for name, market in markets.items():
        volume = num(market.get('tradingVolume'))
        if volume is None or volume < 0: raise ValueError('Incomplete exchange volume')
        totals['tradingVolume'] += volume
        for key in ('foreignNetVolume', 'organizationNetVolume', 'individualNetVolume'):
            value = num(market.get(key))
            # Naver publishes a zero-volume NXT placeholder before trading begins.
            # Only an explicit zero traded volume makes a missing net quantity zero.
            if value is None and volume == 0: value = 0
            if value is None: raise ValueError('Incomplete exchange flow')
            totals[key] += value
            if key == 'foreignNetVolume': exchange_foreign[name] = value
    reference = markets.get('KRX') or markets.get('NXT')
    close = num(reference.get('closingPrice'))
    ownership = num(row.get('foreignHoldingRatio'), True)
    if close is None or ownership is None: raise ValueError('Incomplete price/ownership')
    return {
        'date': day, 'close': close, 'volume': totals['tradingVolume'],
        'institutionNetShares': totals['organizationNetVolume'],
        'foreignNetShares': totals['foreignNetVolume'],
        'individualNetShares': totals['individualNetVolume'],
        'foreignHeldShares': num(row.get('foreignHoldingStockQuantity')),
        # This is an issuer-level published ratio, never a sum of exchange ratios
        # or an estimate derived from cumulative net purchases.
        'foreignOwnershipPct': ownership,
        'flowBasis': FLOW_BASIS, 'exchangeForeignNetShares': exchange_foreign,
    }


def fetch_stock_page(code, cursor=None):
    params = {'code': code, 'exchangeType': 'ALL', 'size': 100}
    if cursor: params['cursor'] = cursor
    req = Request(TREND_URL + '?' + urlencode(params), headers={
        'User-Agent': 'Mozilla/5.0 FundingDashboard/1.0',
        'Referer': f'https://m.stock.naver.com/domestic/stock/{code}/total',
    })
    for attempt in range(3):
        try:
            with urlopen(req, timeout=20) as res: payload = json.load(res)
            if payload.get('isSuccess') is not True or not isinstance(payload.get('result', {}).get('items'), list):
                raise ValueError('Invalid consolidated flow response')
            return payload['result']
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)


def parse_index_snapshot(trend,basic,now_kst=None):
    now_kst=now_kst or datetime.now(KST)
    bizdate=str(trend.get('bizdate',''))
    if not re.fullmatch(r'\d{8}',bizdate): raise ValueError('Missing index flow business date')
    traded_at=basic.get('localTradedAt')
    try: source_time=datetime.fromisoformat(traded_at).astimezone(KST).strftime('%H:%M')
    except (TypeError,ValueError): source_time=now_kst.strftime('%H:%M')
    values={
        'individual':num(trend.get('personalValue','')),
        'foreign':num(trend.get('foreignValue','')),
        'institution':num(trend.get('institutionalValue','')),
    }
    if any(value is None for value in values.values()): raise ValueError('Incomplete index flow values')
    return {'date':datetime.strptime(bizdate,'%Y%m%d').date().isoformat(),'sourceTime':source_time,**values}

def fetch_index_snapshot(market):
    headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0','Referer':f'https://m.stock.naver.com/domestic/index/{market}/total'}
    payloads=[]
    for endpoint in ('trend','basic'):
        req=Request(f'https://m.stock.naver.com/api/index/{market}/{endpoint}',headers=headers)
        with urlopen(req,timeout=20) as res: payloads.append(json.load(res))
    return parse_index_snapshot(*payloads)

def collect(code, existing=None):
    existing = existing or []
    migrated = bool(existing) and all(r.get('flowBasis') == FLOW_BASIS for r in existing)
    # First migration re-fetches the complete archive, not only the recent 60 days.
    records = {r['date']: r for r in existing} if migrated else {}
    refresh_since = (date.fromisoformat(max(records)) - timedelta(days=90)).isoformat() if migrated else START_DATE.isoformat()
    cursor = None
    seen = set()
    for _ in range(100):
        page = fetch_stock_page(code, cursor)
        rows = [parse_stock_trend_row(row) for row in page['items']]
        if not rows: raise ValueError('Empty stock history page')
        records.update({r['date']: r for r in rows if r['date'] >= START_DATE.isoformat()})
        if min(r['date'] for r in rows) <= refresh_since or not page.get('hasNext'): break
        cursor = page.get('cursor')
        if not cursor or cursor in seen: raise ValueError('Invalid stock history cursor')
        seen.add(cursor)
    else: raise ValueError('Stock history pagination limit reached')
    if not records: raise RuntimeError(f'No rows collected for {code}')
    if not migrated:
        missing = {r['date'] for r in existing} - records.keys()
        if missing: raise ValueError(f'Incomplete history migration: {len(missing)} existing dates missing')
    return [records[k] for k in sorted(records)]


def collect_intraday(previous):
    now_kst=datetime.now(KST)
    result={}; warnings=[]
    for market in MARKETS:
        records={(r['date'],r['time']):r for r in previous.get(market,[]) if r.get('date') and r.get('time') and int(r['time'].split(':')[1])%15==0}
        try:
            snapshot=fetch_index_snapshot(market)
            hour,minute=map(int,snapshot['sourceTime'].split(':'))
            quarter=min(((hour*60+minute+7)//15)*15,23*60+45)
            bucket=f'{quarter//60:02d}:{quarter%60:02d}'
            records[(snapshot['date'],bucket)]={**snapshot,'time':bucket}
        except Exception as exc:
            warnings.append(f'{market}: {type(exc).__name__}')
            print(f'intraday snapshot unavailable for {market}: {exc}')
        cutoff=(now_kst.date()-timedelta(days=10)).isoformat()
        result[market]=[records[key] for key in sorted(records) if key[0]>=cutoff]
    return result,warnings

def main():
    previous={}
    if OUTPUT.exists():
        try: previous=json.loads(OUTPUT.read_text(encoding='utf-8')).get('stocks',{})
        except (OSError,json.JSONDecodeError): previous={}
    previous_intraday={}
    if OUTPUT.exists():
        try: previous_intraday=json.loads(OUTPUT.read_text(encoding='utf-8')).get('marketIntraday',{})
        except (OSError,json.JSONDecodeError): pass
    data={'updatedAt':datetime.now(timezone.utc).isoformat(),'startDate':START_DATE.isoformat(),'schemaVersion':2,'stockFlowBasis':FLOW_BASIS,'marketFlowBasis':'KRX','source':'Naver Finance: stock flow KRX+NXT; market intraday KRX; published issuer ownership ratio','stocks':{}}
    warnings=[]
    for code,name in STOCKS.items():
        previous_records=previous.get(code,{}).get('records',[])
        try: records=collect(code,previous_records)
        except Exception as exc:
            if not previous_records or any(r.get('flowBasis') != FLOW_BASIS for r in previous_records): raise
            records=previous_records
            warnings.append(f'{code}: {type(exc).__name__}')
            print(f'stock flow unavailable for {code}: {exc}')
        stock={'code':code,'name':name,'records':records}
        stock['historyStart'] = records[0]['date']
        stock['historyEnd'] = records[-1]['date']
        data['stocks'][code]=stock
    data['marketIntraday'],intraday_warnings=collect_intraday(previous_intraday)
    warnings.extend(intraday_warnings)
    if warnings: data['collectionWarnings']=warnings
    OUTPUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(', '.join(f"{v['name']} {len(v['records'])}" for v in data['stocks'].values()))
if __name__=='__main__': main()
