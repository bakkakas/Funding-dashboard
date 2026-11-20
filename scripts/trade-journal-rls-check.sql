begin;
select set_config('journal.test_user',gen_random_uuid()::text,true),set_config('journal.other_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('journal.test_user')::uuid,'journal-test-'||current_setting('journal.test_user')||'@example.invalid'),(current_setting('journal.other_user')::uuid,'journal-test-'||current_setting('journal.other_user')||'@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('journal.test_user'),true);
do $$
declare b jsonb:='{"initial":{"KRW":0,"USD":1000},"trades":[]}'::jsonb; t jsonb; r record; blocked boolean;
begin
 select * into r from public.save_trade_journal('paper',0,b);if r.version<>1 then raise exception 'Seed failed';end if;
 t:=jsonb_build_object('id','t1','at',now(),'side','buy','qty',2,'price',100,'fee',1,'asset',jsonb_build_object('quote_symbol','CG:bitcoin','symbol','BTC','name','Bitcoin','currency','USD','asset_class','crypto'),'quote',jsonb_build_object('source','test','as_of',now(),'fetched_at',now()));
 b:=jsonb_set(b,'{trades}',jsonb_build_array(t));select * into r from public.save_trade_journal('paper',1,b);if r.version<>2 then raise exception 'Trade failed';end if;
 blocked:=false;begin perform public.save_trade_journal('paper',1,b);exception when others then blocked:=position('CONFLICT' in sqlerrm)>0;end;if not blocked then raise exception 'Stale write accepted';end if;
 blocked:=false;begin perform public.save_trade_journal('paper',2,jsonb_set(b,'{trades,0,price}','90'));exception when others then blocked:=position('append only' in sqlerrm)>0;end;if not blocked then raise exception 'Paper edit accepted';end if;
 t:=jsonb_set(t,'{id}','"t2"');t:=jsonb_set(t,'{qty}','99');
 blocked:=false;begin perform public.save_trade_journal('paper',2,jsonb_set(b,'{trades}',(b->'trades')||jsonb_build_array(t)));exception when others then blocked:=position('Insufficient' in sqlerrm)>0;end;if not blocked then raise exception 'Overspend accepted';end if;
 t:=jsonb_set(t,'{side}','"sell"');
 blocked:=false;begin perform public.save_trade_journal('real',0,jsonb_set(b,'{trades}',jsonb_build_array(t)));exception when others then blocked:=position('Cannot sell' in sqlerrm)>0;end;if not blocked then raise exception 'Short sale accepted';end if;
 blocked:=false;begin update public.trade_journal_books set version=99 where user_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Direct update allowed';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('journal.other_user'),true);
do $$ begin
 if exists(select 1 from public.trade_journal_books where user_id=current_setting('journal.test_user')::uuid) then raise exception 'Cross-owner read exposed';end if;
 perform public.save_trade_journal('paper',0,'{"initial":{"KRW":0,"USD":0},"trades":[]}');
 if (select count(*) from public.trade_journal_books)<>1 then raise exception 'RPC owner isolation failed';end if;
end $$;
reset role;
do $$begin
 if (select version from public.trade_journal_books where user_id=current_setting('journal.test_user')::uuid and mode='paper')<>2 then raise exception 'Other owner changed first book';end if;
 if has_table_privilege('anon','public.trade_journal_books','SELECT') or has_function_privilege('anon','public.save_trade_journal(text,bigint,jsonb)','EXECUTE') then raise exception 'Anonymous access';end if;
end $$;
rollback;
