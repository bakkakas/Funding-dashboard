# Expected / actual quarterly bars

- KR (005380, 263750, 005930, 000660): WiseReport/FnGuide pre-announcement revenue, operating profit and parent-shareholders' net income. Same-month finalized Naver actuals are preferred; newer Wise preliminary actuals are explicitly marked. Total net income is not parent net income.
- Overseas (Alphabet, Amazon, Nike, Novo Nordisk): MarketScreener calendar quarterly **Net sales, Net income, EBIT** expected/released pairs. Both values come from that source, not a hybrid of Naver actuals and a differently adjusted forecast. EBIT remains a separate metric, not a replacement for operating profit. The Naver operating-profit chart remains actual-only with an explicit missing-forecast explanation.
- Yahoo EPS retains its currency and selected GAAP/Normalized basis; MarketScreener EPS is not mixed with it. Novo fundamentals are DKK millions, not ADR USD. Nike's fiscal year ends in May: FY2027 Q1 ends August 2026.
- Charts retain four reported quarters plus at most two later forecast quarters. Missing actuals are null (no bar, no surprise); zero remains zero. Some older KR forecasts are unavailable; never backfill them from actuals.

## Refresh and provenance

`update_earnings_comparison.py` refreshes KR consensus and Yahoo EPS in the existing scheduled workflow. Source failures preserve previous files; successful issuers can still be committed if another source fails. Every metric retains its true source timestamp when filling a partial live response.

The four `*-fundamentals.json` files are **reviewed snapshots**, not live quotes and not refreshed by that workflow. Initial captures: 2026-10-27 UTC. Ordinary HTTP/Chromium retrieval returned 403; a public readable-page fetch returned the quarterly tables. No access-control bypass was used. The UI explicitly labels saved/non-live data and flags ages over seven days.

To refresh these supplemental files, retrieve the public source URL in each snapshot, inspect its quarterly table, save a capture JSON `{url, asOf, text}` preserving the actual fetch timestamp, then run:

```
python3 scripts/import_earnings_fundamentals.py googl /path/to/reviewed-capture.json
```

Use issuer `googl`, `amzn`, `nke` or `novo-nordisk`. The importer checks source/issuer, fiscal year-end and released/forecast/spread alignment (allowing source integer rounding). It retains only the next two visibly checked forecast columns because later blank columns can lose alignment in readable text. Confirm those column positions against the source before importing. Failures must not replace valid snapshots. Do not advance `asOf` without a new source capture.

## Annual view and display units

- The period switch loads separate annual data, never sums a partial set of quarters. `*-annual.json` contains Naver's finalized annual financials for all eight stocks and WiseReport annual pre-release consensus for KR. The existing collector refreshes these independently of quarterly/EPS sources (`--annual-only` is available).
- Supplemental MarketScreener captures now retain the annual table separately, including annual EPS with its own provider basis. This is not treated as Yahoo's normalized quarterly EPS. Fiscal year is the year ending in the issuer's reported month (Nike: May; the other supported issuers: December). Snapshot timestamps and manual-refresh limitations remain unchanged.
- Financial totals are displayed in hundred-million units (억), retaining source currency: KRW 억 stays unchanged; USD/DKK millions are divided by 100 to become 억 USD/DKK. No FX conversion is performed. EPS remains per-share. Amounts display up to two decimals, surprises up to one decimal, calculated from unrounded source values.
- Paired actual/estimate bars share a boundary; each period group has a separate gutter. Surprises share one line and use signed green/red percentages; table deltas use the same sign colors. Missing/zero estimates never produce invented percentages.
