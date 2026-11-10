import {parseMarketFx} from './fx-data.js?v=1';
import {parseFx,FX_URL} from './fx-rate.js?v=2';
export function parseUsdMarketCap(value){
 const text=String(value??'').trim();
 if(!/USD\s*$/i.test(text))return null;
 const body=text.replace(/USD\s*$/i,'').replaceAll(',','').trim();
 if(/^\d+(?:\.\d+)?$/.test(body))return Number(body);
 const parts=[...body.matchAll(/(\d+(?:\.\d+)?)\s*(조|억|만)/g)];
 if(!parts.length||body.replace(/(\d+(?:\.\d+)?)\s*(조|억|만)/g,'').trim())return null;
 const valueUsd=parts.reduce((sum,m)=>sum+Number(m[1])*({조:1e12,억:1e8,만:1e4}[m[2]]),0);
 return Number.isFinite(valueUsd)?valueUsd:null;
}
export function formatMarketCapKrw(usd,rate){
 if(!Number.isFinite(usd)||usd<0||!Number.isFinite(rate)||rate<=0)return null;
 const value=usd*rate;if(!Number.isFinite(value))return null;
 if(value>=1e12)return (value/1e12).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+'조원';
 if(value>=1e8)return Math.floor(value/1e8).toLocaleString('ko-KR')+'억원';
 return Math.floor(value).toLocaleString('ko-KR')+'원';
}
let cache=null,pending=null;
export async function loadMarketCapFx(){
 if(cache&&Date.now()-cache.loadedAt<60000)return cache;
 if(pending)return pending;
 pending=(async()=>{
  let quote;
  try{
   const config=window.FUNDING_SUPABASE;if(!config?.functionsBaseUrl||!config.anonKey)throw Error('No FX service');
   const r=await fetch(config.functionsBaseUrl+'/market-fx',{method:'POST',headers:{'Authorization':'Bearer '+config.anonKey,'apikey':config.anonKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('FX unavailable');quote={...parseMarketFx(await r.json()),label:'하나은행 고시'};
  }catch{
   const r=await fetch(FX_URL,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('FX unavailable');quote={...parseFx(await r.json()),label:'일일 참고환율'};
  }
  cache={...quote,loadedAt:Date.now()};return cache;
 })().catch(()=>null).finally(()=>{pending=null});return pending;
}
