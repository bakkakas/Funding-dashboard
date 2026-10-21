#!/usr/bin/env python3
"""Cache public EPS history where cloud-runtime HTML retrieval is unreliable."""
import datetime as dt
import json
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
import time

ROOT = Path(__file__).resolve().parents[1]
ISSUERS = {'stock-googl':'GOOGL','stock-amzn':'AMZN','stock-nke':'NKE','stock-novo-nordisk':'NVO'}
PARSER = """import {yahooEarnings} from './js/earnings-data.js';
let html='';for await(const chunk of process.stdin)html+=chunk;
console.log(JSON.stringify(yahooEarnings(html)));"""

def main():
    directory=ROOT/'data/earnings-comparison';directory.mkdir(parents=True,exist_ok=True)
    failed=[]
    for issuer,ticker in ISSUERS.items():
        try:
            url=f'https://finance.yahoo.com/quote/{ticker}/analysis/'
            request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html'})
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request,timeout=25) as response:html=response.read().decode()
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in (429,500,502,503,504) or attempt==2:raise
                    time.sleep(attempt+1)
            parsed=subprocess.run(['node','--input-type=module','-e',PARSER],input=html,text=True,capture_output=True,check=True,cwd=ROOT)
            rows=json.loads(parsed.stdout)
            if len(rows)<2:raise ValueError('Too few comparable quarters')
            data={'schemaVersion':1,'source':'Yahoo Finance · Earnings History','url':url,'asOf':dt.datetime.now(dt.timezone.utc).isoformat(),'rows':rows,'note':'동일 출처의 같은 분기 예상 EPS와 실제 EPS를 비교합니다. 통화·GAAP/조정 기준은 아래 표에 표시해요. 매출·영업이익의 발표 전 예상치는 이 출처에서 미제공입니다. 분기말은 발표일이 아닙니다.'}
            (directory/f'{issuer}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            print(issuer,len(rows),rows[0]['period'])
        except Exception as error:
            print(issuer,'FAILED',str(error));failed.append(issuer)
    if failed:raise SystemExit(1)
if __name__=='__main__':main()
