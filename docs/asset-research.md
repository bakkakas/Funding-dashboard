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
