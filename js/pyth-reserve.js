const finite = value => value===null||value===undefined||value===''||typeof value==='boolean'?null:Number.isFinite(Number(value))?Number(value):null;

export function annualizedBuybackRate(annualizedFundingUsd, marketCapUsd) {
  const funding = finite(annualizedFundingUsd);
  const marketCap = finite(marketCapUsd);
  return funding !== null && funding >= 0 && marketCap > 0 ? funding / marketCap * 100 : null;
}

export function validatePythReserve(data) {
  if (data?.schemaVersion !== 1 || !/^\d{4}-\d{2}$/.test(data.latestMonth ?? '')) throw new Error('Invalid PYTH Reserve data');
  const numeric = ['latestGrossRevenueUsd','latestDaoShareUsd','annualizedReserveFundingUsd','openMarketPurchasedPyth','reserveBalancePyth'];
  if (numeric.some(key => finite(data[key]) === null || Number(data[key]) < 0)) throw new Error('Invalid PYTH Reserve metrics');
  if (!Array.isArray(data.monthlyRevenue) || data.monthlyRevenue.length < 2) throw new Error('Missing PYTH monthly revenue');
  for (const row of data.monthlyRevenue) {
    if (!/^\d{4}-\d{2}$/.test(row.month) || finite(row.grossRevenueUsd) === null || finite(row.daoShareUsd) === null) throw new Error('Invalid PYTH monthly row');
    const url = new URL(row.source);
    if (url.protocol !== 'https:') throw new Error('Unsafe PYTH source');
  }
  return data;
}

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const compact = value => value>=1_000_000?`${(value/1_000_000).toFixed(2)}M`:new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const el = (tag,text='',className='') => { const node=document.createElement(tag);node.textContent=text;node.className=className;return node; };
const external = (url,text) => { const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node; };

export class PythReservePanel {
  constructor(host, fetchJson) {
    this.host=host;this.fetchJson=fetchJson;this.data=null;this.marketCap=null;this.language='ko';this.request=0;
  }
  async setAsset(assetId, language, signal) {
    this.language=language;this.marketCap=null;this.host.hidden=assetId!=='pyth';
    const request=++this.request;
    if(assetId!=='pyth')return;
    this.host.replaceChildren(el('p',language==='en'?'Loading PYTH Reserve data…':'PYTH Reserve 데이터 불러오는 중…','pyth-reserve-loading'));
    try { const data=validatePythReserve(await this.fetchJson('./data/pyth-reserve.json',{signal}));if(request!==this.request)return;this.data=data;this.render(); }
    catch(error){if(request!==this.request)return;this.host.replaceChildren(el('p',language==='en'?'Unable to load Reserve data.':'Reserve 데이터를 불러오지 못했어.','pyth-reserve-loading'));}
  }
  setMarketCap(value) { this.marketCap=finite(value);if(!this.host.hidden&&this.data)this.render(); }
  render() {
    const d=this.data,en=this.language==='en';
    const rate=annualizedBuybackRate(d.annualizedReserveFundingUsd,this.marketCap);
    const head=el('div','','pyth-reserve-head');
    const intro=el('div');intro.append(el('div','PYTH RESERVE','eyebrow'),el('h3',en?'Revenue → PYTH accumulation':'매출 → PYTH 매수 재원'),el('p',en?'Latest monthly product revenue, DAO share and executed Reserve purchases are shown separately.':'최신 월 제품 매출·DAO 귀속액·실제 체결된 Reserve 매입을 구분해 표시.'));
    head.append(intro,external(d.sources.policy,en?'100% Rule ↗':'100% Rule 공식 발표 ↗'));
    const grid=el('div','','pyth-reserve-metrics');
    const metrics=[
      [en?'Sep. gross revenue':'9월 총매출',money(d.latestGrossRevenueUsd),en?'Reported product revenue':'공식 월별 보고'],
      [en?'Monthly Reserve funding':'월 Reserve 재원',money(d.latestDaoShareUsd),en?'DAO share under the 100% Rule':'100% Rule 적용 DAO 귀속액'],
      [en?'Annualized / market cap':'연환산 재원 / 시총',rate===null?'—':rate.toFixed(2)+'%',en?`${money(d.annualizedReserveFundingUsd)} annualized ÷ live market cap`:`${money(d.annualizedReserveFundingUsd)} 연환산 ÷ 실시간 시총`],
      [en?'Open-market purchases':'공개시장 매입 누적',compact(d.openMarketPurchasedPyth)+' PYTH',en?`${d.openMarketReportCount} execution reports`:`체결 보고서 ${d.openMarketReportCount}건 합계`],
      [en?'Reserve balance':'Reserve 보유량',(d.reserveBalanceApproximate?'≈ ':'')+compact(d.reserveBalancePyth)+' PYTH',en?'Includes direct PYTH settlements; not all are market buys':'현물 PYTH 정산 포함 · 전량 공개시장 매입 아님'],
    ];
    for(const [label,value,note] of metrics){const card=el('div','','pyth-reserve-metric');card.append(el('span',label),el('strong',value),el('small',note));grid.append(card);}
    const history=el('div','','pyth-revenue-history');
    const title=el('div','','pyth-revenue-title');title.append(el('strong',en?'Monthly revenue and DAO allocation':'월별 매출과 DAO 귀속액'),external(d.sources.purchaseReports,en?'Purchase reports ↗':'매입 보고서 ↗'));history.append(title);
    const max=Math.max(...d.monthlyRevenue.map(row=>row.grossRevenueUsd));
    for(const row of d.monthlyRevenue){const line=external(row.source,'');line.className='pyth-revenue-row';const label=el('span',row.month.replace('-','.'),'pyth-revenue-month');const bars=el('span','','pyth-revenue-bars');const gross=el('i','','gross');gross.style.width=(row.grossRevenueUsd/max*100)+'%';gross.title=(en?'Gross revenue ':'총매출 ')+money(row.grossRevenueUsd);const dao=el('i','','dao');dao.style.width=(row.daoShareUsd/max*100)+'%';dao.title=(en?'DAO share ':'DAO 귀속 ')+money(row.daoShareUsd);bars.append(gross,dao);const values=el('span',`${money(row.grossRevenueUsd)} · ${money(row.daoShareUsd)}`,'pyth-revenue-values');line.append(label,bars,values);history.append(line);}
    history.append(el('p',en?'Bars: gross revenue (green) · DAO share / Reserve funding (gold). Before V2, DAO share did not equal same-month open-market spend.':'막대: 총매출(초록) · DAO 귀속/Reserve 재원(금색). V2 이전 DAO 귀속액은 같은 달 공개시장 매입액과 동일하지 않음.','pyth-reserve-note'));
    this.host.replaceChildren(head,grid,history);
  }
}
