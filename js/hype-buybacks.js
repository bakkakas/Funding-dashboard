const finite=value=>value===null||value===undefined||value===''||typeof value==='boolean'?null:Number.isFinite(Number(value))?Number(value):null;

export function annualizedBuybackYield(thirtyDaySpendUsd, marketCapUsd) {
  const spend=finite(thirtyDaySpendUsd),marketCap=finite(marketCapUsd);
  return spend!==null&&spend>=0&&marketCap>0?spend*365/30/marketCap*100:null;
}

export function validateHypeBuybacks(data) {
  if(data?.schemaVersion!==1||!Number.isFinite(Date.parse(data.updatedAt??'')))throw new Error('Invalid HYPE buyback data');
  const numeric=['burnedHype','cumulativeSpendUsd','averageBuyPriceUsd','maxSupply','burnedMaxSupplyPct'];
  if(numeric.some(key=>finite(data[key])===null||Number(data[key])<0))throw new Error('Invalid HYPE buyback metrics');
  for(const period of ['1d','7d','30d']){
    const row=data.recent?.[period];
    if(!row||['hype','usd','fills'].some(key=>finite(row[key])===null||Number(row[key])<0))throw new Error('Invalid HYPE recent activity');
  }
  if(!Array.isArray(data.dailyActivity)||!data.dailyActivity.length)throw new Error('Missing HYPE daily activity');
  for(const row of data.dailyActivity){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||finite(row.hype)===null||finite(row.usd)===null)throw new Error('Invalid HYPE daily row');
  }
  if(!/^https:\/\//.test(data.sources?.policy??''))throw new Error('Unsafe HYPE policy source');
  return data;
}

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const price=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const compact=value=>value>=1_000_000?`${(value/1_000_000).toFixed(2)}M`:value>=1_000?`${(value/1_000).toFixed(1)}K`:new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
const external=(url,text)=>{const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;};

export class HypeBuybackPanel {
  constructor(host,fetchJson){this.host=host;this.fetchJson=fetchJson;this.data=null;this.marketCap=null;this.language='ko';this.request=0;}
  async setAsset(assetId,language,signal){
    this.language=language;this.marketCap=null;this.host.hidden=assetId!=='hype';const request=++this.request;
    if(assetId!=='hype')return;
    this.host.replaceChildren(el('p',language==='en'?'Loading Assistance Fund data…':'Assistance Fund 데이터 불러오는 중…','hype-buyback-loading'));
    try{const data=validateHypeBuybacks(await this.fetchJson('./data/hype-buybacks.json',{signal}));if(request!==this.request)return;this.data=data;this.render();}
    catch(error){if(request!==this.request)return;this.host.replaceChildren(el('p',language==='en'?'Unable to load buyback data.':'바이백 데이터를 불러오지 못했어.','hype-buyback-loading'));}
  }
  setMarketCap(value){this.marketCap=finite(value);if(!this.host.hidden&&this.data)this.render();}
  setLanguage(language){this.language=language;if(!this.host.hidden&&this.data)this.render();}
  render(){
    const d=this.data,en=this.language==='en',buybackYield=annualizedBuybackYield(d.recent['30d'].usd,this.marketCap);
    const head=el('div','','hype-buyback-head');
    const intro=el('div');intro.append(el('div','HYPE ASSISTANCE FUND','eyebrow'),el('h3',en?'Trading fees → HYPE buyback and burn':'거래 수수료 → HYPE 매수·소각'),el('p',en?'Official system-address balances and fills track cumulative and recent executions.':'공식 시스템 주소의 잔액·체결 내역으로 누적 및 최근 매수 현황을 추적.'));
    head.append(intro,external(d.sources.policy,en?'Official fee policy ↗':'공식 수수료 정책 ↗'));
    const grid=el('div','','hype-buyback-metrics');
    const metrics=[
      [en?'Cumulative bought & burned':'누적 매수·소각',compact(d.burnedHype)+' HYPE',`${d.burnedMaxSupplyPct.toFixed(2)}% ${en?'of 1B max supply':'/ 최대공급 10억'}`],
      [en?'Cumulative spend':'누적 매수액',money(d.cumulativeSpendUsd),en?'Official entry notional':'공식 API entry notional'],
      [en?'Average buy price':'평균 매입가',price(d.averageBuyPriceUsd),en?'Cumulative spend ÷ HYPE burned':'누적 매수액 ÷ 소각 HYPE'],
      [en?'Last 24 hours':'최근 24시간',compact(d.recent['1d'].hype)+' HYPE',money(d.recent['1d'].usd)],
      [en?'Last 7 days':'최근 7일',compact(d.recent['7d'].hype)+' HYPE',money(d.recent['7d'].usd)],
      [en?'30d annualized / market cap':'30일 연환산 / 시총',buybackYield===null?'—':buybackYield.toFixed(2)+'%',`${money(d.recent['30d'].usd)} ${en?'spent in 30d':'· 최근 30일'}`],
    ];
    for(const [label,value,note] of metrics){const card=el('div','','hype-buyback-metric');card.append(el('span',label),el('strong',value),el('small',note));grid.append(card);}
    const history=el('div','','hype-buyback-history');
    const title=el('div','','hype-buyback-title');title.append(el('strong',en?'Daily open-market buyback spend':'일별 공개시장 매수액'),el('span',en?'UTC · latest 30 days':'UTC · 최근 30일'));history.append(title);
    const max=Math.max(...d.dailyActivity.map(row=>row.usd));
    const bars=el('div','','hype-daily-bars');
    for(const row of d.dailyActivity){const bar=el('div','','hype-daily-bar');const fill=el('i');fill.style.height=`${max?Math.max(2,row.usd/max*100):0}%`;fill.title=`${row.date} · ${money(row.usd)} · ${compact(row.hype)} HYPE`;bar.append(fill,el('small',row.date.slice(5).replace('-','.')));bars.append(bar);}
    history.append(bars,el('p',en?'Assistance Fund HYPE is treated as burned under the official fee policy. Recent totals come from official fill history; cumulative spend is the system account entry notional.':'공식 정책상 Assistance Fund의 HYPE는 소각 처리된다. 최근 수치는 공식 체결 내역, 누적 매수액은 시스템 계정의 entry notional 기준.','hype-buyback-note'));
    this.host.replaceChildren(head,grid,history);
  }
}
