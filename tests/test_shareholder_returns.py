import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('returns',Path(__file__).resolve().parents[1]/'scripts/update_shareholder_returns.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReturnsTests(unittest.TestCase):
 def test_dividend_not_annualized(self):
  d=m.samsung_dividend('<p>2026년 3분기 배당 주당배당금 : 보통주 4,601원 / 우선주 4,601원 배당 기준일 : 2026년 9월30일 배당금 총액 : 약 30.0조원</p>')
  self.assertEqual(d['dps'],4601);self.assertEqual(d['recordDate'],'2026-09-30')
 def test_changed_source_is_not_silently_zero(self):
  with self.assertRaises(ValueError):m.samsung_dividend('<p>No dividend data</p>')
 def test_links_stay_on_official_host_and_exclude_tags(self):
  body='<a href="https://evil.example/earnings">earnings</a><a href="/tag/dividend/">dividend</a><a href="/q3-results/">earnings</a>'
  self.assertEqual(m.discover(body,'https://news.example/'),['https://news.example/q3-results/'])
 def test_extract_original_forecast_without_promoting_to_actual(self):
  d=m.extract('<title>Test</title><meta property="article:published_time" content="2026-10-28"><article><p>We plan to repurchase shares for up to $20 billion, subject to market conditions.</p></article>','https://example.com/a')
  self.assertEqual(d['publishedAt'],'2026-10-28');self.assertIn('plan',d['paragraphs'][0]);self.assertNotIn('total',d)
 def test_rss_links(self):
  body='<rss><channel><item><title>Dividend announcement</title><link>https://news.example/latest</link></item></channel></rss>'
  self.assertEqual(m.discover(body,'https://news.example/feed'),['https://news.example/latest'])
if __name__=='__main__':unittest.main()

class HynixTests(unittest.TestCase):
 def test_announced_quarter_not_fixed_annual_policy(self):
  html='<p>3분기 현금배당 14조 원. 3분기 배당금은 주당 2만 원이다. 연간 고정배당 1,500원</p>'
  d=m.hynix_dividend(html,'https://news.skhynix.co.kr/q3-2026-business-results/')
  self.assertEqual(d['dps'],20000);self.assertEqual(d['period'],'2026년 3분기')
 def test_no_quarter_declaration_no_inference(self):
  self.assertIsNone(m.hynix_dividend('<p>연간 고정배당 1,500원</p>','https://news.skhynix.co.kr/q3-2026-business-results/'))

class DividendRefreshTests(unittest.TestCase):
 def test_new_quarter_automatically_replaces_old_and_failure_preserves_it(self):
  import tempfile,json
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'samsung.json'
   path.write_text(json.dumps({'issuerId':'stock-005930','source':m.SAMSUNG,'history':[], 'dividend':{'period':'2026년 3분기','dps':4601,'recordDate':'2026-09-30'}}))
   html='<article><p>2026년 4분기 배당 주당배당금 : 보통주 500원 / 우선주 500원 배당 기준일 : 2026년 12월31일 배당금 총액 : 약 3.0조원</p></article>'
   with patch.object(m,'fetch',return_value=html),patch.dict(m.DISCOVERY,{},clear=True):m.update(path)
   refreshed=json.loads(path.read_text());self.assertEqual(refreshed['dividend']['period'],'2026년 4분기');self.assertEqual(refreshed['dividend']['dps'],500)
   with patch.object(m,'fetch',side_effect=OSError('network')),patch.dict(m.DISCOVERY,{},clear=True):m.update(path)
   failed=json.loads(path.read_text());self.assertEqual(failed['dividend'],refreshed['dividend']);self.assertEqual(failed['monitor']['status'],'failed')
