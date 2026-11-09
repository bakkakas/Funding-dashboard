import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('credit', Path(__file__).resolve().parents[1] / 'scripts/update_credit_balance.py')
credit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(credit)

class CreditBalances(unittest.TestCase):
    def test_market_mapping_and_order(self):
        rows = credit.parse_rows({'ds1': [
            {'TMPV1': '20261106', 'TMPV2': 28385643, 'TMPV3': 22067114, 'TMPV4': 6318529, 'TMPV5': 27035},
            {'TMPV1': '합계'},
            {'TMPV1': '20261105', 'TMPV2': 28771509, 'TMPV3': 22320468, 'TMPV4': 6451041}]})
        self.assertEqual(rows[-1], {'date': '2026-11-06', 'KOSPI': 22067114, 'KOSDAQ': 6318529})
        self.assertEqual(rows[0]['date'], '2026-11-05')
        self.assertEqual(rows[-1]['KOSPI'] / 100, 220671.14)

    def test_invalid_data_rejected(self):
        for value in [None, 0, -1, float('nan'), True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                credit.parse_rows({'ds1': [{'TMPV1': '20261106', 'TMPV2': 30, 'TMPV3': value, 'TMPV4': 10}]})
        with self.assertRaises(ValueError):
            credit.parse_rows({'ds1': [{'TMPV1': '20261106', 'TMPV2': 300, 'TMPV3': 20, 'TMPV4': 10}]})
        with self.assertRaises(ValueError):
            credit.parse_rows({'ds1': []})

    def test_fetch_failure_does_not_write(self):
        from unittest.mock import patch
        import tempfile
        import json
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'credit.json'
            original = json.dumps({'rows':[{'date':'2026-11-06','KOSPI':22067114,'KOSDAQ':6318529}]})
            path.write_text(original)
            with patch.object(credit, 'OUTPUT', path), patch.object(credit, 'fetch_rows', side_effect=TimeoutError), self.assertRaises(TimeoutError):
                credit.main()
            self.assertEqual(path.read_text(), original)
