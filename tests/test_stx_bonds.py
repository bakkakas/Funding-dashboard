import importlib.util
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stx_bonds', ROOT/'scripts/update_stx_bonds.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class BondCollectorTests(unittest.TestCase):
    def feed(self):
        stored = json.loads((ROOT/'data/stx-bonds.json').read_text())
        return {'bonds': stored['bonds'], 'unavailable': False, 'total': len(stored['bonds']), 'nowMs': 1793688551832, 'currentBurnHeight': 974361}
    def test_server_rendered_feed(self):
        feed=self.feed()
        wire='a:'+json.dumps(['$', 'component', None, feed])+'\n'
        html='<script>self.__next_f.push('+json.dumps([1,wire])+')</script>'
        self.assertEqual(mod.extract_feed(html),feed)
        self.assertEqual(len(mod.snapshot(feed)['bonds']),feed['total'])
    def test_partial_and_unavailable_fail_closed(self):
        for change in [{'total':999},{'unavailable':True},{'bonds':[]}]:
            with self.assertRaises(ValueError):mod.snapshot({**self.feed(),**change})
        with self.assertRaises(ValueError):mod.extract_feed('<html>Error</html>')
    def test_missing_balance_not_zero(self):
        feed=self.feed();feed['bonds'][0]['balances']['locked']['stx']=None
        with self.assertRaises(ValueError):mod.snapshot(feed)
