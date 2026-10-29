-- Dedicated presentation-edit permission; does not grant analytics/account admin access.
create table public.board_editors(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.board_editors enable row level security;
revoke all on public.board_editors from anon,authenticated;
-- Enroll the verified owner separately through the trusted database administrator.
-- Never publish account identifiers or allow client-side self-enrollment.
create function public.board_is_editor() returns boolean language sql stable security definer set search_path=public
 as $$ select exists(select 1 from public.board_editors where user_id=auth.uid()); $$;
revoke all on function public.board_is_editor() from public;
grant execute on function public.board_is_editor() to authenticated;

create function public.board_valid_content(c jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare k text; v jsonb; a jsonb; ids text[]='{}';
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>100000
 or jsonb_typeof(c->'texts') is distinct from 'object'
 or jsonb_typeof(c->'blocks') is distinct from 'object'
 or jsonb_typeof(c->'custom') is distinct from 'array' then return false; end if;
 if exists(select 1 from jsonb_object_keys(c) t where t not in ('texts','blocks','custom')) then return false; end if;
 if (select count(*) from jsonb_object_keys(c->'texts'))>500 or (select count(*) from jsonb_object_keys(c->'blocks'))>200 or jsonb_array_length(c->'custom')>40 then return false; end if;
 for k,v in select * from jsonb_each(c->'texts') loop
  if k!~'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' or k in ('__proto__','constructor','prototype') or jsonb_typeof(v)<>'string' or length(v#>>'{}')>6000 then return false; end if;
 end loop;
 for k,v in select * from jsonb_each(c->'blocks') loop
  if k!~'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' or k in ('__proto__','constructor','prototype') or jsonb_typeof(v)<>'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(v) t where t not in ('width','height','hidden','order')) then return false; end if;
  if v->>'width' is null or v->>'width' not in ('auto','full','half','third','quarter') or jsonb_typeof(v->'hidden') is distinct from 'boolean' or jsonb_typeof(v->'height') is distinct from 'number' or jsonb_typeof(v->'order') is distinct from 'number' then return false; end if;
  if (v->>'height')::numeric not between 0 and 1200 or trunc((v->>'height')::numeric)<>(v->>'height')::numeric or (v->>'order')::numeric not between 0 and 1000 or trunc((v->>'order')::numeric)<>(v->>'order')::numeric then return false; end if;
 end loop;
 for a in select * from jsonb_array_elements(c->'custom') loop
  if jsonb_typeof(a)<>'object' or a->>'id' is null or a->>'id'!~'^custom-[a-f0-9-]{36}$' or a->>'id'=any(ids) or a->>'group' is null or a->>'group'!~'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' or jsonb_typeof(a->'title') is distinct from 'string' or jsonb_typeof(a->'body') is distinct from 'string' then return false; end if;
  if length(a->>'title')>160 or length(a->>'body')>6000 or length(btrim((a->>'title')||(a->>'body')))=0 then return false; end if;
  ids=array_append(ids,a->>'id');
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.board_content(
 page_key text primary key check(page_key ~ '^(funding|foreign|portfolio|investment)(:[a-zA-Z0-9-]{1,80})?:(ko|en)$' or page_key ~ '^(funding|foreign|portfolio):(ko|en)$'),
 draft jsonb not null default '{"texts":{},"blocks":{},"custom":[]}' check(public.board_valid_content(draft)),
 published jsonb not null default '{"texts":{},"blocks":{},"custom":[]}' check(public.board_valid_content(published)),
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
create table public.board_content_versions(
 id bigint generated always as identity primary key,
 page_key text not null references public.board_content(page_key),
 version integer not null, content jsonb not null check(public.board_valid_content(content)),
 created_at timestamptz not null default now(),created_by uuid references auth.users(id) on delete set null,
 unique(page_key,version)
);
alter table public.board_content enable row level security;
alter table public.board_content_versions enable row level security;
revoke all on public.board_content,public.board_content_versions from anon,authenticated;
grant select on public.board_content,public.board_content_versions to authenticated;
create policy board_content_editor_read on public.board_content for select to authenticated using(public.board_is_editor());
create policy board_content_versions_editor_read on public.board_content_versions for select to authenticated using(public.board_is_editor());
create function public.board_public_content(p_page text) returns jsonb language sql stable security definer set search_path=public
 as $$ select coalesce((select jsonb_build_object('content',published,'version',version) from public.board_content where page_key=p_page),'{"content":{"texts":{},"blocks":{},"custom":[]},"version":0}'::jsonb); $$;
revoke all on function public.board_public_content(text) from public;
grant execute on function public.board_public_content(text) to anon,authenticated;
create function public.board_save_content(p_page text,p_content jsonb,p_version integer,p_publish boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare row public.board_content;
begin
 if not public.board_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
 if not public.board_valid_content(p_content) or p_version is null or p_publish is null then raise exception 'Invalid content'; end if;
 insert into public.board_content(page_key) values(p_page) on conflict do nothing;
 select * into row from public.board_content where page_key=p_page for update;
 if row.version<>p_version then raise exception 'Version conflict. Reload before saving.' using errcode='40001'; end if;
 if p_publish then
  insert into public.board_content_versions(page_key,version,content,created_by) values(p_page,row.version,row.published,auth.uid()) on conflict do nothing;
 end if;
 update public.board_content set draft=p_content,published=case when p_publish then p_content else published end,
 version=version+1,updated_at=now(),updated_by=auth.uid() where page_key=p_page returning * into row;
 return to_jsonb(row);
end $$;
revoke all on function public.board_save_content(text,jsonb,integer,boolean) from public;
grant execute on function public.board_save_content(text,jsonb,integer,boolean) to authenticated;
notify pgrst,'reload schema';
