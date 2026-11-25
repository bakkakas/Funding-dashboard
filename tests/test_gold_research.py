import importlib.util
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('gold',Path(__file__).resolve().parents[1]/'scripts/update_gold_research.py')
gold=importlib.util.module_from_spec(spec);spec.loader.exec_module(gold)

class GoldCollectorTests(unittest.TestCase):
 def test_completed_months_only_and_daily_average(self):
  rows=['observation_date,DFII10']
  for y in range(2010,2021):
   for m in range(1,13):
    rows.extend([f'{y}-{m:02d}-01,-1',f'{y}-{m:02d}-02,0',f'{y}-{m:02d}-03,.'])
  points=gold.parse_monthly('\n'.join(rows),'DFII10','2010-01','2020-02')
  self.assertEqual(points[-1],['2020-01',-.5]);self.assertEqual(len(points),121)
 def test_bad_payload_does_not_parse_as_data(self):
  for text in ['<html>Unavailable</html>','Date,Price\n2020-01,0','Date,Price\n2020-01,NaN']:
   with self.assertRaises(ValueError):gold.parse_monthly(text,'Price','1960-01','2026-11')

 def test_failed_update_preserves_existing_snapshot(self):
  with tempfile.TemporaryDirectory() as folder:
   dest=Path(folder)/'snapshot.json'
   dest.write_text('{"schemaVersion":1,"series":{}}')
   before=dest.read_bytes()
   with patch.object(gold,'download_text',side_effect=OSError('unavailable')):
    with self.assertRaises(OSError):gold.collect(output=dest)
   self.assertEqual(dest.read_bytes(),before)
   self.assertFalse(dest.with_suffix('.tmp').exists())

if __name__=='__main__':unittest.main()

class FedTargetTests(unittest.TestCase):
 def texts(self):
  start=gold.datetime(1982,9,27);end=gold.datetime(2010,2,2)
  rows={k:['observation_date,'+k] for k in ['DFEDTAR','DFEDTARL','DFEDTARU']}
  while start<=end:
   day=start.strftime('%Y-%m-%d')
   if day<'2008-12-16':rows['DFEDTAR'].append(day+',1')
   else:
    rows['DFEDTARL'].append(day+',0');rows['DFEDTARU'].append(day+',0.25')
   start+=gold.timedelta(days=1)
  return {k:'\n'.join(v) for k,v in rows.items()}
 def test_transition_midpoint_zero_bound_and_completed_months(self):
  s=gold.target_series(self.texts(),'2010-02');v=dict(s['values'])
  self.assertEqual(s['values'][0][0],'1982-10');self.assertEqual(s['values'][-1][0],'2010-01')
  self.assertAlmostEqual(v['2008-12'],(15+16*0.125)/31,places=6)
  self.assertEqual(v['2009-01'],0.125);self.assertEqual(s['latestRange']['lower'],0)
 def test_missing_bound_or_day_and_inverted_range_rejected(self):
  for ids in [('DFEDTARL',),('DFEDTARL','DFEDTARU')]:
   texts=self.texts()
   for k in ids:texts[k]='\n'.join(l for l in texts[k].splitlines() if not l.startswith('2009-01-02,'))
   with self.assertRaises(ValueError):gold.target_series(texts,'2010-02')
  texts=self.texts();texts['DFEDTARL']=texts['DFEDTARL'].replace('2009-01-02,0','2009-01-02,1')
  with self.assertRaises(ValueError):gold.target_series(texts,'2010-02')
 def test_target_failure_preserves_existing_file(self):
  previous=gold.json.loads((gold.ROOT/'data/gold-research.json').read_text())
  def parsed(text,column,*args):
   key={'Price':'gold','SP500':'sp500'}.get(column,column)
   return previous['series'][key]['values']
  with tempfile.TemporaryDirectory() as folder:
   dest=Path(folder)/'gold.json';dest.write_text(gold.json.dumps(previous));before=dest.read_bytes()
   with patch.object(gold,'download_text',return_value='bad target'),patch.object(gold,'parse_monthly',side_effect=parsed):
    with self.assertRaises(ValueError):gold.collect(output=dest)
   self.assertEqual(dest.read_bytes(),before)
   self.assertFalse(dest.with_suffix('.tmp').exists())
