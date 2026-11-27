alter table public.portfolio_settings add column platform_balances jsonb not null default '{}'::jsonb;
create function public.valid_platform_balances(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;b jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' then return false;end if;
 for k,b in select * from jsonb_each(value) loop
  if length(k)>40 or k<>btrim(k) or jsonb_typeof(b) is distinct from 'object'
   or jsonb_typeof(b->'enabled') is distinct from 'boolean'
   or jsonb_typeof(b->'amount') is distinct from 'number'
   or jsonb_typeof(b->'excluded_from_total') is distinct from 'boolean'
   or coalesce(b->>'currency','') not in ('KRW','USD')
   or coalesce(b->>'asset_class','') not in ('stock','crypto','commodity','cash') then return false;end if;
  if (b->>'amount')::numeric<0 or (b->>'amount')::numeric>1e15 then return false;end if;
 end loop;
 return true;
end $$;
alter table public.portfolio_settings add constraint valid_platform_balances check(public.valid_platform_balances(platform_balances));
-- SECURITY INVOKER plus existing owner RLS: callers cannot target another account.
create function public.set_platform_balance(p_name text,p_balance jsonb) returns void language plpgsql set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required';end if;
 if not exists(select 1 from public.portfolio_assets where user_id=auth.uid() and btrim(coalesce(nickname,''))=p_name) then raise exception 'Platform no longer exists';end if;
 if not public.valid_platform_balances(jsonb_build_object(p_name,p_balance)) then raise exception 'Invalid platform balance';end if;
 insert into public.portfolio_settings(user_id,platform_balances) values(auth.uid(),jsonb_build_object(p_name,p_balance))
 on conflict(user_id) do update set platform_balances=public.portfolio_settings.platform_balances || excluded.platform_balances;
end $$;
-- Rename/delete the box and its override in one transaction. No partial-save state.
create function public.manage_portfolio_platform(p_name text,p_new_name text,p_delete boolean,p_ids uuid[]) returns void language plpgsql set search_path='' as $$
declare config jsonb;actual uuid[];
begin
 if auth.uid() is null then raise exception 'Login required';end if;
 perform 1 from public.portfolio_settings where user_id=auth.uid() for update;
 perform 1 from public.portfolio_assets where user_id=auth.uid() and btrim(coalesce(nickname,''))=p_name for update;
 select array_agg(id order by id) into actual from public.portfolio_assets where user_id=auth.uid() and btrim(coalesce(nickname,''))=p_name;
 if actual is null or actual is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then raise exception 'Platform changed; reload and retry';end if;
 select platform_balances->p_name into config from public.portfolio_settings where user_id=auth.uid();
 if p_delete then
  delete from public.portfolio_assets where user_id=auth.uid() and id=any(actual);
  update public.portfolio_settings set platform_balances=platform_balances-p_name where user_id=auth.uid();
 else
  if p_new_name is null or length(p_new_name) not between 1 and 40 or p_new_name<>btrim(p_new_name) or p_new_name=p_name then raise exception 'Invalid platform name';end if;
  if exists(select 1 from public.portfolio_assets where user_id=auth.uid() and btrim(coalesce(nickname,''))=p_new_name) then raise exception 'Platform name already exists';end if;
  if config is not null and exists(select 1 from public.crypto_portfolio_entries where user_id=auth.uid() and btrim(location)=p_new_name) then raise exception 'Matching coin wallet already exists';end if;
  update public.portfolio_assets set nickname=p_new_name where user_id=auth.uid() and id=any(actual);
  if config is not null then
   update public.portfolio_settings set platform_balances=(platform_balances-p_name-p_new_name)||jsonb_build_object(p_new_name,config) where user_id=auth.uid();
   update public.crypto_portfolio_entries set location=p_new_name where user_id=auth.uid() and btrim(location)=p_name;
  else
   update public.portfolio_settings set platform_balances=platform_balances-p_new_name where user_id=auth.uid();
  end if;
 end if;
end $$;
revoke all on function public.set_platform_balance(text,jsonb),public.manage_portfolio_platform(text,text,boolean,uuid[]) from public,anon;
grant execute on function public.set_platform_balance(text,jsonb),public.manage_portfolio_platform(text,text,boolean,uuid[]) to authenticated;
-- A removed/moved last holding must not resurrect a stale balance on later reuse.
create function public.cleanup_empty_platform_balance() returns trigger language plpgsql set search_path='' as $$
declare old_name text:=btrim(coalesce(old.nickname,''));
begin
 if not exists(select 1 from public.portfolio_assets where user_id=old.user_id and btrim(coalesce(nickname,''))=old_name) then
  update public.portfolio_settings set platform_balances=platform_balances-old_name where user_id=old.user_id and platform_balances?old_name;
 end if;
 return null;
end $$;
create trigger cleanup_empty_platform_balance after delete or update of nickname on public.portfolio_assets for each row execute function public.cleanup_empty_platform_balance();
