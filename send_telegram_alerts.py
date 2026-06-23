#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


SEVERITY_RANK = {"high": 0, "medium": 1, "info": 2}


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        return default


def save_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def pct(value):
    if value is None:
        return "-"
    return f"{float(value):.2f}%"


def funding_pct(value):
    if value is None:
        return "-"
    return f"{float(value) * 100:.4f}%"


def scope_label(scope):
    return "현재" if scope == "current" else scope


def format_alert(alert):
    if alert.get("type") == "funding_spread":
        return "\n".join([
            f"[{alert.get('severity', '-').upper()}] {alert.get('assetId', '-')} Funding Spread {alert.get('level', '-')}",
            f"기준: {scope_label(alert.get('scope'))}",
            f"Annualized spread: {pct(alert.get('annualizedSpreadPct'))}",
            f"8H spread: {funding_pct(alert.get('fundingSpread8h'))}",
            f"Long 유리: {alert.get('highExchange') or alert.get('highPairKey') or '-'}",
            f"Short 유리: {alert.get('lowExchange') or alert.get('lowPairKey') or '-'}",
        ])
    if alert.get("type") == "data_reliability":
        return "\n".join([
            f"[{alert.get('severity', '-').upper()}] {alert.get('assetId', '-')} Data Reliability",
            f"거래소: {alert.get('exchange') or alert.get('pairKey') or '-'}",
            f"상태: {alert.get('status', '-')}",
            f"히스토리: {alert.get('historyRows', '-')}, 커버리지: {pct(alert.get('historyCoveragePct'))}",
            f"최신 지연: {alert.get('latestAgeHours', '-')}h",
        ])
    return f"[{alert.get('severity', '-').upper()}] {alert.get('id', 'unknown alert')}"


def select_alerts(alerts_payload, state, min_severity="high", limit=10, force=False):
    max_rank = SEVERITY_RANK[min_severity]
    sent = state.get("sent", {})
    selected = []
    for alert in alerts_payload.get("alerts", []):
        severity = alert.get("severity", "info")
        if SEVERITY_RANK.get(severity, 99) > max_rank:
            continue
        alert_id = alert.get("id")
        if not alert_id:
            continue
        if not force and alert_id in sent:
            continue
        selected.append(alert)
        if len(selected) >= limit:
            break
    return selected


def send_telegram_message(token, chat_id, text):
    body = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": "true",
    }).encode()
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode())


def mark_sent(state, alerts):
    now = int(time.time())
    state.setdefault("sent", {})
    for alert in alerts:
        state["sent"][alert["id"]] = {
            "sentAt": now,
            "severity": alert.get("severity"),
            "type": alert.get("type"),
            "assetId": alert.get("assetId"),
        }
    state["lastRunAt"] = now
    return state


def main():
    parser = argparse.ArgumentParser(description="Send funding dashboard alerts to Telegram.")
    parser.add_argument("--alerts", default="alerts.json")
    parser.add_argument("--state", default="alert_state.json")
    parser.add_argument("--min-severity", choices=SEVERITY_RANK.keys(), default="high")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    alerts_payload = load_json(args.alerts, {"alerts": []})
    state = load_json(args.state, {"sent": {}})
    selected = select_alerts(alerts_payload, state, args.min_severity, args.limit, args.force)

    if not selected:
        print("No new alerts to send.")
        return 0

    messages = [format_alert(alert) for alert in selected]
    if args.dry_run:
        print("\n\n---\n\n".join(messages))
        return 0

    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Use --dry-run to preview.", file=sys.stderr)
        return 2

    for message in messages:
        send_telegram_message(token, chat_id, message)

    mark_sent(state, selected)
    save_json(args.state, state)
    print(f"Sent {len(selected)} Telegram alert(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
