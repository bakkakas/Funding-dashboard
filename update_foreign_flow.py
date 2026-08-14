#!/usr/bin/env python3
import json, re, time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

START_DATE=date(2016,1,1); OUTPUT=Path(__file__).with_name('foreign_flow_data.json')
STOCKS={'005930':'삼성전자','000660':'SK하이닉스'}

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

class IntradayParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.row=self.cell=False; self.cells=[]; self.buf=[]; self.rows=[]
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.row=True; self.cells=[]
        elif tag=='td' and self.row: self.cell=True; self.buf=[]
    def handle_endtag(self,tag):
        if tag=='td' and self.cell:
            self.cells.append(' '.join(''.join(self.buf).split())); self.cell=False
        elif tag=='tr' and self.row:
            if len(self.cells)>=4 and re.fullmatch(r'\d{2}:\d{2}',self.cells[0]): self.rows.append(self.cells)
            self.row=False
    def handle_data(self,data):
        if self.cell: self.buf.append(data)

def num(value,pct=False):
    value=value.replace(',','').replace('%','').replace('+','').strip()
    return (float(value) if pct else int(value)) if value and value!='N/A' else None

def fetch(code,page):
    req=Request(f'https://finance.naver.com/item/frgn.naver?code={code}&page={page}',headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0'})
    with urlopen(req,timeout=20) as res: html=res.read().decode('euc-kr',errors='replace')
    parser=Parser(); parser.feed(html); return parser.rows

def collect(code, existing=None):
    records={r['date']:r for r in (existing or [])}
    fully_backfilled=bool(records) and min(records)<=START_DATE.isoformat()
    newest_existing=max(records) if records else None
    if fully_backfilled:
        pages=[(1,fetch(code,1))]
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
    if not records: raise RuntimeError(f'No rows collected for {code}')
    return [records[k] for k in sorted(records)]

def collect_intraday(previous):
    now_kst=datetime.now(timezone(timedelta(hours=9)))
    bizdate=now_kst.strftime('%Y%m%d')
    result={}
    for market,sosok in {'KOSPI':'','KOSDAQ':'02'}.items():
        records={(r['date'],r['time']):r for r in previous.get(market,[]) if r.get('date') and r.get('time') and int(r['time'].split(':')[1])%15==0}
        candidates={}
        for page in range(1,21):
            req=Request(f'https://finance.naver.com/sise/investorDealTrendTime.naver?bizdate={bizdate}&sosok={sosok}&page={page}',headers={'User-Agent':'Mozilla/5.0 FundingDashboard/1.0'})
            with urlopen(req,timeout=20) as res: html=res.read().decode('euc-kr',errors='replace')
            parser=IntradayParser(); parser.feed(html)
            if not parser.rows: break
            for row in parser.rows:
                hour,minute=map(int,row[0].split(':'))
                quarter=round((hour*60+minute)/15)*15
                bucket=f'{quarter//60:02d}:{quarter%60:02d}'
                distance=abs(hour*60+minute-quarter)
                if bucket not in candidates or distance<candidates[bucket][0]: candidates[bucket]=(distance,row)
        today=now_kst.date().isoformat()
        for bucket,(_,row) in candidates.items():
            records[(today,bucket)]={'date':today,'time':bucket,'sourceTime':row[0],'individual':num(row[1]),'foreign':num(row[2]),'institution':num(row[3])}
        cutoff=(now_kst.date()-timedelta(days=10)).isoformat()
        result[market]=[records[key] for key in sorted(records) if key[0]>=cutoff]
    return result

def main():
    previous={}
    if OUTPUT.exists():
        try: previous=json.loads(OUTPUT.read_text(encoding='utf-8')).get('stocks',{})
        except (OSError,json.JSONDecodeError): previous={}
    previous_intraday={}
    if OUTPUT.exists():
        try: previous_intraday=json.loads(OUTPUT.read_text(encoding='utf-8')).get('marketIntraday',{})
        except (OSError,json.JSONDecodeError): pass
    data={'updatedAt':datetime.now(timezone.utc).isoformat(),'startDate':START_DATE.isoformat(),'source':'Naver Finance (KRX-based daily and intraday data)','stocks':{}}
    for code,name in STOCKS.items(): data['stocks'][code]={'code':code,'name':name,'records':collect(code,previous.get(code,{}).get('records',[]))}
    data['marketIntraday']=collect_intraday(previous_intraday)
    OUTPUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(', '.join(f"{v['name']} {len(v['records'])}" for v in data['stocks'].values()))
if __name__=='__main__': main()
