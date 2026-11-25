"""Monthly gold/macro research; genuine monthly averages, no forward filling.
Gold: World Bank via DataHub (1960+ only). S&P: Shiller/DataHub (1957+).
Rates and Nasdaq: FRED daily observations averaged within completed months.
All-or-nothing atomic snapshot: failed/shortened responses never replace history.
"""
import argparse
import csv
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import io
import json
import math
from pathlib import Path
import urllib.request

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
   req = urllib.request.Request(url, headers={'User-Agent':'FundingDashboard/1.0'})
   with urllib.request.urlopen(req,timeout=45) as response: text=response.read().decode('utf-8-sig')
  values = parse_monthly(text,col,start,month)
  if previous:
   old=previous['series'][key]['values']
   if not {r[0] for r in old}.issubset({r[0] for r in values}):
    raise ValueError('History regression: '+key)
  return key,{'source':label,'url':url,'frequency':'monthly-average','values':values}
 with ThreadPoolExecutor(max_workers=6) as pool: series=dict(pool.map(fetch,SOURCES.items()))
 payload={'schemaVersion':1,'updatedAt':now.isoformat(),'series':series}
 output.parent.mkdir(parents=True,exist_ok=True)
 temp=output.with_suffix('.tmp')
 temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 temp.replace(output)
 print({key:(v['values'][0][0],v['values'][-1][0],len(v['values'])) for key,v in series.items()})

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--input-dir');parser.add_argument('--output');args=parser.parse_args()
 collect(args.input_dir,args.output)
