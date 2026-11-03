# HYPE archive / USDe market details

## Sources and units
- HYPE Console: https://hype-console.serhiifotex.dev/?period=all (public server-rendered dataset). USD reported by this secondary index; closing HYPE price (current day provisional).
- Crypto Burn Tracker: https://cryptoburntracker.com/burns/hyperliquid/ (public `/api/v1/assets/hype/daily-burns?limit=6000`, `/summary`). Separate AF, HyperCore protocol/null-address and HyperEVM gas mechanisms.
- Official complete-day AF fills retained in `data/hype-buybacks.json` take priority for day amounts. The new separate `data/hype-history.json` archive is refreshed by existing two-hour collector workflow; failed supplemental collection retains the last snapshot without blocking official updates. Snapshot older than 48 hours is labeled delayed.

## Reconciliation
2026-11-03 initial import contains 592 AF dated quantity observations starting 2025-03-22, 265 with USD after direct official overrides. Console exposes 610 rows starting 2024-11-29, but historical quantity discrepancies are material. Do not simply concatenate or present all USD as official audited executions.

- Include secondary USD only when same UTC day's AF HYPE quantity agrees within 0.02 HYPE; retain source tag. Agreement on quantity does NOT independently audit USD; it remains Console reported spend. Official archived complete days supersede both.
- Missing/disputed USD is null, never zero. Weekly/monthly USD totals label 'known only'; weighted price unavailable if any quantity lacks USD.
- The pre-2025-03-22 reconciled AF opening balance (~17.987M HYPE) is not a dated buyback and has no verified spend; excluded from charts, periods and moving averages.
- Price is Console's closing series, not execution VWAP; missing dates break paths. 7/30-day simple mean of daily USD requires all calendar days complete and known, calculated before applying display range. Current day provisional, excluded from complete rolling means.
- Aggregate mechanism totals are secondary-source cumulative snapshots. AF amount is not added twice. Monthly 'other burns' uses observed non-AF daily records only, not any prior opening balance; not market-buy expenditures.

## USDe
Original historical series: DefiLlama daily all-chain USD market cap, server collection every six hours; visible page checks same-origin snapshot every five minutes. This cadence does not turn daily observations into intraday market quotes.
New separately labeled CoinGecko quote details requested on asset open and every five minutes while visible: price, market cap, circulating supply, 24h volume, 24h high/low, price/cap percent changes and deviation from $1. Optional missing fields shown as dash; stale (>1h) or failed quote explicitly labeled. Do not splice CG current market cap into DefiLlama history or subtract across providers. CMC comparison link requested by user included, but no claim of using CMC as the live feed.
