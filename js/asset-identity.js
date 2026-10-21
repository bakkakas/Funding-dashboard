// Issuer identity is independent of the instrument used to value holdings.
export const STOCKS = [
  {id:'stock-005930',code:'005930',name:'삼성전자',symbol:'005930',currency:'KRW',market:'KR',website:'https://www.samsung.com/',overview:'반도체·디스플레이·스마트폰·가전 등을 영위하는 삼성전자. 연결 실적과 사업부별 실적을 함께 확인합니다.',ir:'https://www.samsung.com/global/ir/financial-information/earnings-release/'},
  {id:'stock-000660',code:'000660',name:'SK하이닉스',symbol:'000660',currency:'KRW',market:'KR',website:'https://www.skhynix.com/',overview:'DRAM·NAND Flash 등 메모리 반도체를 개발·생산하는 기업. HBM을 포함한 제품 구성과 메모리 업황을 함께 확인합니다.',ir:'https://www.skhynix.com/ir/UI-FR-IR05/'},
  {id:'stock-googl',code:'GOOGL.O',name:'Alphabet',symbol:'GOOGL',currency:'USD',market:'US',cik:'1652044',ir:'https://abc.xyz/investor/'},
  {id:'stock-amzn',code:'AMZN.O',name:'Amazon',symbol:'AMZN',currency:'USD',market:'US',cik:'1018724',ir:'https://ir.aboutamazon.com/quarterly-results/default.aspx'},
  {id:'stock-nke',code:'NKE',name:'Nike',symbol:'NKE',currency:'USD',market:'US',cik:'320187',ir:'https://investors.nike.com/investors/news-events-and-reports/'},
  {id:'stock-novo-nordisk',code:'NVO',name:'Novo Nordisk A/S',symbol:'NOVO B',currency:'USD',market:'US',primaryListing:'Nasdaq Copenhagen · NOVO B',quoteNote:'기업 분석·투자 메모는 원주 기업 Novo Nordisk 기준. 아래 가격·변화율은 미국 ADR NVO / USD 참고 시세이며 덴마크 원주 DKK 시세가 아닙니다.',ir:'https://www.novonordisk.com/investors/financial-results.html'},
];
export const INSTRUMENT_ALIASES = {'0193W0':'005930','0195S0':'000660','TSLL':'TSLA.O','TSLQ':'TSLA.O','NVDL':'NVDA.O','NVDU':'NVDA.O','NVDQ':'NVDA.O','AAPU':'AAPL.O','AAPD':'AAPL.O','AMZU':'AMZN.O','AMZD':'AMZN.O','GOOX':'GOOGL.O','GGLL':'GOOGL.O','GGLS':'GOOGL.O'};
const STABLE = new Set(['USDT','USDC','USDE','SUSDE','DAI','USDS','SUSDS','FDUSD','TUSD','USDP','BUSD','FRAX','PYUSD','GUSD','LUSD','USD1','USDD','RLUSD','USDF','USD0','USDG','EURC','EURS','EURCV','EURI','USDBC','CRVUSD','DOLA','MIM','GHO','USDY','USDT0','USDC.E','USDT.E']);
const COMMODITIES = new Set(['PAXG','XAUT','GOLD','SILVER']);
/** @returns {{id:string,code:string,name:string,symbol:string,market:string,via:string|null,currency?:string,website?:string,overview?:string,ir?:string,cik?:string,primaryListing?:string,quoteNote?:string,archiveAvailable?:boolean}} */
export function canonicalStock(code, name='') {
 code=String(code||'').replace(/^NAVER:/,'');
 const base=INSTRUMENT_ALIASES[code]||INSTRUMENT_ALIASES[code.replace(/\.[A-Z]+$/,'')]||code;
 const known=STOCKS.find(s=>s.code===base||s.symbol===base);
 return known?{...known,archiveAvailable:true,via:base!==code?code:null}:{id:`stock-${base.toLowerCase().replace(/\./g,'-')}`,code:base,name:name||base,symbol:base.split('.')[0],market:/^[0-9][0-9A-Z]{5}$/.test(base)?'KR':'US',via:base!==code?code:null};
}
export function researchTarget(asset, cryptoCatalog=[]) {
 const type=asset.asset_class||'crypto',symbol=String(asset.symbol||'').toUpperCase(),name=String(asset.name||''),quote=String(asset.quote_symbol||'');
 if(!['stock','crypto'].includes(type))return null;
 if(type==='crypto') {
  if(STABLE.has(symbol)||COMMODITIES.has(symbol)||quote.startsWith('FIXED:'))return null;
  const cg=quote.startsWith('CG:')?quote.slice(3):null;
  if(!cg||!/^[a-z0-9-]+$/.test(cg))return null;
  const known=cryptoCatalog.find(x=>x.coingeckoId===cg);
  return {kind:'crypto',id:known?.id||`coin-${cg}`,key:`crypto:${cg}`,cg};
 }
 if(!quote.startsWith('NAVER:'))return null;
 const code=quote.slice(6);
 if(!/^[A-Za-z0-9][A-Za-z0-9.-]{0,25}$/.test(code))return null;
 const target=canonicalStock(code,name);
 if(!target.via&&(/\b(ETF|ETN|ETP|UCITS|iShares|SPDR|Vanguard|Direxion|ProShares|YieldMax|GraniteShares)\b|KODEX|TIGER|ACE |RISE |SOL |PLUS |HANARO|KOSEF|레버리지|인버스|커버드콜/i.test(name)||new Set(['SPY','QQQ','VOO','VTI','SCHD','TQQQ','SQQQ','SOXL','SOXS','JEPI','JEPQ','GLD','SLV']).has(symbol)))return null;
 return {...target,kind:'stock',key:target.id};
}
export function researchHref(target) {
 if(!target)return '';
 const p=new URLSearchParams({asset:target.id});
 if(target.kind==='stock'){p.set('stock',target.code);if(target.via)p.set('via',target.via);}
 if(target.kind==='crypto'&&target.id.startsWith('coin-'))p.set('coin',target.cg);
 return `./investment-setup.html?${p}`;
}
