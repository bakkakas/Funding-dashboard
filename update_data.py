import json, time, urllib.request, datetime

BINANCE_BASE = "https://fapi.binance.com/fapi/v1/fundingRate"
BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
PAIRS = [
    {"symbol": "GOOGLUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "AMZNUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "AAPLUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "TSLAUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "NVDAUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "METAUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "MSFTUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "MSTRUSDT", "exchange": "Binance", "group": "US Growth", "enabled": True},
    {"symbol": "COINUSDT", "exchange": "Binance", "group": "US Growth", "enabled": True},
    {"symbol": "TSMUSDT", "exchange": "Binance", "group": "Semiconductor", "enabled": True},
    {"symbol": "PLTRUSDT", "exchange": "Binance", "group": "US Growth", "enabled": True},
    {"symbol": "BABAUSDT", "exchange": "Binance", "group": "China", "enabled": True},
    {"symbol": "QQQUSDT", "exchange": "Binance", "group": "Index ETF", "enabled": True},
    {"symbol": "SPYUSDT", "exchange": "Binance", "group": "Index ETF", "enabled": True}
]
WINDOWS = {"7D": 7, "30D": 30, "90D": 90}

def fetch_binance_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{BINANCE_BASE}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        with urllib.request.urlopen(url, timeout=30) as r:
            batch = json.loads(r.read().decode())
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = batch[-1]["fundingTime"] + 1
    seen = set()
    ded = []
    for row in rows:
        t = row["fundingTime"]
        if t not in seen:
            seen.add(t)
            ded.append({
                "fundingTime": row["fundingTime"],
                "fundingRate": float(row["fundingRate"]),
                "markPrice": float(row["markPrice"]),
            })
    return ded


def fetch_binance_latest(symbol):
    url = f"{BINANCE_PREMIUM}?symbol={symbol}"
    with urllib.request.urlopen(url, timeout=30) as r:
        row = json.loads(r.read().decode())
    return {
        "markPrice": float(row["markPrice"]),
        "indexPrice": float(row["indexPrice"]),
        "lastFundingRate": float(row["lastFundingRate"]),
        "nextFundingTime": int(row["nextFundingTime"]),
        "time": int(row["time"])
    }

def summarize(rows):
    if not rows:
        return {
            "count": 0, "avgFundingRate": 0, "annualizedPct": 0,
            "sumFundingRate": 0, "firstFundingTime": None, "lastFundingTime": None
        }
    rates = [r["fundingRate"] for r in rows]
    avg = sum(rates) / len(rates)
    return {
        "count": len(rows),
        "avgFundingRate": avg,
        "annualizedPct": avg * 3 * 365 * 100,
        "sumFundingRate": sum(rates),
        "firstFundingTime": rows[0]["fundingTime"],
        "lastFundingTime": rows[-1]["fundingTime"],
    }

def main():
    data = {
        "updatedAt": int(time.time() * 1000),
        "meta": {
            "windows": WINDOWS,
            "notes": {
                "Hyperliquid xyz:GOOGL": "spot market; funding history not applicable",
                "THENA GOOGLUSDT": "public page/API access currently blocked (403) in this environment"
            }
        },
        "pairs": {},
        "comparisons": {
            "Binance": {"supported": True, "notes": "Funding history available via public futures API"},
            "Hyperliquid xyz:GOOGL": {"supported": False, "notes": "Spot market, not perp funding market"},
            "THENA GOOGLUSDT": {"supported": False, "notes": "Public endpoint unavailable from current environment (403)"}
        }
    }

    for pair in PAIRS:
        symbol = pair["symbol"]
        pair_out = {
            "symbol": symbol,
            "exchange": pair["exchange"],
            "group": pair.get("group", "Other"),
            "windows": {},
            "latest": fetch_binance_latest(symbol),
            "rows": []
        }
        full_rows = fetch_binance_history(symbol, WINDOWS["90D"])
        pair_out["rows"] = full_rows
        for label, days in WINDOWS.items():
            filtered = full_rows[-days*3-5:] if label != '90D' else full_rows
            # safer exact filter by timestamp
            min_ts = int(time.time() * 1000) - days * 24 * 3600 * 1000
            filtered = [r for r in full_rows if r["fundingTime"] >= min_ts]
            pair_out["windows"][label] = summarize(filtered)
        data["pairs"][symbol] = pair_out

    Path('funding_data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    from pathlib import Path
    main()
