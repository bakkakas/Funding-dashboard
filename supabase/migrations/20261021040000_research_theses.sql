create table public.research_theses (
 user_id uuid not null references auth.users(id) on delete cascade,
 asset_key text not null check (length(asset_key) between 1 and 160),
 buy_reason text not null default '' check (length(buy_reason)<=6000),
 reconsider_conditions text not null default '' check (length(reconsider_conditions)<=6000),
 updated_at timestamptz not null default now(),
 primary key(user_id,asset_key)
);
alter table public.research_theses enable row level security;
create policy research_theses_own on public.research_theses for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.research_theses to authenticated;
create trigger research_theses_touch before update on public.research_theses for each row execute function public.touch_updated_at();
