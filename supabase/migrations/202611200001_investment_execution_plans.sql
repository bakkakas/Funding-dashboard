-- Additive private planning storage. Existing judgments and holdings are untouched.
create table public.investment_rules (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=40000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.investment_execution_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=80000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.investment_rules enable row level security;
alter table public.investment_execution_plans enable row level security;
revoke all on public.investment_rules,public.investment_execution_plans from anon;
grant select,insert,update,delete on public.investment_rules,public.investment_execution_plans to authenticated;
create policy investment_rules_owner on public.investment_rules for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy investment_execution_owner on public.investment_execution_plans for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create index investment_execution_user_created on public.investment_execution_plans(user_id,created_at desc,id);
create trigger investment_rules_touch before update on public.investment_rules for each row execute function public.touch_updated_at();
create trigger investment_execution_touch before update on public.investment_execution_plans for each row execute function public.touch_updated_at();
alter table public.investment_plan_items add column observed_on date check(observed_on between '1900-01-01' and '2199-12-31'), add column source_url text not null default '' check(length(source_url)<=2000), add column interpretation text not null default '' check(length(interpretation)<=4000);
