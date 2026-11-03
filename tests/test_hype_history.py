import datetime
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).resolve().parents[1]/'scripts/update_hype_history.py'
s=importlib.util.spec_from_file_location('history',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ArchiveTests(unittest.TestCase):
 def test_reconciliation_never_uses_opening_balance_as_daily_purchase(self):
  days=[(datetime.date(2025,1,1)+datetime.timedelta(days=i)).isoformat() for i in range(301)]
  html=','.join('{date:"'+d+'",hypeTokens:10,usdAmount:100,avgPrice:10,closePrice:11}' for d in days)
  rows=[{'date':d,'mechanismId':'hype-assistance-fund','amountDecimal':'10'} for d in days]
  rows[0]['openingBalanceAdjustmentDecimal']='1000';rows[1]['amountDecimal']='20'
  official={'dailyActivity':[{'date':days[2],'hype':8,'usd':88,'partial':False}]}
  out=m.reconcile(html,{'data':rows},{'data':{'mechanismBreakdown':[]}},official,days[-1])
  self.assertEqual(out['openingHype'],1000);self.assertEqual(out['rows'][0]['hype'],10)
  self.assertIsNone(out['rows'][1]['usd']);self.assertEqual(out['rows'][2]['usd'],88)
  self.assertTrue(out['rows'][-1]['partial']);self.assertEqual(out['rows'][0]['closePrice'],11)
  with self.assertRaises(ValueError):m.reconcile(html,{'data':rows+rows[:1]},{'data':{'mechanismBreakdown':[]}},official,days[-1])
  with self.assertRaises(ValueError):m.reconcile('',{'data':rows},{'data':{'mechanismBreakdown':[]}},official,days[-1])
