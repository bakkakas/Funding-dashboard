alter table public.portfolio_assets
  add column if not exists stable_currency text not null default 'KRW'
  check (stable_currency in ('KRW', 'USD'));
