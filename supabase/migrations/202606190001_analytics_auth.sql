create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

alter table public.favorites enable row level security;

create table if not exists public.visit_events (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  path text,
  referrer text,
  country text,
  user_agent text,
  ip_hash text
);

alter table public.visit_events enable row level security;

create index if not exists visit_events_visited_at_idx on public.visit_events (visited_at desc);
create index if not exists visit_events_visitor_id_idx on public.visit_events (visitor_id);
create index if not exists visit_events_country_idx on public.visit_events (country);
create index if not exists favorites_user_sort_idx on public.favorites (user_id, sort_order);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists favorites_touch_updated_at on public.favorites;
create trigger favorites_touch_updated_at
before update on public.favorites
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = 'member');

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "favorites_update_own" on public.favorites;
create policy "favorites_update_own"
on public.favorites for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "visit_events_admin_select" on public.visit_events;
create policy "visit_events_admin_select"
on public.visit_events for select
to authenticated
using (public.is_admin());

create or replace function public.admin_dashboard_stats(days_back integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  with base as (
    select
      visited_at,
      (visited_at at time zone 'Asia/Seoul')::date as kst_day,
      visitor_id,
      coalesce(nullif(country, ''), 'Unknown') as country
    from public.visit_events
    where visited_at >= now() - make_interval(days => greatest(days_back, 1))
  ),
  daily as (
    select coalesce(jsonb_agg(row_to_json(row_data) order by day desc), '[]'::jsonb) as rows
    from (
      select
        kst_day::text as day,
        count(*)::integer as pageviews,
        count(distinct visitor_id)::integer as visitors
      from base
      group by kst_day
      order by kst_day desc
    ) row_data
  ),
  countries as (
    select coalesce(jsonb_agg(row_to_json(row_data) order by visitors desc), '[]'::jsonb) as rows
    from (
      select
        country,
        count(*)::integer as pageviews,
        count(distinct visitor_id)::integer as visitors
      from base
      group by country
      order by visitors desc, pageviews desc
      limit 30
    ) row_data
  ),
  totals as (
    select
      count(*)::integer as pageviews,
      count(distinct visitor_id)::integer as visitors,
      count(distinct visitor_id) filter (where (visited_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date)::integer as today_visitors
    from public.visit_events
  ),
  members as (
    select count(*)::integer as member_count from public.profiles
  )
  select jsonb_build_object(
    'totalPageviews', totals.pageviews,
    'totalVisitors', totals.visitors,
    'todayVisitors', totals.today_visitors,
    'memberCount', members.member_count,
    'daily', daily.rows,
    'countries', countries.rows
  )
  into result
  from totals, members, daily, countries;

  return result;
end;
$$;

grant execute on function public.admin_dashboard_stats(integer) to authenticated;
