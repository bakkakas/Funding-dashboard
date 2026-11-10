-- Keep legacy nickname as the platform grouping key; independent per-holding label.
alter table public.portfolio_assets add column if not exists asset_label text not null default '' check (char_length(asset_label) <= 80);
