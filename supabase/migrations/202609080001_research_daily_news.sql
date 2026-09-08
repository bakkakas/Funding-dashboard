begin;
create table if not exists public.research_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorites text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (cardinality(favorites) <= 200)
);
create table if not exists public.research_news_items (
  id text primary key,
  asset_id text not null check (asset_id ~ '^[a-z0-9][a-z0-9-]*$'),
  title text not null check (length(title) between 1 and 300),
  summary text not null check (length(summary) <= 1500),
  source_url text not null check (source_url ~ '^https://'),
  source_name text not null,
  source_type text not null check (source_type in ('official_blog','x','media','governance','docs')),
  published_at timestamptz not null,
  checked_at timestamptz not null default now(),
  unique(asset_id, source_url)
);
create table if not exists public.research_news_batches (
  asset_id text not null,
  edition_date date not null,
  status text not null check (status in ('success','error')),
  article_ids text[] not null default '{}',
  screened_at timestamptz not null default now(),
  primary key(asset_id,edition_date),
  check(cardinality(article_ids) <= 3)
);
create table if not exists public.research_news_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  news_id text not null references public.research_news_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,news_id)
);
alter table public.research_preferences enable row level security;
alter table public.research_news_items enable row level security;
alter table public.research_news_batches enable row level security;
alter table public.research_news_pins enable row level security;
create policy research_preferences_own on public.research_preferences for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy research_pins_own on public.research_news_pins for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy research_items_read on public.research_news_items for select to authenticated using(true);
create policy research_batches_read on public.research_news_batches for select to authenticated using(true);
revoke all on public.research_preferences,public.research_news_items,public.research_news_batches,public.research_news_pins from anon,authenticated;
grant select,insert,update on public.research_preferences to authenticated;
grant select on public.research_news_items,public.research_news_batches to authenticated;
grant select,insert,delete on public.research_news_pins to authenticated;
grant all on public.research_preferences,public.research_news_items,public.research_news_batches,public.research_news_pins to service_role;
create index research_news_items_asset on public.research_news_items(asset_id,published_at desc);

-- Atomic per-asset changes avoid overwriting other devices' favorites.
create or replace function public.research_set_favorite(p_asset_id text,p_enabled boolean,p_expected_user uuid)
returns text[] language plpgsql security invoker set search_path=public as $$
declare result text[];
begin
  if auth.uid() is null or p_expected_user is distinct from auth.uid() then raise exception 'Account changed'; end if;
  if p_asset_id is null or p_enabled is null or p_asset_id !~ '^[a-z0-9][a-z0-9-]*$' or length(p_asset_id)>80 then raise exception 'Invalid asset'; end if;
  insert into research_preferences(user_id) values(auth.uid()) on conflict do nothing;
  update research_preferences set favorites=case
    when p_enabled and not(p_asset_id=any(favorites)) then array_append(favorites,p_asset_id)
    when not p_enabled then array_remove(favorites,p_asset_id) else favorites end,
    updated_at=now() where user_id=auth.uid() returning favorites into result;
  return result;
end $$;
revoke all on function public.research_set_favorite(text,boolean,uuid) from public;
grant execute on function public.research_set_favorite(text,boolean,uuid) to authenticated;

-- Worker-only publication. Each invocation is atomic; no browser user can publish.
create or replace function public.research_publish_news(p_edition date,p_batches jsonb)
returns integer language plpgsql security invoker set search_path=public,extensions as $$
declare batch jsonb; item jsonb; ids text[]; item_id text; pub timestamptz;
  boundary timestamptz:=p_edition::timestamp at time zone 'UTC'; written integer:=0;
begin
  if p_edition is distinct from (now() at time zone 'UTC')::date then raise exception 'Wrong edition'; end if;
  if jsonb_typeof(p_batches) is distinct from 'array' then raise exception 'Invalid batches'; end if;
  for batch in select value from jsonb_array_elements(p_batches) loop
    if coalesce(batch->>'asset_id','') !~ '^[a-z0-9][a-z0-9-]*$'
      or coalesce(batch->>'status','') not in ('success','error')
      or jsonb_typeof(batch->'items') is distinct from 'array'
      or jsonb_array_length(batch->'items')>3 then raise exception 'Invalid batch'; end if;
    if batch->>'status'='error' and jsonb_array_length(batch->'items')>0 then raise exception 'Failed batch has items'; end if;
    ids:='{}';
    for item in select value from jsonb_array_elements(batch->'items') loop
      pub:=(item->>'published_at')::timestamptz;
      if pub is null or pub<boundary-interval '24 hours' or pub>=boundary then raise exception 'Outside 24h window'; end if;
      item_id:=encode(digest((batch->>'asset_id')||'|'||(item->>'source_url'),'sha256'),'hex');
      if item_id=any(ids) then raise exception 'Duplicate article'; end if;
      insert into research_news_items(id,asset_id,title,summary,source_url,source_name,source_type,published_at)
      values(item_id,batch->>'asset_id',item->>'title',item->>'summary',item->>'source_url',item->>'source_name',item->>'source_type',pub)
      on conflict(id) do nothing;
      -- Immutable source/date: an updated URL cannot recycle an old pinned article as new.
      if exists(select 1 from research_news_items where id=item_id and (published_at<boundary-interval '24 hours' or published_at>=boundary)) then
        raise exception 'Previously published article outside window';
      end if;
      ids:=array_append(ids,item_id);
    end loop;
    insert into research_news_batches(asset_id,edition_date,status,article_ids) values(batch->>'asset_id',p_edition,batch->>'status',ids)
    on conflict(asset_id,edition_date) do update set status=excluded.status,article_ids=excluded.article_ids,screened_at=now();
    written:=written+1;
  end loop;
  -- Pins remain indefinitely. Old unpinned selections are not a permanent archive.
  delete from research_news_batches where edition_date<p_edition-7;
  delete from research_news_items n where n.checked_at<now()-interval '7 days'
    and not exists(select 1 from research_news_pins p where p.news_id=n.id)
    and not exists(select 1 from research_news_batches b where n.id=any(b.article_ids));
  return written;
end $$;
revoke all on function public.research_publish_news(date,jsonb) from public,anon,authenticated;
grant execute on function public.research_publish_news(date,jsonb) to service_role;
commit;
