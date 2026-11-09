"""Archive Ethena's published sUSDe APY and its separate daily source series.

The headline is NOT the latest daily observation or the Indicative sUSDe series.
History's 7-calendar-day mean is a reconstruction, not realized vault returns.
"""
import datetime as dt
import json
import math
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CURRENT_URL = 'https://app.ethena.fi/api/yields/protocol-and-staking-yield'
HISTORY_URL = 'https://app.ethena.fi/api/yields/historical/historical-protocol-and-competitor-yields'
METRICS = {'apy': 'stakingYield', 'avg30d': 'avg30dSusdeYield', 'avg90d': 'avg90dSusdeYield'}


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Missing/non-numeric yield; retain previous snapshot')
    return value


def build_snapshot(current, history, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    metrics = {}
    for key, source in METRICS.items():
        item = current[source]
        day = dt.datetime.strptime(item['lastUpdated'], '%d %b %y').date()
        value = number(item['value'])
        if value < 0 or not 0 <= (now.date() - day).days <= 14:
            raise ValueError('Stale/future/invalid published APY')
        metrics[key] = {'value': value, 'date': day.isoformat()}
    matches = [s for s in history['queryIndex'] if s['name'] == 'sUSDe Yield']
    if len(matches) != 1 or not isinstance(matches[0]['yields'], list):
        raise ValueError('Missing/ambiguous exact sUSDe Yield series')
    unique = {}
    for item in matches[0]['yields']:
        stamp = dt.datetime.fromisoformat(item['timestamp'].replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError('History timestamp requires timezone')
        stamp = stamp.astimezone(dt.timezone.utc)
        day = stamp.date().isoformat()
        value = number(item['value'])
        if stamp > now + dt.timedelta(minutes=5):
            raise ValueError('Future history')
        if day in unique and unique[day] != value:
            raise ValueError('Conflicting daily observations')
        # Negative source observations are preserved, NOT vault losses or deductions.
        unique[day] = value
    rows = [{'date': day, 'apy': unique[day]} for day in sorted(unique)]
    if len(rows) < 30 or rows[-1]['date'] != metrics['apy']['date']:
        raise ValueError('Incomplete/misaligned history')
    end = dt.date.fromisoformat(metrics['apy']['date'])
    window = [unique.get((end - dt.timedelta(days=i)).isoformat()) for i in range(7)]
    if any(v is None for v in window) or abs(sum(window) / 7 - metrics['apy']['value']) > 0.02:
        raise ValueError('Published APY / 7-day history reconciliation failed')
    return {'schemaVersion': 1, 'asset': 'sUSDe', 'source': 'Ethena',
            'currentUrl': CURRENT_URL, 'historyUrl': HISTORY_URL,
            'fetchedAt': now.isoformat(), 'through': rows[-1]['date'],
            'current': metrics, 'seriesName': 'sUSDe Yield', 'rows': rows}


def validate_progress(new, old):
    if new['through'] < old['through'] or new['rows'][0]['date'] > old['rows'][0]['date']:
        raise ValueError('Source regressed/truncated; retain previous snapshot')
    new_dates = {row['date'] for row in new['rows']}
    if any(row['date'] not in new_dates for row in old['rows']):
        raise ValueError('Existing observations disappeared; retain previous snapshot')
    for key in METRICS:
        if new['current'][key]['date'] < old['current'][key]['date']:
            raise ValueError('Published metric regressed')


def publish(snapshot, path):
    if path.exists():
        validate_progress(snapshot, json.loads(path.read_text()))
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(path)


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'FundingDashboard/1.0', 'Accept': 'application/json'}), timeout=40) as response:
        body = response.read()
        try:
            return json.loads(body)
        except (ValueError, UnicodeError) as error:
            import re
            title = re.search(r'<title[^>]*>(.*?)</title>', body.decode('utf-8', errors='replace'), re.I | re.S)
            detail = title.group(1).strip()[:160] if title else 'no HTML title'
            raise ValueError(f"Non-JSON source response: status={response.status}, type={response.headers.get('Content-Type')}, url={response.url}, title={detail}") from error


def main():
    snapshot = build_snapshot(fetch(CURRENT_URL), fetch(HISTORY_URL))
    publish(snapshot, ROOT / 'data/susde-yield.json')
    print(f"Saved {len(snapshot['rows'])} sUSDe observations; published APY {snapshot['current']['apy']['value']:.4f}% as of {snapshot['through']}")


if __name__ == '__main__':
    main()
