"""Use HYPE Console daily chart data; keep burn-mechanism data separate."""
import datetime
import json
import math
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONSOLE = 'https://hype-console.serhiifotex.dev/?period=all'
BURNS = 'https://cryptoburntracker.com/api/v1/assets/hype/daily-burns?limit=6000'
SUMMARY = 'https://cryptoburntracker.com/api/v1/assets/hype/summary'

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Funding-Dashboard/1.0'}), timeout=30) as r:
        return r.read().decode()

def reconcile(html, burns, summary, official, today):
    # User-selected single chart source. Never substitute a second provider's daily values.
    matches = re.findall(r'\{date:"([0-9-]+)",hypeTokens:([0-9.eE+-]+),usdAmount:([0-9.eE+-]+),avgPrice:([0-9.eE+-]+),closePrice:([0-9.eE+-]+)\}', html)
    rows=[];seen=set()
    for day,hype,usd,average,close in matches:
        datetime.date.fromisoformat(day)
        values=list(map(float,[hype,usd,average,close]))
        if day in seen or day>today or any(not math.isfinite(v) or v<0 for v in values):
            raise ValueError('Invalid Console daily row')
        seen.add(day)
        rows.append({'date':day,'hype':values[0],'usd':values[1],'closePrice':values[3] if values[3]>0 else None,'partial':day>=today,'source':'hype-console'})
    if len(rows)<300: raise ValueError('Archive coverage unexpectedly small')
    if (datetime.date.fromisoformat(today)-datetime.date.fromisoformat(max(seen))).days>2: raise ValueError('Stale archive')
    mechanisms=summary['data']['mechanismBreakdown']
    return {'schemaVersion':2,'chartSource':'hype-console','fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':sorted(rows,key=lambda r:r['date']),
      'mechanisms':[{'id':r['mechanismId'],'name':r['displayName'],'hype':float(r['amountDecimal']),'from':r.get('coverageAvailableFrom'),'note':r.get('coverageNote')} for r in mechanisms],
      'burnDaily':[{'date':r['date'],'mechanism':r['mechanismId'],'hype':float(r['amountDecimal'])} for r in burns['data'] if r['mechanismId']!='hype-assistance-fund'],
      'sources':{'console':CONSOLE,'burns':'https://cryptoburntracker.com/burns/hyperliquid/'}}

def main():
    path=ROOT/'data/hype-history.json'
    html=fetch(CONSOLE)
    # A separate burn-detail source must not block the selected chart feed.
    burn_error=False
    try:
        burns=json.loads(fetch(BURNS));summary=json.loads(fetch(SUMMARY))
    except Exception:
        burns={'data':[]};summary={'data':{'mechanismBreakdown':[]}};burn_error=True
    data=reconcile(html,burns,summary,{},datetime.datetime.now(datetime.timezone.utc).date().isoformat())
    if burn_error and path.exists():
        old=json.loads(path.read_text())
        for key in ['mechanisms','burnDaily']:data[key]=old.get(key,[])
        data['burnDetailsAsOf']=old.get('burnDetailsAsOf',old.get('fetchedAt'))
    else:data['burnDetailsAsOf']=data['fetchedAt']
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,separators=(',',':'))+'\n');tmp.replace(path)
    print('Saved',len(data['rows']),'Console historical days')
if __name__=='__main__':main()
