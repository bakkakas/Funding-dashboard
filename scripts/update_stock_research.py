#!/usr/bin/env python3
"""Public issuer filings only; never reads portfolio/customer data or AI credentials."""
import concurrent.futures, datetime as dt, html, json, re, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NOW=dt.datetime.now(dt.timezone.utc)
MIN_YEAR=NOW.year-5
HEADERS={'User-Agent':'Mozilla/5.0','Accept':'application/json,text/html,*/*'}
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=25) as r:return r.read().decode('utf-8-sig')
def links(body,base):
    from urllib.parse import urljoin
    return list(dict.fromkeys(urljoin(base,html.unescape(x)) for x in re.findall(r'href=[\"\']([^\"\']+)',body)))
def pdf_exists(url):
    try:
        req=urllib.request.Request(url,headers=HEADERS,method='HEAD')
        with urllib.request.urlopen(req,timeout=12) as r:return 'pdf' in r.headers.get('Content-Type','').lower()
    except Exception:return False

def samsung():
    source='https://www.samsung.com/global/ir/financial-information/earnings-release/'
    found=[]
    for u in links(fetch(source),source):
        m=re.search(r'/(20\d{2})_([1-4])Q_conference_eng[^/]*\.pdf',u)
        if m and int(m[1])>=MIN_YEAR:found.append((u,int(m[1]),int(m[2])))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:good=list(ex.map(lambda x:pdf_exists(x[0]),found))
    return {'source':source,'reports':[{'year':y,'quarter':q,'period':f'{y} Q{q}','url':u,'title':'분기 실적 발표자료','type':'IR presentation','filed':None} for (u,y,q),ok in zip(found,good) if ok]}
def novo():
    source='https://www.novonordisk.com/investors/financial-results.html';reports=[];seen=set()
    for u in links(fetch(source),source):
        leaf=u.split('/')[-1];m=re.search(r'q([1-4])[-_ ]?(20\d{2})',leaf,re.I)
        if not m:
            q=re.search(r'q([1-4])',leaf,re.I);y=re.search(r'/(20\d{2})/',u)
            if q and y:m=[None,q[1],y[1]]
        if not m or not re.search('presentation|company-announcement',leaf,re.I) or not u.lower().endswith('.pdf'):continue
        q,y=int(m[1]),int(m[2]);key=(y,q)
        if y<MIN_YEAR or key in seen:continue
        seen.add(key);reports.append({'year':y,'quarter':q,'period':f'{y} Q{q}','url':u,'title':'Novo Nordisk 원주 기업 실적 발표','type':'IR presentation','filed':None})
    return {'source':source,'reports':reports}
def hynix():
    source='https://news.skhynix.com/en/?s=financial+results'
    urls=[source]+[f'https://news.skhynix.com/en/page/{p}/?s=financial+results' for p in range(2,7)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:pages=list(ex.map(fetch,urls))
    reports={}
    for body in pages:
        for u in links(body,source):
            # Discover actual announcement links, never fabricate per-quarter URLs.
            m=re.search(r'(?:announces|reports).*?([1-4])q(2[0-9])',u,re.I)
            fy=re.search(r'(?:announces|reports).*?fy(2[0-9])',u,re.I)
            compact=re.search(r'/q([1-4])-(20\d{2})-business-results',u,re.I)
            long=re.search(r'(first|second|third|fourth)-quarter-(20\d{2})',u,re.I)
            annual=re.search(r'fiscal-year-(20\d{2})',u,re.I)
            if compact:y,q=int(compact[2]),int(compact[1])
            elif m:y,q=2000+int(m[2]),int(m[1])
            elif fy:y,q=2000+int(fy[1]),4
            elif long:y,q=int(long[2]),['first','second','third','fourth'].index(long[1].lower())+1
            elif annual:y,q=int(annual[1]),4
            else:continue
            if y<MIN_YEAR:continue
            reports[(y,q)]={'year':y,'quarter':q,'period':f'{y} Q{q}','url':u,'title':'SK하이닉스 실적 발표'+(' · 연간 포함' if q==4 else ''),'type':'IR release','filed':None}
    return {'source':source,'reports':list(reports.values())}
def sec(cik):
    cik=str(cik).zfill(10);source=f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json';d=json.loads(fetch(source));facts=d['facts'].get('us-gaap',{});reports={}
    for tag in ['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet']:
        fact=facts.get(tag,{})
        for unit,rows in fact.get('units',{}).items():
            for r in rows:
                end=r.get('end','');filed=r.get('filed','');form=r.get('form');start=r.get('start');acc=r.get('accn')
                if not start:continue
                duration=(dt.date.fromisoformat(end)-dt.date.fromisoformat(start)).days
                if not (70<=duration<=110 or (form=='10-K' and 330<=duration<=380)):continue
                if form not in ['10-Q','10-K'] or end<f'{MIN_YEAR}-01-01' or filed>NOW.date().isoformat() or not acc:continue
                # Filing index gives access to the exact original report and exhibits.
                if end not in reports or filed<reports[end]['filed']:
                    reports[end]={'year':int(end[:4]),'period':end,'url':f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace("-","")}/{acc}-index.html','title':f'{form} 재무 공시','type':form,'filed':filed,'metrics':[]}
    # Attach directly reported standalone-quarter values only. No YTD mistaken for a quarter.
    keys={'매출액':['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],'영업이익':['OperatingIncomeLoss'],'순이익':['NetIncomeLoss'],'희석 EPS':['EarningsPerShareDiluted']}
    for label,tags in keys.items():
        fact=next((facts[t] for t in tags if t in facts),{})
        chosen={}
        for unit,rows in fact.get('units',{}).items():
            if unit not in ['USD','USD/shares']:continue
            for r in rows:
                if not r.get('start') or r.get('end') not in reports or r.get('filed','')>NOW.date().isoformat():continue
                days=(dt.date.fromisoformat(r['end'])-dt.date.fromisoformat(r['start'])).days
                if 70<=days<=110 and (r['end'] not in chosen or r['filed']>chosen[r['end']]['filed']):chosen[r['end']]={**r,'unit':unit}
        for end,r in chosen.items():reports[end]['metrics'].append({'label':label,'value':r['val'],'unit':r['unit'],'filed':r['filed']})
    return {'source':source,'reports':list(reports.values())}
TASKS={'stock-005930':samsung,'stock-000660':hynix,'stock-novo-nordisk':novo,'stock-googl':lambda:sec('1652044'),'stock-amzn':lambda:sec('1018724'),'stock-nke':lambda:sec('320187')}
def main():
    out=ROOT/'data/stock-research';out.mkdir(parents=True,exist_ok=True);fail=[]
    for key,task in TASKS.items():
        try:
            data=task();data['reports'].sort(key=lambda r:r['period'],reverse=True)
            if not data['reports']:raise ValueError('No reports found')
            data.update(schemaVersion=1,updatedAt=NOW.isoformat(),fromYear=MIN_YEAR)
            (out/f'{key}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            print(key,len(data['reports']),min(r['year'] for r in data['reports']))
        except Exception as e:
            print(key,'FAILED',str(e));fail.append(key)
    if fail:raise SystemExit(1)
if __name__=='__main__':main()
