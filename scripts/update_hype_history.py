"""Reconcile secondary archive sources, keeping USD unknown on disagreement."""
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
    matches = re.findall(r'\{date:"([0-9-]+)",hypeTokens:([0-9.eE+-]+),usdAmount:([0-9.eE+-]+),avgPrice:([0-9.eE+-]+),closePrice:([0-9.eE+-]+)\}', html)
    console = {r[0]:dict(zip(['hype','usd','average','close'], map(float,r[1:]))) for r in matches}
    if len(console)<300 or not burns.get('data'): raise ValueError('Missing archive data')
    own = {r['date']:r for r in official['dailyActivity']}
    rows=[]; seen=set();opening=0
    for r in burns['data']:
        if r['mechanismId']!='hype-assistance-fund': continue
        day=r['date']; datetime.date.fromisoformat(day); amount=float(r['amountDecimal']); c=console.get(day)
        if day>today: raise ValueError('Future archive date')
        opening+=float(r.get('openingBalanceAdjustmentDecimal',0))
        if day in seen or not math.isfinite(amount) or amount<0: raise ValueError('Invalid archive row')
        seen.add(day)
        matched=bool(c and abs(c['hype']-amount)<0.02 and math.isfinite(c['usd']) and c['usd']>=0)
        row={'date':day,'hype':amount,'usd':c['usd'] if matched else None,'closePrice':c['close'] if c and math.isfinite(c['close']) and c['close']>0 else None,'partial':day>=today,'source':'cross-checked' if matched else 'quantity-only'}
        o=own.get(day)
        if o and o.get('partial') is False:
            row.update(hype=o['hype'],usd=o['usd'],partial=False,source='official')
        rows.append(row)
    if len(rows)<300: raise ValueError('Archive coverage unexpectedly small')
    if (datetime.date.fromisoformat(today)-datetime.date.fromisoformat(max(seen))).days>2: raise ValueError('Stale archive')
    mechanisms=summary['data']['mechanismBreakdown']
    return {'schemaVersion':1,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':sorted(rows,key=lambda r:r['date']),
      'mechanisms':[{'id':r['mechanismId'],'name':r['displayName'],'hype':float(r['amountDecimal']),'from':r.get('coverageAvailableFrom'),'note':r.get('coverageNote')} for r in mechanisms],
      'burnDaily':[{'date':r['date'],'mechanism':r['mechanismId'],'hype':float(r['amountDecimal'])} for r in burns['data'] if r['mechanismId']!='hype-assistance-fund'],
      'openingHype':opening,'sources':{'console':CONSOLE,'burns':'https://cryptoburntracker.com/burns/hyperliquid/'}}

def main():
    data=reconcile(fetch(CONSOLE),json.loads(fetch(BURNS)),json.loads(fetch(SUMMARY)),json.loads((ROOT/'data/hype-buybacks.json').read_text()),datetime.datetime.now(datetime.timezone.utc).date().isoformat())
    path=ROOT/'data/hype-history.json';tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,separators=(',',':'))+'\n');tmp.replace(path)
    print('Saved',len(data['rows']),'historical days')
if __name__=='__main__':main()
