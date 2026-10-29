#!/usr/bin/env python3
"""Refresh public KR consensus / US EPS caches; retain prior files on source failure."""
import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
import time
from tradingview_earnings import collect_otly
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ISSUERS = {'stock-googl':'GOOGL','stock-amzn':'AMZN','stock-nke':'NKE','stock-novo-nordisk':'NVO','stock-otly':'OTLY'}
DOMESTIC = ['005380','263750','005930','000660']

def get(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=25) as response:return response.read().decode()
        except urllib.error.HTTPError as error:
            if error.code not in (429,500,502,503,504) or attempt==2:raise
            time.sleep(attempt+1)

def parse(function, payload):
    parser=f"import {{{function}}} from './js/earnings-data.js';let input='';for await(const chunk of process.stdin)input+=chunk;console.log(JSON.stringify({function}({ 'JSON.parse(input)' if function!='yahooEarnings' else 'input' })));"
    return json.loads(subprocess.run(['node','--input-type=module','-e',parser],input=payload,text=True,capture_output=True,check=True,cwd=ROOT).stdout)

def collect_kr(code, annual=False):
    date=dt.datetime.now(ZoneInfo('Asia/Seoul')).strftime('%Y%m%d')
    payloads=[]
    for label,acc in [('매출액','121000'),('영업이익','121500'),('지배주주 순이익','122700')]:
        url=f'https://comp.wisereport.co.kr/company/ajax/c1050001_data.aspx?flag=5&cmp_cd={code}&finGubun=IFRSL&frq={0 if annual else 1}&sDT={date}&acc_cd={acc}&chartType=svg'
        payloads.append({'label':label,'data':json.loads(get(url))})
    rows=parse('wiseAnnualEarnings' if annual else 'wiseEarnings',json.dumps(payloads))
    if any(not any(m['label']==label and m['estimate'] is not None for r in rows for m in r['metrics']) for label in ['매출액','영업이익','지배주주 순이익']):
        raise ValueError('Incomplete consensus; retaining previous snapshot')
    return {'source':'WiseReport · FnGuide','url':f'https://comp.wisereport.co.kr/company/c1050001.aspx?cmp_cd={code}&cn=','rows':rows,'note':'발표직전 예상치와 최초 잠정/실적 발표치를 제공합니다. 미발표 분기는 현재 예상치이며, 확정 실적과 잠정치는 다를 수 있습니다.'}

def collect_us(ticker):
    url=f'https://finance.yahoo.com/quote/{ticker}/analysis/'
    return {'source':'Yahoo Finance · Earnings History','url':url,'rows':parse('yahooEarnings',get(url)),'note':'동일 출처·동일 통화·GAAP/조정 기준의 예상 EPS와 실제 EPS를 비교합니다. 매출·순이익·EBIT는 별도 출처의 저장 자료를 사용합니다.'}

def collect_annual(code):
    kr=code in DOMESTIC
    url=f'https://m.stock.naver.com/api/stock/{code}/finance/annual' if kr else f'https://api.stock.naver.com/stock/{code}/finance/income/annual'
    raw=json.loads(get(url));f=raw.get('financeInfo',raw)
    rows=[]
    for title in f.get('trTitleList',[]):
        if title['isConsensus']!='N':continue
        metrics=[]
        for item in f.get('rowList',[]):
            if item['title'] not in ['매출액','매출','영업이익','순이익','당기순이익','지배주주순이익','지배주주 순이익']:continue
            value=item.get('columns',{}).get(title['key'],{}).get('value')
            if value in (None,'','-','N/A'):continue
            metrics.append({'label':item['title'],'value':float(str(value).replace(',',''))})
        year=title['key'][:4]
        rows.append({'key':year,'period':year,'metrics':metrics})
    if len(rows)<2:raise ValueError('Annual financials unavailable')
    result=collect_kr(code,True) if kr else {'source':'Naver Finance · 연간 재무제표','url':url,'rows':[]}
    result.update(quarters=sorted(rows,key=lambda r:r['key'],reverse=True),financialUnit='억 KRW' if kr else raw['unit'],fiscalYearEnd=5 if code=='NKE' else 12)
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--annual-only',action='store_true');parser.add_argument('--market',choices=['KR','US','all'],default='all');args=parser.parse_args()
    directory=ROOT/'data/earnings-comparison';directory.mkdir(parents=True,exist_ok=True)
    jobs=[]
    if args.market!='US':jobs += [('stock-'+code,collect_kr,code) for code in DOMESTIC]
    if args.market!='KR':jobs += [(issuer,collect_us,ticker) for issuer,ticker in ISSUERS.items() if ticker!='OTLY'] + [('stock-otly-fundamentals',collect_otly,'OTLY')]
    if args.annual_only:jobs=[]
    if args.market!='US':jobs += [('stock-'+code+'-annual',collect_annual,code) for code in DOMESTIC]
    if args.market!='KR':jobs += [(issuer+'-annual',collect_annual,ticker+('.O' if ticker in ('GOOGL','AMZN','OTLY') else '')) for issuer,ticker in ISSUERS.items()]
    failed=[]
    for issuer,collect,ticker in jobs:
        try:
            data=collect(ticker)
            previous=directory/f'{issuer}.json'
            if issuer=='stock-otly-fundamentals' and 'annual' not in data and previous.exists():
                annual=json.loads(previous.read_text()).get('annual')
                if annual:data['annual']=annual # preserve original timestamp; annual is a reviewed snapshot
            if len(data.get('quarters',data['rows']))<2:raise ValueError('Too few comparable quarters')
            data.update(schemaVersion=1,asOf=dt.datetime.now(dt.timezone.utc).isoformat())
            (directory/f'{issuer}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            print(issuer,len(data['rows']),(data['rows'] or data['quarters'])[0]['period'])
        except Exception as error:
            print(issuer,'FAILED',str(error));failed.append(issuer)
    if failed:raise SystemExit(1)
if __name__=='__main__':main()
