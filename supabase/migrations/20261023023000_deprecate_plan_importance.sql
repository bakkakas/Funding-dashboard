-- Keep legacy clients readable/writable, but new clients neither send nor use importance.
-- The field is no longer exposed and does not affect scoring or ordering.
alter table public.investment_plan_items alter column importance set default 3;
comment on column public.investment_plan_items.importance is 'Deprecated legacy field; not used by current UI, scoring or ordering.';
