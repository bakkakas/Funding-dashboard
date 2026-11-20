# Trade journal & paper practice

`trade-journal.html` adds two independent, private, authenticated ledgers. It never changes portfolio holdings, funding positions, investment plans, or broker accounts. Paper is the default tab; the user supplies starting KRW and/or USD capital. No sample trades, model allocation, or initial funds are seeded into real accounts.

## Accounting
- Long-only cash instruments. No derivatives, borrowing, short selling, or leveraged PnL accounting.
- Moving-average cost including buy fees/taxes. Each sale releases proportional basis and deducts sell fees/taxes. Partial and full exits realize PnL; a full exit also shows total PnL and basis-relative return for that zero-to-zero cycle.
- Daily/weekly/monthly figures aggregate realized PnL by **KST sale date**, Monday-start calendar weeks and calendar months. Date filters apply before aggregation. No-sale periods are omitted; current periods are partial. Percentages are PnL / disposed basis, not portfolio/time-weighted returns.
- Current unrealized = remaining quantity × current quote − remaining basis; hypothetical exit costs are excluded. Missing/failed quotes suppress that currency's total unrealized and total PnL rather than valuing missing assets at zero.
- KRW and USD are separate pools; no current-FX restatement of historical profits, no implicit FX trades. Crypto quotes are CoinGecko USD reference prices, not actual USDT executions. Gold is PAXG units, not KRX grams or physical gold.
- Fees and transaction taxes are manually specified per fill in its quote currency. Dividends, interest, funding, external deposits/withdrawals, tax liability calculations, corporate action processing, and historical mark-to-market daily NAV returns are not implemented. Stock splits require consistent quantity/price adjustments of the input records. The page explains this scope.

## Data & paper execution
Reuses the existing portfolio-market stock search/quote function and CoinGecko public search/price endpoints. Stock result codes are restricted to supported Korean/US formats. Provider time, retrieval time and reference-price source are displayed. Coin quotes older than 15 minutes, stock date older than 5 days, or unverifiable dates are refused. Stock timestamps without timezone remain verbatim, not converted by guesswork.

Paper is **manual reference-price practice**, not an exchange fill simulator/backtest. It uses a fetched quote within 2 minutes, records current time and source, and does not model spreads, slippage, liquidity, opening hours, limit order matching or market impact. Quotes can be delayed or previous close. No profitability comparison/competition integrity is claimed: quotes are client supplied. Clients cannot overspend or sell unowned size through the save API, but the server does not independently attest the external quote. SL is a planning field only, never an automatic order or notification.

Actual fills always use the user's entered execution price/time. Current quotes are read-only reference information, never backfilled as historical execution prices. Edits/deletes replay the entire history; invalid resulting sales are blocked. Paper history is append-only except explicit whole-book reset. A reset does not touch the real book.

## Persistence & safety
`trade_journal_books` key = `(auth.uid(), mode)`; authenticated owner SELECT RLS, no direct client writes or anonymous privileges. `save_trade_journal` SECURITY DEFINER uses auth.uid() only, a fixed search_path, typed JSON validation, a row lock and expected integer revision. Atomic saves validate cash and chronological ownership; conflicts are rejected rather than last-write-wins. First saves use INSERT ON CONFLICT + row locking. 2,000 transactions / 2 MB per mode. Notes rendered as escaped text; CSV formula prefixes neutralized. No private localStorage fallback.

UI guards asynchronous loads/search/quotes/saves against account/mode changes. Failed saves retain form values. Account changes clear the form and hide prior user results. Failed loads lock mutations and offer retry. No authenticated user test writes are required for deployment verification.

## Verification
- `node --test tests/trade-journal.test.mjs`: average basis/fees, partial and full cycles, fractional quantities, cash/currency separation, short-sale rejection, chronological corrections, KST bucket boundaries, missing quotes, invalid inputs.
- `scripts/trade-journal-rls-check.sql`: run as a transaction; creates synthetic test users, exercises owner writes, revision conflicts, immutability, insufficient cash, overselling, cross-user isolation and anonymous denial; ends ROLLBACK.
- Browser local mocked flows cover seed/buy/partial/close, PnL, filtering, real/paper isolation, save failure/conflict, edits, reload, logout race and mobile/desktop layout. Production anonymous and live quote reads verified separately. No claim of a real user's authenticated UI write unless explicitly recorded.
