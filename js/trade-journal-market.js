const mk=(symbol,name,asset_class,quote_symbol,currency='USD')=>({symbol,name,asset_class,quote_symbol,currency});
export const seeds=[mk('BTC','비트코인','crypto','CG:bitcoin'),mk('ETH','이더리움','crypto','CG:ethereum'),mk('SOL','솔라나','crypto','CG:solana'),mk('PAXG','금 · PAXG 토큰 1개 기준','commodity','CG:pax-gold'),mk('005930','삼성전자','stock','NAVER:005930','KRW'),mk('000660','SK하이닉스','stock','NAVER:000660','KRW'),mk('NVDA','엔비디아','stock','NAVER:NVDA.O'),mk('VT','Vanguard Total World Stock ETF','stock','NAVER:VT.P')];
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`시세 제공처 오류 (${r.status})`);return r.json();}
export async function searchAssets(db,query,type){
 const local=seeds.filter(a=>a.asset_class===type&&`${a.name} ${a.symbol}`.toLowerCase().includes(query.toLowerCase()));let remote=[];
 if(type==='stock'){const {data,error}=await db.functions.invoke('portfolio-market',{body:{action:'search',query}});if(error||data?.error)throw Error('주식 검색 실패. 다시 시도해 주세요.');remote=(data.results||[]).filter(a=>/^(?:[0-9]{6}|[A-Z0-9-]+\.[ONP])$/.test(a.quote_symbol?.slice(6)||''));}
 if(type==='crypto'){const data=await json(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);remote=(data.coins||[]).slice(0,12).map(a=>mk(a.symbol.toUpperCase(),a.name,'crypto',`CG:${a.id}`));}
 const seen=new Set();return [...local,...remote].filter(a=>{const key=a.quote_symbol;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,16);
}
export async function fetchQuote(db,a){
 const fetched_at=new Date().toISOString();let price,as_of,source;
 if(a.quote_symbol.startsWith('CG:')){
  if(a.currency!=='USD')throw Error('이 시세는 USD 기준이에요.');
  const id=a.quote_symbol.slice(3),data=await json(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_last_updated_at=true`);
  price=Number(data[id]?.usd);as_of=data[id]?.last_updated_at?new Date(data[id].last_updated_at*1000).toISOString():'';source='CoinGecko · USD 환산 참고가';
  if(!as_of||Date.now()-Date.parse(as_of)>15*60000)throw Error('코인 시세가 오래됐어요. 다시 조회해 주세요.');
 }else if(a.quote_symbol.startsWith('NAVER:')){
  const {data,error}=await db.functions.invoke('portfolio-market',{body:{action:'quote',quote_symbol:a.quote_symbol,currency:a.currency}});
  if(error||data?.error)throw Error('주식 시세 조회 실패');price=Number(data.price);as_of=String(data.as_of||'');source='Naver · 지연/최근 거래가';
  // Provider local timestamp may not carry a timezone. Keep it verbatim; use date only for old-quote rejection.
  const date=as_of.slice(0,10),age=Date.now()-Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(age)||age>5*86400000||age< -86400000)throw Error('주식 시세 기준일을 확인할 수 없거나 오래됐어요.');
 }else throw Error('자동 시세를 지원하지 않는 종목이에요.');
 if(!Number.isFinite(price)||price<=0)throw Error('유효한 시세가 없어요.');return {price,as_of,source,fetched_at};
}
