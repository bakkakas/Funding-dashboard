import json, time, urllib.request, datetime
from pathlib import Path

BINANCE_BASE = "https://fapi.binance.com/fapi/v1/fundingRate"
BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
BYBIT_TICKERS = "https://api.bybit.com/v5/market/tickers"
BYBIT_FUNDING = "https://api.bybit.com/v5/market/funding/history"
BYBIT_MARK_KLINE = "https://api.bybit.com/v5/market/mark-price-kline"
PAIRS = [
    {"symbol": "GOOGLUSDT", "exchange": "Binance", "group": "US Big Tech", "enabled": True},
    {"symbol": "GOOGLUSDT", "exchange": "Bybit", "group": "US Big Tech", "enabled": True},
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

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def pair_key(pair):
    return f"{pair['exchange']}:{pair['symbol']}"

def fetch_binance_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{BINANCE_BASE}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
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
    try:
        row = fetch_json(url)
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "time": int(row["time"]),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_bybit_mark_prices(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    out = []
    cur_end = end_ms
    seen = set()
    while True:
        url = f"{BYBIT_MARK_KLINE}?category=linear&symbol={symbol}&interval=240&end={cur_end}&limit=1000"
        data = fetch_json(url)
        batch = data.get("result", {}).get("list", [])
        if not batch:
            break
        progressed = False
        for row in batch:
            ts = int(row[0])
            if ts < start_ms:
                continue
            if ts in seen:
                continue
            seen.add(ts)
            progressed = True
            out.append({"time": ts, "markPrice": float(row[4])})
        oldest = min(int(row[0]) for row in batch)
        if oldest <= start_ms or not progressed:
            break
        cur_end = oldest - 1
    out.sort(key=lambda x: x["time"])
    return out


def fetch_bybit_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    url = f"{BYBIT_FUNDING}?category=linear&symbol={symbol}&startTime={start_ms}&endTime={end_ms}&limit=200"
    data = fetch_json(url)
    funding_rows = data.get("result", {}).get("list", [])
    mark_rows = fetch_bybit_mark_prices(symbol, days)

    def nearest_mark_price(ts):
        eligible = [row for row in mark_rows if row["time"] <= ts]
        if eligible:
            return eligible[-1]["markPrice"]
        return mark_rows[0]["markPrice"] if mark_rows else None

    rows = []
    for row in funding_rows:
        ts = int(row["fundingRateTimestamp"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": nearest_mark_price(ts),
        })
    rows.sort(key=lambda x: x["fundingTime"])
    return rows


def fetch_bybit_latest(symbol):
    url = f"{BYBIT_TICKERS}?category=linear&symbol={symbol}"
    try:
        data = fetch_json(url)
        row = data["result"]["list"][0]
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["fundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "time": int(data["time"]),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_history(pair, days):
    if pair["exchange"] == "Binance":
        return fetch_binance_history(pair["symbol"], days)
    if pair["exchange"] == "Bybit":
        return fetch_bybit_history(pair["symbol"], days)
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")


def fetch_latest(pair):
    if pair["exchange"] == "Binance":
        return fetch_binance_latest(pair["symbol"])
    if pair["exchange"] == "Bybit":
        return fetch_bybit_latest(pair["symbol"])
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")

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
        "annualizedPct": -avg * 3 * 365 * 100,
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
                "Bybit GOOGLUSDT": "Funding history and current snapshot available via public linear market API",
                "Hyperliquid xyz:GOOGL": "spot market; funding history not applicable",
                "THENA GOOGLUSDT": "public page/API access currently blocked (403) in this environment"
            }
        },
        "pairs": {},
        "comparisons": {
            "Binance": {"supported": True, "notes": "Funding history available via public futures API"},
            "Bybit": {"supported": True, "notes": "Funding history + current snapshot available via public linear market API"},
            "Hyperliquid xyz:GOOGL": {"supported": False, "notes": "Spot market, not perp funding market"},
            "THENA GOOGLUSDT": {"supported": False, "notes": "Public endpoint unavailable from current environment (403)"}
        }
    }

    for pair in PAIRS:
        symbol = pair["symbol"]
        pair_out = {
            "key": pair_key(pair),
            "symbol": symbol,
            "exchange": pair["exchange"],
            "group": pair.get("group", "Other"),
            "windows": {},
            "latest": fetch_latest(pair),
            "rows": []
        }
        full_rows = fetch_history(pair, WINDOWS["90D"])
        pair_out["rows"] = full_rows
        for label, days in WINDOWS.items():
            min_ts = int(time.time() * 1000) - days * 24 * 3600 * 1000
            filtered = [r for r in full_rows if r["fundingTime"] >= min_ts]
            pair_out["windows"][label] = summarize(filtered)
        data["pairs"][pair_key(pair)] = pair_out

    Path('funding_data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
