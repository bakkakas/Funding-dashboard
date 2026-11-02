# FX, dividends and shareholder returns

## FX
All page header FX tickers share `js/fx-rate.js`: ExchangeRate-API open USD feed, daily reference rate, **not live market/bank dealing rates**. Fetch on load and every 30 minutes while visible. Show source timestamp in KST and link to provider documentation. Reject unsuccessful/nonpositive/nonfinite/stale (>3 days)/future values. Removed former `(ER rate - Fawaz rate)/Fawaz rate` pseudo daily change: two providers are not two trading dates.
Portfolio valuation and server daily snapshots retain their existing daily reference feed; historical amounts are not rewritten. Header refresh does not trigger portfolio snapshots.

## Dividends
Naver summary dividend metrics retain provider period and are explicitly separate from latest announced quarterly DPS. Samsung quarterly DPS is parsed from official shareholder-return page; parse changes preserve last known data and flag failure. SK hynix quarterly DPS is parsed only from explicitly named quarter/year business-result releases with a matching quarterly DPS and total; latest verified Q3 data comes from the October 28 release. No annual fixed dividend is inferred as quarterly DPS. Quarterly DPS/current quote uses matching currency only, without multiplying by four or relabeling as trailing annual yield. No unknown dividend is imputed as zero.

## Policies
Manually reviewed structured history: Samsung, SK hynix, Hyundai, Pearl Abyss. Latest verified source date: 2026-11-02. Distinguish commitments, forecasts, executions, annual/fixed/quarterly/special dividends, FCF vs controlling-owner profit, repurchase vs existing-share cancellation valuations and employee compensation shares.

`update-shareholder-returns.yml` checks these four issuers at 00:17/06:17/12:17/18:17 UTC (09:17/15:17/21:17/03:17 KST). It discovers same-host official release links and adds source paragraphs without generative extraction. New sources appear with original links in the UI; reviewed numeric history is **not** silently rewritten by keyword matching. Changed paragraphs retained in `sourceChanges`; source failures preserve old documents and publish status, total collection failure produces failed workflow. `checkedAt` is not publication date. No date is inferred from fetch time.

Overseas issuer IR collection currently blocked (HTTP errors or no parsable policy content): Alphabet, Amazon, Nike, Novo Nordisk, Oatly. These display official links and explicitly unregistered structured policy, not "no policy". They are not scheduled as successfully monitored. Newly selected unknown issuers likewise use their official IR fallback. Extending structured coverage requires verified official sources rather than guessing numbers from headlines.
