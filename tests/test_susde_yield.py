import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('susde', Path(__file__).resolve().parents[1] / 'scripts/update_susde_yield.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = dt.datetime(2026, 11, 9, tzinfo=dt.timezone.utc)


def fixture():
    rows = [{'timestamp': (NOW-dt.timedelta(days=44-i)).isoformat(), 'value': 5} for i in range(40)]
    current = {key: {'lastUpdated': '4 Nov 26', 'value': 5} for key in m.METRICS.values()}
    return current, {'queryIndex': [{'name': 'Indicative sUSDe APY', 'yields': [{'value': 999}]}, {'name': 'sUSDe Yield', 'yields': rows}]}


class SusdeCollectorTests(unittest.TestCase):
    def test_exact_series_units_and_source_dates(self):
        current, history = fixture()
        d = m.build_snapshot(current, history, NOW)
        self.assertEqual(d['through'], '2026-11-04')
        self.assertEqual(d['current']['apy']['value'], 5)
        self.assertEqual(len(d['rows']), 40)

    def test_invalid_and_misaligned_data_fail_closed(self):
        for mutation in [lambda c,h: c['stakingYield'].update(value=None),
                         lambda c,h: c['stakingYield'].update(value=True),
                         lambda c,h: c['stakingYield'].update(value=9),
                         lambda c,h: c['stakingYield'].update(lastUpdated='10 Nov 26'),
                         lambda c,h: h['queryIndex'][1]['yields'].pop(),
                         lambda c,h: h['queryIndex'][1]['yields'][-1].update(value=float('nan'))]:
            c, h = fixture(); mutation(c,h)
            with self.assertRaises((ValueError,TypeError)):
                m.build_snapshot(c,h,NOW)

    def test_negative_history_not_clipped_and_gaps_not_filled(self):
        c,h=fixture();h['queryIndex'][1]['yields'][0]['value']=-3
        h['queryIndex'][1]['yields'].pop(1)
        d=m.build_snapshot(c,h,NOW)
        self.assertEqual(d['rows'][0]['apy'],-3)
        self.assertEqual(len(d['rows']),39)
        h['queryIndex'][1]['yields'].pop(-2)
        with self.assertRaises(ValueError):m.build_snapshot(c,h,NOW)

    def test_stale_source_rejected_despite_fresh_fetch(self):
        with self.assertRaises(ValueError):m.build_snapshot(*fixture(),NOW+dt.timedelta(days=11))

    def test_failed_regression_or_truncation_preserves_previous_file(self):
        d=m.build_snapshot(*fixture(),NOW)
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'snapshot.json';m.publish(d,path);before=path.read_bytes()
            for index in [0,10,-1]:
                new=copy.deepcopy(d);new['rows'].pop(index)
                with self.assertRaises(ValueError):m.publish(new,path)
                self.assertEqual(path.read_bytes(),before)
            self.assertEqual(json.loads(before)['current']['apy']['value'],5)

    def test_conflicting_duplicates_and_ambiguous_series_rejected(self):
        c,h=fixture();duplicate=copy.deepcopy(h['queryIndex'][1]['yields'][0]);duplicate['value']=6
        h['queryIndex'][1]['yields'].append(duplicate)
        with self.assertRaises(ValueError):m.build_snapshot(c,h,NOW)
        c,h=fixture();h['queryIndex'].append(h['queryIndex'][1])
        with self.assertRaises(ValueError):m.build_snapshot(c,h,NOW)


if __name__ == '__main__':unittest.main()
