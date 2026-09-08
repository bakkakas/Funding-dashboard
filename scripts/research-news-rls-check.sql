-- Administrator SQL Editor check. ALL fixture writes are rolled back.
begin;
do $$ declare target uuid; begin
  select id into target from auth.users order by created_at limit 1;
  if target is null then raise exception 'An existing app user is needed for this rollback-only check'; end if;
  perform set_config('request.jwt.claim.sub',target::text,true);
end $$;
insert into public.research_news_items(id,asset_id,title,summary,source_url,source_name,source_type,published_at)
values('rollback-only-rls-check','ethfi','ROLLBACK TEST','Not published','https://example.invalid/rollback-only-rls-check','Test','docs',now());
set local role authenticated;
do $$ begin
  perform public.research_set_favorite('ethfi',true,auth.uid());
  if not exists(select 1 from public.research_preferences where user_id=auth.uid() and 'ethfi'=any(favorites)) then raise exception 'Owner favorite write failed'; end if;
  insert into public.research_news_pins(user_id,news_id) values(auth.uid(),'rollback-only-rls-check');
  if not exists(select 1 from public.research_news_pins where news_id='rollback-only-rls-check') then raise exception 'Owner pin read failed'; end if;
  begin
    perform public.research_publish_news(current_date,'[]'::jsonb);
    raise exception 'Authenticated user unexpectedly published';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  if exists(select 1 from public.research_preferences) then raise exception 'Cross-account favorites visible'; end if;
  if exists(select 1 from public.research_news_pins) then raise exception 'Cross-account pins visible'; end if;
  delete from public.research_news_pins where news_id='rollback-only-rls-check';
  if found then raise exception 'Cross-account pin delete succeeded'; end if;
end $$;
reset role;
rollback;
select 'PASS: owner writes, cross-account isolation, publish denied; fixtures rolled back' as research_rls_check;
