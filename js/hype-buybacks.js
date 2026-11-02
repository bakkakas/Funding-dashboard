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

const DAY_MS=86400000;
const dayTime=date=>Date.parse(`${date}T00:00:00Z`);
export function selectHypeDays(rows,days,updatedAt){
  const end=dayTime(updatedAt.slice(0,10)),start=days===null?-Infinity:end-(days-1)*DAY_MS;
  return rows.filter(row=>dayTime(row.date)>=start&&dayTime(row.date)<=end).sort((a,b)=>a.date.localeCompare(b.date));
}
export function summarizeHypePeriods(rows,unit){
  const buckets=new Map();
  for(const row of rows){
    const day=new Date(dayTime(row.date));
    if(unit==='week')day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
    else day.setUTCDate(1);
    const key=day.toISOString().slice(0,10);
    const bucket=buckets.get(key)??{key,usd:0,hype:0,days:0,partial:false};
    bucket.usd+=row.usd;bucket.hype+=row.hype;bucket.days++;bucket.partial ||= row.partial!==false;
    buckets.set(key,bucket);
  }
  return [...buckets.values()].map(row=>{
    const start=new Date(dayTime(row.key)),end=new Date(start);
    if(unit==='week')end.setUTCDate(end.getUTCDate()+7);else end.setUTCMonth(end.getUTCMonth()+1);
    return {...row,end:new Date(end.getTime()-DAY_MS).toISOString().slice(0,10),partial:row.partial||row.days!==(end-start)/DAY_MS,average:row.hype>0?row.usd/row.hype:null};
  }).sort((a,b)=>b.key.localeCompare(a.key));
}

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const price=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const compact=value=>value>=1_000_000?`${(value/1_000_000).toFixed(2)}M`:value>=1_000?`${(value/1_000).toFixed(1)}K`:new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
const external=(url,text)=>{const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;};

export class HypeBuybackPanel {
  constructor(host,fetchJson){this.host=host;this.fetchJson=fetchJson;this.data=null;this.marketCap=null;this.language='ko';this.request=0;this.rangeDays=30;this.periodUnit='week';}
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
    const title=el('div','','hype-buyback-title');title.append(el('strong',en?'Daily open-market buyback spend':'일별 공개시장 매수액'));history.append(title);
    const ranges=el('div','','hype-period-controls');
    for(const [days,label] of [[30,en?'30 days':'30일'],[90,en?'90 days':'90일'],[365,en?'1 year':'1년'],[null,en?'All':'전체']]){
      const button=el('button',label,'chip');button.type='button';button.classList.toggle('active',this.rangeDays===days);button.setAttribute('aria-pressed',String(this.rangeDays===days));button.onclick=()=>{this.rangeDays=days;this.render();};ranges.append(button);
    }
    history.append(ranges);
    const rows=selectHypeDays(d.dailyActivity,this.rangeDays,d.updatedAt),max=Math.max(0,...rows.map(row=>row.usd));
    const scroll=el('div','','hype-chart-scroll'),bars=el('div','','hype-daily-bars');
    bars.style.minWidth=`${Math.max(300,rows.length*28)}px`;
    for(const row of rows){const bar=el('div','','hype-daily-bar'),fill=el('i');fill.style.height=`${max?row.usd/max*100:0}%`;fill.tabIndex=0;fill.title=`${row.date} · ${money(row.usd)} · ${row.hype.toFixed(2)} HYPE${row.partial?' · '+(en?'Partial':'일부 기록'):''}`;fill.setAttribute('aria-label',fill.title);bar.append(fill,el('small',row.date.slice(5).replace('-','.')));bars.append(bar);}
    scroll.append(bars);history.append(scroll);
    const coverage=rows.length?`${rows[0].date} ~ ${rows.at(-1).date} · ${rows.length}${en?' recorded days':'일 기록'}`:(en?'No records in this period':'해당 기간 기록 없음');
    history.append(el('p',`UTC · ${coverage}`,'hype-buyback-note'));
    const links=el('div','','hype-source-links');
    links.append(external('https://app.hyperliquid.xyz/explorer/address/0xfefefefefefefefefefefefefefefefefefefefe',en?'Official AF account ↗':'공식 AF 계정 ↗'),external('https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#retrieve-a-users-fills-by-time',en?'Official execution API ↗':'공식 체결 API ↗'));
    history.append(links);
    const periodControls=el('div','','hype-period-controls');
    for(const [unit,label] of [['week',en?'Weekly':'주별'],['month',en?'Monthly':'월별']]){
      const button=el('button',label,'chip');button.type='button';button.classList.toggle('active',this.periodUnit===unit);button.setAttribute('aria-pressed',String(this.periodUnit===unit));button.onclick=()=>{this.periodUnit=unit;this.render();};periodControls.append(button);
    }
    history.append(periodControls);
    const tableScroll=el('div','','hype-table-scroll'),table=el('table','','hype-period-table'),thead=el('thead'),tr=el('tr');
    for(const label of [en?'UTC period':'기간 (UTC)',en?'Spend (USD)':'매수액 (USD)',en?'HYPE bought':'HYPE 수량',en?'Avg price (USD)':'평균 단가 (USD)'])tr.append(el('th',label));
    thead.append(tr);table.append(thead);const tbody=el('tbody');
    for(const row of summarizeHypePeriods(rows,this.periodUnit)){
      const tr=el('tr');tr.append(el('td',`${this.periodUnit==='month'?row.key.slice(0,7):row.key+' ~ '+row.end}${row.partial?(en?' · partial':' · 일부'):''}`),el('td',price(row.usd)),el('td',row.hype.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})),el('td',row.average===null?'—':price(row.average)));tbody.append(tr);
    }
    table.append(tbody);tableScroll.append(table);history.append(tableScroll);
    history.append(el('p',en?'Selected-period recorded executions only. Weeks start Monday (UTC). Average = USD spent ÷ HYPE bought. Partial marks unfinished or missing days. The API exposes only the latest 10,000 fills; All means all archived records, not lifetime purchases. Missing history is not zero.':'선택 기간의 보관된 체결 기준 · UTC 월요일 시작 · 평균 단가 = 매수액 ÷ HYPE 수량. 미완료·누락일이 있는 주·월은 ‘일부’ 표시. 공식 API는 최근 1만 건만 제공하므로 전체는 보관된 기록 전체이며, 미확보 기간은 0원이 아닙니다.','hype-buyback-note'));
    this.host.replaceChildren(head,grid,history);
  }
}
