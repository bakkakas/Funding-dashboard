-- Classification override only. Native class remains the pricing/source identity.
alter table public.portfolio_assets
  add column if not exists allocation_class text
  check (allocation_class in ('stock', 'crypto', 'commodity', 'cash'));
