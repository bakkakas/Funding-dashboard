"""Archive DeFiBurn's source-chain UNI burns, not mainnet settlements twice.
USD values = recorded daily UNI * source daily reference price; NOT execution spend.
"""
import datetime as dt
import json
import math
import re
from pathlib import Path
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://www.defiburn.com/burn'


def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():yield from objects(child)
    elif isinstance(value,list):
        for child in value:yield from objects(child)


def extract(html):
    records=[];decoded=[]
    for chunk in re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>',html,re.S):
        envelope=json.loads(chunk)
        if len(envelope)<2 or not isinstance(envelope[1],str):continue
        decoded.append(envelope[1])
        for line in envelope[1].splitlines():
            try:records.extend(objects(json.loads(line.partition(':')[2])))
            except ValueError:continue
    history=[v for v in records if all(k in v for k in ['dates','series','price','showTotal'])]
    pies=[v['data'] for v in records if v.get('type')=='pie' and any(x.get('name')=='Protocol Fee Burn' for x in v.get('data',[]))]
    if len(history)!=1 or len(pies)!=1:raise ValueError('Missing/ambiguous source datasets')
    events=next((v['events'] for v in records if 'events' in v and 'total' in v and 'chain' in v),[])
    # This page footer is UTC, distinct from fee-feed and hooks timestamps.
    text='\n'.join(decoded)
    stamp=re.search(r'Data updated.{0,240}?"children":"([0-9/]+, [0-9:]+)"',text)
    if not stamp:raise ValueError('Missing source update timestamp')
    asof=dt.datetime.strptime(stamp.group(1),'%m/%d/%Y, %H:%M:%S').replace(tzinfo=dt.timezone.utc)
    return history[0],pies[0],events,asof


def nonnegative(v):
    return isinstance(v,(float,int)) and not isinstance(v,bool) and math.isfinite(v) and v>=0


def build(html,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    h,pie,events,asof=extract(html)
    dates=h['dates'];series=h['series'];prices=h['price']
    if len(dates)<30 or len(dates)!=len(set(dates)) or dates!=sorted(dates) or len(prices)!=len(dates):raise ValueError('Invalid history coverage')
    if not series or len({s['name'] for s in series})!=len(series):raise ValueError('Invalid chains')
    for s in series:
        if len(s['data'])!=len(dates) or any(v is not None and not nonnegative(v) for v in s['data']):raise ValueError('Invalid burn series')
    if (now-asof).total_seconds()>72*3600 or asof>now+dt.timedelta(minutes=10):raise ValueError('Stale/invalid source timestamp')
    if (now.date()-dt.date.fromisoformat(dates[-1])).days>3:raise ValueError('Stale daily history')
    rows=[]
    for i,day in enumerate(dates):
        dt.date.fromisoformat(day)
        if day>now.date().isoformat():raise ValueError('Future day')
        values=[s['data'][i] for s in series if s['data'][i] is not None]
        # Preserve absent whole-day records as missing, never manufacture zero activity.
        amount=sum(values) if values else None
        price=prices[i]
        if price is not None and (not nonnegative(price) or price==0):raise ValueError('Invalid price')
        rows.append({'date':day,'uni':amount,'usdValue':amount*price if amount is not None and price is not None else None,'price':price,'partial':day>=asof.date().isoformat()})
    composition={r['name']:r['value'] for r in pie}
    if not all(nonnegative(v) for v in composition.values()) or 'One-time treasury burn' not in composition:raise ValueError('Invalid composition')
    # Source labels this entire non-fee bucket treasury; only 100M is the documented one-off.
    nonfee=composition['One-time treasury burn'];fee=composition['Protocol Fee Burn']
    if nonfee<100_000_000:raise ValueError('Unexpected non-fee burn baseline')
    chains=[{'name':s['name'],'uni':sum(v for v in s['data'] if v is not None)} for s in series]
    clean_events=[]
    for e in events:
        if not re.fullmatch(r'0x[0-9a-fA-F]{64}',e['txHash']) or not nonnegative(e['uniAmount']):raise ValueError('Invalid settlement event')
        clean_events.append({k:e[k] for k in ['chain','txHash','ts','uniAmount']})
    return {'schemaVersion':1,'source':SOURCE,'fetchedAt':now.isoformat(),'sourceUpdatedAt':asof.isoformat(),'through':dates[-1],
      'rows':rows,'chains':sorted(chains,key=lambda x:-x['uni']),
      'mainnet':{'feeSettledUni':fee,'nonFeeUni':nonfee,'totalDeadUni':fee+nonfee,'documentedTreasuryUni':100_000_000,'otherNonFeeUni':nonfee-100_000_000},
      'settlements':clean_events,'valuation':'daily UNI amount × DeFiBurn daily reference price; not buyback spend',
      'basis':'Source-chain recorded burns; mainnet settlements are separate and never added again.'}


def main():
    with urlopen(Request(SOURCE,headers={'User-Agent':'FundingDashboard/1.0'}),timeout=45) as r:data=build(r.read().decode())
    path=ROOT/'data/uni-burns.json'
    if path.exists():
        old=json.loads(path.read_text())
        if data['sourceUpdatedAt']<old['sourceUpdatedAt'] or data['through']<old['through']:raise ValueError('Source regressed; retain prior snapshot')
        if data['rows'][0]['date']>old['rows'][0]['date']:raise ValueError('History truncated; retain prior snapshot')
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');tmp.replace(path)
    print('Saved',len(data['rows']),'UNI burn days through',data['through'])
if __name__=='__main__':main()
