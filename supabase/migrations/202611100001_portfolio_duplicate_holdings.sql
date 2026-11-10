-- Each holding is identified by its UUID, not by platform + symbol.
-- Keep ownership lookup indexed while allowing independently editable lots.
create index if not exists portfolio_assets_user_id_idx on public.portfolio_assets (user_id);
alter table public.portfolio_assets
  drop constraint if exists portfolio_assets_user_symbol_class_nickname_key;
-- Existing rows, primary key, checks, foreign key and owner RLS remain unchanged.
