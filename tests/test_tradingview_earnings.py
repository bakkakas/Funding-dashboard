import copy
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tv', ROOT/'scripts/tradingview_earnings.py')
tv=importlib.util.module_from_spec(spec);spec.loader.exec_module(tv)
class TradingViewEarnings(unittest.TestCase):
    def setUp(self):self.payload=json.loads((ROOT/'tests/fixtures/tradingview-otly.json').read_text())
    def test_dated_same_source_pairs_and_units(self):
        d=tv.parse_otly(self.payload)
        row=next(r for r in d['rows'] if r['period']=='2026-09')
        revenue=next(m for m in row['metrics'] if m['label']=='매출액')
        eps=next(m for m in row['metrics'] if m['label']=='EPS')
        self.assertEqual(revenue['actual'],243.054)
        self.assertEqual(revenue['estimate'],241.744667)
        self.assertEqual(eps['actual'],-0.86);self.assertEqual(eps['estimate'],-0.81275)
        self.assertIn('ADS',eps['unit'])
        self.assertEqual(d['annual']['rows'][0]['period'],'2027')
    def test_unreported_not_zero_and_only_two_future_periods(self):
        d=tv.parse_otly(self.payload)
        self.assertEqual(d['rows'][0]['period'],'2027-03')
        self.assertTrue(all(m['actual'] is None for m in d['rows'][0]['metrics']))
    def test_absent_annual_is_not_synthetic(self):
        self.payload['data'][0]['d'][3:]=[None,None]
        self.assertNotIn('annual',tv.parse_otly(self.payload))
    def test_invalid_currency_and_missing_history_fail_closed(self):
        bad=copy.deepcopy(self.payload);bad['data'][0]['d'][0]='SEK'
        with self.assertRaises(ValueError):tv.parse_otly(bad)
        bad=copy.deepcopy(self.payload);bad['data'][0]['d'][1]=None
        with self.assertRaises(ValueError):tv.parse_otly(bad)
