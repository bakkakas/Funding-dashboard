# Investment judgment board

The Investment Setup → Investment Plan tab records context, not trade orders or a probability of profitable investment. No examples or real user data are seeded.

- Six impact scores (very negative 1 through very positive 6); mandatory fact/forecast selection. Importance is removed from UI, normalization, ranking and scoring. Existing signed storage (-3, -2, -1, +1, +2, +3) maps deterministically to 1–6 to preserve saved records. The deprecated importance DB column has default 3 for compatibility with old clients; it is ignored.
- Scope defaults to entire portfolio; optional asset class, industry, or individual asset target. Target filtering also includes global context.
- Personal cash context includes qualitative liquidity (room/balanced/tight/unsure), optional required KRW amount and date, and freeform horizon/evidence. No presumed house purchase, fabricated budget, automatic investment-ratio recommendation or sum of heterogeneous obligations.
- Optional expiry dates are interpreted as calendar dates in Asia/Seoul. Starting at that date an active entry is marked for review, remains visible, and is excluded from score totals and averages. Resolve the entry or explicitly edit its expiry after review. Page checks the date every minute and on visibility return; expired entries also badge the parent tab. No background push/Telegram notification.
- Owner-only `investment_plan_items` table with RLS; authenticated CRUD, no anonymous access; paginated reads, no localStorage personal-data fallback. Save failures retain input, load failures lock editing, account changes clear forms, stale results cannot repaint another user's context. Updates/deletes compare `updated_at` and reject stale edits.
- Six-level/domain/date/personal-cash logic in `investment-plan-model.js`; Node tests in `tests/investment-plan.test.mjs`.
- Migration `20261023020000_investment_plan_items.sql`. `scripts/investment-plan-rls-check.sql` verifies owner CRUD, cross-account rejection and impact constraints entirely inside a rolled-back transaction.
- UI validation uses a browser-only fake database (no real account writes). Production anonymous UI checked independently. Korean board text currently remains Korean in the global EN shell, consistent with the existing thesis editor.

## Score calculation and option buttons
- All inputs and filters use visible radio-button choices, not dropdowns. Default scope is all; fact/forecast and impact require explicit selection. Target names support free text plus visible quick-pick buttons.
- Global score = sum of eligible global-scope records only. For each exact `(scope, target)` group: global records + that group's records, once each. Industry-specific negatives do not affect unrelated industries or the global score. No asset-class/industry/asset membership inference.
- Personal-cash context participates according to scope. Every record is equally weighted; facts and forecasts are not weighted differently. `total`, `count`, `maximum = 6 × count`, and `average = total / count` shown together. Empty sets have no average, shown as a dash, not a neutral score. Scores ignore list filters.
- Scores include active, unexpired records only. Existing scope cards remain visible after expiry/resolution with any still-valid global context. Same target text in different scope types is kept separate in scoring and filtering.
- New migration `20261023023000_deprecate_plan_importance.sql`; rolled-back DB checks now insert without importance.
