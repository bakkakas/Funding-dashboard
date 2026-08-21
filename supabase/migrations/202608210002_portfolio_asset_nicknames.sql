alter table public.portfolio_assets
  add column if not exists nickname text not null default '';

alter table public.portfolio_assets
  drop constraint if exists portfolio_assets_user_id_symbol_asset_class_key;

alter table public.portfolio_assets
  add constraint portfolio_assets_user_symbol_class_nickname_key
  unique (user_id, symbol, asset_class, nickname);
