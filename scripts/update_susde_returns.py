"""Archive official sUSDe redemption-rate history, independently of quoted APY."""
import datetime as dt
import json
from pathlib import Path
from update_susde_yield import fetch, number

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://app.ethena.fi/api/susde-price-history?range=All'


def build_snapshot(payload, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if not isinstance(payload, list):
        raise ValueError('Expected official rate history array')
    daily = {}
    for item in payload:
        stamp = dt.datetime.fromisoformat(item['timestamp'].replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError('Rate timestamp needs timezone')
        stamp = stamp.astimezone(dt.timezone.utc)
        rate = number(item['price'])
        if rate <= 0 or stamp > now + dt.timedelta(minutes=5):
            raise ValueError('Invalid/future rate observation')
        # Exclude the current UTC day: do not mix intraday snapshots with daily endpoints.
        if stamp.date() == now.date():
            continue
        day = stamp.date().isoformat()
        row = {'date': day, 'timestamp': stamp.isoformat(), 'rate': rate}
        if day in daily:
            if daily[day]['timestamp'] == row['timestamp'] and daily[day]['rate'] != rate:
                raise ValueError('Conflicting rate observation')
            if daily[day]['timestamp'] > row['timestamp']:
                continue
        daily[day] = row
    rows = [daily[day] for day in sorted(daily)]
    if len(rows) < 30 or (now.date() - dt.date.fromisoformat(rows[-1]['date'])).days > 3:
        raise ValueError('Incomplete/stale rate history')
    return {'schemaVersion': 1, 'asset': 'sUSDe', 'unit': 'USDe per sUSDe',
            'source': 'Ethena official app redemption-rate history', 'sourceUrl': URL,
            'fetchedAt': now.isoformat(), 'through': rows[-1]['date'], 'rows': rows}


def publish(snapshot, path):
    if path.exists():
        old = json.loads(path.read_text())
        dates = {r['date'] for r in snapshot['rows']}
        if snapshot['through'] < old['through'] or any(r['date'] not in dates for r in old['rows']):
            raise ValueError('Regressed/truncated rate history; retain last good snapshot')
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(snapshot, separators=(',', ':')) + '\n')
    tmp.replace(path)


def main():
    snapshot = build_snapshot(fetch(URL))
    publish(snapshot, ROOT / 'data/susde-returns.json')
    print(f"Saved {len(snapshot['rows'])} daily sUSDe rates through {snapshot['through']}")


if __name__ == '__main__':
    main()
