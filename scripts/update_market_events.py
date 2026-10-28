#!/usr/bin/env python3
"""Daily public event calendar. No guessed recurring release dates or private accounts."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, time, timedelta, timezone
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from icalendar import Calendar

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'market_events.json'
KST = ZoneInfo('Asia/Seoul')
NY = ZoneInfo('America/New_York')
URLS = {
 'fed': 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
 'bls': 'https://www.bls.gov/schedule/news_release/bls.ics',
 'bea': 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
 'ecb': 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html',
 'boj': 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm',
 'bok': 'https://www.bok.or.kr/eng/main/contents.do?menuNo=400020',
 'samsung': 'https://www.samsung.com/global/ir/ir-events-presentations/events/',
 'hynix': 'https://asia.tools.euroland.com/tools/FinCalendar2/Home/AllEvents?companyCode=kr-000660&eventTypeId=&lang=en-gb&selectedYear=&v=redesign&CurrentPage=1&RowPerPage=100&SortOrder=DESC',
 'nasdaq': 'https://api.nasdaq.com/api/calendar/earnings',
 'elections': 'https://www.usa.gov/election-day',
}
NAMES = {'fomc':'미국 FOMC','cpi':'미국 CPI','jobs':'미국 고용보고서','pce':'미국 PCE','ecb':'ECB 금리 결정','boj':'BOJ 금리 결정','bok':'한국은행 금통위',
 'NVDA':'엔비디아 실적','MSFT':'마이크로소프트 실적','AAPL':'애플 실적','AMZN':'아마존 실적','GOOGL':'알파벳 실적','META':'메타 실적','TSM':'TSMC 실적','005930':'삼성전자 실적','000660':'SK하이닉스 실적'}
US_SYMBOLS = {'NVDA','MSFT','AAPL','AMZN','GOOGL','META','TSM'}
MONTHS = {m[:3].lower():i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}

def fetch(url):
    req = Request(url, headers={'User-Agent':'Mozilla/5.0', 'Accept':'application/json,text/html,text/calendar,*/*', **({'Origin':'https://www.tradingview.com'} if 'economic-calendar.tradingview.com/' in url else {})})
    with urlopen(req, timeout=25) as response:
        return response.read().decode('utf-8-sig')

def soup(raw): return BeautifulSoup(raw, 'html.parser')
def month(s): return MONTHS[s.strip()[:3].lower()]
def event(series, day, source, *, starts=None, status='confirmed', note='', name=None, identity=None):
    source_day = day.isoformat()
    effective = starts.astimezone(KST).date() if starts else day
    return {'id':f'{series}:{identity or source_day}', 'series':series, 'name':name or NAMES[series], 'date':effective.isoformat(), 'sourceDate':source_day,
            'startsAt':starts.isoformat() if starts else None, 'status':status, 'sourceUrl':URLS[source], 'dateNote':note}

def parse_ics(raw, source):
    result=[]
    for item in Calendar.from_ical(raw).walk('VEVENT'):
        title=str(item.get('summary',''))
        series = ({'Consumer Price Index':'cpi','Employment Situation':'jobs'}.get(title) if source=='bls' else ('pce' if title.startswith('Personal Income and Outlays') else None))
        if not series or str(item.get('status','')).upper()=='CANCELLED': continue
        start=item.decoded('dtstart')
        if not isinstance(start,datetime) or start.tzinfo is None: raise ValueError('Calendar release lacks timezone')
        result.append(event(series,start.date(),source,starts=start,note=title))
    if not result: raise ValueError('No matching official releases')
    return result

def parse_fed(raw):
    result=[]
    for panel in soup(raw).select('.panel'):
        heading=panel.select_one('.panel-heading')
        match=re.search(r'(20\d\d) FOMC Meetings',heading.get_text(' ',strip=True) if heading else '')
        if not match: continue
        year=int(match[1])
        for row in panel.select('.fomc-meeting'):
            m=row.select_one('.fomc-meeting__month'); d=row.select_one('.fomc-meeting__date')
            if not m or not d: continue
            label=d.get_text(' ',strip=True)
            if 'unscheduled' in label.lower() or 'cancel' in label.lower(): continue
            # Decision is on the second/final meeting day; supports Apr/May.
            parts=re.findall(r'\d+',label)
            if not parts: continue
            day=date(year,month(m.get_text().split('/')[-1]),int(parts[-1]))
            result.append(event('fomc',day,'fed',starts=datetime.combine(day,time(14),NY),note='금리 결정·기자회견 일정 / 한국 날짜'))
    if not result: raise ValueError('FOMC layout changed')
    return result

def parse_ecb(raw):
    result=[]
    for dt in soup(raw).select('main dt'):
        dd=dt.find_next_sibling('dd'); text=dd.get_text(' ',strip=True) if dd else ''
        if 'monetary policy meeting' not in text or 'non-monetary' in text or 'Day 2' not in text: continue
        day=datetime.strptime(dt.get_text(strip=True),'%d/%m/%Y').date()
        result.append(event('ecb',day,'ecb',note='통화정책 회의 최종일'))
    if not result: raise ValueError('ECB layout changed')
    return result

def parse_boj(raw):
    result=[]
    for table in soup(raw).find_all('table'):
        caption=table.find('caption'); match=re.search(r'20\d\d',caption.get_text() if caption else '')
        if not match: continue
        for tr in table.select('tbody tr'):
            cell=tr.find('td')
            text=re.sub(r'\[PDF.*','',cell.get_text(' ',strip=True)) if cell else ''
            months=re.findall(r'([A-Za-z]+)\.?\s+(\d{1,2})',text)
            days=re.findall(r'(\d{1,2})\s*\(',text)
            if not months or not days: continue
            day=date(int(match[0]),month(months[-1][0]),int(days[-1]))
            result.append(event('boj',day,'boj',note='금융정책결정회의 최종일 / 발표 시각 미정'))
    if not result: raise ValueError('BOJ layout changed')
    return result

def parse_bok(raw):
    result=[]
    for heading in soup(raw).select('#content h3'):
        if not re.fullmatch(r'20\d\d',heading.get_text(strip=True)): continue
        table=heading.find_next('table')
        for td in table.find_all('td'):
            match=re.search(r'([A-Za-z]+)\.?\s*(\d{1,2})',td.get_text(' ',strip=True))
            if match:
                day=date(int(heading.get_text()),month(match[1]),int(match[2]))
                result.append(event('bok',day,'bok',note='기준금리 결정 회의 / 한국 날짜'))
    if not result: raise ValueError('BOK layout changed')
    return result

def parse_samsung(raw):
    result=[]
    for dl in soup(raw).select('.ir-event-list__detail'):
        dt=dl.find('dt'); dd=dl.find('dd')
        if not dt or not dd or 'Earnings Conference Call' not in dt.get_text(): continue
        match=re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d\d)',dd.get_text(' ',strip=True))
        if not match: continue
        day=date(int(match[3]),month(match[1]),int(match[2]))
        result.append(event('005930',day,'samsung',note=dt.get_text(' ',strip=True)+' / 한국 날짜'))
    if not result: raise ValueError('Samsung earnings layout changed')
    return result

def parse_hynix(raw):
    rows=json.loads(raw).get('events')
    if not isinstance(rows,list): raise ValueError('SK hynix calendar unavailable')
    result=[]
    for row in rows:
        if row.get('type')!='Earnings Release': continue
        stamp=row.get('startDateUTC','')
        start=datetime.strptime(stamp,'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc) if 'T' in stamp else None
        day=start.astimezone(KST).date() if start else datetime.strptime(stamp,'%Y%m%d').date()
        result.append(event('000660',day,'hynix',starts=start,note=row.get('title','')))
    if not result: raise ValueError('No SK hynix earnings in published calendar')
    return result

def parse_nasdaq(raw, day):
    payload=json.loads(raw)
    if payload.get('status',{}).get('rCode')!=200 or not isinstance(payload.get('data'),dict): raise ValueError('Nasdaq calendar unavailable')
    rows=payload['data'].get('rows') or []
    result=[]
    for row in rows:
        symbol=row.get('symbol')
        if symbol not in US_SYMBOLS: continue
        session=row.get('time')
        # Session is enough for the Korean calendar day, not an exact release time.
        if session=='time-after-hours': kday=day+timedelta(days=1); note='미국 장 마감 후 → 한국 다음 날 (정확한 시각 미공개)'
        elif session=='time-pre-market': kday=day; note='미국 장 시작 전 → 한국 같은 날 (정확한 시각 미공개)'
        else: kday=day; note='발표 시각 미공개 · 날짜는 제공처의 미국 현지일 기준'
        item=event(symbol,day,'nasdaq',status='estimated',note=note)
        item['date']=kday.isoformat();item['dateBasis']='US-local' if session not in ('time-after-hours','time-pre-market') else 'Asia/Seoul';item['sourceUrl']=URLS['nasdaq']+'?date='+day.isoformat()
        result.append(item)
    return result

def collect_nasdaq(today):
    # Includes yesterday's US after-hours reports and all D-30 dates.
    days=[today+timedelta(days=i) for i in range(-1,31)]
    result=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(fetch,URLS['nasdaq']+'?date='+d.isoformat()):d for d in days}
        for job in as_completed(jobs): result.extend(parse_nasdaq(job.result(),jobs[job]))
    return result

def elections(today):
    result=[]
    for year in range(today.year,today.year+5):
        if year%2: continue
        first=date(year,11,1); first_monday=first+timedelta(days=(0-first.weekday())%7); day=first_monday+timedelta(days=1)
        name='미국 대통령·의회 선거' if year%4==0 else '미국 중간선거'
        # US election-day voting extends into the next Korean calendar date.
        item=event('us-election',day,'elections',name=name,note=f'미국 법정 선거일 {day.isoformat()} · 투표 종료가 포함되는 한국 날짜')
        item['date']=(day+timedelta(days=1)).isoformat(); result.append(item)
    return result


def collect_macro_fallback(today):
    start=today-timedelta(days=1); end=today+timedelta(days=90)
    url='https://economic-calendar.tradingview.com/events?'+urlencode({'from':start.isoformat()+'T00:00:00.000Z','to':end.isoformat()+'T23:59:59.000Z','countries':'US,KR'})
    return parse_macro_fallback(fetch(url),today)

def parse_macro_fallback(raw,today):
    payload=json.loads(raw)
    if payload.get('status')!='ok' or not isinstance(payload.get('result'),list) or not payload['result']: raise ValueError('Economic calendar unavailable')
    mapping={'ECONOMICS:USNFP':('jobs','US','bls'),'ECONOMICS:USIRYY':('cpi','US','bls'),'ECONOMICS:KRINTR':('bok','KR','bok')}
    rows=[]; dates=[]
    for row in payload['result']:
        stamp=row.get('date','')
        if not stamp: continue
        start=datetime.fromisoformat(stamp.replace('Z','+00:00'))
        if start.tzinfo is None: raise ValueError('Economic calendar date lacks timezone')
        dates.append(start.astimezone(KST).date())
        match=mapping.get(row.get('ticker'))
        if not match or row.get('country')!=match[1]: continue
        series,_,source=match
        source_day=start.astimezone(NY if source=='bls' else KST).date()
        item=event(series,source_day,source,starts=start,status='reported',note='TradingView 경제 캘린더 재공표 일정 / 한국 날짜')
        item.update(sourceUrl='https://www.tradingview.com/economic-calendar/',originalSourceUrl=URLS[source],sourceProvider='TradingView economic calendar')
        rows.append(item)
    if not dates: raise ValueError('Economic calendar has no dated coverage')
    return rows,min(max(dates),today+timedelta(days=90))

def apply_macro_fallback(groups,warnings,today,collector,now):
    targets=[key for key in ('bls','bok') if key in warnings]
    if not targets:return
    try: rows,coverage_end=collector(today)
    except Exception:return
    for key in targets:
        required={'cpi','jobs'} if key=='bls' else {'bok'}
        upcoming=[e for e in rows if e['series'] in required and date.fromisoformat(e['date'])>=today]
        # An empty/partial response must never erase the last verified schedule.
        if {e['series'] for e in upcoming}!=required:continue
        prior=groups[key]
        retained=[e for e in prior['events'] if date.fromisoformat(e['date'])<today-timedelta(days=1) or date.fromisoformat(e['date'])>coverage_end]
        groups[key]={'checkedAt':now,'status':'fallback','primaryError':prior.get('error'),'provider':'TradingView economic calendar','events':retained+[e for e in rows if e['series'] in required and today-timedelta(days=1)<=date.fromisoformat(e['date'])<=coverage_end]}
        warnings.remove(key)

PARSERS={'fed':parse_fed,'bls':lambda raw:parse_ics(raw,'bls'),'bea':lambda raw:parse_ics(raw,'bea'),'ecb':parse_ecb,'boj':parse_boj,'bok':parse_bok,'samsung':parse_samsung,'hynix':parse_hynix}

def refresh(previous, today, fetcher=fetch, nasdaq_collector=collect_nasdaq, fallback_collector=collect_macro_fallback):
    now=datetime.now(timezone.utc).isoformat(); groups={}; warnings=[]
    for key,parser in PARSERS.items():
        try:
            events=parser(fetcher(URLS[key])); groups[key]={'checkedAt':now,'status':'ok','events':events}
        except Exception as exc:
            prior=previous.get('sources',{}).get(key,{})
            groups[key]={**prior,'status':'stale','error':type(exc).__name__,'events':prior.get('events',[])}
            warnings.append(key)
    try: groups['nasdaq']={'checkedAt':now,'status':'ok','events':nasdaq_collector(today)}
    except Exception as exc:
        prior=previous.get('sources',{}).get('nasdaq',{})
        groups['nasdaq']={**prior,'status':'stale','error':type(exc).__name__,'events':prior.get('events',[])};warnings.append('nasdaq')
    apply_macro_fallback(groups,warnings,today,fallback_collector,now)
    groups['elections']={'checkedAt':now,'status':'ok','events':elections(today)}
    # Keep modest history for audit; D+1 removal is a client calendar-day rule.
    all_events={}
    for key,group in groups.items():
        group['events']=[e for e in group['events'] if today-timedelta(days=90)<=date.fromisoformat(e['date'])<=today+timedelta(days=1500)]
        for e in group['events']: all_events[e['id']]={**e,'sourceKey':key,'stale':group['status']=='stale'}
    return {'schemaVersion':1,'updatedAt':now,'timezone':'Asia/Seoul','windowDays':30,'sources':groups,'warnings':warnings,'events':sorted(all_events.values(),key=lambda e:(e['date'],e['id']))}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,help='Use separately retrieved official fixtures for an initial verified snapshot');args=parser.parse_args()
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    today=datetime.now(KST).date()
    aliases={'fed':'fed','bls':'bls.ics','bea':'bea.ics','ecb':'ecb','boj':'boj','bok':'bokdates','samsung':'samsung2','hynix':'hynixall'}
    fetcher=(lambda url:(args.source_dir/aliases[next(k for k,v in URLS.items() if v==url)]).read_text()) if args.source_dir else fetch
    data=refresh(previous,today,fetcher)
    if not data['events']: raise RuntimeError('No verified schedule available; preserving previous file')
    temp=OUTPUT.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(OUTPUT)
    print(json.dumps({'events':len(data['events']),'warnings':data['warnings'],'visible':[f"{e['date']} {e['name']}" for e in data['events'] if today<=date.fromisoformat(e['date'])<=today+timedelta(days=30)]},ensure_ascii=False))
if __name__=='__main__': main()
