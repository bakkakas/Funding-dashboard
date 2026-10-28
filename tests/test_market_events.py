import unittest
import importlib.util
import json
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('market_events',Path(__file__).resolve().parents[1]/'scripts/update_market_events.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CalendarTests(unittest.TestCase):
 def test_ics_filter_and_timezone(self):
  raw='BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Employment Situation\nDTSTART:20261106T133000Z\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Employment Situation of Veterans\nDTSTART:20261106T133000Z\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Consumer Price Index\nSTATUS:CANCELLED\nDTSTART:20261110T133000Z\nEND:VEVENT\nEND:VCALENDAR'
  rows=m.parse_ics(raw,'bls');self.assertEqual(len(rows),1);self.assertEqual(rows[0]['date'],'2026-11-06');self.assertEqual(rows[0]['series'],'jobs')
 def test_fed_final_day_dst_and_month_boundary(self):
  raw='<div class="panel"><div class="panel-heading">2026 FOMC Meetings</div><div class="fomc-meeting"><div class="fomc-meeting__month">October</div><div class="fomc-meeting__date">27-28</div></div><div class="fomc-meeting"><div class="fomc-meeting__month">December</div><div class="fomc-meeting__date">8-9*</div></div></div>'
  rows=m.parse_fed(raw);self.assertEqual([r['date'] for r in rows],['2026-10-29','2026-12-10']);self.assertTrue(rows[0]['startsAt'].endswith('-04:00'));self.assertTrue(rows[1]['startsAt'].endswith('-05:00'))
 def test_ecb_excludes_day_one_and_non_policy(self):
  raw='<main><dt>28/10/2026</dt><dd>monetary policy meeting (Day 1)</dd><dt>29/10/2026</dt><dd>monetary policy meeting (Day 2)</dd><dt>25/11/2026</dt><dd>non-monetary policy meeting (Day 2)</dd></main>'
  self.assertEqual([r['date'] for r in m.parse_ecb(raw)],['2026-10-29'])
 def test_boj_and_bok_only_decision_dates(self):
  raw='<table><caption>Table : 2026</caption><tbody><tr><td>Oct. 29 (Thurs.), 30 (Fri.)</td><td>Nov. 10 (Tues.)</td></tr></tbody></table>'
  self.assertEqual(m.parse_boj(raw)[0]['date'],'2026-10-30')
  raw='<div id="content"><h3>2026</h3><table><tr><td>Nov.26 (Thu)</td></tr></table></div>'
  self.assertEqual(m.parse_bok(raw)[0]['date'],'2026-11-26')
 def test_samsung_excludes_guidance_and_hynix_utc(self):
  raw='<dl class="ir-event-list__detail"><dt>3Q26 Earnings Conference Call</dt><dd>October 29, 2026, 10:00 a.m. KST</dd></dl><dl class="ir-event-list__detail"><dt>3Q26 Guidance Announcement</dt><dd>October 8, 2026</dd></dl>'
  self.assertEqual(len(m.parse_samsung(raw)),1)
  raw=json.dumps({'events':[{'type':'Earnings Release','startDateUTC':'20260729T000000Z','title':'Q2 earnings'},{'type':'Conference'}]})
  self.assertEqual(m.parse_hynix(raw)[0]['date'],'2026-07-29')
 def test_nasdaq_allowlist_session_and_missing_data(self):
  raw=json.dumps({'status':{'rCode':200},'data':{'rows':[{'symbol':'AAPL','time':'time-after-hours'},{'symbol':'TSM','time':'time-pre-market'},{'symbol':'OTHER'}]}})
  rows=m.parse_nasdaq(raw,date(2026,10,29));self.assertEqual([r['date'] for r in rows],['2026-10-30','2026-10-29']);self.assertTrue(all(r['status']=='estimated' for r in rows))
  with self.assertRaises(ValueError):m.parse_nasdaq('{"data":null}',date.today())
 def test_election_midterms_not_duplicate(self):
  rows=m.elections(date(2026,10,28));self.assertEqual(rows[0]['sourceDate'],'2026-11-03');self.assertEqual(rows[0]['date'],'2026-11-04');self.assertEqual(rows[0]['name'],'미국 중간선거');self.assertEqual(rows[1]['name'],'미국 대통령·의회 선거');self.assertEqual(rows[1]['sourceDate'],'2028-11-07')
 def test_failed_source_preserves_verified_schedule_and_success_replaces_reschedule(self):
  old=m.event('fomc',date(2026,11,1),'fed');new=m.event('fomc',date(2026,11,2),'fed')
  previous={'sources':{'fed':{'checkedAt':'2026-10-27T00:00:00Z','events':[old]}}}
  with patch.dict(m.PARSERS,{'fed':lambda raw:[new]},clear=True):
   data=m.refresh(previous,date(2026,10,28),lambda url:'ok',lambda d:[],lambda d:([],date(2026,11,30)));self.assertEqual(data['sources']['fed']['events'],[new])
   def fail(url):raise ValueError('offline')
   data=m.refresh(previous,date(2026,10,28),fail,lambda d:[],lambda d:([],date(2026,11,30)));self.assertEqual(data['sources']['fed']['events'],[old]);self.assertEqual(data['warnings'],['fed']);self.assertEqual(data['sources']['fed']['checkedAt'],'2026-10-27T00:00:00Z')
 def test_macro_fallback_allowlist_and_timezone(self):
  rows=[{'ticker':'ECONOMICS:USNFP','country':'US','date':'2026-11-06T13:30:00.000Z'},{'ticker':'ECONOMICS:USIRYY','country':'US','date':'2026-11-10T13:30:00.000Z'},{'ticker':'ECONOMICS:KRINTR','country':'KR','date':'2026-11-26T01:00:00.000Z'},{'ticker':'ECONOMICS:USNPP','country':'US','date':'2026-11-06T13:30:00.000Z'}]
  events,end=m.parse_macro_fallback(json.dumps({'status':'ok','result':rows}),date(2026,10,28))
  self.assertEqual([e['series'] for e in events],['jobs','cpi','bok']);self.assertEqual(end,date(2026,11,26));self.assertTrue(all(e['status']=='reported' and 'tradingview' in e['sourceUrl'] for e in events))
 def test_fallback_replaces_covered_dates_preserves_future_and_rejects_partial(self):
  today=date(2026,10,28);old=m.event('cpi',date(2026,11,9),'bls');far=m.event('cpi',date(2026,12,10),'bls')
  groups={'bls':{'status':'stale','events':[old,far]}};warnings=['bls']
  cpi=m.event('cpi',date(2026,11,10),'bls');jobs=m.event('jobs',date(2026,11,6),'bls')
  m.apply_macro_fallback(groups,warnings,today,lambda d:([cpi],date(2026,11,30)),'now')
  self.assertEqual(warnings,['bls']);self.assertEqual(groups['bls']['events'],[old,far])
  m.apply_macro_fallback(groups,warnings,today,lambda d:([cpi,jobs],date(2026,11,30)),'now')
  self.assertEqual(warnings,[]);self.assertEqual(groups['bls']['status'],'fallback');self.assertEqual(groups['bls']['events'],[far,cpi,jobs])
if __name__=='__main__':unittest.main()
