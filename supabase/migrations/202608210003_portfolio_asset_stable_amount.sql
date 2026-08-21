alter table public.portfolio_assets
  add column if not exists stable_amount_krw numeric not null default 0
  check (stable_amount_krw >= 0);
