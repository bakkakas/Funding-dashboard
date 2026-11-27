create or replace function public.valid_platform_balances(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;b jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' then return false;end if;
 for k,b in select * from jsonb_each(value) loop
  if length(k)>40 or k<>btrim(k) or jsonb_typeof(b) is distinct from 'object'
   or jsonb_typeof(b->'enabled') is distinct from 'boolean'
   or jsonb_typeof(b->'amount') is distinct from 'number'
   or jsonb_typeof(b->'excluded_from_total') is distinct from 'boolean'
   or (b?'mode' and coalesce(b->>'mode','') not in ('manual','auto_cash'))
   or coalesce(b->>'currency','') not in ('KRW','USD')
   or coalesce(b->>'asset_class','') not in ('stock','crypto','commodity','cash') then return false;end if;
  if (b->>'amount')::numeric<0 or (b->>'amount')::numeric>1e15 then return false;end if;
 end loop;
 return true;
end $$;
