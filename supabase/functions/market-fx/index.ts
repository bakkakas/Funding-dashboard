import {parseBankFx} from '../../../js/fx-data.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
let cached:{at:number,value:unknown}|null=null;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(cached&&Date.now()-cached.at<30000)return reply(cached.value);
 try{
  const response=await fetch('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW',{headers:{'Accept':'application/json','User-Agent':'Mozilla/5.0 (compatible; FundingDashboard/1.0)'},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok)throw Error('FX provider unavailable');
  const value={...parseBankFx(await response.json()),fetchedAt:Date.now()};
  cached={at:Date.now(),value};return reply(value);
 }catch{return reply({error:'Latest bank FX unavailable'},502);}
});
