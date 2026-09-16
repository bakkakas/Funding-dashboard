import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("usde", Path(__file__).resolve().parents[1] / "scripts/update_usde_market_cap.py")
usde = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usde)


class SnapshotTests(unittest.TestCase):
    now = 1789516800

    def rows(self):
        return [{"date": str(self.now - days * 86400), "totalCirculatingUSD": {"peggedUSD": 100 + days}} for days in (0, 1, 7, 30, 365)]

    def test_valid_usd_history(self):
        snapshot = usde.build_snapshot(self.rows(), self.now)
        self.assertEqual(snapshot["history"][-1]["totalCirculatingUSD"]["peggedUSD"], 100)
        self.assertEqual(snapshot["dataAsOf"], self.now)

    def test_rejects_missing_baseline_and_stale_data(self):
        with self.assertRaises(ValueError):
            usde.build_snapshot(self.rows()[:-1], self.now)
        with self.assertRaises(ValueError):
            usde.build_snapshot(self.rows(), self.now + 3 * 86400)

    def test_supply_cannot_replace_usd_value(self):
        rows = self.rows()
        rows[0] = {"date": self.now, "totalCirculating": {"peggedUSD": 100}}
        with self.assertRaises(ValueError):
            usde.build_snapshot(rows, self.now)


if __name__ == "__main__":
    unittest.main()
