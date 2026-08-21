alter table public.portfolio_assets
  add column if not exists excluded_from_total boolean not null default false;
