def alert_severity(level):
    if level == "wide":
        return "high"
    if level == "narrow":
        return "medium"
    return "info"


def build_alerts(data):
    alerts = []
    pairs = data.get("pairs", {})
    for asset_id, metrics in (data.get("assetMetrics") or {}).items():
        scopes = [("current", metrics.get("current"))]
        scopes.extend((window, window_metrics) for window, window_metrics in (metrics.get("windows") or {}).items())
        for scope, scope_metrics in scopes:
            if not scope_metrics or not scope_metrics.get("spread"):
                continue
            level = scope_metrics.get("alertLevel")
            if level not in {"narrow", "wide"}:
                continue
            spread = scope_metrics["spread"]
            high_pair = pairs.get(spread.get("highPairKey"), {})
            low_pair = pairs.get(spread.get("lowPairKey"), {})
            alerts.append({
                "id": f"{asset_id}:{scope}:funding-spread:{level}",
                "type": "funding_spread",
                "severity": alert_severity(level),
                "assetId": asset_id,
                "scope": scope,
                "level": level,
                "annualizedSpreadPct": spread.get("annualizedPct"),
                "fundingSpread8h": spread.get("longFundingFee8h"),
                "highPairKey": spread.get("highPairKey"),
                "lowPairKey": spread.get("lowPairKey"),
                "highExchange": high_pair.get("exchange"),
                "lowExchange": low_pair.get("exchange"),
            })
        for pair_key, reliability in (metrics.get("reliability") or {}).items():
            status = reliability.get("status")
            if status in {None, "ok"}:
                continue
            pair = pairs.get(pair_key, {})
            alerts.append({
                "id": f"{asset_id}:{pair_key}:reliability:{status}",
                "type": "data_reliability",
                "severity": "medium" if status in {"limited", "stale"} else "high",
                "assetId": asset_id,
                "pairKey": pair_key,
                "exchange": pair.get("exchange"),
                "status": status,
                "historyRows": reliability.get("historyRows"),
                "historyCoveragePct": reliability.get("historyCoveragePct"),
                "latestAgeHours": reliability.get("latestAgeHours"),
            })
    alerts.sort(key=lambda item: ({"high": 0, "medium": 1, "info": 2}.get(item["severity"], 3), item["assetId"], item["type"]))
    return {
        "updatedAt": data["updatedAt"],
        "alerts": alerts,
        "summary": {
            "total": len(alerts),
            "high": sum(1 for alert in alerts if alert["severity"] == "high"),
            "medium": sum(1 for alert in alerts if alert["severity"] == "medium"),
            "info": sum(1 for alert in alerts if alert["severity"] == "info"),
        }
    }
