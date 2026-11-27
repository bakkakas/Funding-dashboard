# Platform manual balances

Each platform card can save a KRW/USD balance and explicitly enable it. Disabled is the default. Holdings remain unchanged; switching off restores their valuation. The user chooses one representative allocation class and whether this balance is excluded from total assets only (allocation still includes it, matching the existing exclusion policy).

Enabled balances replace all assets in that trimmed platform name. Matching named detailed crypto-wallet entries are also suppressed from totals, irrespective of the selected crypto source. Detail values are shown as reference only; their Stable/exclusion/classification settings do not apply to the manual representative. Manual zero is meaningful. USD is converted once using the same exchange rate as the rest of the portfolio.

`effectivePortfolio` is shared by the browser and scheduled snapshot valuation. Snapshot quote validation ignores replaced holdings, but still fails closed for incomplete remaining quotes/FX. Prior snapshots are not migrated. Existing scheduled snapshots retain their protected semantics.

Storage: `portfolio_settings.platform_balances`, under existing owner RLS. RPC updates merge a single platform key without overwriting other platform keys or crypto-source settings. Rename/delete are transactional, including settings; rename of a configured platform also moves matching detailed crypto-wallet locations (a collision rejects the entire change). Deleting a platform does not delete the separate detailed crypto portfolio. Removing/moving the last holding clears its override so later platform-name reuse cannot resurrect old balances. Stale orphan settings do not contribute to valuation.

Migration: `202611270001_platform_balances.sql`. Deploy the updated `portfolio-snapshot` Edge Function with its JS dependencies before releasing the browser entry. Existing scheduler-token authorization and `verify_jwt=false` are unchanged.

## Auto Cash mode

`mode: auto_cash` uses a manually entered platform total and values its selected non-cash detail holdings. The residual is one computed Cash(Stable) row; it is not inserted as another persisted asset. `mode` absent remains the original manual replacement mode.

- Allocation and snapshots: non-cash detail value + residual = platform total. The platform-level total-only exclusion applies to both parts; individual exclusion flags are ignored in this mode.
- Explicit cash-class holdings and recognized stablecoin quote identities are not subtracted again. A holding's explicitly designated Stable portion is removed from its non-cash value once. The entire residual is included in Cash and the Stable subset.
- The selected global crypto source chooses either original crypto holdings or same-named detailed wallet entries, never both. Other platforms are unchanged.
- Quotes missing/invalid or details exceeding the total halt allocation and snapshots, with a visible explanation. Invalid initial balances cannot be enabled/saved. The UI can still edit/disable the mode to recover. No negative residual is invented.
- Changing prices or quantities changes the split, not the manually entered total. Users must update the platform total themselves; this is not exchange balance/API synchronization.

Migration `202611270002_platform_auto_cash.sql` validates the optional mode while retaining existing owner RLS/RPCs. Deploy the shared snapshot dependencies before browser release. Synthetic fixtures verified one-million USD total / half-million crypto / half-million cash, mixed currency, source selection, Stable, exclusions, zero, overshoot, missing prices and disable restoration.

## Platform currency and cash header
Each platform has a USD/KRW selector. Selecting a currency opens the balance editor; Save persists it, Cancel leaves the previous setting intact. Existing totals are converted at the current FX rate (USD cents/KRW whole won); missing FX blocks conversion. New configurations default to auto_cash; explicit legacy manual configurations retain their mode. Auto Cash is displayed next to the platform valuation in its selected currency. The setting is retained even when manual use is unchecked.
