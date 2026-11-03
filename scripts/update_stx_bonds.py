"""Archive Hiro's server-rendered bond feed; fail closed, preserving the last snapshot."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = 'https://explorer.hiro.so/staking/bonds?chain=mainnet'
DEST = Path(__file__).resolve().parents[1] / 'data/stx-bonds.json'


def find_feed(value):
    if isinstance(value, dict):
        if isinstance(value.get('bonds'), list) and 'unavailable' in value:
            return value
        for child in value.values():
            found = find_feed(child)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_feed(child)
            if found is not None:
                return found
    return None


def extract_feed(html):
    for chunk in re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>', html, re.S):
        envelope = json.loads(chunk)
        if len(envelope) < 2 or not isinstance(envelope[1], str):
            continue
        for line in envelope[1].splitlines():
            _, _, payload = line.partition(':')
            try:
                feed = find_feed(json.loads(payload))
            except ValueError:
                continue
            if feed is not None:
                return feed
    raise ValueError('Hiro bond feed missing from page')


def snapshot(feed, now=None):
    bonds = feed.get('bonds', [])
    if feed.get('unavailable') or not bonds or feed.get('total') != len(bonds):
        raise ValueError('Unavailable or incomplete bond feed; retain previous snapshot')
    ids = set()
    for bond in bonds:
        index = bond['index']
        if not isinstance(index, int) or index < 1 or index in ids:
            raise ValueError('Invalid or duplicate bond index')
        ids.add(index)
        for value in [bond['balances']['locked'][unit] for unit in ('btc', 'stx')] + [bond['parameters']['btc_capacity']]:
            if not isinstance(value, str) or not value.isdigit():
                raise ValueError('Invalid atomic-unit balance')
        for name in ('activation', 'unlock'):
            event = bond['schedule'][name]
            if not isinstance(event['bitcoin_height'], int) or event['bitcoin_height'] <= 0:
                raise ValueError('Invalid height')
            for field in ('time_iso', 'projected_time_iso'):
                if event.get(field):
                    datetime.fromisoformat(event[field].replace('Z', '+00:00'))
        if bond['schedule']['unlock']['bitcoin_height'] <= bond['schedule']['activation']['bitcoin_height']:
            raise ValueError('Invalid bond duration')
    return {'schemaVersion': 1, 'updatedAt': (now or datetime.now(timezone.utc)).isoformat(),
            'source': SOURCE, 'sourceAsOf': datetime.fromtimestamp(feed['nowMs']/1000, timezone.utc).isoformat(),
            'bitcoinHeight': feed['currentBurnHeight'], 'bonds': sorted(bonds, key=lambda b: b['index'])}


def main():
    request = Request(SOURCE, headers={'User-Agent': 'FundingDashboard/1.0 (public bond statistics)'})
    with urlopen(request, timeout=45) as response:
        data = snapshot(extract_feed(response.read().decode()))
    tmp = DEST.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(DEST)
    print(f"Saved {len(data['bonds'])} complete bond records")


if __name__ == '__main__':
    main()
