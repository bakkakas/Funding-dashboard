create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table public.portfolio_snapshots add column if not exists source text not null default 'browser' check (source in ('browser','scheduled'));
alter table public.portfolio_snapshots add column if not exists captured_at timestamptz;
create table public.portfolio_snapshot_runs (
 user_id uuid not null references auth.users(id) on delete cascade,
 snapshot_date date not null,
 status text not null check(status in ('pending','running','success','failed')),
 attempts integer not null default 0,
 holdings_revision text, started_at timestamptz, finished_at timestamptz, error text, usd_krw numeric,
 primary key(user_id,snapshot_date)
);
alter table public.portfolio_snapshot_runs enable row level security;
create policy snapshot_runs_own_read on public.portfolio_snapshot_runs for select to authenticated using(user_id=auth.uid());
grant select on public.portfolio_snapshot_runs to authenticated;
revoke all on public.portfolio_snapshot_runs from anon;

create function public.protect_scheduled_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if TG_OP='UPDATE' and OLD.source='scheduled' then return null; end if;
  NEW.source:='browser';
 end if;
 NEW.captured_at:=now();
 return NEW;
end $$;
create trigger protect_scheduled_snapshot before insert or update on public.portfolio_snapshots for each row execute function public.protect_scheduled_snapshot();

-- The token never leaves Vault except inside the database-to-function HTTPS request.
do $$ begin
 if not exists(select 1 from vault.secrets where name='portfolio_scheduler_token') then
  perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'portfolio_scheduler_token');
 end if;
end $$;
create function public.authorize_portfolio_scheduler(token text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from vault.decrypted_secrets where name='portfolio_scheduler_token' and decrypted_secret=token)
$$;
create function public.portfolio_snapshot_users() returns table(user_id uuid) language sql security definer set search_path='' as $$
 select user_id from public.portfolio_assets union select user_id from public.crypto_portfolio_entries
$$;
create function public.portfolio_holdings_revision(p_user uuid) returns text language sql security definer set search_path='' as $$
 select md5(jsonb_build_array(
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.portfolio_assets a where a.user_id=p_user),
 (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from public.crypto_portfolio_entries c where c.user_id=p_user),
 (select to_jsonb(s) from public.portfolio_settings s where s.user_id=p_user))::text)
$$;
create function public.claim_portfolio_snapshot(p_user uuid,p_date date) returns timestamptz language plpgsql security definer set search_path='' as $$
declare claimed timestamptz;
begin
 if p_date<>(now() at time zone 'Asia/Seoul')::date then raise exception 'Only today may be collected';end if;
 insert into public.portfolio_snapshot_runs(user_id,snapshot_date,status,attempts,started_at,holdings_revision)
 values(p_user,p_date,'running',1,clock_timestamp(),public.portfolio_holdings_revision(p_user))
 on conflict(user_id,snapshot_date) do update set holdings_revision=public.portfolio_holdings_revision(p_user),status='running',attempts=public.portfolio_snapshot_runs.attempts+1,started_at=clock_timestamp(),finished_at=null,error=null
 where public.portfolio_snapshot_runs.status in ('pending','failed') or (public.portfolio_snapshot_runs.status='running' and public.portfolio_snapshot_runs.started_at<now()-interval '5 minutes')
 returning started_at into claimed;
 return claimed;
end $$;
create function public.finish_portfolio_snapshot(p_user uuid,p_date date,p_claim timestamptz,p_value numeric,p_classes jsonb,p_fx numeric) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.portfolio_snapshot_runs where user_id=p_user and snapshot_date=p_date and status='running' and started_at=p_claim for update;
 if not found then raise exception 'Stale run';end if;
 if (now() at time zone 'Asia/Seoul')::date<>p_date then raise exception 'Date boundary crossed';end if;
 if (select holdings_revision from public.portfolio_snapshot_runs where user_id=p_user and snapshot_date=p_date) is distinct from public.portfolio_holdings_revision(p_user) then raise exception 'Holdings changed during collection';end if;
 if exists(select 1 from public.portfolio_assets where user_id=p_user and updated_at>p_claim) or exists(select 1 from public.crypto_portfolio_entries where user_id=p_user and updated_at>p_claim) or exists(select 1 from public.portfolio_settings where user_id=p_user and updated_at>p_claim) then raise exception 'Holdings changed during collection';end if;
 if p_value is null or p_value<0 or p_value::text in ('NaN','Infinity') or p_fx is null or p_fx<=0 then raise exception 'Invalid valuation';end if;
 insert into public.portfolio_snapshots(user_id,snapshot_date,total_value_krw,class_values,source,captured_at) values(p_user,p_date,p_value,p_classes,'scheduled',now())
 on conflict(user_id,snapshot_date) do update set total_value_krw=excluded.total_value_krw,class_values=excluded.class_values,source='scheduled',captured_at=now();
 update public.portfolio_snapshot_runs set status='success',finished_at=now(),error=null,usd_krw=p_fx where user_id=p_user and snapshot_date=p_date;
end $$;
create function public.fail_portfolio_snapshot(p_user uuid,p_date date,p_claim timestamptz,p_error text) returns void language sql security definer set search_path='' as $$
 update public.portfolio_snapshot_runs set status='failed',finished_at=now(),error=left(p_error,120) where user_id=p_user and snapshot_date=p_date and status='running' and started_at=p_claim
$$;
create function public.dispatch_portfolio_snapshot() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint;
begin
 insert into public.portfolio_snapshot_runs(user_id,snapshot_date,status)
 select user_id,(now() at time zone 'Asia/Seoul')::date,'pending' from public.portfolio_snapshot_users()
 on conflict do nothing;
 select net.http_post(url:='https://xdsuepwoncvomljvjtmx.supabase.co/functions/v1/portfolio-snapshot',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='portfolio_scheduler_token')),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;
create function public.watch_portfolio_snapshots() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;target_date date:=(now() at time zone 'Asia/Seoul')::date-1;
begin
 -- Never label the historic gap as a failure of this newly enabled scheduler.
 if target_date<date '2026-10-29' then return 0;end if;
 insert into public.portfolio_snapshot_runs(user_id,snapshot_date,status,error,finished_at)
 select user_id,target_date,'failed','일일 자동 저장 미완료 (실행 누락 또는 시간 초과)',now() from (
 select user_id from public.portfolio_assets where created_at<((target_date+1)::timestamp at time zone 'Asia/Seoul') union select user_id from public.crypto_portfolio_entries where created_at<((target_date+1)::timestamp at time zone 'Asia/Seoul')) u
 on conflict(user_id,snapshot_date) do update set status='failed',error=coalesce(public.portfolio_snapshot_runs.error,excluded.error),finished_at=now()
 where public.portfolio_snapshot_runs.status<>'success';
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.portfolio_holdings_revision(uuid),public.authorize_portfolio_scheduler(text),public.portfolio_snapshot_users(),public.claim_portfolio_snapshot(uuid,date),public.finish_portfolio_snapshot(uuid,date,timestamptz,numeric,jsonb,numeric),public.fail_portfolio_snapshot(uuid,date,timestamptz,text),public.dispatch_portfolio_snapshot(),public.watch_portfolio_snapshots(),public.protect_scheduled_snapshot() from public,anon,authenticated;
grant execute on function public.authorize_portfolio_scheduler(text),public.portfolio_snapshot_users(),public.claim_portfolio_snapshot(uuid,date),public.finish_portfolio_snapshot(uuid,date,timestamptz,numeric,jsonb,numeric),public.fail_portfolio_snapshot(uuid,date,timestamptz,text),public.dispatch_portfolio_snapshot(),public.watch_portfolio_snapshots() to service_role;
-- pg_cron uses UTC. KST 23:40, retry 23:50; independent watchdog at KST 00:05.
select cron.schedule('portfolio-snapshot-daily','40 14 * * *','select public.dispatch_portfolio_snapshot()');
select cron.schedule('portfolio-snapshot-retry','50 14 * * *','select public.dispatch_portfolio_snapshot()');
select cron.schedule('portfolio-snapshot-watchdog','5 15 * * *','select public.watch_portfolio_snapshots()');
