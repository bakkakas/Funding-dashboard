#!/usr/bin/env python3
"""Official-source monitoring. Preserve reviewed figures; append dated source excerpts.
Never infer budgets from buyback market valuations, or annualize quarterly dividends.
"""
import concurrent.futures, datetime as dt, hashlib, json, re, sys, urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse, quote
from bs4 import BeautifulSoup
ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'data/shareholder-returns'
KEY = re.compile(r'주주환원|배당|자사주|자기주식|dividend|repurchas|buyback|shareholder return|capital return', re.I)
DISCOVER = re.compile(r'주주환원|배당|자사주|실적|shareholder|dividend|repurchas|buyback|results|earnings|financial.release', re.I)
SAMSUNG = 'https://www.samsung.com/sec/ir/stock-information/shareholder-return/'
DISCOVERY = {
 'stock-005930': ['https://news.samsung.com/kr/feed'],
 'stock-000660': ['https://news.skhynix.co.kr/category/ir/'],
 'stock-263750': ['https://www.pearlabyss.com/ko-KR/Board/Index/2'],
}
def fetch(url):
    url=quote(url,safe=':/?=&%+#')
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xml'})
    with urllib.request.urlopen(req,timeout=20) as r:
        if urlparse(r.url).hostname != urlparse(url).hostname: raise ValueError('Unexpected redirect host')
        return r.read(4000000).decode('utf-8-sig',errors='replace')
def extract(body,url):
    soup=BeautifulSoup(body,'html.parser')
    for el in soup.select('script,style,nav,header,footer,form'):el.decompose()
    title=soup.title.get_text(' ',strip=True) if soup.title else url
    date=soup.select_one('meta[property="article:published_time"],meta[name="date"],time[datetime]')
    published=(date.get('content') or date.get('datetime') or '')[:10] if date else ''
    if not re.fullmatch(r'20\d\d-\d\d-\d\d',published):published=''
    root=soup.select_one('.view_detail, .board_detail, .entry-content, article, main') or soup
    paras=[]
    for el in root.find_all(['p','li']):
        text=' '.join(el.stripped_strings)
        if KEY.search(text) and 35<=len(text)<=2600 and text not in paras:paras.append(text)
    if not paras:
        # Some corporate IR pages use div-only layouts. Keep bounded original lines.
        paras=[s for s in root.stripped_strings if KEY.search(s) and 35<=len(s)<=2600]
    if not paras:raise ValueError('No shareholder-return content found')
    paragraphs=list(dict.fromkeys(paras))[:18]
    return dict(url=url,title=title,publishedAt=published,paragraphs=paragraphs,
                digest=hashlib.sha256('\n'.join(paragraphs).encode()).hexdigest())
def discover(body,base):
    urls=[]
    if '<rss' in body[:500]:
        import xml.etree.ElementTree as ET
        for item in ET.fromstring(body).findall('./channel/item'):
            url=item.findtext('link','')
            if DISCOVER.search(item.findtext('title','')) and urlparse(url).hostname==urlparse(base).hostname:urls.append(url)
        return list(dict.fromkeys(urls))[:8]
    soup=BeautifulSoup(body,'html.parser')
    for a in soup.select('a[href]'):
        url=urljoin(base,a['href']).split('#')[0]
        if urlparse(url).hostname!=urlparse(base).hostname or re.search(r'/tag/|/category/|[?&]tag=',url):continue
        if DISCOVER.search(a.get_text(' ',strip=True)+' '+url) and not re.search(r'\.(pdf|jpg|png|xlsx)(\?|$)',url,re.I):urls.append(url)
    # RSS feed: links are text rather than hrefs.
    for item in soup.find_all('item'):
        title=item.find('title');link=item.find('link')
        if title and link and DISCOVER.search(title.get_text()):
            url=link.get_text(strip=True) or (link.next_sibling or '').strip()
            if urlparse(url).hostname==urlparse(base).hostname:urls.append(url)
    return list(dict.fromkeys(urls))[:8]
def samsung_dividend(body):
    text=' '.join(BeautifulSoup(body,'html.parser').stripped_strings)
    m=re.search(r'(20\d{2})년\s*([1-4])분기\s*배당.{0,120}?주당배당금\s*[:：]?\s*보통주\s*([\d,]+)원.{0,120}?배당\s*기준일\s*[:：]?\s*(20\d{2})년\s*(\d+)월\s*(\d+)일.{0,100}?배당금\s*총액\s*[:：]?\s*약\s*([\d.]+)조원',text)
    if not m:raise ValueError('Samsung quarterly dividend format changed')
    year,q,dps,ry,rm,rd,total=m.groups()
    record=dt.date(int(ry),int(rm),int(rd)).isoformat()
    return dict(period=f'{year}년 {q}분기',dps=int(dps.replace(',','')),currency='KRW',recordDate=record,total=f'약 {total}조원',url=SAMSUNG)
def hynix_dividend(body,url):
    period=re.search(r'/q([1-4])-(20\d{2})-business-results/',url)
    if not period:return None
    q,year=period.groups();text=' '.join(BeautifulSoup(body,'html.parser').stripped_strings)
    amount=re.search(q+r'분기 배당금은 주당\s*([\d,]+)\s*(만)?\s*원',text)
    total=re.search(q+r'분기 현금배당\s*([\d.]+)조',text)
    if not amount or not total:return None
    dps=int(amount[1].replace(',',''))*(10000 if amount[2] else 1)
    return dict(period=f'{year}년 {q}분기',dps=dps,currency='KRW',recordDate='원문에 미제시',total=total[1]+'조원',url=url)
def update(path):
    d=json.loads(path.read_text());now=dt.datetime.now(dt.timezone.utc).isoformat();errors=[]
    sources=list(dict.fromkeys([d['source']]+[r['url'] for r in d['history']]))
    pages={}
    for url in list(dict.fromkeys([d['source']]+DISCOVERY.get(d['issuerId'],[]))):
        try:
            pages[url]=fetch(url);sources.extend(discover(pages[url],url))
        except Exception as ex:errors.append(f'{url}: {type(ex).__name__}')
    old={r['url']:r for r in d.get('documents',[]) if not re.search(r'/tag/|/category/',r['url'])};success=0
    for url in list(dict.fromkeys(sources))[:12]:
        try:
            body=pages[url] if url in pages else fetch(url)
            doc=extract(body,url);doc['checkedAt']=now
            prior=old.get(url)
            if prior and prior.get('digest')!=doc['digest']:
                d.setdefault('sourceChanges',[]).append({**prior,'supersededAt':now})
            old[url]=doc;success+=1
            if d['issuerId']=='stock-000660':
                dividend=hynix_dividend(body,url)
                if dividend and dividend['period']>d.get('dividend',{}).get('period',''):
                    d['dividend']=dividend
            if url==SAMSUNG:
                dividend=samsung_dividend(body)
                if dividend['recordDate'] >= d.get('dividend',{}).get('recordDate',''):
                    d['dividend']=dividend
        except ValueError as ex:
            if url in [d['source']]+[r['url'] for r in d['history']]:errors.append(f'{url}: {str(ex)}')
        except Exception as ex:errors.append(f'{url}: {type(ex).__name__}')
    unique={doc['digest']:doc for doc in old.values()}
    d['documents']=sorted(unique.values(),key=lambda x:(x.get('publishedAt',''),x['url']),reverse=True)
    d['monitor']={'checkedAt':now,'status':'ok' if success and not errors else 'partial' if success else 'failed','successCount':success,'errors':errors}
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
    print(d['issuerId'],d['monitor']['status'],success,'documents')
    return success>0
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(update,[p for p in sorted(DIR.glob('*.json')) if json.loads(p.read_text()).get('history')]))
    if not all(results):sys.exit(1)
