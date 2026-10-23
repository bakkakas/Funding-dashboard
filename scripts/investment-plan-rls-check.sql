begin;
select set_config('test.plan_owner',(select id::text from auth.users order by created_at limit 1),true);
select set_config('test.plan_id',gen_random_uuid()::text,true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.plan_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.investment_plan_items(id,user_id,title,category,kind,impact,importance)
values(current_setting('test.plan_id')::uuid,auth.uid(),'ROLLBACK QA','macro','fact',-3,4);
do $$ begin
 if (select count(*) from public.investment_plan_items where id=current_setting('test.plan_id')::uuid)<>1 then raise exception 'owner read failed';end if;
 update public.investment_plan_items set title='ROLLBACK QA updated' where id=current_setting('test.plan_id')::uuid;
 if not found then raise exception 'owner update failed';end if;
 begin
 update public.investment_plan_items set impact=0 where id=current_setting('test.plan_id')::uuid;
 raise exception 'invalid impact accepted';
 exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.investment_plan_items where id=current_setting('test.plan_id')::uuid) then raise exception 'cross-user read leak';end if;
 update public.investment_plan_items set title='not allowed' where id=current_setting('test.plan_id')::uuid;
 if found then raise exception 'cross-user update allowed';end if;
 delete from public.investment_plan_items where id=current_setting('test.plan_id')::uuid;
 if found then raise exception 'cross-user delete allowed';end if;
 begin
 insert into public.investment_plan_items(user_id,title,category,kind,impact,importance) values(current_setting('test.plan_owner')::uuid,'spoof','macro','fact',1,3);
 raise exception 'spoofed insert allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.plan_owner'),'role','authenticated')::text,true);
delete from public.investment_plan_items where id=current_setting('test.plan_id')::uuid;
reset role;
select 'Owner CRUD, cross-account isolation, and six-level constraint PASS; rolled back' as verification;
rollback;
