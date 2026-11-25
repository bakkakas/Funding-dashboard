import importlib.util
from pathlib import Path
import unittest
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

if __name__=='__main__':unittest.main()
