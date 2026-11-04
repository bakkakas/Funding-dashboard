import datetime as dt
import importlib.util
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('uni',ROOT/'scripts/update_uni_burns.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc)
def fixture(missing_price=False,missing_day=False):
    days=[(NOW.date()-dt.timedelta(days=31-i)).isoformat() for i in range(31)]
    chart={'dates':days,'series':[{'name':'Ethereum','data':[10]*31},{'name':'Base','data':[None]*31}],'price':[2]*31,'showTotal':True}
    if missing_price:chart['price'][10]=None
    if missing_day:chart['series'][0]['data'][10]=None
    pie={'type':'pie','data':[{'name':'One-time treasury burn','value':100000005},{'name':'Protocol Fee Burn','value':280}]}
    footer={'children':['Data updated',' ',{'children':'11/4/2026, 02:15:00'}]}
    return '<script>self.__next_f.push('+json.dumps([1,'a:'+json.dumps([chart,pie,footer],separators=(',',':'))+'\n'])+')</script>'
class UniCollectorTests(unittest.TestCase):
    def test_source_chain_not_double_counted(self):
        d=m.build(fixture(),NOW)
        self.assertEqual(sum(r['uni'] for r in d['rows']),310)
        self.assertEqual(d['mainnet']['totalDeadUni'],100000285)
        self.assertEqual(d['mainnet']['otherNonFeeUni'],5)
    def test_missing_values_not_zero(self):
        d=m.build(fixture(missing_price=True,missing_day=True),NOW)
        self.assertIsNone(d['rows'][10]['uni']);self.assertIsNone(d['rows'][10]['usdValue'])
    def test_stale_or_broken_feed_rejected(self):
        with self.assertRaises(ValueError):m.build(fixture(),NOW+dt.timedelta(days=4))
        with self.assertRaises(ValueError):m.build('<html>Unavailable</html>',NOW)
