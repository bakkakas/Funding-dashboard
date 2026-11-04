# UNI fee-burn board

## Sources and accounting

- Mechanics: https://developers.uniswap.org/docs/protocols/protocol-fee/overview
- Treasury one-off / growth-budget context: https://blog.uniswap.org/unification
- Latest product catalyst: https://blog.uniswap.org/aggregator-hooks-are-now-live
- Quantitative source: https://www.defiburn.com/burn (independent third-party indexer, not an official audit).

The collector extracts the source's server-rendered daily chart, composition and recent mainnet settlement records. Daily recorded UNI is the sum of available originating-chain records, and can precede Ethereum settlement by several days. Mainnet settlement amounts are displayed separately and NEVER added to the originating-chain daily series. Missing chain cells are not invented records; a day with no reported amounts is null, not zero. The board is limited to the indexer's coverage.

USD valuation = each day's recorded UNI × that source's daily UNI reference price. It is NOT observed swap execution spend, a purchase cost, or protocol revenue. No TokenBuybacks or other provider series is spliced into the chart. Cumulative valuation and 30-day annualized valuation / live CoinGecko market cap inherit this limitation. The ratio is NOT dividend yield.

The recurring chart excludes the treasury one-off. The source's non-fee composition bucket exceeds the documented 100M UNI event: display exactly 100M as the documented treasury event and the residual separately, without assigning undocumented provenance. These balances are a burn/dead-address measure, not an independently verified decrement in the ERC-20 totalSupply function or a net-emissions metric.

## Time and missing data

- UTC daily history; week starts Monday, months use calendar boundaries.
- Range windows end at the last source-reported day, explicitly displayed, not silently at today's date.
- Unfinished/range-clipped weeks/months marked partial. Complete-calendar windows required for moving averages and annualization; missing USD remains unavailable.
- Source updated time is taken from the SSR footer (UTC), not the separately stale protocol-fee feed or Aggregator Hooks estimates.
- Current-day data marked provisional; 48-hour source age / over-three-day daily age warning.

## Refresh and failure handling

`scripts/update_uni_burns.py`, workflow `update-uni-burns.yml`: scheduled every two hours. It validates identity, daily ordering, duplicate dates, values, source age, complete array lengths, chain identities, history truncation and regressing source timestamps before atomic file replacement. Missing/changed SSR, invalid prices or stale feeds fail without replacing the last good snapshot. No silent zero fallback. Frontend fetch failures show an unavailable state and source link.

Initial snapshot: 310 daily observations, 2025-12-29 through 2026-11-03. Any future change to source definitions or chain coverage needs reconciliation; successful collection alone does not independently prove source completeness.
