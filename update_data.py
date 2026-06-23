import json, time, urllib.error, urllib.parse, urllib.request, datetime
from pathlib import Path

from funding_dashboard.alerts import build_alerts
from funding_dashboard.metrics import build_asset_metrics, summarize


BINANCE_BASE = "https://fapi.binance.com/fapi/v1/fundingRate"
BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
BYBIT_TICKERS = "https://api.bybit.com/v5/market/tickers"
BYBIT_FUNDING = "https://api.bybit.com/v5/market/funding/history"
BYBIT_MARK_KLINE = "https://api.bybit.com/v5/market/mark-price-kline"
HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info"
ASTER_FUNDING = "https://fapi.asterdex.com/fapi/v1/fundingRate"
ASTER_MARK_KLINE = "https://fapi.asterdex.com/fapi/v1/markPriceKlines"
ASTER_PREMIUM = "https://fapi.asterdex.com/fapi/v3/premiumIndex"
OKX_FUNDING = "https://www.okx.com/api/v5/public/funding-rate"
OKX_FUNDING_HISTORY = "https://www.okx.com/api/v5/public/funding-rate-history"
OKX_MARK_PRICE = "https://www.okx.com/api/v5/public/mark-price"
OKX_MARK_CANDLES = "https://www.okx.com/api/v5/market/mark-price-candles"
OKX_INDEX_TICKER = "https://www.okx.com/api/v5/market/index-tickers"
VARIATIONAL_STATS = "https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats"
ORBS_PERPS_FUNDING = "https://perps.thena.fi/api/proxy/fapi/fundingRate"
ORBS_PERPS_PREMIUM = "https://perps.thena.fi/api/proxy/fapi/premiumIndex"
ORBS_PERPS_AGGREGATED_FUNDING = "https://perps.thena.fi/api/solver/aggregatedFundingData?chainId=0"
orbs_perps_funding_cache = None
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config/pairs.json"
DATA_PATH = BASE_DIR / "funding_data.json"
ALERTS_PATH = BASE_DIR / "alerts.json"


def load_config(path=CONFIG_PATH):
    return json.loads(path.read_text())


CONFIG = load_config()
WINDOWS = CONFIG.get("windows", {"1D": 1, "7D": 7, "30D": 30, "90D": 90})
COMPARISON_INTERVAL_HOURS = float(CONFIG.get("comparisonIntervalHours", 8))
PAIRS = [dict(pair) for pair in CONFIG.get("pairs", [])]
MAX_RETRIES = 4
RETRY_BASE_DELAY = 1.5
_variational_stats_cache = None

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


def funding_interval_hours(pair):
    if pair.get("fundingIntervalHours"):
        return float(pair["fundingIntervalHours"])
    if pair["exchange"] == "Hyperliquid":
        return 1
    if pair["exchange"] == "Aster":
        return 4
    return 8


def payments_per_day(pair):
    return 24 / funding_interval_hours(pair)


def infer_funding_interval_hours(pair, rows):
    if pair.get("fundingIntervalHours"):
        return float(pair["fundingIntervalHours"])
    if len(rows) < 2:
        return funding_interval_hours(pair)
    diffs = []
    prev = None
    for row in rows:
        ts = int(row["fundingTime"])
        if prev is not None:
            gap_hours = (ts - prev) / 3600000
            if 0.5 <= gap_hours <= 24:
                diffs.append(gap_hours)
        prev = ts
    if not diffs:
        return funding_interval_hours(pair)
    diffs.sort()
    return round(diffs[len(diffs) // 2], 4)


def nearest_mark_price(mark_rows, ts):
    eligible = [row for row in mark_rows if row["time"] <= ts]
    if eligible:
        return eligible[-1]["markPrice"]
    return mark_rows[0]["markPrice"] if mark_rows else None


def merge_rows(existing_rows, new_rows, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    merged = {}
    for row in (existing_rows or []) + (new_rows or []):
        ts = int(row["fundingTime"])
        if ts >= start_ms:
            merged[ts] = row
    return [merged[ts] for ts in sorted(merged)]


def parse_iso_ms(value):
    if not value:
        return int(time.time() * 1000)
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    if "." in value:
        head, tail = value.split(".", 1)
        digits = ""
        suffix = ""
        for ch in tail:
            if ch.isdigit() and not suffix:
                digits += ch
            else:
                suffix += ch
        value = f"{head}.{digits[:6].ljust(6, '0')}{suffix}"
    return int(datetime.datetime.fromisoformat(value).timestamp() * 1000)

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
    funding_rows = []
    cur_end = end_ms
    seen = set()
    while True:
        url = f"{BYBIT_FUNDING}?category=linear&symbol={symbol}&startTime={start_ms}&endTime={cur_end}&limit=200"
        data = fetch_json(url)
        batch = data.get("result", {}).get("list", [])
        if not batch:
            break
        for row in batch:
            ts = int(row["fundingRateTimestamp"])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                funding_rows.append(row)
        oldest = min(int(row["fundingRateTimestamp"]) for row in batch)
        if oldest <= start_ms or len(batch) < 200:
            break
        cur_end = oldest - 1
    mark_rows = fetch_bybit_mark_prices(symbol, days)

    rows = []
    for row in funding_rows:
        ts = int(row["fundingRateTimestamp"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
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

    rows = []
    for row in funding_rows:
        ts = int(row["time"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "premium": float(row["premium"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    rows.sort(key=lambda x: x["fundingTime"])
    return rows


def fetch_hyperliquid_latest(symbol, dex=None):
    try:
        payload = {"type": "metaAndAssetCtxs"}
        if dex:
            payload["dex"] = dex
        meta, ctxs = post_json(HYPERLIQUID_INFO, payload)
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


def fetch_aster_mark_prices(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    url = f"{ASTER_MARK_KLINE}?symbol={symbol}&interval=4h&startTime={start_ms}&endTime={end_ms}&limit=1000"
    rows = fetch_json(url)
    out = []
    for row in rows:
        ts = int(row[0])
        if ts >= start_ms:
            out.append({"time": ts, "markPrice": float(row[4])})
    out.sort(key=lambda x: x["time"])
    return out


def fetch_aster_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{ASTER_FUNDING}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = int(batch[-1]["fundingTime"]) + 1
    mark_rows = fetch_aster_mark_prices(symbol, days)
    seen = set()
    out = []
    for row in rows:
        ts = int(row["fundingTime"])
        if ts in seen or ts < start_ms:
            continue
        seen.add(ts)
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_aster_latest(symbol):
    url = f"{ASTER_PREMIUM}?symbol={symbol}"
    try:
        row = fetch_json(url)
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "fundingIntervalHours": 4,
            "time": int(row.get("time") or time.time() * 1000),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": 4,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_okx_mark_prices(symbol, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    out = []
    seen = set()
    after = None
    while True:
        params = {"instId": symbol, "bar": "4H", "limit": "100"}
        if after:
            params["after"] = str(after)
        url = f"{OKX_MARK_CANDLES}?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        batch = data.get("data", [])
        if not batch:
            break
        for row in batch:
            ts = int(row[0])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                out.append({"time": ts, "markPrice": float(row[4])})
        oldest = min(int(row[0]) for row in batch)
        if oldest <= start_ms or len(batch) < 100:
            break
        after = oldest
    out.sort(key=lambda x: x["time"])
    return out


def fetch_okx_history(symbol, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    funding_rows = []
    seen = set()
    after = None
    while True:
        params = {"instId": symbol, "limit": "100"}
        if after:
            params["after"] = str(after)
        url = f"{OKX_FUNDING_HISTORY}?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        batch = data.get("data", [])
        if not batch:
            break
        for row in batch:
            ts = int(row["fundingTime"])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                funding_rows.append(row)
        oldest = min(int(row["fundingTime"]) for row in batch)
        if oldest <= start_ms or len(batch) < 100:
            break
        after = oldest
    mark_rows = fetch_okx_mark_prices(symbol, days)
    out = []
    for row in funding_rows:
        ts = int(row["fundingTime"])
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["realizedRate"] or row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_okx_latest(symbol):
    try:
        funding = fetch_json(f"{OKX_FUNDING}?instId={urllib.parse.quote(symbol)}")
        mark = fetch_json(f"{OKX_MARK_PRICE}?instType=SWAP&instId={urllib.parse.quote(symbol)}")
        index = fetch_json(f"{OKX_INDEX_TICKER}?instId={urllib.parse.quote(symbol.replace('-SWAP', ''))}")
        funding_row = funding.get("data", [{}])[0]
        mark_row = mark.get("data", [{}])[0]
        index_row = index.get("data", [{}])[0]
        return {
            "markPrice": float(mark_row.get("markPx") or funding_row.get("markPx")),
            "indexPrice": float(index_row["idxPx"]),
            "lastFundingRate": float(funding_row["fundingRate"]),
            "nextFundingTime": int(funding_row.get("nextFundingTime") or funding_row.get("nextFundingTimeMs")),
            "fundingIntervalHours": 8,
            "time": int(funding_row.get("ts") or time.time() * 1000),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": 8,
            "time": None,
            "available": False,
            "error": str(e)
        }


def get_variational_listing(symbol):
    global _variational_stats_cache
    if _variational_stats_cache is None:
        _variational_stats_cache = fetch_json(VARIATIONAL_STATS)
    data = _variational_stats_cache
    for row in data.get("listings", []):
        if str(row.get("ticker", "")).upper() == symbol.upper():
            return row
    raise RuntimeError(f"variational listing not found: {symbol}")


def fetch_variational_latest(symbol):
    try:
        row = get_variational_listing(symbol)
        interval_hours = float(row.get("funding_interval_s") or 28800) / 3600
        payments_per_year = (24 / interval_hours) * 365
        updated_ms = parse_iso_ms(row.get("quotes", {}).get("updated_at"))
        return {
            "markPrice": float(row["mark_price"]),
            "indexPrice": float(row["mark_price"]),
            "lastFundingRate": float(row["funding_rate"]) / payments_per_year,
            "nextFundingTime": updated_ms + int(interval_hours * 3600000),
            "fundingIntervalHours": interval_hours,
            "time": updated_ms,
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_variational_history(pair, days, previous_rows):
    latest = fetch_variational_latest(pair["symbol"])
    rows = []
    if latest.get("available") and latest.get("lastFundingRate") is not None:
        rows.append({
            "fundingTime": int(latest["time"]),
            "fundingRate": float(latest["lastFundingRate"]),
            "markPrice": latest["markPrice"],
            "source": "snapshot",
        })
        pair["_latest"] = latest
        pair["_fundingIntervalHours"] = latest.get("fundingIntervalHours")
    return merge_rows(previous_rows, rows, days)


def fetch_orbs_perps_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{ORBS_PERPS_FUNDING}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = int(batch[-1]["fundingTime"]) + 1
    seen = set()
    out = []
    for row in rows:
        ts = int(row["fundingTime"])
        if ts in seen or ts < start_ms:
            continue
        seen.add(ts)
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": float(row["markPrice"]) if row.get("markPrice") is not None else None,
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_orbs_perps_funding_data():
    global orbs_perps_funding_cache
    if orbs_perps_funding_cache is None:
        data = fetch_json(ORBS_PERPS_AGGREGATED_FUNDING)
        orbs_perps_funding_cache = data.get("PERPS_HUB", {})
    return orbs_perps_funding_cache


def fetch_orbs_perps_latest(symbol):
    url = f"{ORBS_PERPS_PREMIUM}?symbol={symbol}"
    try:
        row = fetch_json(url)
        funding = fetch_orbs_perps_funding_data().get(symbol, {})
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "rawFundingRate": float(row["lastFundingRate"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "longFundingFee": float(funding.get("next_funding_rate_long", -float(row["lastFundingRate"]))),
            "shortFundingFee": float(funding.get("next_funding_rate_short", float(row["lastFundingRate"]))),
            "nextFundingTime": int(funding.get("next_funding_time") or row["nextFundingTime"]),
            "time": int(row.get("time") or time.time() * 1000),
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


def fetch_history(pair, days, previous_rows=None):
    if pair["exchange"] == "Binance":
        return fetch_binance_history(pair["symbol"], days)
    if pair["exchange"] == "Bybit":
        return fetch_bybit_history(pair["symbol"], days)
    if pair["exchange"] == "Hyperliquid":
        if previous_rows:
            return merge_rows(previous_rows, fetch_hyperliquid_history(pair["symbol"], min(days, 2)), days)
        return fetch_hyperliquid_history(pair["symbol"], days)
    if pair["exchange"] == "Aster":
        return fetch_aster_history(pair["symbol"], days)
    if pair["exchange"] == "OKX":
        return fetch_okx_history(pair["symbol"], days)
    if pair["exchange"] == "Variational":
        return fetch_variational_history(pair, days, previous_rows or [])
    if pair["exchange"] == "Orbs Perps Hub":
        return fetch_orbs_perps_history(pair["symbol"], days)
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")


def fetch_latest(pair):
    if pair["exchange"] == "Binance":
        return fetch_binance_latest(pair["symbol"])
    if pair["exchange"] == "Bybit":
        return fetch_bybit_latest(pair["symbol"])
    if pair["exchange"] == "Hyperliquid":
        return fetch_hyperliquid_latest(pair["symbol"], pair.get("dex"))
    if pair["exchange"] == "Aster":
        return fetch_aster_latest(pair["symbol"])
    if pair["exchange"] == "OKX":
        return fetch_okx_latest(pair["symbol"])
    if pair["exchange"] == "Variational":
        return pair.pop("_latest", None) or fetch_variational_latest(pair["symbol"])
    if pair["exchange"] == "Orbs Perps Hub":
        return fetch_orbs_perps_latest(pair["symbol"])
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")

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
            "comparisonIntervalHours": COMPARISON_INTERVAL_HOURS,
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
            "Hyperliquid": {"supported": True, "notes": "HIP-3 xyz perp funding history + current snapshot available via public info API"},
            "Aster": {"supported": True, "notes": "Funding history + current snapshot available via public futures API"},
            "OKX": {"supported": True, "notes": "Funding history + current snapshot available via public API"},
            "Variational": {"supported": True, "notes": "Public API is current snapshot oriented; dashboard accumulates snapshots over time"},
            "Orbs Perps Hub": {"supported": True, "notes": "Current Long/Short funding uses THENA Perps aggregatedFundingData; history uses raw public proxy funding API"}
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
            "fundingIntervalHours": funding_interval_hours(pair),
            "windows": {},
            "latest": {},
            "rows": []
        }

        try:
            old_pair = previous.get("pairs", {}).get(key, {})
            full_rows = fetch_history(pair, WINDOWS["90D"], old_pair.get("rows", []))
            if pair.get("_fundingIntervalHours"):
                pair_out["fundingIntervalHours"] = float(pair["_fundingIntervalHours"])
                pair_out["fundingPeriodsPerDay"] = 24 / pair_out["fundingIntervalHours"]
            elif full_rows:
                pair_out["fundingIntervalHours"] = infer_funding_interval_hours(pair, full_rows)
                pair_out["fundingPeriodsPerDay"] = 24 / pair_out["fundingIntervalHours"]
            pair_out["latest"] = fetch_latest(pair)
            pair_out["rows"] = full_rows
            for label, days in WINDOWS.items():
                min_ts = int(time.time() * 1000) - days * 24 * 3600 * 1000
                filtered = [r for r in full_rows if r["fundingTime"] >= min_ts]
                pair_out["windows"][label] = summarize(filtered, pair_out["fundingPeriodsPerDay"])
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

    data["assetMetrics"] = build_asset_metrics(data, WINDOWS, COMPARISON_INTERVAL_HOURS)
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    ALERTS_PATH.write_text(json.dumps(build_alerts(data), ensure_ascii=False, indent=2) + "\n")

if __name__ == '__main__':
    main()
