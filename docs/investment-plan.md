# Investment judgment board

The Investment Setup → Investment Plan tab records context, not trade orders or an automatic buy score. No examples or real user data are seeded.

- Six signed impact levels (-3, -2, -1, +1, +2, +3); mandatory fact/forecast selection; importance 1–5.
- Scope defaults to entire portfolio; optional asset class, industry, or individual asset target. Target filtering also includes global context.
- Personal cash context includes qualitative liquidity (room/balanced/tight/unsure), optional required KRW amount and date, and freeform horizon/evidence. No presumed house purchase, fabricated budget, automatic investment-ratio recommendation or sum of heterogeneous obligations.
- Optional expiry dates are interpreted as calendar dates in Asia/Seoul. Starting at that date an active entry is marked for review, remains visible, and is excluded from fresh market positive/negative counts. Resolve the entry or explicitly edit its expiry after review. Page checks the date every minute and on visibility return; expired entries also badge the parent tab. No background push/Telegram notification.
- Owner-only `investment_plan_items` table with RLS; authenticated CRUD, no anonymous access; paginated reads, no localStorage personal-data fallback. Save failures retain input, load failures lock editing, account changes clear forms, stale results cannot repaint another user's context. Updates/deletes compare `updated_at` and reject stale edits.
- Six-level/domain/date/personal-cash logic in `investment-plan-model.js`; Node tests in `tests/investment-plan.test.mjs`.
- Migration `20261023020000_investment_plan_items.sql`. `scripts/investment-plan-rls-check.sql` verifies owner CRUD, cross-account rejection and impact constraints entirely inside a rolled-back transaction.
- UI validation uses a browser-only fake database (no real account writes). Production anonymous UI checked independently. Korean board text currently remains Korean in the global EN shell, consistent with the existing thesis editor.
