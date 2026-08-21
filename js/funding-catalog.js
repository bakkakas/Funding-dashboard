const COINGECKO_SEARCH_URL = 'https://api.coingecko.com/api/v3/search';
const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
const MARKET_SOURCES = [
  {
    exchange:'Binance',
    url:'https://fapi.binance.com/fapi/v1/exchangeInfo',
    fundingInfoUrl:'https://fapi.binance.com/fapi/v1/fundingInfo',
    rows:json=>json.symbols || [],
    parse:row=>row.status === 'TRADING' && row.contractType === 'PERPETUAL' && row.quoteAsset === 'USDT'
      ? { symbol:row.symbol, base:row.baseAsset, fundingIntervalHours:8 }
      : null,
  },
  {
    exchange:'Bybit',
    url:'https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000',
    rows:json=>json.result?.list || [],
    parse:row=>row.status === 'Trading' && row.contractType === 'LinearPerpetual' && row.quoteCoin === 'USDT'
      ? { symbol:row.symbol, base:row.baseCoin, fundingIntervalHours:Number(row.fundingInterval || 480) / 60 }
      : null,
  },
  {
    exchange:'Aster',
    url:'https://fapi.asterdex.com/fapi/v1/exchangeInfo',
    fundingInfoUrl:'https://fapi.asterdex.com/fapi/v1/fundingInfo',
    rows:json=>json.symbols || [],
    parse:row=>row.status === 'TRADING' && row.contractType === 'PERPETUAL' && row.quoteAsset === 'USDT'
      ? { symbol:row.symbol, base:row.baseAsset, fundingIntervalHours:8 }
      : null,
  },
  {
    exchange:'OKX',
    url:'https://www.okx.com/api/v5/public/instruments?instType=SWAP',
    rows:json=>json.data || [],
    parse:row=>row.state === 'live' && row.ctType === 'linear' && row.settleCcy === 'USDT' && row.instId.endsWith('-USDT-SWAP')
      ? { symbol:row.instId, base:row.instId.replace(/-USDT-SWAP$/, ''), fundingIntervalHours:8 }
      : null,
  },
];

let marketCatalogPromise;
const searchCache = new Map();

async function fetchJson(url, options={}){
  const response=await fetch(url, options);
  if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function normalizedBase(value){
  return String(value || '').toUpperCase().replace(/^(?:1000000|1000)(?=[A-Z])/, '');
}

async function loadHyperliquidMarkets(){
  const json=await fetchJson(HYPERLIQUID_INFO_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ type:'meta' }),
  });
  return (json.universe || []).map(row=>({
    exchange:'Hyperliquid',
    symbol:row.name,
    base:row.name,
    normalizedBase:normalizedBase(row.name),
    fundingIntervalHours:1,
  }));
}

async function loadMarketCatalog(){
  if(marketCatalogPromise) return marketCatalogPromise;
  marketCatalogPromise=Promise.allSettled([
    ...MARKET_SOURCES.map(async source=>{
      const [json, fundingInfo]=await Promise.all([
        fetchJson(source.url),
        source.fundingInfoUrl ? fetchJson(source.fundingInfoUrl).catch(()=>[]) : Promise.resolve([]),
      ]);
      const intervalBySymbol=new Map((Array.isArray(fundingInfo) ? fundingInfo : [])
        .map(row=>[row.symbol, Number(row.fundingIntervalHours)])
        .filter(([,hours])=>Number.isFinite(hours) && hours > 0));
      return source.rows(json).map(source.parse).filter(Boolean).map(row=>({
        ...row,
        exchange:source.exchange,
        fundingIntervalHours:intervalBySymbol.get(row.symbol) || row.fundingIntervalHours,
        normalizedBase:normalizedBase(row.base),
      }));
    }),
    loadHyperliquidMarkets(),
  ]).then(results=>results.flatMap(result=>result.status === 'fulfilled' ? result.value : []));
  return marketCatalogPromise;
}

export function fundingIntervalHoursBetween(fundingTime, nextFundingTime, fallback=8){
  const current=Number(fundingTime);
  const next=Number(nextFundingTime);
  const hours=(next-current) / 3600000;
  return Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : fallback;
}

export async function refreshFundingAssetDefinition(result){
  const markets=await loadMarketCatalog();
  const byPair=new Map(markets.map(market=>[`${market.exchange}:${market.symbol}`, market]));
  return {
    ...result,
    pairs:(result.pairs || []).map(pair=>{
      const current=byPair.get(`${pair.exchange}:${pair.symbol}`);
      return current ? { ...pair, fundingIntervalHours:current.fundingIntervalHours } : pair;
    }),
  };
}

function pairDefinitionsForCoin(coin, markets){
  const ticker=String(coin.symbol || '').toUpperCase();
  const seen=new Set();
  return markets.filter(market=>market.normalizedBase === ticker).filter(market=>{
    const key=`${market.exchange}:${market.symbol}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(market=>({
    ...market,
    assetId:ticker,
    displaySymbol:ticker,
    assetName:coin.name || ticker,
  }));
}

export async function searchFundingAssets(query){
  const raw=String(query || '').trim();
  if(raw.length < 2) return [];
  const cacheKey=raw.toLocaleLowerCase('en');
  if(searchCache.has(cacheKey)) return searchCache.get(cacheKey);
  const promise=Promise.all([
    loadMarketCatalog(),
    fetchJson(`${COINGECKO_SEARCH_URL}?query=${encodeURIComponent(raw)}`)
      .then(json=>(json.coins || []).filter(coin=>coin.market_cap_rank).slice(0, 14))
      .catch(()=>[]),
  ]).then(([markets, coins])=>{
    const results=[];
    const seen=new Set();
    coins.forEach(coin=>{
      const pairs=pairDefinitionsForCoin(coin, markets);
      const id=String(coin.symbol || '').toUpperCase();
      if(!pairs.length || seen.has(id)) return;
      seen.add(id);
      results.push({
        id,
        name:coin.name,
        marketCapRank:coin.market_cap_rank,
        thumb:coin.thumb || coin.small || '',
        pairs,
        remote:true,
      });
    });
    if(results.length) return results;
    const normalized=raw.toUpperCase();
    const fallbackSymbols=[...new Set(markets
      .filter(market=>market.normalizedBase.includes(normalized))
      .map(market=>market.normalizedBase))].slice(0, 12);
    return fallbackSymbols.map(id=>({
      id,
      name:id,
      pairs:pairDefinitionsForCoin({ symbol:id, name:id }, markets),
      remote:true,
    }));
  });
  searchCache.set(cacheKey, promise);
  return promise;
}

function emptySummary(){
  return { count:0, avgFundingRate:0, annualizedPct:0, sumFundingRate:0, firstFundingTime:null, lastFundingTime:null };
}

function summarize(rows, intervalHours){
  if(!rows.length) return emptySummary();
  const rates=rows.map(row=>Number(row.fundingRate)).filter(Number.isFinite);
  if(!rates.length) return emptySummary();
  const avg=rates.reduce((sum,value)=>sum+value,0) / rates.length;
  return {
    count:rates.length,
    avgFundingRate:avg,
    annualizedPct:avg * (24 / intervalHours) * 365 * 100,
    sumFundingRate:rates.reduce((sum,value)=>sum+value,0),
    firstFundingTime:rows[0].fundingTime,
    lastFundingTime:rows.at(-1).fundingTime,
  };
}

export function addDynamicFundingAsset(data, result){
  const windowKeys=Object.keys(data.meta.windows || {});
  const added=[];
  result.pairs.forEach(definition=>{
    const pairKey=`${definition.exchange}:${definition.symbol}`;
    if(data.pairs[pairKey]){
      added.push(pairKey);
      return;
    }
    const windows={};
    windowKeys.forEach(key=>{ windows[key]=emptySummary(); });
    data.pairs[pairKey]={
      key:pairKey,
      symbol:definition.symbol,
      displaySymbol:result.id,
      assetId:result.id,
      assetName:result.name,
      exchange:definition.exchange,
      fundingPeriodsPerDay:24 / definition.fundingIntervalHours,
      fundingIntervalHours:definition.fundingIntervalHours,
      windows,
      latest:{},
      rows:[],
      available:true,
      dynamic:true,
      historyLoaded:false,
      historyLoading:false,
      logoUrl:result.thumb || '',
    };
    added.push(pairKey);
  });
  return added;
}

async function fetchBinanceStyleHistory(baseUrl, symbol, startTime, endTime){
  const json=await fetchJson(`${baseUrl}?symbol=${encodeURIComponent(symbol)}&startTime=${startTime}&endTime=${endTime}&limit=1000`);
  return json.map(row=>({
    fundingTime:Number(row.fundingTime),
    fundingRate:Number(row.fundingRate),
    markPrice:row.markPrice == null ? null : Number(row.markPrice),
  }));
}

async function fetchBybitHistory(symbol, startTime, endTime){
  const rows=[];
  let cursorEnd=endTime;
  for(let page=0; page<8 && cursorEnd > startTime; page+=1){
    const url=`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(symbol)}&startTime=${startTime}&endTime=${cursorEnd}&limit=200`;
    const json=await fetchJson(url);
    const batch=json.result?.list || [];
    if(!batch.length) break;
    rows.push(...batch.map(row=>({
      fundingTime:Number(row.fundingRateTimestamp),
      fundingRate:Number(row.fundingRate),
      markPrice:null,
    })));
    const oldest=Math.min(...batch.map(row=>Number(row.fundingRateTimestamp)));
    if(batch.length < 200 || oldest <= startTime) break;
    cursorEnd=oldest - 1;
  }
  return rows;
}

async function fetchHyperliquidHistory(symbol, startTime, endTime){
  const rows=[];
  let cursor=startTime;
  for(let page=0; page<8 && cursor < endTime; page+=1){
    const batch=await fetchJson(HYPERLIQUID_INFO_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ type:'fundingHistory', coin:symbol, startTime:cursor, endTime }),
    });
    if(!batch.length) break;
    rows.push(...batch.map(row=>({
      fundingTime:Number(row.time),
      fundingRate:Number(row.fundingRate),
      premium:row.premium == null ? null : Number(row.premium),
      markPrice:null,
    })));
    const newest=Math.max(...batch.map(row=>Number(row.time)));
    if(batch.length < 500 || newest < cursor) break;
    cursor=newest + 1;
  }
  return rows;
}

async function fetchOkxHistory(symbol, startTime){
  const rows=[];
  let after='';
  for(let page=0; page<8; page+=1){
    const suffix=after ? `&after=${after}` : '';
    const json=await fetchJson(`https://www.okx.com/api/v5/public/funding-rate-history?instId=${encodeURIComponent(symbol)}&limit=100${suffix}`);
    const batch=json.data || [];
    if(!batch.length) break;
    rows.push(...batch.map(row=>({
      fundingTime:Number(row.fundingTime),
      fundingRate:Number(row.realizedRate || row.fundingRate),
      markPrice:null,
    })).filter(row=>row.fundingTime >= startTime));
    const oldest=Math.min(...batch.map(row=>Number(row.fundingTime)));
    if(batch.length < 100 || oldest <= startTime) break;
    after=String(oldest);
  }
  return rows;
}

async function fetchHistory(pair, startTime, endTime){
  if(pair.exchange === 'Binance') return fetchBinanceStyleHistory('https://fapi.binance.com/fapi/v1/fundingRate', pair.symbol, startTime, endTime);
  if(pair.exchange === 'Bybit') return fetchBybitHistory(pair.symbol, startTime, endTime);
  if(pair.exchange === 'Hyperliquid') return fetchHyperliquidHistory(pair.symbol, startTime, endTime);
  // Aster's history endpoint does not allow browser CORS. Current funding still
  // comes from the public premiumIndex endpoint; history remains empty here.
  if(pair.exchange === 'Aster') return [];
  if(pair.exchange === 'OKX') return fetchOkxHistory(pair.symbol, startTime);
  return [];
}

export async function hydrateDynamicFundingHistory(pair, windows){
  if(!pair?.dynamic || pair.historyLoaded || pair.historyLoading) return pair;
  pair.historyLoading=true;
  const maxDays=Math.max(...Object.values(windows).map(Number).filter(Number.isFinite), 90);
  const endTime=Date.now();
  const startTime=endTime - maxDays * 86400000;
  try{
    const fetched=await fetchHistory(pair, startTime, endTime);
    const seen=new Set();
    pair.rows=fetched.filter(row=>Number.isFinite(row.fundingTime) && Number.isFinite(row.fundingRate))
      .sort((a,b)=>a.fundingTime-b.fundingTime)
      .filter(row=>{
        if(seen.has(row.fundingTime)) return false;
        seen.add(row.fundingTime);
        return true;
      });
    Object.entries(windows).forEach(([key,days])=>{
      const cutoff=endTime - Number(days) * 86400000;
      pair.windows[key]=summarize(pair.rows.filter(row=>row.fundingTime >= cutoff), pair.fundingIntervalHours || 8);
    });
    pair.historyLoaded=true;
    pair.historyError='';
  } catch(error){
    pair.historyError=error.message || String(error);
  } finally {
    pair.historyLoading=false;
  }
  return pair;
}
