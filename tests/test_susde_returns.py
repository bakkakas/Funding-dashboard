import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_susde_returns as m
import run_susde_yield_local as runner

NOW=dt.datetime(2026,11,11,4,tzinfo=dt.timezone.utc)
def history():
    return [{'timestamp':(NOW-dt.timedelta(days=40-i)).replace(hour=23).isoformat(),'price':1.2+i*.0001} for i in range(40)]

class ReturnsTests(unittest.TestCase):
    def test_completed_days_and_units(self):
        raw=history()+[{'timestamp':NOW.isoformat(),'price':1.3}]
        data=m.build_snapshot(raw,NOW)
        self.assertEqual(len(data['rows']),40)
        self.assertEqual(data['through'],'2026-11-10')
        self.assertEqual(data['rows'][-1]['rate'],raw[-2]['price'])
        self.assertEqual(data['unit'],'USDe per sUSDe')
    def test_missing_days_not_filled_flat_and_negative_not_clamped(self):
        raw=history();del raw[5];raw[-1]['price']=1.1
        data=m.build_snapshot(raw,NOW);self.assertEqual(len(data['rows']),39)
        self.assertEqual(data['rows'][-1]['rate'],1.1)
    def test_latest_intraday_observation_selected_and_conflicts_rejected(self):
        raw=history();raw.append(dict(raw[-1],timestamp='2026-11-10T22:00:00+00:00',price=1.1))
        self.assertEqual(m.build_snapshot(raw,NOW)['rows'][-1]['rate'],history()[-1]['price'])
        raw.append(dict(raw[0],price=1.5))
        with self.assertRaises(ValueError):m.build_snapshot(raw,NOW)
    def test_invalid_future_stale_rates_rejected(self):
        for value in [0,-1,None,True,float('nan'),'1.2']:
            raw=history();raw[0]['price']=value
            with self.assertRaises(ValueError):m.build_snapshot(raw,NOW)
        for timestamp in ['2027-01-01T00:00:00+00:00','2026-10-01T00:00:00']:
            raw=history();raw[0]['timestamp']=timestamp
            with self.assertRaises(ValueError):m.build_snapshot(raw,NOW)
        with self.assertRaises(ValueError):m.build_snapshot(history()[:-4],NOW)
    def test_failed_progress_preserves_old_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'data.json';snap=m.build_snapshot(history(),NOW);m.publish(snap,p);old=p.read_bytes()
            snap['rows'].pop(2)
            with self.assertRaises(ValueError):m.publish(snap,p)
            self.assertEqual(old,p.read_bytes())
    def test_scheduler_collects_returns_even_when_apy_fails_and_reports_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp)/'repo').mkdir();commands=[]
            def run(args,**kwargs):
                commands.append(args)
                failed=any(str(a).endswith('update_susde_yield.py') for a in args)
                dirty='diff' in args
                return subprocess.CompletedProcess(args,1 if failed or dirty else 0,stdout='')
            with patch.object(sys,'argv',['runner',tmp]),patch.object(subprocess,'run',side_effect=run),patch.dict('os.environ'):
                with self.assertRaisesRegex(RuntimeError,'Partial collection failure'):runner.main()
            self.assertTrue(any('data/susde-returns.json' in c for c in commands))
            self.assertFalse(any('data/susde-yield.json' in c for c in commands))
            self.assertTrue(any('push' in c for c in commands))

if __name__=='__main__':unittest.main()
