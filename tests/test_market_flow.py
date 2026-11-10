import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('market_flow',Path(__file__).resolve().parents[1]/'scripts/update_market_flow.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MarketFlowTest(unittest.TestCase):
 def row(self):return {'bizdate':'20261109','netAmounts':[{'investorGubun':code,'diffValue':'1000000','buyPrice':'1000000','sellPrice':'0'} for code in ('1000','2000','3000','3100','4000','5000','6000','7000')]+[{'investorGubun':'9000','diffValue':'-100000000','buyPrice':'200000000','sellPrice':'300000000'},{'investorGubun':'8000','diffValue':'50000000','buyPrice':'50000000','sellPrice':'0'},{'investorGubun':'9001','diffValue':'90000000'}]}
 def test_amounts_not_share_counts_or_other_foreign(self):
  r=m.parse_row(self.row());self.assertEqual(r['foreignNetKRW'],-100000000);self.assertEqual(r['individualNetKRW'],50000000);self.assertEqual(r['date'],'2026-11-09');self.assertEqual(r['institutionNetKRW'],8000000)
 def test_reconciliation(self):
  r=self.row();r['netAmounts'][8]['buyPrice']='1'
  with self.assertRaises(ValueError):m.parse_row(r)
 def test_missing_foreign_rejected(self):
  r=self.row();r['netAmounts']=[x for x in r['netAmounts'] if x['investorGubun']!='9000']
  with self.assertRaises(KeyError):m.parse_row(r)
 def test_bool_not_numeric(self):
  with self.assertRaises(ValueError):m.amount(True)
 def test_collection_excludes_today_and_joins_prices_by_date(self):
  from unittest.mock import patch
  today=m.datetime.now(m.KST).date()
  yesterday=today-m.timedelta(days=1)
  live=self.row();live['bizdate']=today.strftime('%Y%m%d')
  closed=self.row();closed['bizdate']=yesterday.strftime('%Y%m%d')
  def get(url):
   if '/trend/daily?' in url:return {'content':[live,closed],'last':True}
   return [{'localTradedAt':yesterday.isoformat(),'closePrice':'1,234.56'},{'localTradedAt':'2015-12-31','closePrice':'1,200'}]
  with patch.object(m,'get',side_effect=get):rows=m.collect('KOSPI',[])
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['date'],yesterday.isoformat());self.assertEqual(rows[0]['close'],1234.56)
 def test_price_failure_does_not_discard_market_amounts(self):
  from unittest.mock import patch
  def get(url):
   if '/trend/daily?' in url:return {'content':[self.row()],'last':True}
   raise OSError('price unavailable')
  with patch.object(m,'get',side_effect=get):rows=m.collect('KOSPI',[])
  self.assertEqual(rows[0]['foreignNetKRW'],-100000000);self.assertIsNone(rows[0]['close'])
