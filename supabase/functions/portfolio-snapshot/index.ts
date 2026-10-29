import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { valuePortfolio, snapshotDate } from '../../../js/portfolio-snapshot.js';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
async function rpc(name:string,args:Record<string,unknown>={}) {const {data,error}=await db.rpc(name,args);if(error)throw Error(name+' failed');return data;}
async function rows(table:string,user?:string) {
 const result=[];
 for(let offset=0;;offset+=1000){let query=db.from(table).select('*').order('user_id').range(offset,offset+999);if(user)query=query.eq('user_id',user);const {data,error}=await query;if(error)throw Error('보유내역 조회 실패');result.push(...data);if(data.length<1000)return result;}
}
async function getJson(url:string) {const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (FundingDashboard)','Accept':'application/json'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('시세 제공처 응답 실패');return response.json();}
const number=(v:unknown)=>Number(String(v??'').replaceAll(',',''));
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'method not allowed'},405);
 try {
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!token||!await rpc('authorize_portfolio_scheduler',{token}))return json({error:'unauthorized'},401);
  const date=snapshotDate(), users=await rpc('portfolio_snapshot_users');
  const quotes=new Map<string,Promise<number>>();let fxPromise:Promise<number>|undefined;
  const quote=async(a:Record<string,any>)=>{
   if(a.symbol?.toUpperCase()==='USDT')return 1;
   if(a.manual_price!=null)return Number(a.manual_price);
   const key=a.quote_symbol+'|'+a.currency;
   if(!quotes.has(key))quotes.set(key,(async()=>{
    let price:number;
    if(a.quote_symbol.startsWith('CG:')){const id=a.quote_symbol.slice(3),data=await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`);price=number(data[id]?.usd);}
    else if(a.quote_symbol.startsWith('BINANCE:')){const data=await getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(a.quote_symbol.slice(8))}`);price=number(data.price);}
    else if(a.quote_symbol.startsWith('NAVER:')){const code=encodeURIComponent(a.quote_symbol.slice(6)),data=await getJson(a.currency==='KRW'?`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`:`https://api.stock.naver.com/stock/${code}/basic`);price=number(a.currency==='KRW'?data.datas?.[0]?.closePrice:data.closePrice);}
    else throw Error('지원하지 않는 시세 경로');
    if(!Number.isFinite(price)||price<=0)throw Error('시세 누락');return price;
   })());
   const price=await quotes.get(key)!;if(!Number.isFinite(price)||price<=0)throw Error('시세 누락');return price;
  };
  let succeeded=0,failed=0,skipped=0;
  for(const {user_id} of users){
   const claim=await rpc('claim_portfolio_snapshot',{p_user:user_id,p_date:date});
   if(!claim){skipped++;continue;}
   try{
    const [assets,cryptoEntries,settings]=await Promise.all([rows('portfolio_assets',user_id),rows('crypto_portfolio_entries',user_id),rows('portfolio_settings',user_id)]);
    fxPromise??=getJson('https://open.er-api.com/v6/latest/USD').then(data=>{
     const fx=number(data.rates?.KRW);
     if(data.result!=='success'||!Number.isFinite(fx)||fx<=0||!data.time_last_update_unix||Date.now()/1000-data.time_last_update_unix>3*86400)throw Error('환율 조회 실패');return fx;
    });
    const fx=await fxPromise;
    const ids=[...new Set([...assets,...cryptoEntries].filter(a=>a.quote_symbol.startsWith('CG:')&&a.manual_price==null).map(a=>a.quote_symbol.slice(3)))];
    if(ids.length){
     const data=await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`);
     for(const id of ids)if(!quotes.has('CG:'+id+'|USD'))quotes.set('CG:'+id+'|USD',Promise.resolve(number(data[id]?.usd)));
    }
    const snapshot=await valuePortfolio({assets,cryptoEntries,cryptoTotalSource:settings[0]?.crypto_total_source,fx,quote});
    await rpc('finish_portfolio_snapshot',{p_user:user_id,p_date:date,p_claim:claim,p_value:snapshot.total_value_krw,p_classes:snapshot.class_values,p_fx:fx});succeeded++;
   }catch(error){
    failed++;
    // Store a bounded, non-sensitive reason, not provider payloads or holdings.
    const message=error instanceof Error?error.message:'자동 저장 실패';
    await rpc('fail_portfolio_snapshot',{p_user:user_id,p_date:date,p_claim:claim,p_error:message.slice(0,120)});
   }
  }
  return json({date,succeeded,failed,skipped},failed?207:200);
 }catch{return json({error:'snapshot collector failed; watchdog will detect missing completion'},500);}
});
