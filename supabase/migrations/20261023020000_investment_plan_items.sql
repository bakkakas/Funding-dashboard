create table public.investment_plan_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 300),
 category text not null check(category in ('macro','geopolitics','industry','asset','personal','other')),
 kind text not null check(kind in ('fact','forecast')),
 impact smallint not null check(impact in (-3,-2,-1,1,2,3)),
 importance smallint not null check(importance between 1 and 5),
 scope text not null default 'all' check(scope in ('all','asset_class','industry','asset')),
 target text not null default '' check(length(target)<=120),
 notes text not null default '' check(length(notes)<=4000),
 expires_on date check(expires_on between '1900-01-01' and '2199-12-31'),
 cash_date date check(cash_date between '1900-01-01' and '2199-12-31'),
 cash_amount numeric check(cash_amount between 0 and 100000000000000),
 liquidity text not null default 'unsure' check(liquidity in ('room','balanced','tight','unsure')),
 state text not null default 'active' check(state in ('active','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((scope='all' and target='') or (scope<>'all' and length(btrim(target))>0)),
 check(category='personal' or (cash_date is null and cash_amount is null and liquidity='unsure'))
);
alter table public.investment_plan_items enable row level security;
revoke all on public.investment_plan_items from anon;
grant select,insert,update,delete on public.investment_plan_items to authenticated;
create policy investment_plan_items_owner on public.investment_plan_items for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
create index investment_plan_items_user_created on public.investment_plan_items(user_id,created_at desc,id);
create trigger investment_plan_items_touch before update on public.investment_plan_items for each row execute function public.touch_updated_at();
