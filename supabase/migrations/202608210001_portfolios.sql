create table if not exists public.portfolio_assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null, name text not null,
  asset_class text not null check (asset_class in ('stock','crypto','commodity','cash')),
  quote_symbol text, quantity numeric not null default 0 check (quantity >= 0),
  currency text not null default 'USD' check (currency in ('USD','KRW')),
  manual_price numeric check (manual_price is null or manual_price >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, symbol, asset_class)
);
create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date, total_value_krw numeric not null check (total_value_krw >= 0),
  class_values jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);
alter table public.portfolio_assets enable row level security;
alter table public.portfolio_snapshots enable row level security;
create policy "portfolio_assets_own" on public.portfolio_assets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "portfolio_snapshots_own" on public.portfolio_snapshots for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger portfolio_assets_touch_updated_at before update on public.portfolio_assets for each row execute function public.touch_updated_at();
grant select, insert, update, delete on public.portfolio_assets to authenticated;
grant select, insert, update, delete on public.portfolio_snapshots to authenticated;
