def summarize(rows, periods_per_day):
    if not rows:
        return {
            "count": 0,
            "avgFundingRate": 0,
            "annualizedPct": 0,
            "sumFundingRate": 0,
            "firstFundingTime": None,
            "lastFundingTime": None,
        }
    rates = [row["fundingRate"] for row in rows]
    avg = sum(rates) / len(rates)
    return {
        "count": len(rows),
        "avgFundingRate": avg,
        "annualizedPct": avg * periods_per_day * 365 * 100,
        "sumFundingRate": sum(rates),
        "firstFundingTime": rows[0]["fundingTime"],
        "lastFundingTime": rows[-1]["fundingTime"],
    }


def latest_long_fee(latest):
    if latest.get("rawFundingRate") is not None:
        return float(latest["rawFundingRate"])
    if latest.get("lastFundingRate") is None:
        return None
    return float(latest["lastFundingRate"])


def latest_short_fee(latest):
    return latest_long_fee(latest)


def annualized_from_fee(fee, interval_hours):
    if fee is None:
        return None
    return fee * (24 / interval_hours) * 365 * 100


def comparable_fee_from_annualized(annualized_pct, comparison_interval_hours):
    if annualized_pct is None:
        return None
    return annualized_pct / 100 / (24 / comparison_interval_hours * 365)


def spread_alert_level(annualized_spread):
    if annualized_spread is None:
        return "unknown"
    abs_spread = abs(annualized_spread)
    if abs_spread >= 20:
        return "wide"
    if abs_spread >= 5:
        return "narrow"
    return "normal"


def asset_reliability(pair, now_ms, windows):
    rows = pair.get("rows") or []
    latest = pair.get("latest") or {}
    interval = float(pair.get("fundingIntervalHours") or 8)
    expected_90d = max(1, int(windows["90D"] * 24 / interval))
    last_funding_time = rows[-1]["fundingTime"] if rows else None
    freshness_time = latest.get("time") or latest.get("nextFundingTime") or last_funding_time
    latest_age_hours = None
    if freshness_time:
        latest_age_hours = max(0, (now_ms - int(freshness_time)) / 3600000)
    coverage = min(1, len(rows) / expected_90d)
    latest_available = bool(latest.get("available", True)) and latest_long_fee(latest) is not None
    if not pair.get("available") or not latest_available:
        status = "unavailable"
    elif coverage < 0.5:
        status = "limited"
    elif latest_age_hours is not None and latest_age_hours > max(24, interval * 4):
        status = "stale"
    else:
        status = "ok"
    return {
        "status": status,
        "historyRows": len(rows),
        "historyCoveragePct": round(coverage * 100, 2),
        "latestAgeHours": None if latest_age_hours is None else round(latest_age_hours, 2),
    }


def summarize_metric_entries(entries, comparison_interval_hours):
    if not entries:
        return {
            "exchanges": [],
            "spread": None,
            "alertLevel": "unknown",
            "longFavored": None,
            "shortFavored": None,
        }
    standard_sorted = sorted(entries, key=lambda item: item["longFundingFee8h"])
    low = standard_sorted[0]
    high = standard_sorted[-1]
    annualized_spread = None
    if high.get("annualizedPct") is not None and low.get("annualizedPct") is not None:
        annualized_spread = high["annualizedPct"] - low["annualizedPct"]
    spread_8h = high["longFundingFee8h"] - low["longFundingFee8h"]
    return {
        "exchanges": entries,
        "spread": {
            "highPairKey": high["pairKey"],
            "lowPairKey": low["pairKey"],
            "longFundingFee8h": spread_8h,
            "annualizedPct": annualized_spread,
        },
        "alertLevel": spread_alert_level(annualized_spread),
        "longFavored": low["pairKey"],
        "shortFavored": high["pairKey"],
    }


def build_asset_metrics(data, windows, comparison_interval_hours):
    now_ms = data["updatedAt"]
    grouped = {}
    for key, pair in data["pairs"].items():
        asset_id = pair.get("assetId", pair.get("displaySymbol", pair["symbol"]))
        grouped.setdefault(asset_id, []).append((key, pair))

    metrics = {}
    for asset_id, pairs in grouped.items():
        current_entries = []
        window_entries = {label: [] for label in windows}
        reliability = {}
        for key, pair in pairs:
            interval = float(pair.get("fundingIntervalHours") or 8)
            latest = pair.get("latest") or {}
            funding_rate = latest_long_fee(latest)
            annualized = annualized_from_fee(funding_rate, interval)
            reliability[key] = asset_reliability(pair, now_ms, windows)
            if annualized is not None:
                current_entries.append({
                    "pairKey": key,
                    "exchange": pair["exchange"],
                    "symbol": pair["symbol"],
                    "intervalHours": interval,
                    "rawLongFundingFee": funding_rate,
                    "rawShortFundingFee": funding_rate,
                    "longFundingFee8h": comparable_fee_from_annualized(annualized, comparison_interval_hours),
                    "shortFundingFee8h": comparable_fee_from_annualized(annualized, comparison_interval_hours),
                    "annualizedPct": annualized,
                    "shortAnnualizedPct": annualized,
                    "reliabilityStatus": reliability[key]["status"],
                })
            for label, summary in (pair.get("windows") or {}).items():
                if not summary or not summary.get("count"):
                    continue
                annualized = summary.get("annualizedPct")
                if annualized is None:
                    continue
                avg_funding_rate = float(summary.get("avgFundingRate", 0))
                comparable_rate = comparable_fee_from_annualized(annualized, comparison_interval_hours)
                window_entries[label].append({
                    "pairKey": key,
                    "exchange": pair["exchange"],
                    "symbol": pair["symbol"],
                    "intervalHours": interval,
                    "rawLongFundingFee": avg_funding_rate,
                    "rawShortFundingFee": avg_funding_rate,
                    "longFundingFee8h": comparable_rate,
                    "shortFundingFee8h": comparable_rate,
                    "annualizedPct": annualized,
                    "shortAnnualizedPct": annualized,
                    "count": summary.get("count", 0),
                    "reliabilityStatus": reliability[key]["status"],
                })
        metrics[asset_id] = {
            "comparisonIntervalHours": comparison_interval_hours,
            "current": summarize_metric_entries(current_entries, comparison_interval_hours),
            "windows": {
                label: summarize_metric_entries(entries, comparison_interval_hours)
                for label, entries in window_entries.items()
            },
            "reliability": reliability,
        }
    return metrics
