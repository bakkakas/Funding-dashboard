#!/usr/bin/env python3
"""Import a reviewed public MarketScreener readable-page capture.

Input JSON: {url, asOf, text}; preserve the fetch timestamp, never today's date.
No access-control workarounds; normal HTTP may be unavailable. See docs/earnings-sources.md.
"""
from pathlib import Path
import argparse
import json
import re
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
ISSUERS={'googl':'24203373','amzn':'12864605','nke':'13739','novo-nordisk':'13835'}

def parse_capture(d, id):
 host=urlparse(d['url']).hostname or ''
 if not host.endswith('.marketscreener.com') or ISSUERS[id] not in d['url']:
  raise ValueError('Wrong issuer/source URL')
 if not re.match(r'^20\d{2}-\d{2}-\d{2}T',d['asOf']):raise ValueError('Original capture timestamp required')
 text=d['text'];q=text.split('### Quarterly results')[1]
 if not any('Fiscal Period'+month in text.split('### Quarterly results')[0] for month in ['May','December']):raise ValueError('Unknown fiscal year end')
 endMonth=5 if 'Fiscal PeriodMay' in text.split('### Quarterly results')[0] else 12
 if (id=='nke') != (endMonth==5):raise ValueError('Unexpected issuer fiscal year end')
 periods=re.findall(r'(20\d{2}) Q([1-4])',q.split('Net sales')[0]);rows=[]
 for year,quarter in periods:
  k=int(year)*12+endMonth-1-(4-int(quarter))*3
  rows.append({'period':f'{k//12:04}-{k%12+1:02}','fiscalPeriod':f'FY{year} Q{quarter}','basis':'MarketScreener 분기 발표·컨센서스 (제공처 기준)','directComparison':True,'metrics':[]})
 for label,nextlabel,metric in [('Net sales','EBITDA','매출액'),('EBIT','Earnings before Tax (EBT)','EBIT'),('Net income','EPS','순이익')]:
  section=q.split('\n '+label+'\n',1)[1].split('\n '+nextlabel+'\n',1)[0]
  currency=re.search(r'Million ([A-Z]{3})',section)[1]
  if currency!=('DKK' if id=='novo-nordisk' else 'USD'):raise ValueError('Unexpected reporting currency')
  body=section.split('Spread\n',1)[1].strip()
  chunks=body.split('%');released=len(chunks)-1
  for i,chunk in enumerate(chunks[:-1]):
   lines=chunk.strip().splitlines()
   if len(lines)!=3:raise ValueError((id,label,i,lines))
   actual,estimate,spread=[float(x.replace(' ','').replace(',','.')) for x in lines]
   if estimate:
    possibilities=[(a-e)/abs(e)*100 for a in [actual-.5,actual+.5] for e in [estimate-.5,estimate+.5] if e]
    if not min(possibilities)-.02<=spread<=max(possibilities)+.02:raise ValueError((id,label,i,'alignment verification failed',actual,estimate,spread))
   rows[i]['metrics'].append({'label':metric,'actual':actual,'estimate':estimate,'unit':currency+'(백만)','announcedAt':None})
  forecasts=chunks[-1].strip().splitlines()
  # Retain only the two immediately following forecasts reviewed in this source snapshot.
  for j,value in enumerate(forecasts[:2]):
   rows[released+j]['metrics'].append({'label':metric,'actual':None,'estimate':float(value.replace(' ','').replace(',','.')),'unit':currency+'(백만)','announcedAt':None})
 rows=[r for r in rows if r['metrics']]
 for r in rows:r.update(source='MarketScreener',url=d['url'],asOf=d['asOf'])
 out={'schemaVersion':1,'source':'MarketScreener · Quarterly results','url':d['url'],'asOf':d['asOf'],'rows':rows,'note':'매출·순이익·EBIT의 예상/발표 수치는 같은 제공처의 같은 회계분기를 사용합니다. EBIT는 영업이익과 다른 지표로 구분합니다. 확정 재무제표·다른 출처의 조정 실적과 다를 수 있습니다.','refreshMode':'verified-snapshot'}

 return out

def main():
 parser=argparse.ArgumentParser();parser.add_argument("issuer",choices=ISSUERS);parser.add_argument("capture",type=Path);args=parser.parse_args()
 data=parse_capture(json.loads(args.capture.read_text()),args.issuer)
 (ROOT/"data/earnings-comparison"/("stock-"+args.issuer+"-fundamentals.json")).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
if __name__=="__main__":main()
