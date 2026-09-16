"""Collect DefiLlama USDe USD valuations for the static, same-origin board."""
import datetime
import json
import math
from pathlib import Path
import time
import urllib.request

SOURCE = "https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=146"
DESTINATION = Path(__file__).resolve().parents[1] / "data" / "usde-market-cap.json"


def build_snapshot(data, now):
    if not isinstance(data, list):
        raise ValueError("Invalid USDe history")
    rows = {}
    for item in data:
        try:
            date = int(item["date"])
            value = item["totalCirculatingUSD"]["peggedUSD"]
            if value is None or isinstance(value, bool) or value == "":
                continue
            cap = float(value)
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if 0 < date <= now + 300 and math.isfinite(cap) and cap >= 0:
            rows[date] = {"date": date, "totalCirculatingUSD": {"peggedUSD": cap}}
    history = [rows[date] for date in sorted(rows)]
    if not history or now - history[-1]["date"] > 2 * 86400:
        raise ValueError("Missing or stale USDe history; retaining previous snapshot")
    latest = history[-1]["date"]
    for days in (1, 7, 30, 365):
        if not any(date // 86400 == (latest - days * 86400) // 86400 for date in rows):
            raise ValueError(f"Missing {days}-day USDe baseline; retaining previous snapshot")
    return {"schemaVersion": 1, "asset": "USDe", "source": "DefiLlama",
            "sourceUrl": SOURCE, "dataAsOf": latest,
            "fetchedAt": datetime.datetime.fromtimestamp(now, datetime.timezone.utc).isoformat(),
            "history": history}


def main():
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "Funding-Dashboard/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        snapshot = build_snapshot(json.load(response), time.time())
    if DESTINATION.exists():
        existing = json.loads(DESTINATION.read_text())
        if existing.get("history") == snapshot["history"]:
            print("USDe history unchanged")
            return
    temporary = DESTINATION.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
    temporary.replace(DESTINATION)
    print(f"Saved {len(snapshot['history'])} USDe daily observations")


if __name__ == "__main__":
    main()
