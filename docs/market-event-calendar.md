# Investment judgment board: market event countdown

## Scope and display
Only FOMC, US CPI/employment/PCE, ECB, BOJ, BOK policy decisions; US presidential/congressional general elections (midterms represented once); NVDA, MSFT, AAPL, AMZN, GOOGL, META, TSM, Samsung Electronics and SK hynix earnings.

Public compact badges above the judgment-board heading. D-30 through D-0 inclusive, sorted by date, no count cap. Expired events are hidden from the UI at Korean midnight, not deleted from the audit data. No sign-in needed and no changes to private judgment items or scores. Desktop wraps inline; narrow mobile shows two columns. A badge opens its source and exposes date/status details in its title.

## Sources and date semantics
- Federal Reserve official meeting HTML, final meeting day at 14:00 America/New_York; DST-aware conversion to Korean date. No separate dot-plot or press-conference duplicate.
- BLS official ICS, exact CPI and Employment Situation titles only; BEA official ICS Personal Income and Outlays (PCE), not state income/GDP releases.
- ECB official schedule, monetary-policy day 2 only. BOJ official meeting table final day, not minutes or outlook publication. BOK official eight policy-setting meetings, not all board sessions.
- Samsung official IR Events, earnings conference calls, not separate preliminary guidance. SK hynix's embedded Euroland financial calendar, Earnings Release category only.
- Nasdaq daily earnings calendar (Zacks): allowlisted seven US-listed tickers only; yesterday through next 30 days, every day. These dates are labeled 예정, not asserted to be company-confirmed. US after-hours maps to next Korean date; pre-market same date. If session/time is unavailable, retain the provider's local date with an explicit 현지 badge and date note, never invent a release hour. A company with no provided upcoming date produces no fabricated badge.
- US statutory general election day: Tuesday after first Monday in November, even years; presidential+congressional one badge every four years, other even years midterms. Effective Korean display date is the next day when US voting ends; tooltip retains the actual US election date. Does not predict primaries, special elections, results or inauguration.

## Automatic refresh and failures
GitHub Actions `update-market-events.yml` runs daily at 06:17 KST (scheduler delays possible), also manual dispatch. Python dependencies in `scripts/requirements-market-events.txt`. Browser refreshes the JSON every 30 minutes and on visibility restore; Korean midnight timer expires badges even if the daily job is delayed.

Each source refresh replaces its own schedule, so removed/rescheduled source events do not linger. Failure retains that source's last verified data, checkedAt is not advanced, warnings are recorded and a compact delay notice is displayed. Never turn source failure into “no events”. Source histories older than 90 days are pruned; source unavailability does not synthesize monthly dates. Initial BLS official ICS was fetched through the connected web-fetch reader because local urllib received 403; deployment checks must inspect the actual hosted collector run, not infer network availability from local success.

## Verification
Tests cover D-30/D-31, D-0/D+1 midnight, month/year/leap transitions, malformed dates, deduplication, FOMC final day and DST, central-bank selection, announcement categories, Nasdaq session conversion/allowlist, US election deduplication, and preserving failed-source data versus replacing revised schedules.
