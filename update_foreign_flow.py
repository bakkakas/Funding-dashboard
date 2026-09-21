#!/usr/bin/env python3
import json, re, time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

START_DATE=date(2016,1,1); OUTPUT=Path(__file__).with_name('foreign_flow_data.json')
STOCKS={'005930':'삼성전자','000660':'SK하이닉스'}
MARKETS=('KOSPI','KOSDAQ')
KST=timezone(timedelta(hours=9))

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.target=self.caption=self.row=self.cell=False; self.cap=''; self.cells=[]; self.buf=[]; self.rows=[]
    def handle_starttag(self,tag,attrs):
        if tag=='caption' and not self.target: self.caption=True; self.cap=''
        elif tag=='tr' and self.target: self.row=True; self.cells=[]
        elif tag=='td' and self.row: self.cell=True; self.buf=[]
    def handle_endtag(self,tag):
        if tag=='caption' and self.caption:
            self.caption=False; self.target='외국인 기관 순매매 거래량' in self.cap
        elif tag=='td' and self.cell:
            self.cells.append(' '.join(''.join(self.buf).split())); self.cell=False
        elif tag=='tr' and self.row:
            if len(self.cells)==9 and re.fullmatch(r'\d{4}\.\d{2}\.\d{2}',self.cells[0]): self.rows.append(self.cells)
            self.row=False
        elif tag=='table' and self.target: self.target=False
    def handle_data(self,data):
        if self.caption: self.cap+=data
        if self.cell: self.buf.append(data)

def num(value,pct=False):
    value=value.replace(',','').replace('%','').replace('+','').strip()
    return (float(value) if pct else int(value)) if value and value!='N/A' else None

def fetch(code,page):
    req=Request(f'https://finance.naver.com/item/frgn.naver?code={code}&page={page}',headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0'})
    with urlopen(req,timeout=20) as res: html=res.read().decode('euc-kr',errors='replace')
    parser=Parser(); parser.feed(html); return parser.rows

def fetch_live_snapshot(code):
    req=Request(f'https://m.stock.naver.com/api/stock/{code}/integration',headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0','Referer':'https://m.stock.naver.com/'})
    with urlopen(req,timeout=20) as res: payload=json.load(res)
    infos={item.get('code'):item.get('value') for item in payload.get('totalInfos',[])}
    ownership=num(infos.get('foreignRate',''),True)
    return {'foreignOwnershipPct':ownership,'fetchedAt':datetime.now(timezone.utc).isoformat()}

def parse_stock_trend_row(row):
    bizdate=str(row.get('bizdate',''))
    if not re.fullmatch(r'\d{8}',bizdate): raise ValueError('Missing stock flow business date')
    institution=num(row.get('organPureBuyQuant',''))
    foreign=num(row.get('foreignerPureBuyQuant',''))
    if institution is None or foreign is None: raise ValueError('Incomplete stock flow values')
    return {
        'date':datetime.strptime(bizdate,'%Y%m%d').date().isoformat(),
        'close':num(row.get('closePrice','')),
        'volume':num(str(row.get('accumulatedTradingVolume',''))),
        'institutionNetShares':institution,
        'foreignNetShares':foreign,
        'individualNetSharesEstimated':-(institution+foreign),
        'foreignHeldShares':None,
        'foreignOwnershipPct':num(row.get('foreignerHoldRatio',''),True),
    }

def fetch_recent_stock_trends(code):
    req=Request(f'https://m.stock.naver.com/api/stock/{code}/trend?pageSize=60',headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0','Referer':f'https://m.stock.naver.com/domestic/stock/{code}/total'})
    with urlopen(req,timeout=20) as res: payload=json.load(res)
    return [parse_stock_trend_row(row) for row in payload]

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
    records={r['date']:r for r in (existing or [])}
    fully_backfilled=bool(records) and min(records)<=START_DATE.isoformat()
    newest_existing=max(records) if records else None
    if fully_backfilled:
        pages=[]
    else:
        with ThreadPoolExecutor(max_workers=8) as pool:
            pages=list(enumerate(pool.map(lambda page:fetch(code,page),range(1,181)),start=1))
    for page,rows in pages:
        if not rows: break
        days=[]
        for r in rows:
            day=datetime.strptime(r[0],'%Y.%m.%d').date(); days.append(day)
            if day<START_DATE: continue
            institution=num(r[5]); foreign=num(r[6])
            records[day.isoformat()]={'date':day.isoformat(),'close':num(r[1]),'volume':num(r[4]),'institutionNetShares':institution,'foreignNetShares':foreign,'individualNetSharesEstimated':-(institution+foreign),'foreignHeldShares':num(r[7]),'foreignOwnershipPct':num(r[8],True)}
        if min(days)<START_DATE: break
        if fully_backfilled and newest_existing and min(days).isoformat()<=newest_existing: break
    for row in fetch_recent_stock_trends(code):
        existing_row=records.get(row['date'],{})
        if row['foreignHeldShares'] is None and existing_row.get('foreignHeldShares') is not None:
            row['foreignHeldShares']=existing_row['foreignHeldShares']
        records[row['date']]=row
    if not records: raise RuntimeError(f'No rows collected for {code}')
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
    data={'updatedAt':datetime.now(timezone.utc).isoformat(),'startDate':START_DATE.isoformat(),'source':'Naver Finance mobile API (KRX-based daily and intraday data)','stocks':{}}
    warnings=[]
    for code,name in STOCKS.items():
        previous_records=previous.get(code,{}).get('records',[])
        try: records=collect(code,previous_records)
        except Exception as exc:
            if not previous_records: raise
            records=previous_records
            warnings.append(f'{code}: {type(exc).__name__}')
            print(f'stock flow unavailable for {code}: {exc}')
        stock={'code':code,'name':name,'records':records}
        try: stock['liveSnapshot']=fetch_live_snapshot(code)
        except Exception as exc: print(f'live snapshot unavailable for {code}: {exc}')
        data['stocks'][code]=stock
    data['marketIntraday'],intraday_warnings=collect_intraday(previous_intraday)
    warnings.extend(intraday_warnings)
    if warnings: data['collectionWarnings']=warnings
    OUTPUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(', '.join(f"{v['name']} {len(v['records'])}" for v in data['stocks'].values()))
if __name__=='__main__': main()
