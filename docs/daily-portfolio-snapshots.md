# Daily portfolio snapshots

- Scheduler: Supabase pg_cron, UTC 14:40 (KST 23:40), retry UTC 14:50.
- Independent DB watchdog: UTC 15:05 / KST 00:05, checks the preceding KST date.
- `portfolio-snapshot` Edge Function authenticates a Vault-generated scheduler token through a service-role-only RPC. No token or service key is stored in the repository or returned by the API.
- One `(user_id, snapshot_date)` snapshot. Successful scheduled runs cannot be claimed again, and the DB trigger prevents subsequent browser upserts from replacing them.
- Failed/incomplete prices or FX never save a partial valuation. A five-minute lease allows an interrupted collector to be retried. Completion checks both the claim and the holdings revision (including deletes) before committing the snapshot and success status atomically.
- Failures are recorded in `portfolio_snapshot_runs`. The My Assets page shows last success and a red failure/status warning; this is **not** an email or push notification.
- The watchdog marks missing/unfinished runs, even if the Edge Function did not execute. Historical dates before enablement are not synthesized or backfilled.
- Cash split balances, manual prices, stable annotations, excluded-from-total assets and the selected crypto total source follow the browser's shared `valuePortfolio` calculation. Allocation categories intentionally include excluded assets, matching the existing allocation UI.
- Prices are the latest available quotes, not a guaranteed exchange closing-price series. Manual-price assets retain their configured value. The daily scheduler uses the currently saved quantities; it does not reconstruct missing historical holdings.

## Deployment

Deploy `supabase/functions/portfolio-snapshot/index.ts` with its three JS dependencies; `verify_jwt=false` is intentional because the function performs its own scheduler-token authentication. Apply migration `20261029020000_daily_portfolio_snapshots.sql` once. It installs pg_cron/pg_net, private run state/RPCs, a Vault token and the three scheduled jobs.

## Verification (without exposing holdings)

```sql
select jobname,schedule,active from cron.job where jobname like 'portfolio-snapshot-%';
select snapshot_date,status,attempts,error from public.portfolio_snapshot_runs order by snapshot_date desc;
-- Dispatch uses the Vault token internally; never select request headers or secret values.
select public.dispatch_portfolio_snapshot();
-- Inspect the returned request id's status and non-sensitive summary only:
select id,status_code,timed_out,error_msg,content from net._http_response where id = :request_id;
```

2026-10-29 validation: first real run succeeded; repeat dispatch skipped the successful day. Invalid-token/no-token calls returned 401. Transaction-rolled-back tests verified failed-run recording, retry claims, preservation of the good snapshot, service-only RPC grants and authenticated browser overwrite protection. UI success/failure states tested with synthetic data at 390px and 1440px; real holdings were not displayed in test-browser captures.
