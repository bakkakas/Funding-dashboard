import unittest

from funding_dashboard.metrics import (
    annualized_from_fee,
    build_asset_metrics,
    comparable_fee_from_annualized,
    latest_long_fee,
    latest_short_fee,
    spread_alert_level,
    summarize,
)
from update_data import funding_interval_hours


class FundingMetricTests(unittest.TestCase):
    def test_raw_positive_funding_is_negative_for_long(self):
        latest = {"lastFundingRate": 0.001}
        self.assertEqual(latest_long_fee(latest), -0.001)
        self.assertEqual(latest_short_fee(latest), 0.001)

    def test_raw_negative_funding_is_positive_for_long(self):
        latest = {"lastFundingRate": -0.001}
        self.assertEqual(latest_long_fee(latest), 0.001)
        self.assertEqual(latest_short_fee(latest), -0.001)

    def test_explicit_long_short_fees_are_preserved(self):
        latest = {"lastFundingRate": 0.001, "longFundingFee": -0.0012, "shortFundingFee": 0.0008}
        self.assertEqual(latest_long_fee(latest), -0.0012)
        self.assertEqual(latest_short_fee(latest), 0.0008)

    def test_interval_annualization_and_8h_equivalent(self):
        one_hour_fee = 0.0001
        annualized = annualized_from_fee(one_hour_fee, 1)
        self.assertAlmostEqual(annualized, 87.6)
        self.assertAlmostEqual(comparable_fee_from_annualized(annualized, 8), one_hour_fee * 8)

        four_hour_fee = 0.0001
        annualized = annualized_from_fee(four_hour_fee, 4)
        self.assertAlmostEqual(comparable_fee_from_annualized(annualized, 8), four_hour_fee * 2)

    def test_aster_default_interval_is_8h(self):
        pair = {"exchange": "Aster", "symbol": "BTCUSDT"}
        self.assertEqual(funding_interval_hours(pair), 8)

    def test_summarize_uses_long_perspective_for_annualized(self):
        rows = [
            {"fundingTime": 1, "fundingRate": 0.001},
            {"fundingTime": 2, "fundingRate": -0.0005},
        ]
        summary = summarize(rows, periods_per_day=3)
        self.assertEqual(summary["count"], 2)
        self.assertAlmostEqual(summary["avgFundingRate"], 0.00025)
        self.assertAlmostEqual(summary["annualizedPct"], -27.375)

    def test_spread_alert_thresholds(self):
        self.assertEqual(spread_alert_level(4.99), "normal")
        self.assertEqual(spread_alert_level(5), "narrow")
        self.assertEqual(spread_alert_level(20), "wide")

    def test_asset_metrics_rank_by_8h_long_fee(self):
        data = {
            "updatedAt": 10_000,
            "pairs": {
                "Hyperliquid:BTC": {
                    "symbol": "BTC",
                    "assetId": "BTC",
                    "exchange": "Hyperliquid",
                    "fundingIntervalHours": 1,
                    "available": True,
                    "latest": {"lastFundingRate": -0.0001, "time": 10_000},
                    "rows": [{"fundingTime": 1, "fundingRate": -0.0001}],
                    "windows": {},
                },
                "Binance:BTCUSDT": {
                    "symbol": "BTCUSDT",
                    "assetId": "BTC",
                    "exchange": "Binance",
                    "fundingIntervalHours": 8,
                    "available": True,
                    "latest": {"lastFundingRate": 0.0002, "time": 10_000},
                    "rows": [{"fundingTime": 1, "fundingRate": 0.0002}],
                    "windows": {},
                },
            },
        }
        metrics = build_asset_metrics(data, {"90D": 90}, 8)
        current = metrics["BTC"]["current"]
        self.assertEqual(current["longFavored"], "Hyperliquid:BTC")
        self.assertEqual(current["shortFavored"], "Binance:BTCUSDT")
        self.assertAlmostEqual(current["spread"]["longFundingFee8h"], 0.001)


if __name__ == "__main__":
    unittest.main()
