import datetime
import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "update_hype_buybacks.py"
SPEC = importlib.util.spec_from_file_location("update_hype_buybacks", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class HypeBuybackTests(unittest.TestCase):
    def test_build_snapshot_separates_cumulative_and_recent_activity(self):
        now = int(datetime.datetime(2026, 10, 13, tzinfo=datetime.timezone.utc).timestamp() * 1000)
        state = {"balances": [{"coin": "HYPE", "token": 150, "total": "48000000", "entryNtl": "1360000000"}]}
        fills = [
            {"time": now - 2 * 3_600_000, "price": 80, "size": 10},
            {"time": now - 3 * 86_400_000, "price": 75, "size": 20},
            {"time": now - 20 * 86_400_000, "price": 70, "size": 30},
        ]
        snapshot = MODULE.build_snapshot(state, fills, now)
        self.assertEqual(snapshot["burnedHype"], 48_000_000)
        self.assertEqual(snapshot["cumulativeSpendUsd"], 1_360_000_000)
        self.assertAlmostEqual(snapshot["burnedMaxSupplyPct"], 4.8)
        self.assertEqual(snapshot["recent"]["1d"]["hype"], 10)
        self.assertEqual(snapshot["recent"]["7d"]["hype"], 30)
        self.assertEqual(snapshot["recent"]["30d"]["hype"], 60)
        self.assertEqual(len(snapshot["dailyActivity"]), 3)

    def test_daily_collection_filters_non_hype_and_refuses_capped_days(self):
        now = 2 * 86_400_000

        def request(payload):
            return [
                {"coin": "@107", "side": "B", "time": payload["startTime"] + 1, "px": "10", "sz": "2", "tid": payload["startTime"] + 1},
                {"coin": "@107", "side": "S", "time": payload["startTime"] + 2, "px": "11", "sz": "3", "tid": payload["startTime"] + 2},
                {"coin": "PURR", "side": "B", "time": payload["startTime"] + 3, "px": "1", "sz": "4", "tid": payload["startTime"] + 3},
            ]

        fills = MODULE.collect_daily_fills(now, request_json=request, days=1)
        self.assertEqual(len(fills), 2)
        self.assertTrue(all(row["size"] == 2 for row in fills))

        calls = []
        def capped_then_empty(payload):
            calls.append(payload)
            return [{}] * 2000 if payload["endTime"] - payload["startTime"] > 60_000 else []
        MODULE.collect_daily_fills(now, request_json=capped_then_empty, days=1)
        self.assertGreater(len(calls), 2)

    def test_invalid_assistance_fund_state_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.build_snapshot({"balances": []}, [], 1)


if __name__ == "__main__":
    unittest.main()
