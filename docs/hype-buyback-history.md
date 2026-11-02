# HYPE daily execution archive

The official `userFillsByTime` API exposes at most 2,000 fills per response and only the most recent 10,000 fills. Empty old responses do **not** establish zero purchases.

On 2026-11-02, 34 observed daily rows (2026-09-30 through 2026-11-02) were recovered from 88 versions of `data/hype-buybacks.json` in Git history. For each UTC day, a snapshot whose returned daily range starts before that day and whose observation date is later than that day is preferred; otherwise retain the largest observed fill count. First returned and current days are conservatively partial. This is the archived execution history, not lifetime purchases.

The scheduled collector now preserves old daily rows. A truncated retention-boundary response cannot overwrite a previously complete day. Current-day rows are replaced, never added twice. Failed API calls still abort before the atomic snapshot write. No synthetic zero days are inserted.

UI ranges count UTC calendar days inclusive of the snapshot date (30, 90, 365, or all archived rows). Weekly/monthly tables aggregate only the selected rows. Weeks start Monday UTC. Missing days, incomplete daily rows, and selected-window-truncated weeks/months are marked partial. Average execution price is total USD notional divided by total HYPE quantity, not an average of daily prices. Trade fees are not included in notional.

The upper cumulative balance / entry-notional metrics remain separate from archived execution sums; the collector's rolling recent metrics retain their existing API-fill basis and may have less history than the archive.

Sources:
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
- https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees
- https://app.hyperliquid.xyz/explorer/address/0xfefefefefefefefefefefefefefefefefefefefe
