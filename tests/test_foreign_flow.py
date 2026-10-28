import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from copy import deepcopy

from update_foreign_flow import parse_index_snapshot, parse_stock_trend_row, collect


class ForeignFlowTests(unittest.TestCase):
    def raw(self, day='2026-10-27'):
        return {'localTradedAt':day,'foreignHoldingRatio':'48.61','foreignHoldingStockQuantity':'355123730',
                'krx':{'foreignNetVolume':'-51049','organizationNetVolume':'113396','individualNetVolume':'-67933','tradingVolume':'3136495','closingPrice':'1374000'},
                'nxt':{'foreignNetVolume':'-2500','organizationNetVolume':'36537','individualNetVolume':'-51714','tradingVolume':'1665032','closingPrice':'1374000'}}

    def test_consolidated_hynix_matches_screenshot_without_double_counting_ownership(self):
        parsed=parse_stock_trend_row(self.raw())
        self.assertEqual(parsed['foreignNetShares'],-53549)
        self.assertEqual(parsed['institutionNetShares'],149933)
        self.assertEqual(parsed['individualNetShares'],-119647)
        self.assertEqual(parsed['volume'],4801527)
        self.assertEqual(parsed['foreignOwnershipPct'],48.61)
        self.assertEqual(parsed['foreignHeldShares'],355123730)
        self.assertNotIn('individualNetSharesEstimated',parsed)
        self.assertEqual(parsed['flowBasis'],'KRX+NXT')

    def test_krx_buy_can_be_consolidated_sell(self):
        row=self.raw('2026-10-22')
        row['krx']['foreignNetVolume']='25304';row['nxt']['foreignNetVolume']='-168045'
        self.assertEqual(parse_stock_trend_row(row)['foreignNetShares'],-142741)

    def test_pre_nxt_and_explicit_zero_volume_placeholder(self):
        row=self.raw('2025-03-21');row['nxt']=None
        self.assertEqual(parse_stock_trend_row(row)['foreignNetShares'],-51049)
        row['nxt']={'tradingVolume':'0','foreignNetVolume':None,'organizationNetVolume':None,'individualNetVolume':None}
        self.assertEqual(parse_stock_trend_row(row)['foreignNetShares'],-51049)
        row['nxt']['tradingVolume']='10'
        with self.assertRaisesRegex(ValueError,'Incomplete'):parse_stock_trend_row(row)

    def test_migration_fetches_full_history_and_replaces_legacy_not_mixes_it(self):
        legacy=[{'date':'2016-01-04','foreignNetShares':999},{'date':'2026-10-27','foreignNetShares':-51049}]
        pages=[{'items':[self.raw()],'hasNext':True,'cursor':'older'},
               {'items':[self.raw('2016-01-04'),self.raw('2015-12-30')],'hasNext':False}]
        with patch('update_foreign_flow.fetch_stock_page',side_effect=pages) as fetch:
            result=collect('000660',legacy)
        self.assertEqual(fetch.call_count,2)
        self.assertEqual([r['date'] for r in result],['2016-01-04','2026-10-27'])
        self.assertTrue(all(r['flowBasis']=='KRX+NXT' for r in result))
        self.assertEqual(legacy[0]['foreignNetShares'],999)

    def test_migration_rejects_lost_dates_and_broken_cursor(self):
        legacy=[{'date':'2016-01-04'}]
        with patch('update_foreign_flow.fetch_stock_page',return_value={'items':[self.raw()],'hasNext':False}):
            with self.assertRaisesRegex(ValueError,'migration'):collect('000660',legacy)
        with patch('update_foreign_flow.fetch_stock_page',return_value={'items':[self.raw()],'hasNext':True,'cursor':'repeat'}):
            with self.assertRaisesRegex(ValueError,'cursor'):collect('000660')

    def test_incremental_refresh_keeps_verified_archive_and_is_atomic_on_failure(self):
        existing=[parse_stock_trend_row(self.raw('2016-01-04')),parse_stock_trend_row(self.raw())]
        before=deepcopy(existing)
        with patch('update_foreign_flow.fetch_stock_page',return_value={'items':[self.raw(),self.raw('2026-06-01')],'hasNext':True,'cursor':'unused'}) as fetch:
            result=collect('000660',existing)
        self.assertEqual(fetch.call_count,1)
        self.assertEqual(result[0],existing[0])
        with patch('update_foreign_flow.fetch_stock_page',side_effect=ValueError('Unavailable')):
            with self.assertRaises(ValueError):collect('000660',existing)
        self.assertEqual(existing,before)

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
