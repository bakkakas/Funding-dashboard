# HYPE archive / USDe market details

## Sources and units
- HYPE Console: https://hype-console.serhiifotex.dev/?period=all (public server-rendered dataset). USD reported by this secondary index; closing HYPE price (current day provisional).
- Crypto Burn Tracker: https://cryptoburntracker.com/burns/hyperliquid/ (public `/api/v1/assets/hype/daily-burns?limit=6000`, `/summary`). Separate AF, HyperCore protocol/null-address and HyperEVM gas mechanisms.
- Chart source selected by user on 2026-11-03: **HYPE Console only**, including USD, HYPE quantity and closing price. Official summary cards remain separate; never override Console daily chart rows with official fills or Crypto Burn Tracker amounts.
- `data/hype-history.json` schemaVersion 2 / chartSource hype-console is refreshed every two hours. A failed Console fetch retains last snapshot; separate burn-detail fetch failure retains earlier mechanism details without blocking the Console chart.

## Historical source limitations
The former cross-source quantity-matching rule intentionally left disputed USD null. User requested a single source instead; these artificial disagreement gaps are removed. This is not a claim of independently auditing Console's values.

The Console source currently has 607 dated rows, with real missing records including 2026-07-21 through 2026-10-17 (also marked no data on its own calendar). Do not interpolate or replace those with zero. Price/average paths break on calendar gaps. Current day is provisional; 7/30-day mean requires complete days. Early source amounts and totals may differ from official balances; do not force them to reconcile.

The top spend bar chart now precedes the composite price chart and supports day/week/month buckets within the selected 30/90/365/all window. A week starts Monday UTC; months are calendar months. Boundary/incomplete buckets explicitly show partial sums. Tables remain separately selectable by week/month. Dollar totals and HYPE quantities use the same Console observations.

Crypto Burn Tracker is used only for the separate burn-mechanism section, not the daily buyback series. Gas/protocol burns are not market-buy expenditure and AF must not be added twice.

## USDe
Original historical series: DefiLlama daily all-chain USD market cap, server collection every six hours; visible page checks same-origin snapshot every five minutes. This cadence does not turn daily observations into intraday market quotes.
New separately labeled CoinGecko quote details requested on asset open and every five minutes while visible: price, market cap, circulating supply, 24h volume, 24h high/low, price/cap percent changes and deviation from $1. Optional missing fields shown as dash; stale (>1h) or failed quote explicitly labeled. Do not splice CG current market cap into DefiLlama history or subtract across providers. CMC comparison link requested by user included, but no claim of using CMC as the live feed.
