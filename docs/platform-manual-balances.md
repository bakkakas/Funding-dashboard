# Platform manual balances

Each platform card can save a KRW/USD balance and explicitly enable it. Disabled is the default. Holdings remain unchanged; switching off restores their valuation. The user chooses one representative allocation class and whether this balance is excluded from total assets only (allocation still includes it, matching the existing exclusion policy).

Enabled balances replace all assets in that trimmed platform name. Matching named detailed crypto-wallet entries are also suppressed from totals, irrespective of the selected crypto source. Detail values are shown as reference only; their Stable/exclusion/classification settings do not apply to the manual representative. Manual zero is meaningful. USD is converted once using the same exchange rate as the rest of the portfolio.

`effectivePortfolio` is shared by the browser and scheduled snapshot valuation. Snapshot quote validation ignores replaced holdings, but still fails closed for incomplete remaining quotes/FX. Prior snapshots are not migrated. Existing scheduled snapshots retain their protected semantics.

Storage: `portfolio_settings.platform_balances`, under existing owner RLS. RPC updates merge a single platform key without overwriting other platform keys or crypto-source settings. Rename/delete are transactional, including settings; rename of a configured platform also moves matching detailed crypto-wallet locations (a collision rejects the entire change). Deleting a platform does not delete the separate detailed crypto portfolio. Removing/moving the last holding clears its override so later platform-name reuse cannot resurrect old balances. Stale orphan settings do not contribute to valuation.

Migration: `202611270001_platform_balances.sql`. Deploy the updated `portfolio-snapshot` Edge Function with its JS dependencies before releasing the browser entry. Existing scheduler-token authorization and `verify_jwt=false` are unchanged.
