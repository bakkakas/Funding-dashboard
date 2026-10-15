alter table public.portfolio_assets
  add column if not exists cash_amount_krw numeric not null default 0
    check (cash_amount_krw >= 0),
  add column if not exists cash_amount_usd numeric not null default 0
    check (cash_amount_usd >= 0);

-- Preserve every existing cash balance before the app starts reading split amounts.
update public.portfolio_assets
set
  cash_amount_krw = case when currency = 'KRW' then quantity else cash_amount_krw end,
  cash_amount_usd = case when currency = 'USD' then quantity else cash_amount_usd end
where asset_class = 'cash'
  and cash_amount_krw = 0
  and cash_amount_usd = 0;

-- The owner requested these two legacy rows to become one multi-currency account.
-- Scope the merge to matching rows owned by the same user and keep the older row id.
with pairs as (
  select
    krw.id as keep_id,
    usd.id as remove_id,
    krw.cash_amount_krw + usd.cash_amount_krw as merged_krw,
    krw.cash_amount_usd + usd.cash_amount_usd as merged_usd,
    krw.stable_amount_krw + usd.stable_amount_krw as merged_stable,
    krw.excluded_from_total or usd.excluded_from_total as merged_excluded
  from public.portfolio_assets krw
  join public.portfolio_assets usd on usd.user_id = krw.user_id
  where krw.asset_class = 'cash'
    and usd.asset_class = 'cash'
    and lower(btrim(krw.nickname)) = lower('젠틱')
    and regexp_replace(lower(btrim(usd.nickname)), '[[:space:]]+', '', 'g') = lower('젠틱USD')
), updated as (
  update public.portfolio_assets asset
  set
    name = '현금 계정',
    nickname = '젠틱',
    quantity = 0,
    currency = 'KRW',
    manual_price = 1,
    cash_amount_krw = pairs.merged_krw,
    cash_amount_usd = pairs.merged_usd,
    stable_amount_krw = pairs.merged_stable,
    stable_currency = 'KRW',
    excluded_from_total = pairs.merged_excluded
  from pairs
  where asset.id = pairs.keep_id
  returning pairs.remove_id
)
delete from public.portfolio_assets asset
using updated
where asset.id = updated.remove_id;
