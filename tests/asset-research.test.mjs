import test from 'node:test';
import assert from 'node:assert/strict';
import {researchTarget,researchHref,canonicalStock} from '../js/asset-identity.js';
import {CRYPTO_RESEARCH} from '../js/crypto-research-map.js';
import {priceChanges,financialQuarters,numeric} from '../js/stock-data.js';
const stock=(symbol,name=symbol)=>({asset_class:'stock',symbol,name,quote_symbol:'NAVER:'+symbol});
const coin=(symbol,id)=>({asset_class:'crypto',symbol,quote_symbol:'CG:'+id});
test('portfolio excludes cash, commodities, broad ETFs and stablecoins but not ENA',()=>{
 for(const a of [{asset_class:'cash'},{asset_class:'commodity'},stock('498400','KODEX 200타겟위클리커버드콜'),stock('QQQ'),stock('233740','KODEX 코스닥150레버리지'),coin('USDT','tether'),coin('USDE','ethena-usde'),coin('USDC','usd-coin'),coin('PAXG','pax-gold')])assert.equal(researchTarget(a,CRYPTO_RESEARCH),null);
 assert.equal(researchTarget(coin('ENA','ethena'),CRYPTO_RESEARCH).id,'ena');
});
test('single-stock ETF resolves to same company and note key as underlying',()=>{
 const a=researchTarget(stock('0193W0','KODEX 삼성전자단일종목레버리지')),b=researchTarget(stock('005930','삼성전자'));
 assert.equal(a.key,b.key);assert.equal(a.code,'005930');assert.equal(a.via,'0193W0');assert.match(researchHref(a),/stock=005930/);
 assert.equal(researchTarget(stock('0195S0','TIGER SK하이닉스단일종목레버리지')).key,canonicalStock('000660').id);
 assert.equal(researchTarget(stock('NVDL','GraniteShares 2x Long NVDA Daily ETF')).code,'NVDA.O');
});
test('ADR links to issuer identity and discloses quote basis',()=>{
 const target=researchTarget(stock('NVO','노보 노디스크 ADR'));assert.equal(target.id,'stock-novo-nordisk');assert.equal(target.symbol,'NOVO B');assert.match(target.quoteNote,/ADR NVO/);
});
test('crypto exact ID beats ticker collisions; unknown coin retains its identity',()=>{
 assert.equal(researchTarget(coin('BNB','binancecoin'),CRYPTO_RESEARCH).id,'bnb');
 assert.equal(researchTarget(coin('BNB','different-coin'),CRYPTO_RESEARCH).id,'coin-different-coin');
 assert.equal(researchTarget(coin('BTC','bitcoin'),CRYPTO_RESEARCH).key,'crypto:bitcoin');
 assert.equal(researchTarget(stock('../../bad')),null);
});
test('calendar changes use previous trading day and reject stale/missing baselines',()=>{
 const rows=[{localDate:'20251020',closePrice:50},{localDate:'20260921',closePrice:80},{localDate:'20261014',closePrice:100}];
 const r=priceChanges(rows,110,'2026-10-21T12:00:00+09:00');assert.ok(Math.abs(r.d7.value-10)<1e-9);assert.equal(r.d30.baseDate,'2026-09-21');assert.equal(r.y1.baseDate,'2025-10-20');
 assert.equal(priceChanges([{localDate:'20260901',closePrice:80}],110,'2026-10-21').d7,null);
 assert.equal(priceChanges(rows,110,'invalid').d7,null);assert.equal(numeric('-'),null);assert.equal(numeric('0'),0);
});
test('financials exclude forecasts, preserve negative and zero, latest actual first',()=>{
 const r=financialQuarters({financeInfo:{trTitleList:[{key:'202603',title:'2026.03.',isConsensus:'N'},{key:'202606',title:'2026.06.',isConsensus:'N'},{key:'202609',title:'2026.09.',isConsensus:'Y'}],rowList:[{title:'영업이익',columns:{'202603':{value:'-1,200'},'202606':{value:'0'},'202609':{value:'9,000'}}}]}});
 assert.equal(r.length,2);assert.equal(r[0].key,'202606');assert.equal(r[0].metrics[0].value,0);assert.equal(r[1].metrics[0].value,-1200);
});

test('published issuer archives cover five prior years, contain safe links and no future filings',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const id of ['stock-005930','stock-000660','stock-novo-nordisk','stock-googl','stock-amzn','stock-nke']){
  const a=JSON.parse(await readFile(new URL('../data/stock-research/'+id+'.json',import.meta.url)));
  assert.ok(a.reports.length>=20,id);assert.ok(a.reports.some(r=>r.year<=2021),id);
  for(const r of a.reports){assert.equal(new URL(r.url).protocol,'https:');if(r.filed)assert.ok(r.filed<=a.updatedAt.slice(0,10));if(r.type==='10-Q')assert.match(r.period,/-\d{2}-(28|29|30|31)$/);}
 }
});

test('OTLY ticker and Naver ADS code resolve to the same issuer without a nonexistent archive',()=>{
 const a=canonicalStock('OTLY'),b=researchTarget(stock('OTLY.O','오틀리 그룹 ADR'));
 assert.equal(a.id,'stock-otly');assert.equal(a.id,b.id);assert.equal(a.code,'OTLY.O');assert.equal(a.archiveAvailable,false);assert.match(a.primaryListing,/ADS/);assert.match(a.quoteNote,/USD/);
});
