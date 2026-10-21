# Portfolio → issuer research

Portfolio instrument names link into `investment-setup.html`. The existing crypto
research catalogue remains authoritative for matching CoinGecko IDs. Uncatalogued
coins use the same renderer with sourced overview and explicitly unknown research
fields; missing unlock/valuation information is not fabricated.

## Instrument identity

`js/asset-identity.js` separates a holding's pricing instrument from the issuer
research identity. Verified single-stock ETF mappings share the underlying stock's
page and investment notes. Broad ETFs/ETNs, cash, commodities and stablecoins are
excluded. Unknown ETF/ADR identities are not guessed: the data service rejects
unresolved instruments and asks for the underlying stock. Extend the explicit map
only after verifying the issuer. Exclusion rules are not a complete global security
master; newly added instruments may require a verified mapping.

NVO maps to Novo Nordisk's issuer and original-company IR archive. Its market quote
remains the US ADR in USD, prominently labelled; it is not presented as Copenhagen
NOVO B in DKK. Other ADRs require a verified issuer mapping before admission.

## Private investment principles

`research_theses` stores `buy_reason` and `reconsider_conditions` under a composite
`(user_id, asset_key)` key, with owner-only RLS on every operation. Stock keys are
issuer IDs and crypto keys are `crypto:<coingecko-id>`. There is no shared-browser
localStorage fallback for these notes. Saving is explicit, failed saves retain the
input, failed loads disable editing, and stale responses cannot populate another
asset/account's form. Unsaved navigation prompts before discarding. Existing crypto
valuation/scenario controls are independent of these two new fields.

## Sources and definitions

The independent `asset-research` Supabase Edge Function reads public Naver Finance
and CoinGecko endpoints with timeouts, bounded cache and fixed upstream hosts. It
uses no model provider, OpenClaw session, DailyKit service or AI credential.

- Market cap/financial units follow the source and are labelled.
- 1D is source-reported previous trading-day change. 7D, 30D, 1Y compare the current
  quoted price against the close on/before 7, 30, 365 calendar days before the quote
  date. Missing or more-than-seven-day-stale baselines remain unavailable. They are
  price returns, not dividends-reinvested returns; upstream adjustment rules apply.
- Korean foreign ownership is `foreignerHoldRatio` with its own date, **not** foreign
  quota utilization. Overseas foreign ownership is unavailable rather than zero.
- Quarter tables exclude consensus/forecast rows. Period-end and filing dates are
  distinguished. Missing values stay missing, including unavailable descriptions.
- News links lead to Naver's actual article routes; articles can include broader
  market context, and are not an AI-ranked recommendation list.

## Historical filings

`scripts/update_stock_research.py` collects public archives from Samsung/Novo
Nordisk IR, SK hynix's official newsroom and SEC companyfacts for Alphabet, Amazon
and Nike. The initial six issuer archives cover 2021 onward. Other ordinary stock
quotes can load on demand, but their five-year archive requires adding a verified
collector; the UI says so rather than claiming complete coverage.

SEC entries link to original 10-Q/10-K filing indexes, not necessarily the earnings
press-release date. Only directly reported standalone-quarter facts are attached;
YTD amounts are not labelled quarterly. Annual 10-K data is not silently converted
to Q4. Later restatement facts display their own filing dates. IR-only archive rows
open the original presentation/release instead of inventing parsed historic values.
Missing announcements are omitted, so the list is not guaranteed exhaustive.

The scheduled workflow refreshes on weekday mornings KST. An upstream failure stops
publication; previous published data remains available with its last-check date.
Add an archive to the catalogue's `archiveAvailable` mapping when adding its file.

## Verification

Run `node --test tests/*.test.mjs`, Python unittest discovery and
`deno check supabase/functions/asset-research/index.ts`. Browser checks cover mobile
portfolio navigation, ETF/ADR identity, explicit save/reload, account/asset isolation
and year selection. Fixture-auth UI checks are distinct from real database RLS
checks; never insert trial notes into a real user's portfolio.

## Earnings comparison and last four quarters

Company logos come from the issuer's Naver logo URL (never the leverage wrapper's
logo), in both the catalogue and stock header. On-demand stock/crypto selections
also update the catalogue's identity/logo after the source response.

The top of the earnings section charts the latest four **final reported** quarters
from Naver, chronologically, with a revenue/operating-profit/net-income selector
and exact values plus quarter-on-quarter changes. Overseas figures now use the
actual income-statement endpoint: EBIT is not relabelled operating profit. A
missing quarter, zero or negative base is not assigned a misleading growth rate.
The statement's own currency/scale is shown (including DKK for Novo Nordisk).

Comparison data is separate from this finalized series:
- Domestic: WiseReport/FnGuide quarterly IFRS-consolidated earnings surprise table,
  with the **immediately-pre-announcement consensus** and **first announced result
  (including preliminary results)**, with each metric's announcement date. Net
  income is parent-company attributable. Current unannounced estimates are marked
  as such and never treated as actual zero. Partial metric retrieval is disclosed.
- Overseas: the publicly rendered Yahoo Finance Earnings History table, preserving
  its actual selected GAAP/Normalized switch, currency and matching fiscal period
  columns. EPS estimate and actual come from that same table. Revenue/operating
  profit pre-announcement consensus is not supplied by this source. Example: NVO
  can report Normalized EPS in DKK although its market quote is the USD ADR.

Difference percentages are computed from displayed (rounded) values, using the
absolute estimate as denominator. Zero/missing estimates yield no percentage.
Cross-provider or GAAP-vs-adjusted numbers are never combined into surprise values.
Parser failures leave comparison unavailable without discarding independent stock
price/final-financial data. Retrieval time is not an announcement or estimate date.
Fixtures retain only public numerical table facts and source markup needed to
verify parsing; no user data or credentials.

Cloud-runtime Yahoo retrieval can fail independently of public browser access.
For the initial four overseas issuers, a public `data/earnings-comparison` snapshot
is used only when the live comparison is unavailable. Its original collection time
and “정기 수집 자료” label remain visible. Seven-day-old data or comparison quarters
older than the latest finalized statement trigger an update-delay notice.
`scripts/update_earnings_comparison.py` refreshes these tables with the same JS
parser, through a separate weekday GitHub workflow; transient 429/5xx responses
are retried up to three times. Failed collections do not publish or erase the last
successful snapshot. The collector reads no portfolio, account or AI configuration.
