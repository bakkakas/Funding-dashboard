#!/usr/bin/env python3
"""Market-wide KRX net trading amounts (KRW), not share counts. Atomic per-market refresh."""
import json, math, time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'market_flow_data.json'
START='2016-01-01'
KST=timezone(timedelta(hours=9))

def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://stock.naver.com/'}),timeout=25) as r:return json.load(r)
        except Exception:
            if attempt==2:raise
            time.sleep(1)

def parse_volume_xml(text):
    result={}
    for item in ET.fromstring(text).findall('.//item'):
        fields=item.attrib['data'].split('|')
        if len(fields)!=6:raise ValueError('Invalid index candle')
        day=datetime.strptime(fields[0],'%Y%m%d').date().isoformat()
        volume=int(fields[5])
        if volume<0 or day in result:raise ValueError('Invalid index volume')
        result[day]=volume
    if not result:raise ValueError('No index volumes')
    return result

def collect_volume(market,count=5000):
    url=f'https://fchart.stock.naver.com/sise.nhn?symbol={market}&timeframe=day&count={count}&requestType=0'
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r:
                return parse_volume_xml(r.read().decode('euc-kr'))
        except Exception:
            if attempt==2:raise
            time.sleep(1)

def amount(v):
    if v is None or isinstance(v,bool):raise ValueError('Missing amount')
    n=int(str(v).replace(',',''))
    if abs(n)>10**16:raise ValueError('Amount out of range')
    return n

TRADING_CODES={'1000','2000','3000','3100','4000','5000','6000','7000','7100','8000','9000','9001'}
def trading_value(items):
    # One side only: buy + sell would double-count traded consideration.
    # Provider reports each investor amount rounded to KRW million.
    if set(items)!=TRADING_CODES:return None
    try:
        buys=[amount(items[code]['buyPrice']) for code in sorted(TRADING_CODES)]
        sells=[amount(items[code]['sellPrice']) for code in sorted(TRADING_CODES)]
        if min(buys+sells)<0:return None
        if abs(sum(buys)-sum(sells))>len(TRADING_CODES)*1_000_000:return None
        return sum(buys)
    except (ValueError,KeyError,TypeError):return None

def parse_row(row):
    day=datetime.strptime(row['bizdate'],'%Y%m%d').date().isoformat()
    items={r['investorGubun']:r for r in row['netAmounts']}
    # 9000 foreign investors; 9001 other foreigners is deliberately separate.
    out={'date':day,'tradingValueKRW':trading_value(items)}
    for key,code in [('foreignNetKRW','9000'),('individualNetKRW','8000')]:
        r=items[code];v=amount(r['diffValue'])
        if amount(r['buyPrice'])-amount(r['sellPrice'])!=v:raise ValueError('Buy/sell reconciliation failed')
        out[key]=v
    institution=[]
    for code in ('1000','2000','3000','3100','4000','5000','6000','7000'):
        r=items.get(code)
        if r is None:raise ValueError('Missing institutional component: '+code)
        v=amount(r['diffValue'])
        if amount(r['buyPrice'])-amount(r['sellPrice'])!=v:raise ValueError('Institution reconciliation failed')
        institution.append(v)
    out['institutionNetKRW']=sum(institution)
    out['otherForeignNetKRW']=amount(items['9001']['diffValue']) if '9001' in items else None
    return out

def collect(market,existing):
    now=datetime.now(KST)
    records={r['date']:r for r in existing}
    since=(date.fromisoformat(max(records))-timedelta(days=30)).isoformat() if records else START
    if any('institutionNetKRW' not in r or 'tradingValueKRW' not in r for r in existing):since=START
    seen=set()
    for page in range(80):
        payload=get('https://stock.naver.com/api/domestic/market/trend/daily?'+urlencode({'tradeType':'KRX','marketType':market,'bizdate':now.strftime('%Y%m%d'),'startIdx':page,'pageSize':100}))
        rows=[parse_row(r) for r in payload['content']]
        if not rows:break
        signature=tuple(r['date'] for r in rows)
        if signature in seen:raise ValueError('Repeated pagination')
        seen.add(signature)
        # Exclude today's provisional intraday observation from daily history.
        for r in rows:
            if START<=r['date']<now.date().isoformat():records[r['date']]=r
        if min(r['date'] for r in rows)<=since or payload.get('last') is True:break
    else:raise ValueError('Pagination limit')
    if not records:raise ValueError('No completed daily records')
    # Refresh and join index closes by date, never by list position.
    price_since=since if existing else min(records)
    prices={r['date']:r.get('close') for r in existing if r.get('close') is not None}
    if not prices:price_since=min(records)
    for page in range(1,81):
        try:
            rows=get(f'https://m.stock.naver.com/api/index/{market}/price?pageSize=60&page={page}')
        except Exception as exc:
            print(f'{market} price history stopped at page {page}: {type(exc).__name__}', flush=True)
            break
        if not rows:break
        for r in rows:
            v=float(r['closePrice'].replace(',',''))
            if not math.isfinite(v) or v<=0:raise ValueError('Invalid index price')
            prices[r['localTradedAt']]=v
        if rows[-1]['localTradedAt']<=price_since:break
    # Naver index chart volume is in thousands of shares, not KRW turnover.
    volumes={r['date']:r['volumeThousandShares'] for r in existing if r.get('volumeThousandShares') is not None}
    try:volumes.update(collect_volume(market,100 if existing and all(r.get('volumeThousandShares') is not None for r in existing) else 5000))
    except Exception as exc:print(f'{market} volume history unavailable: {type(exc).__name__}',flush=True)
    for day,r in records.items():
        r['close']=prices.get(day)
        r['volumeThousandShares']=volumes.get(day)
    return [records[k] for k in sorted(records)]

def main():
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {'markets':{}}
    result={'updatedAt':datetime.now(KST).isoformat(),'source':'Naver Finance','sourceUrl':'https://stock.naver.com/market/stock/kr/trend/trader','basis':'KRX','volumeSource':'Naver index daily candle','volumeSourceUrl':'https://fchart.stock.naver.com/sise.nhn','volumeUnit':'thousand shares','tradingValueDefinition':'전체 12개 투자주체 매수금액 합계 (매도합계 대조, 백만원 반올림 오차 허용); 매수+매도 합산 아님','unit':'KRW','foreignDefinition':'9000 (외국인), 기타외국인(9001) 제외','ownershipStatus':'unavailable','markets':{}}
    warnings=[]
    for market in ('KOSPI','KOSDAQ'):
        old=previous['markets'].get(market,{}).get('records',[])
        try:rows=collect(market,old)
        except Exception as e:
            if not old:raise
            rows=old;warnings.append(f'{market}: {type(e).__name__}')
        result['markets'][market]={'records':rows,'historyStart':rows[0]['date'],'historyEnd':rows[-1]['date']}
        print(market,len(rows),rows[0]['date'],rows[-1]['date'],flush=True)
    if warnings:result['collectionWarnings']=warnings
    temp=OUTPUT.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(OUTPUT)
if __name__=='__main__':main()
