create table public.research_thesis_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 asset_key text not null check(length(asset_key) between 1 and 160),
 kind text not null check(kind in ('reason','conditions','issue')),
 body text not null check(length(btrim(body)) between 1 and 6000),
 starts_on date,
 ends_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint thesis_issue_period check (
  (kind='issue' and length(body)<=300 and starts_on is not null and ends_on is not null
   and starts_on between '1900-01-01' and '2199-12-31'
   and ends_on between starts_on and '2199-12-31')
  or (kind in ('reason','conditions') and starts_on is null and ends_on is null)
 )
);
create index research_thesis_items_owner_asset on public.research_thesis_items(user_id,asset_key,created_at,id);
alter table public.research_thesis_items enable row level security;
create policy research_thesis_items_own on public.research_thesis_items for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.research_thesis_items from anon;
grant select,insert,update,delete on public.research_thesis_items to authenticated;
create trigger research_thesis_items_touch before update on public.research_thesis_items for each row execute function public.touch_updated_at();
-- Preserve each complete legacy text as one item; leave the original table untouched.
insert into public.research_thesis_items(user_id,asset_key,kind,body,created_at,updated_at)
select t.user_id,t.asset_key,v.kind,v.body,t.updated_at,t.updated_at
from public.research_theses t cross join lateral
(values ('reason',t.buy_reason),('conditions',t.reconsider_conditions)) v(kind,body)
where length(btrim(v.body))>0;
