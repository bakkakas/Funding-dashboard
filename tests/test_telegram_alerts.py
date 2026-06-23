import unittest

from send_telegram_alerts import format_alert, select_alerts


class TelegramAlertsTest(unittest.TestCase):
    def test_select_alerts_filters_sent_and_severity(self):
        payload = {
            "alerts": [
                {"id": "a", "severity": "high", "type": "funding_spread"},
                {"id": "b", "severity": "medium", "type": "funding_spread"},
                {"id": "c", "severity": "high", "type": "data_reliability"},
            ]
        }
        selected = select_alerts(payload, {"sent": {"a": {}}}, min_severity="high", limit=10)
        self.assertEqual([alert["id"] for alert in selected], ["c"])

    def test_select_alerts_respects_limit(self):
        payload = {"alerts": [{"id": str(i), "severity": "high"} for i in range(5)]}
        selected = select_alerts(payload, {"sent": {}}, min_severity="high", limit=2)
        self.assertEqual([alert["id"] for alert in selected], ["0", "1"])

    def test_format_funding_spread_alert(self):
        text = format_alert({
            "id": "GOOGL:current:funding-spread:wide",
            "type": "funding_spread",
            "severity": "high",
            "assetId": "GOOGL",
            "scope": "current",
            "level": "wide",
            "annualizedSpreadPct": 27.1234,
            "fundingSpread8h": 0.000247,
            "highExchange": "Aster",
            "lowExchange": "OKX",
        })
        self.assertIn("GOOGL Funding Spread wide", text)
        self.assertIn("Annualized spread: 27.12%", text)
        self.assertIn("8H spread: 0.0247%", text)
        self.assertIn("Long 유리: Aster", text)


if __name__ == "__main__":
    unittest.main()
