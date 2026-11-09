#!/usr/bin/env python3
"""KOFIA FreeSIS 신용공여 잔고 추이; balances in KRW millions.
TMPV2 total, TMPV3 KOSPI, TMPV4 KOSDAQ. tmpV40 selects unit, not row limit.
Keep the last good snapshot on any fetch/validation failure.
"""
import json
import math
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

OUTPUT = Path(__file__).resolve().parents[1] / 'credit_balance_data.json'
URL = 'http://freesis.kofia.or.kr/meta/getMetaDataList.do'
START = date(2026, 1, 1)


def parse_rows(payload):
    rows = {}
    for item in payload['ds1']:
        raw = str(item.get('TMPV1', ''))
        if len(raw) != 8 or not raw.isdigit():
            continue
        day = datetime.strptime(raw, '%Y%m%d').date().isoformat()
        values = [item.get(key) for key in ('TMPV2', 'TMPV3', 'TMPV4')]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v <= 0 for v in values):
            raise ValueError(f'Invalid credit balance: {day}')
        total, kospi, kosdaq = values
        if abs(total - kospi - kosdaq) > 2:
            raise ValueError(f'Market totals do not reconcile: {day}')
        row = {'date': day, 'KOSPI': kospi, 'KOSDAQ': kosdaq}
        if day in rows and rows[day] != row:
            raise ValueError(f'Conflicting date: {day}')
        rows[day] = row
    if not rows:
        raise ValueError('No dated credit balances returned')
    return sorted(rows.values(), key=lambda row: row['date'])


def fetch_rows(start, end):
    body = {'dmSearch': {'OBJ_NM': 'STATSCU0100000070BO', 'tmpV1': 'D',
                        'tmpV40': '1000000', 'tmpV41': '1',
                        'tmpV45': start.strftime('%Y%m%d'), 'tmpV46': end.strftime('%Y%m%d')}}
    req = Request(URL, data=json.dumps(body).encode(), headers={
        'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://freesis.kofia.or.kr/'})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=35) as response:
                rows = parse_rows(json.load(response))
            if any(not start.isoformat() <= row['date'] <= end.isoformat() for row in rows):
                raise ValueError('Response outside requested dates')
            return rows
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def main():
    now = datetime.now(timezone(timedelta(hours=9)))
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {'rows': []}
    rows = {row['date']: row for row in previous['rows']}
    start = max(START, date.fromisoformat(max(rows)) - timedelta(days=30)) if rows else START
    while start <= now.date():
        end = min(date(start.year, 12, 31), now.date())
        for row in fetch_rows(start, end):
            rows[row['date']] = row
        start = end + timedelta(days=1)
    ordered = sorted(rows.values(), key=lambda row: row['date'])
    snapshot = {'source': 'KOFIA FreeSIS', 'sourceUrl': 'http://freesis.kofia.or.kr/',
                'statistic': 'STATSCU0100000070', 'unit': 'KRW million',
                'metric': '신용거래융자 잔고', 'updatedAt': now.isoformat(),
                'asOf': ordered[-1]['date'], 'rows': ordered}
    temp = OUTPUT.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    temp.replace(OUTPUT)
    print(f"Credit balances: {len(ordered)} dates, latest {snapshot['asOf']}")


if __name__ == '__main__':
    main()
