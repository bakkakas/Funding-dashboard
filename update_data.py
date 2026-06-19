import json, time, urllib.error, urllib.request, datetime
from pathlib import Path

BINANCE_BASE = "https://fapi.binance.com/fapi/v1/fundingRate"
BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
BYBIT_TICKERS = "https://api.bybit.com/v5/market/tickers"
BYBIT_FUNDING = "https://api.bybit.com/v5/market/funding/history"
BYBIT_MARK_KLINE = "https://api.bybit.com/v5/market/mark-price-kline"
HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info"
PAIRS = [
    {"symbol": "xyz:GOOGL", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Binance", "enabled": True},
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:SMSN", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Binance", "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:SKHX", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Binance", "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:GOLD", "displaySymbol": "GOLD", "assetId": "GOLD", "assetName": "Gold", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "XAUUSDT", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "Binance", "enabled": True},
    {"symbol": "XAUTUSDT", "displaySymbol": "XAUT", "assetId": "GOLD", "assetName": "Gold", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:AMZN", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Binance", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:AAPL", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Binance", "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:TSLA", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Binance", "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:NVDA", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Binance", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:META", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Binance", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:MSFT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Binance", "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:MSTR", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Binance", "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:COIN", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Binance", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:TSM", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Binance", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:PLTR", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Binance", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:BABA", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Binance", "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Bybit", "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Binance", "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Bybit", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Binance", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Bybit", "enabled": True}
]
WINDOWS = {"1D": 1, "7D": 7, "30D": 30, "90D": 90}
DATA_PATH = Path("funding_data.json")
MAX_RETRIES = 4
RETRY_BASE_DELAY = 1.5

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_error = e
            if attempt == MAX_RETRIES:
                break
            time.sleep(RETRY_BASE_DELAY * attempt)
    raise RuntimeError(f"failed to fetch after {MAX_RETRIES} attempts: {url}: {last_error}")


def post_json(url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_error = e
            if attempt == MAX_RETRIES:
                break
            time.sleep(RETRY_BASE_DELAY * attempt)
    raise RuntimeError(f"failed to post after {MAX_RETRIES} attempts: {url}: {last_error}")


def pair_key(pair):
    return f"{pair['exchange']}:{pair['symbol']}"


def payments_per_day(pair):
    if pair["exchange"] == "Hyperliquid":
        return 24
    return 3

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


def fetch_hyperliquid_candles(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    out = []
    cur = start_ms
    seen = set()
    while cur < end_ms:
        rows = post_json(HYPERLIQUID_INFO, {
            "type": "candleSnapshot",
            "req": {
                "coin": symbol,
                "interval": "1h",
                "startTime": cur,
                "endTime": end_ms,
            },
        })
        if not rows:
            break
        for row in rows:
            ts = int(row["t"])
            if ts in seen:
                continue
            seen.add(ts)
            out.append({
                "time": ts,
                "markPrice": float(row["c"]),
            })
        newest = max(int(row["t"]) for row in rows)
        if newest < cur:
            break
        cur = newest + 3600000
        if len(rows) < 500:
            break
    out.sort(key=lambda x: x["time"])
    return out


def fetch_hyperliquid_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    funding_rows = []
    cur = start_ms
    seen = set()
    while cur < end_ms:
        batch = post_json(HYPERLIQUID_INFO, {
            "type": "fundingHistory",
            "coin": symbol,
            "startTime": cur,
            "endTime": end_ms,
        })
        if not batch:
            break
        for row in batch:
            ts = int(row["time"])
            if ts in seen:
                continue
            seen.add(ts)
            funding_rows.append(row)
        newest = max(int(row["time"]) for row in batch)
        if newest < cur:
            break
        cur = newest + 1
        if len(batch) < 500:
            break
    mark_rows = fetch_hyperliquid_candles(symbol, days)

    def nearest_mark_price(ts):
        eligible = [row for row in mark_rows if row["time"] <= ts]
        if eligible:
            return eligible[-1]["markPrice"]
        return mark_rows[0]["markPrice"] if mark_rows else None

    rows = []
    for row in funding_rows:
        ts = int(row["time"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "premium": float(row["premium"]),
            "markPrice": nearest_mark_price(ts),
        })
    rows.sort(key=lambda x: x["fundingTime"])
    return rows


def fetch_hyperliquid_latest(symbol, dex):
    try:
        meta, ctxs = post_json(HYPERLIQUID_INFO, {"type": "metaAndAssetCtxs", "dex": dex})
        for asset, ctx in zip(meta.get("universe", []), ctxs):
            if asset.get("name") != symbol:
                continue
            now_ms = int(time.time() * 1000)
            next_hour_ms = ((now_ms // 3600000) + 1) * 3600000
            mark_price = float(ctx["markPx"])
            return {
                "markPrice": mark_price,
                "indexPrice": float(ctx["oraclePx"]),
                "lastFundingRate": float(ctx["funding"]),
                "premium": float(ctx["premium"]),
                "nextFundingTime": next_hour_ms,
                "time": now_ms,
                "openInterest": float(ctx["openInterest"]),
                "dayNtlVlm": float(ctx["dayNtlVlm"]),
                "available": True,
            }
        raise RuntimeError(f"{symbol} not found in Hyperliquid dex {dex}")
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "premium": None,
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
    if pair["exchange"] == "Hyperliquid":
        return fetch_hyperliquid_history(pair["symbol"], days)
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")


def fetch_latest(pair):
    if pair["exchange"] == "Binance":
        return fetch_binance_latest(pair["symbol"])
    if pair["exchange"] == "Bybit":
        return fetch_bybit_latest(pair["symbol"])
    if pair["exchange"] == "Hyperliquid":
        return fetch_hyperliquid_latest(pair["symbol"], pair["dex"])
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")

def summarize(rows, periods_per_day):
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
        "annualizedPct": -avg * periods_per_day * 365 * 100,
        "sumFundingRate": sum(rates),
        "firstFundingTime": rows[0]["fundingTime"],
        "lastFundingTime": rows[-1]["fundingTime"],
    }

def main():
    previous = {}
    if DATA_PATH.exists():
        try:
            previous = json.loads(DATA_PATH.read_text())
        except json.JSONDecodeError:
            previous = {}

    data = {
        "updatedAt": int(time.time() * 1000),
        "meta": {
            "windows": WINDOWS,
            "partialFailure": False,
            "errors": [],
            "notes": {
                "Hyperliquid xyz:GOOGL": "HIP-3 builder-deployed perp on dex xyz; hourly funding history available via public info API",
                "SAMSUNG": "Binance symbol is SAMSUNGUSDT; Hyperliquid API symbol is xyz:SMSN",
                "SKHYNIX": "Binance symbol is SKHYNIXUSDT; Hyperliquid API symbol is xyz:SKHX",
                "GOLD": "Binance symbol is XAUUSDT; Bybit symbol is XAUTUSDT; Hyperliquid API symbol is xyz:GOLD",
                "Bybit GOOGLUSDT": "Funding history and current snapshot available via public linear market API",
                "Binance XAUUSDT": "Funding history and current snapshot available via public futures API",
                "Bybit XAUTUSDT": "Funding history and current snapshot available via public linear market API"
            }
        },
        "pairs": {},
        "comparisons": {
            "Binance": {"supported": True, "notes": "Funding history available via public futures API"},
            "Bybit": {"supported": True, "notes": "Funding history + current snapshot available via public linear market API"},
            "Hyperliquid": {"supported": True, "notes": "HIP-3 xyz perp funding history + current snapshot available via public info API"}
        }
    }

    for pair in PAIRS:
        symbol = pair["symbol"]
        key = pair_key(pair)
        pair_out = {
            "key": key,
            "symbol": symbol,
            "displaySymbol": pair.get("displaySymbol", symbol),
            "assetId": pair.get("assetId", symbol),
            "assetName": pair.get("assetName", pair.get("displaySymbol", symbol)),
            "exchange": pair["exchange"],
            "dex": pair.get("dex"),
            "fundingPeriodsPerDay": payments_per_day(pair),
            "windows": {},
            "latest": {},
            "rows": []
        }

        try:
            pair_out["latest"] = fetch_latest(pair)
            full_rows = fetch_history(pair, WINDOWS["90D"])
            pair_out["rows"] = full_rows
            for label, days in WINDOWS.items():
                min_ts = int(time.time() * 1000) - days * 24 * 3600 * 1000
                filtered = [r for r in full_rows if r["fundingTime"] >= min_ts]
                pair_out["windows"][label] = summarize(filtered, payments_per_day(pair))
            pair_out["available"] = True
            data["pairs"][key] = pair_out
        except Exception as e:
            old_pair = previous.get("pairs", {}).get(key)
            data["meta"]["partialFailure"] = True
            data["meta"]["errors"].append({
                "key": key,
                "error": str(e),
                "time": int(time.time() * 1000)
            })
            if old_pair:
                old_pair["available"] = False
                old_pair["lastError"] = str(e)
                old_pair["lastErrorAt"] = int(time.time() * 1000)
                data["pairs"][key] = old_pair
            else:
                pair_out["available"] = False
                pair_out["lastError"] = str(e)
                pair_out["lastErrorAt"] = int(time.time() * 1000)
                data["pairs"][key] = pair_out

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

if __name__ == '__main__':
    main()
