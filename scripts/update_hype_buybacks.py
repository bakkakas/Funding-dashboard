"""Collect official Hyperliquid Assistance Fund buyback-and-burn metrics."""
import datetime
import json
import math
from pathlib import Path
import time
import urllib.request

API_URL = "https://api.hyperliquid.xyz/info"
ASSISTANCE_FUND = "0xfefefefefefefefefefefefefefefefefefefefe"
HYPE_TOKEN_ID = 150
HYPE_SPOT_COIN = "@107"
MAX_SUPPLY = 1_000_000_000
DESTINATION = Path(__file__).resolve().parents[1] / "data" / "hype-buybacks.json"


def finite(value):
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def post_info(payload, timeout=30):
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload, separators=(",", ":")).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Funding-Dashboard/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def collect_daily_fills(now_ms, request_json=post_info, days=30):
    """Query bounded UTC windows and split any response that reaches the API cap."""
    start_ms = now_ms - days * 86_400_000
    first_day = start_ms // 86_400_000
    last_day = now_ms // 86_400_000
    fills = {}

    def collect_window(window_start, window_end):
        rows = request_json({
            "type": "userFillsByTime",
            "user": ASSISTANCE_FUND,
            "startTime": window_start,
            "endTime": window_end,
            "aggregateByTime": True,
        })
        if not isinstance(rows, list):
            raise ValueError("Invalid Assistance Fund fill history")
        if len(rows) >= 2000:
            if window_end - window_start < 60_000:
                raise ValueError("Assistance Fund fills reached API cap in a one-minute window")
            midpoint = (window_start + window_end) // 2
            collect_window(window_start, midpoint)
            collect_window(midpoint + 1, window_end)
            return
        for row in rows:
            if row.get("coin") != HYPE_SPOT_COIN or row.get("side") != "B":
                continue
            timestamp = finite(row.get("time"))
            price = finite(row.get("px"))
            size = finite(row.get("sz"))
            if timestamp is None or price is None or size is None or price <= 0 or size <= 0:
                continue
            key = str(row.get("tid") or f"{int(timestamp)}:{price}:{size}")
            fills[key] = {"time": int(timestamp), "price": price, "size": size}

    for day in range(first_day, last_day + 1):
        window_start = max(start_ms, day * 86_400_000)
        window_end = min(now_ms, (day + 1) * 86_400_000 - 1)
        collect_window(window_start, window_end)
    return sorted(fills.values(), key=lambda row: row["time"])


def build_snapshot(state, fills, now_ms, existing=None):
    if not isinstance(state, dict) or not isinstance(state.get("balances"), list):
        raise ValueError("Invalid Assistance Fund state")
    hype = next((row for row in state["balances"] if row.get("coin") == "HYPE" and row.get("token") == HYPE_TOKEN_ID), None)
    if hype is None:
        raise ValueError("HYPE balance missing from Assistance Fund state")
    burned = finite(hype.get("total"))
    cumulative_spend = finite(hype.get("entryNtl"))
    if burned is None or cumulative_spend is None or burned <= 0 or cumulative_spend <= 0:
        raise ValueError("Invalid Assistance Fund HYPE metrics")

    def activity(days):
        cutoff = now_ms - days * 86_400_000
        selected = [row for row in fills if row["time"] >= cutoff]
        return {
            "hype": sum(row["size"] for row in selected),
            "usd": sum(row["size"] * row["price"] for row in selected),
            "fills": len(selected),
        }

    daily = {}
    for row in fills:
        date = datetime.datetime.fromtimestamp(row["time"] / 1000, datetime.timezone.utc).date().isoformat()
        bucket = daily.setdefault(date, {"date": date, "hype": 0.0, "usd": 0.0, "fills": 0})
        bucket["hype"] += row["size"]
        bucket["usd"] += row["size"] * row["price"]
        bucket["fills"] += 1

    observed_at = datetime.datetime.fromtimestamp(now_ms / 1000, datetime.timezone.utc).isoformat()
    history = []
    if isinstance(existing, dict) and isinstance(existing.get("history"), list):
        history = [row for row in existing["history"] if isinstance(row, dict) and row.get("observedAt") != observed_at]
    history.append({"observedAt": observed_at, "burnedHype": burned, "cumulativeSpendUsd": cumulative_spend})
    history = history[-400:]

    return {
        "schemaVersion": 1,
        "updatedAt": observed_at,
        "assistanceFundAddress": ASSISTANCE_FUND,
        "burnedHype": burned,
        "cumulativeSpendUsd": cumulative_spend,
        "averageBuyPriceUsd": cumulative_spend / burned,
        "maxSupply": MAX_SUPPLY,
        "burnedMaxSupplyPct": burned / MAX_SUPPLY * 100,
        "recent": {"1d": activity(1), "7d": activity(7), "30d": activity(30)},
        "dailyActivity": [daily[key] for key in sorted(daily)],
        "history": history,
        "sources": {
            "api": API_URL,
            "policy": "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees",
        },
    }


def main():
    now_ms = int(time.time() * 1000)
    existing = json.loads(DESTINATION.read_text()) if DESTINATION.exists() else None
    state = post_info({"type": "spotClearinghouseState", "user": ASSISTANCE_FUND})
    fills = collect_daily_fills(now_ms)
    snapshot = build_snapshot(state, fills, now_ms, existing)
    temporary = DESTINATION.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
    temporary.replace(DESTINATION)
    print(f"Saved HYPE buyback snapshot: {snapshot['burnedHype']:.2f} HYPE burned")


if __name__ == "__main__":
    main()
