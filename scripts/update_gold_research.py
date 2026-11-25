"""Monthly gold/macro research; genuine monthly averages, no forward filling.
Gold: World Bank via DataHub (1960+ only). S&P: Shiller/DataHub (1957+).
Rates and Nasdaq: FRED daily observations averaged within completed months.
All-or-nothing atomic snapshot: failed/shortened responses never replace history.
"""
import argparse
import csv
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import calendar
import io
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
 'gold': ('https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv', 'Price', '1960-01', 'World Bank / DataHub · 월평균'),
 'sp500': ('https://raw.githubusercontent.com/datasets/s-and-p-500/master/data/data.csv', 'SP500', '1957-03', 'Shiller / DataHub · 월평균 가격지수'),
 **{key: (f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={key}', key, start, f'FRED {key} · 일별 관측값의 월평균') for key,start in [('DGS10','1962-01'),('DFF','1954-07'),('DFII10','2003-01'),('NASDAQCOM','1971-02')]}
}

def parse_monthly(text, column, start, current_month):
 rows = csv.DictReader(io.StringIO(text))
 if not rows.fieldnames or column not in rows.fieldnames:
  raise ValueError('Missing CSV column: '+column)
 groups = defaultdict(list)
 for row in rows:
  date = row.get('Date', row.get('observation_date', ''))
  month = date[:7]
  try:
   datetime.strptime(month, '%Y-%m')
  except ValueError:
   raise ValueError('Invalid observation date')
  if month < start or month >= current_month: continue
  raw = row.get(column, '')
  if raw in ('', '.', None): continue
  value = float(raw)
  if not math.isfinite(value) or (column not in ('DGS10','DFF','DFII10') and value <= 0):
   raise ValueError('Invalid observation')
  groups[month].append(value)
 result = [[m, round(sum(v)/len(v), 6)] for m,v in sorted(groups.items())]
 if len(result) < 120: raise ValueError('Insufficient history: '+column)
 return result

def download_text(url):
 # curl negotiates the FRED transport reliably on macOS and GitHub runners.
 # Public unauthenticated CSV only; normal HTTP errors remain failures.
 result = subprocess.run(['curl','--fail','--location','--silent','--show-error',
                          '--max-time','30','--retry','2','--retry-delay','2',url],
                         capture_output=True,check=True,timeout=105)
 return result.stdout.decode('utf-8-sig')

def parse_target_daily(text, column):
 rows=csv.DictReader(io.StringIO(text))
 if not rows.fieldnames or column not in rows.fieldnames: raise ValueError('Missing target column')
 result={}
 for row in rows:
  day=row.get('observation_date','')
  if datetime.strptime(day,'%Y-%m-%d').strftime('%Y-%m-%d')!=day: raise ValueError('Bad target date')
  raw=row[column]
  if raw in ('','.'): continue
  value=float(raw)
  if not math.isfinite(value) or value<0 or day in result: raise ValueError('Invalid target observation')
  result[day]=value
 if not result: raise ValueError('Empty target history')
 return result

def target_series(texts, current_month):
 old=parse_target_daily(texts['DFEDTAR'],'DFEDTAR')
 low=parse_target_daily(texts['DFEDTARL'],'DFEDTARL')
 high=parse_target_daily(texts['DFEDTARU'],'DFEDTARU')
 if set(low)!=set(high): raise ValueError('Target bounds dates differ')
 if min(low)!='2008-12-16' or max(old)!='2008-12-15': raise ValueError('Target regime boundary mismatch')
 if any(low[d]>high[d] for d in low): raise ValueError('Inverted target range')
 daily={**old,**{d:(low[d]+high[d])/2 for d in low}}
 last=max(daily)
 day=datetime(1982,10,1)
 while day.strftime('%Y-%m-%d')<=last:
  if day.strftime('%Y-%m-%d') not in daily: raise ValueError('Missing target day')
  day+=timedelta(days=1)
 groups=defaultdict(list)
 for day,value in sorted(daily.items()):
  month=day[:7]
  if '1982-10'<=month<current_month: groups[month].append(value)
 values=[]
 for month,points in sorted(groups.items()):
  y,m=map(int,month.split('-'))
  if len(points)!=calendar.monthrange(y,m)[1]: raise ValueError('Incomplete target month')
  values.append([month,round(sum(points)/len(points),6)])
 if len(values)<120: raise ValueError('Insufficient target history')
 return {'source':'FRED DFEDTAR / DFEDTARL / DFEDTARU · 목표금리 중간값 월평균',
  'url':'https://fred.stlouisfed.org/series/DFEDTARU','frequency':'monthly-average',
  'values':values,'latestRange':{'date':last,'lower':low[last],'upper':high[last]},
  'note':'1982–1993년은 FRED의 연구 기반 복원 목표금리. 2008-12-16부터 목표 범위 중간값. 첫 완전한 달인 1982-10부터 제공.'}


def collect(input_dir=None, output=None):
 now = datetime.now(timezone.utc)
 month = now.strftime('%Y-%m')
 output = Path(output or ROOT/'data/gold-research.json')
 previous = json.loads(output.read_text()) if output.exists() else None
 def fetch(item):
  key,(url,col,start,label) = item
  if input_dir:
   text = (Path(input_dir)/(key+'.csv')).read_text()
  else:
   print('Downloading '+key,flush=True)
   text = download_text(url)
  values = parse_monthly(text,col,start,month)
  if previous:
   old=previous['series'][key]['values']
   if not {r[0] for r in old}.issubset({r[0] for r in values}):
    raise ValueError('History regression: '+key)
  return key,{'source':label,'url':url,'frequency':'monthly-average','values':values}
 with ThreadPoolExecutor(max_workers=6) as pool: series=dict(pool.map(fetch,SOURCES.items()))
 target_ids=['DFEDTAR','DFEDTARL','DFEDTARU']
 def read_target(key):
  return key,(Path(input_dir)/(key+'.csv')).read_text() if input_dir else download_text('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+key)
 with ThreadPoolExecutor(max_workers=3) as pool: texts=dict(pool.map(read_target,target_ids))
 series['FEDTARGET']=target_series(texts,month)
 if previous and 'FEDTARGET' in previous['series']:
  old=previous['series']['FEDTARGET'];new=series['FEDTARGET']
  if not {r[0] for r in old['values']}.issubset({r[0] for r in new['values']}) or new['latestRange']['date']<old['latestRange']['date']:
   raise ValueError('Target history regression')
 payload={'schemaVersion':1,'updatedAt':now.isoformat(),'series':series}
 output.parent.mkdir(parents=True,exist_ok=True)
 temp=output.with_suffix('.tmp')
 temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 temp.replace(output)
 print({key:(v['values'][0][0],v['values'][-1][0],len(v['values'])) for key,v in series.items()})

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--input-dir');parser.add_argument('--output');args=parser.parse_args()
 collect(args.input_dir,args.output)
