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

  with human_visit_events as (
    select *
    from public.visit_events
    where coalesce(user_agent, '') !~* '(HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider)'
  ),
  base as (
    select
      visited_at,
      (visited_at at time zone 'Asia/Seoul')::date as kst_day,
      visitor_id,
      coalesce(nullif(country, ''), 'Unknown') as country
    from human_visit_events
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
    from human_visit_events
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
