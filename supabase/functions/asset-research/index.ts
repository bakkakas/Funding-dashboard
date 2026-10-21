import { canonicalStock, researchTarget } from '../../../js/asset-identity.js';
import { numeric, priceChanges, financialQuarters } from '../../../js/stock-data.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const cache=new Map<string,{at:number,value:unknown}>();
async function get(url:string){const r=await fetch(url,{headers:{'User-Agent':'FundingDashboard/1.0','Accept':'application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`Source HTTP ${r.status}`);return r.json();}
async function stock(code:string){
 const issuer=canonicalStock(code),kr=issuer.market==='KR',c=encodeURIComponent(issuer.code),base=kr?`https://m.stock.naver.com/api/stock/${c}`:`https://api.stock.naver.com/stock/${c}`;
 const now=new Date(),from=new Date(now.getTime()-380*86400000),day=(d:Date)=>d.toISOString().slice(0,10).replaceAll('-','')+'0000';
 const urls=[`${base}/basic`,`${base}/integration`,`${base}/finance/quarter`,`https://api.stock.naver.com/chart/${kr?'domestic':'foreign'}/item/${c}/day?startDateTime=${day(from)}&endDateTime=${day(new Date(now.getTime()+86400000))}`,kr?`https://m.stock.naver.com/api/news/stock/${c}?pageSize=8&page=1`:`https://api.stock.naver.com/news/worldStock/${c}?pageSize=8&page=1`];
 const all=await Promise.allSettled(urls.map(get));const val=(i:number)=>all[i].status==='fulfilled'?(all[i] as PromiseFulfilledResult<any>).value:null;
 const b=val(0),i=val(1);if(!b)throw Error('종목 시세를 불러오지 못했습니다.');
 if(b.stockEndType!=='stock'||!researchTarget({asset_class:'stock',quote_symbol:'NAVER:'+issuer.code,symbol:b.symbolCode||issuer.code,name:b.stockName}))return {excluded:true,message:'ETF·ETN·원자재는 기업 분석 대상이 아닙니다. 단일종목 상품은 확인된 기초종목으로 연결하세요.'};
 if(/ADR|ADS|예탁증서/i.test(b.stockName||'')&&!issuer.primaryListing)return {excluded:true,message:'원주 연결이 아직 확인되지 않은 ADR입니다. 원주 종목으로 검색해 주세요.'};
 const infos=kr?i?.totalInfos:b.stockItemTotalInfos,info=(name:string)=>infos?.find((r:any)=>r.code===name);
 const foreign=kr?i?.dealTrendInfos?.find((r:any)=>numeric(String(r.foreignerHoldRatio||'').replace('%',''))!==null):null;
 const asOf=b.localTradedAt,changes=priceChanges(val(3),numeric(b.closePrice),asOf);
 const news=(kr?(val(4)||[]).flatMap((g:any)=>g.items||[]):val(4)||[]).slice(0,8).map((n:any)=>({title:n.title||n.tit,date:n.datetime||n.dt,source:n.officeName||n.ohnm,url:n.mobileNewsUrl||`https://m.stock.naver.com/investment/news/worldnews/${encodeURIComponent(n.oid)}/${encodeURIComponent(n.aid)}`}));
 return {issuer:{...issuer,name:issuer.primaryListing?issuer.name:b.stockName,symbol:issuer.primaryListing?issuer.symbol:b.symbolCode||issuer.code,currency:b.currencyType?.code||(kr?'KRW':'USD'),logo:b.itemLogoPngUrl,website:i?.summaries?.url||issuer.website},price:numeric(b.closePrice),asOf,fetchedAt:now.toISOString(),marketCap:info('marketValue')?.value||null,changes:{d1:numeric(b.fluctuationsRatio),...changes},foreign:foreign?{value:numeric(foreign.foreignerHoldRatio.replace('%','')),asOf:foreign.bizdate}:null,foreignNote:kr?'외국인 보유비율 기준. 외국인 한도 소진율과 구분합니다.':'해당 해외 시장의 동일 기준 외국인 지분율은 제공되지 않습니다.',overview:issuer.overview||i?.corporateOverview||null,overviewNote:'기업소개는 제공처 설명으로 최신 사업구조와 차이가 있을 수 있습니다. 공식 IR도 함께 확인하세요.',stats:(infos||[]).filter((r:any)=>['per','eps','pbr','bps','dividendYieldRatio','dividend','highPriceOf52Weeks','lowPriceOf52Weeks','accumulatedTradingVolume','industryGroupKor'].includes(r.code)).map((r:any)=>({label:r.key,value:r.value,asOf:r.valueDesc||r.keyDesc||''})),quarters:financialQuarters(val(2)),financialUnit:kr?'금액: 억 KRW · EPS/BPS/배당: KRW · 비율: % · 배수: 배':val(2)?.unit||'원문 단위 확인 필요',news,irSchedule:i?.irScheduleInfo||null,source:`https://m.stock.naver.com/${kr?'domestic':'worldstock'}/stock/${c}/total`,partial:all.flatMap((r,j)=>r.status==='rejected'?[['price','overview','financials','history','news'][j]]:[])};
}
async function crypto(id:string){
 const d=await get(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false`);
 if((d.categories||[]).some((x:string)=>/stablecoin|tokenized gold|tokenized silver|commodity.backed/i.test(x))||!researchTarget({symbol:d.symbol,asset_class:'crypto',quote_symbol:'CG:'+id}))return {excluded:true,message:'스테이블코인·원자재는 종목 분석에서 제외됩니다.'};
 return {id:d.id,name:d.name,symbol:d.symbol.toUpperCase(),logo:d.image?.small,description:d.description?.en||'',website:d.links?.homepage?.find(Boolean)||'',market:d.market_data,updatedAt:d.last_updated};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{const b=await req.json();const kind=b.kind==='crypto'?'crypto':'stock',id=String(b.id||'');if(!/^[A-Za-z0-9][A-Za-z0-9.-]{0,79}$/.test(id))return reply({error:'Invalid instrument'},400);
 const key=kind+':'+id,hit=cache.get(key);if(hit&&Date.now()-hit.at<300000)return reply(hit.value);
 const value=await(kind==='crypto'?crypto(id):stock(id));if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),value});return reply(value);
 }catch(e){return reply({error:e instanceof Error?e.message:'Source unavailable'},502);}
});
