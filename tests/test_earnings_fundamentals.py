import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('importer',Path(__file__).resolve().parents[1]/'scripts/import_earnings_fundamentals.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def capture():
    text='### Annual results\nFiscal PeriodMay\n### Quarterly results\n2026 Q4\n2027 Q1\n2027 Q2\n2027 Q3\n'
    for label,end in [('Net sales','EBITDA'),('EBIT','Earnings before Tax (EBT)'),('Net income','EPS')]:
        text+=f'\n {label}\nMillion USDReleased\nForecast\n Spread\n110\n100\n10%120\n100\n20%\n130\n140\n {end}\n'
    return {'url':'https://www.marketscreener.com/quote/stock/NIKE-INC-13739/calendar/','asOf':'2026-10-27T00:00:00Z','text':text}

class Fundamentals(unittest.TestCase):
    def test_fiscal_dates_and_future_null(self):
        result=module.parse_capture(capture(),'nke')
        self.assertEqual([r['period'] for r in result['rows']],['2026-05','2026-08','2026-11','2027-02'])
        self.assertEqual(result['rows'][0]['metrics'][0]['actual'],110)
        self.assertIsNone(result['rows'][-1]['metrics'][0]['actual'])
        self.assertEqual(result['rows'][-1]['metrics'][0]['estimate'],140)
        self.assertEqual(result['asOf'],capture()['asOf'])
        self.assertEqual([m['label'] for m in result['rows'][0]['metrics']],['매출액','EBIT','순이익'])
    def test_reject_wrong_issuer_and_misaligned_table(self):
        with self.assertRaises(ValueError):module.parse_capture(capture(),'googl')
        bad=capture();bad['text']=bad['text'].replace('110\n100\n10%','110\n100\n50%')
        with self.assertRaises(ValueError):module.parse_capture(bad,'nke')
    def test_reject_unknown_fiscal_calendar(self):
        bad=capture();bad['text']=bad['text'].replace('Fiscal PeriodMay','Fiscal PeriodMarch')
        with self.assertRaises(ValueError):module.parse_capture(bad,'nke')
if __name__=='__main__':unittest.main()
