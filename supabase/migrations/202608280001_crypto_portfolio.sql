create table if not exists public.crypto_portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location text not null check (char_length(trim(location)) between 1 and 60),
  symbol text not null,
  name text not null,
  quote_symbol text not null,
  quantity numeric not null default 0 check (quantity > 0),
  currency text not null default 'USD' check (currency in ('USD', 'KRW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, location, symbol)
);

create table if not exists public.portfolio_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  crypto_total_source text not null default 'assets'
    check (crypto_total_source in ('assets', 'details')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crypto_portfolio_entries enable row level security;
alter table public.portfolio_settings enable row level security;

create policy "crypto_portfolio_entries_own"
  on public.crypto_portfolio_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "portfolio_settings_own"
  on public.portfolio_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger crypto_portfolio_entries_touch_updated_at
  before update on public.crypto_portfolio_entries
  for each row execute function public.touch_updated_at();

create trigger portfolio_settings_touch_updated_at
  before update on public.portfolio_settings
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.crypto_portfolio_entries to authenticated;
grant select, insert, update, delete on public.portfolio_settings to authenticated;
