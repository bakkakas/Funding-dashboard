begin;
select set_config('test.exec_owner',(select id::text from auth.users order by created_at limit 1),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.exec_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.investment_execution_plans(user_id,document) values(auth.uid(),'{"target":"ROLLBACK QA"}') returning set_config('test.exec_id',id::text,true);
insert into public.investment_rules(user_id,document) values(auth.uid(),'{}') on conflict(user_id) do nothing;
do $$ begin
 update public.investment_rules set document='{"capital":100}' where user_id=auth.uid();
 if not found then raise exception 'owner rule update failed';end if;
 if not exists(select 1 from public.investment_rules where user_id=auth.uid() and document->>'capital'='100') then raise exception 'owner rule read failed';end if;
 update public.investment_execution_plans set document='{"target":"updated"}' where id=current_setting('test.exec_id')::uuid;
 if not found then raise exception 'owner plan update failed';end if;
 begin
 insert into public.investment_execution_plans(user_id,document) values(auth.uid(),'[]');
 raise exception 'array accepted'; exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$ declare t text; n integer; begin
 foreach t in array array['investment_rules','investment_execution_plans'] loop
  execute format('select count(*) from public.%I where user_id=$1',t) into n using current_setting('test.exec_owner')::uuid;
  if n<>0 then raise exception 'cross-account read leak';end if;
  execute format('update public.%I set document=''{}'' where user_id=$1',t) using current_setting('test.exec_owner')::uuid;
  get diagnostics n=row_count;if n<>0 then raise exception 'cross-account update';end if;
  execute format('delete from public.%I where user_id=$1',t) using current_setting('test.exec_owner')::uuid;
  get diagnostics n=row_count;if n<>0 then raise exception 'cross-account delete';end if;
  begin
   execute format('insert into public.%I(user_id,document) values($1,''{}'')',t) using current_setting('test.exec_owner')::uuid;
   raise exception 'spoof insert accepted';exception when insufficient_privilege then null;end;
 end loop;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.exec_owner'),'role','authenticated')::text,true);
delete from public.investment_execution_plans where id=current_setting('test.exec_id')::uuid;
delete from public.investment_rules where user_id=auth.uid();
reset role;
select case when has_table_privilege('anon','public.investment_rules','select') or has_table_privilege('anon','public.investment_execution_plans','select') then 'FAIL anon access' else 'PASS owner CRUD, cross-user isolation, document shape, no anonymous access; rolled back' end as verification;
rollback;
