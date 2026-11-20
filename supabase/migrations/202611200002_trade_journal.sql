-- Independent books: neither holdings nor plans are changed by this ledger.
create table public.trade_journal_books (
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check (mode in ('real','paper')),
 version bigint not null default 0,
 document jsonb not null default '{"initial":{"KRW":0,"USD":0},"trades":[]}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(user_id,mode),
 check(jsonb_typeof(document)='object' and octet_length(document::text)<=2000000)
);
alter table public.trade_journal_books enable row level security;
revoke all on public.trade_journal_books from anon,authenticated;
grant select on public.trade_journal_books to authenticated;
create policy trade_journal_read_owner on public.trade_journal_books for select to authenticated using(user_id=auth.uid());

create function public.validate_trade_journal(doc jsonb, book_mode text) returns void
language plpgsql set search_path=pg_catalog,public as $$
declare t jsonb; a jsonb; cash jsonb; holdings jsonb:='{}'; seen text[]:='{}'; k text; cur text; q numeric; p numeric; f numeric; held numeric; bal numeric; stamp timestamptz; id text;
begin
 if book_mode not in ('real','paper') or jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'initial') is distinct from 'object' or jsonb_typeof(doc->'trades') is distinct from 'array' then raise exception 'Invalid book';end if;
 if jsonb_array_length(doc->'trades')>2000 then raise exception 'Maximum 2000 trades';end if;
 cash:=doc->'initial';
 foreach cur in array array['KRW','USD'] loop
  if jsonb_typeof(cash->cur) is distinct from 'number' then raise exception 'Initial cash required';end if;
  bal:=(cash->>cur)::numeric;if bal<0 or bal>1e14 then raise exception 'Invalid initial cash';end if;
 end loop;
 for t in select value from jsonb_array_elements(doc->'trades') with ordinality order by (value->>'at')::timestamptz,ordinality loop
  a:=t->'asset';id:=t->>'id';cur:=a->>'currency';
  if coalesce(id,'')!~'^[a-zA-Z0-9-]{1,80}$' or id=any(seen) then raise exception 'Invalid or duplicate ID';end if;seen:=array_append(seen,id);
  if not coalesce(t->>'side' in ('buy','sell'),false) or not coalesce(cur in ('KRW','USD'),false) or not coalesce(a->>'asset_class' in ('stock','crypto','commodity'),false) then raise exception 'Invalid side/currency/class';end if;
  if coalesce(length(a->>'name'),0) not between 1 and 120 or coalesce(length(a->>'symbol'),0) not between 1 and 80 or coalesce(length(a->>'quote_symbol'),0) not between 1 and 160 then raise exception 'Asset required';end if;
  stamp:=(t->>'at')::timestamptz;if stamp is null or stamp<'1900-01-01' or stamp>now()+interval '1 minute' then raise exception 'Invalid trade time';end if;
  if jsonb_typeof(t->'qty') is distinct from 'number' or jsonb_typeof(t->'price') is distinct from 'number' or jsonb_typeof(t->'fee') is distinct from 'number' then raise exception 'Numeric trade fields required';end if;
  q:=(t->>'qty')::numeric;p:=(t->>'price')::numeric;f:=(t->>'fee')::numeric;
  if q<1e-12 or q>1e14 or p<=0 or p>1e14 or q*p>1e14 or f<0 or f>q*p then raise exception 'Invalid size/price/fees';end if;
  if t->>'sl' is not null and ((t->>'sl')::numeric<=0 or (t->>'side'='buy' and (t->>'sl')::numeric>=p)) then raise exception 'Invalid SL';end if;
  if coalesce(length(t->>'reason'),0)>2000 or coalesce(length(t->>'note'),0)>2000 then raise exception 'Note too long';end if;
  if book_mode='paper' and (jsonb_typeof(t->'quote') is distinct from 'object' or t#>>'{quote,fetched_at}' is null) then raise exception 'Paper quote required';end if;
  k:=(a->>'quote_symbol')||'|'||cur;held:=coalesce((holdings->>k)::numeric,0);bal:=(cash->>cur)::numeric;
  if t->>'side'='buy' then
   bal:=bal-q*p-f;held:=held+q;
   if book_mode='paper' and bal< -0.00000001 then raise exception 'Insufficient paper cash';end if;
  else
   if held=0 or q>held then raise exception 'Cannot sell more than held';end if;
   held:=held-q;bal:=bal+q*p-f;
  end if;
  holdings:=jsonb_set(holdings,array[k],to_jsonb(held),true);cash:=jsonb_set(cash,array[cur],to_jsonb(bal),true);
 end loop;
end $$;
revoke all on function public.validate_trade_journal(jsonb,text) from public;

create function public.save_trade_journal(p_mode text,p_expected bigint,p_document jsonb)
returns setof public.trade_journal_books language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); previous public.trade_journal_books; old_count int;
begin
 if uid is null then raise exception 'Login required';end if;
 perform public.validate_trade_journal(p_document,p_mode);
 insert into public.trade_journal_books(user_id,mode) values(uid,p_mode) on conflict do nothing;
 select * into previous from public.trade_journal_books where user_id=uid and mode=p_mode for update;
 if p_expected is null or previous.version<>p_expected then raise exception 'CONFLICT: reload before saving';end if;
 -- Paper history is append-only; explicit full reset is permitted. Real corrections replay the full ledger.
 old_count:=jsonb_array_length(previous.document->'trades');
 if p_mode='paper' and jsonb_array_length(p_document->'trades')>0 then
  if p_document->'initial'<>previous.document->'initial' then raise exception 'Reset paper book before changing seed';end if;
  if jsonb_array_length(p_document->'trades')<>old_count+1 or exists(select 1 from generate_series(0,old_count-1) i where p_document->'trades'->i is distinct from previous.document->'trades'->i) then raise exception 'Paper history is append only';end if;
  if abs(extract(epoch from ((p_document->'trades'->old_count->>'at')::timestamptz-now())))>120 then raise exception 'Paper trade must be current';end if;
  if abs(extract(epoch from ((p_document->'trades'->old_count#>>'{quote,fetched_at}')::timestamptz-now())))>120 then raise exception 'Refresh paper quote';end if;
 end if;
 return query update public.trade_journal_books set document=p_document,version=previous.version+1,updated_at=now() where user_id=uid and mode=p_mode returning *;
end $$;
revoke all on function public.save_trade_journal(text,bigint,jsonb) from public,anon;
grant execute on function public.save_trade_journal(text,bigint,jsonb) to authenticated;
