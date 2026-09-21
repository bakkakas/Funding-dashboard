import unittest
from datetime import datetime, timedelta, timezone

from update_foreign_flow import parse_index_snapshot, parse_stock_trend_row


class ForeignFlowTests(unittest.TestCase):
    def test_parse_stock_trend_row(self):
        row={
            'bizdate':'20260918',
            'foreignerPureBuyQuant':'-1,673,323',
            'foreignerHoldRatio':'46.46%',
            'organPureBuyQuant':'+2,746,972',
            'closePrice':'260,000',
            'accumulatedTradingVolume':'17,489,615',
        }

        parsed=parse_stock_trend_row(row)

        self.assertEqual(parsed['date'],'2026-09-18')
        self.assertEqual(parsed['close'],260000)
        self.assertEqual(parsed['volume'],17489615)
        self.assertEqual(parsed['foreignNetShares'],-1673323)
        self.assertEqual(parsed['institutionNetShares'],2746972)
        self.assertEqual(parsed['individualNetSharesEstimated'],-1073649)
        self.assertEqual(parsed['foreignOwnershipPct'],46.46)

    def test_parse_index_snapshot_uses_business_date_and_signed_values(self):
        trend={
            'bizdate':'20260921',
            'personalValue':'-29,103',
            'foreignValue':'-1,297',
            'institutionalValue':'+13,801',
        }
        basic={'localTradedAt':'2026-09-21T15:24:00+09:00'}

        snapshot=parse_index_snapshot(trend,basic)

        self.assertEqual(snapshot,{
            'date':'2026-09-21',
            'sourceTime':'15:24',
            'individual':-29103,
            'foreign':-1297,
            'institution':13801,
        })

    def test_parse_index_snapshot_falls_back_to_collection_time(self):
        trend={'bizdate':'20260921','personalValue':'1','foreignValue':'2','institutionalValue':'3'}
        now=datetime(2026,9,21,14,7,tzinfo=timezone(timedelta(hours=9)))

        snapshot=parse_index_snapshot(trend,{},now)

        self.assertEqual(snapshot['sourceTime'],'14:07')

    def test_parse_index_snapshot_rejects_incomplete_data(self):
        trend={'bizdate':'20260921','personalValue':'1','foreignValue':'','institutionalValue':'3'}

        with self.assertRaisesRegex(ValueError,'Incomplete'):
            parse_index_snapshot(trend,{})


if __name__=='__main__':
    unittest.main()
