import { overviewChart } from './hype-overview.js?v=2';
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
    else if(unit==='month')day.setUTCDate(1);
    const key=day.toISOString().slice(0,10);
    const bucket=buckets.get(key)??{key,usd:0,hype:0,days:0,partial:false};
    if(row.usd===null)bucket.partial=true;else bucket.usd+=row.usd;bucket.hype+=row.hype;bucket.missingUsd ||= row.usd===null;bucket.days++;bucket.partial ||= row.partial!==false;
    buckets.set(key,bucket);
  }
  return [...buckets.values()].map(row=>{
    const start=new Date(dayTime(row.key)),end=new Date(start);
    if(unit==='week')end.setUTCDate(end.getUTCDate()+7);else if(unit==='month')end.setUTCMonth(end.getUTCMonth()+1);else end.setUTCDate(end.getUTCDate()+1);
    return {...row,end:new Date(end.getTime()-DAY_MS).toISOString().slice(0,10),partial:row.partial||row.days!==(end-start)/DAY_MS,average:!row.missingUsd&&row.hype>0?row.usd/row.hype:null};
  }).sort((a,b)=>b.key.localeCompare(a.key));
}

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const price=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const compact=value=>value>=1_000_000?`${(value/1_000_000).toFixed(2)}M`:value>=1_000?`${(value/1_000).toFixed(1)}K`:new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
const external=(url,text)=>{const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;};

export class HypeBuybackPanel {
  constructor(host,fetchJson){this.host=host;this.fetchJson=fetchJson;this.data=null;this.marketCap=null;this.language='ko';this.request=0;this.rangeDays=30;this.periodUnit='week';this.barUnit='day';}
  async setAsset(assetId,language,signal){
    this.language=language;this.marketCap=null;this.host.hidden=assetId!=='hype';const request=++this.request;
    if(assetId!=='hype')return;
    this.host.replaceChildren(el('p',language==='en'?'Loading Assistance Fund data…':'Assistance Fund 데이터 불러오는 중…','hype-buyback-loading'));
    try{const data=validateHypeBuybacks(await this.fetchJson('./data/hype-buybacks.json',{signal}));if(request!==this.request)return;this.data=data;this.archive=null;try{const archive=await this.fetchJson('./data/hype-history.json',{signal});if(archive?.schemaVersion===2&&archive.chartSource==='hype-console'&&Array.isArray(archive.rows)&&archive.rows.every(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.hype)&&r.hype>=0&&(r.usd===null||Number.isFinite(r.usd))))this.archive=archive;}catch{}if(request!==this.request)return;this.render();}
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
      [en?'30d annualized / market cap':'30일 연환산 / 시총',buybackYield===null?'—':buybackYield.toFixed(2)+'%',`${money(d.recent['30d'].usd)} ${en?'spent in 30d':'· 최근 30일'}`],
    ];
    for(const [label,value,note] of metrics){const card=el('div','','hype-buyback-metric');card.append(el('span',label),el('strong',value),el('small',note));grid.append(card);}
    const history=el('div','','hype-buyback-history');
    const title=el('div','','hype-buyback-title');title.append(el('strong',en?'Open-market buyback spend':'공개시장 매수액'));history.append(title);
    const ranges=el('div','','hype-period-controls');
    for(const [days,label] of [[30,en?'30 days':'30일'],[90,en?'90 days':'90일'],[365,en?'1 year':'1년'],[null,en?'All':'전체']]){
      const button=el('button',label,'chip');button.type='button';button.classList.toggle('active',this.rangeDays===days);button.setAttribute('aria-pressed',String(this.rangeDays===days));button.onclick=()=>{this.rangeDays=days;this.render();};ranges.append(button);
    }
    history.append(ranges);
    // Archive charts use only the selected source; official cards stay independent.
    const allRows=this.archive?.rows??d.dailyActivity.map(r=>({...r,closePrice:null}));
    const rows=selectHypeDays(allRows,this.rangeDays,this.archive?.fetchedAt??d.updatedAt);
    const units=el('div','','hype-period-controls hype-bar-units');
    for(const [unit,label] of [['day',en?'Daily':'일별'],['week',en?'Weekly':'주별'],['month',en?'Monthly':'월별']]){
      const button=el('button',label,'chip');button.type='button';button.classList.toggle('active',this.barUnit===unit);button.setAttribute('aria-pressed',String(this.barUnit===unit));button.onclick=()=>{this.barUnit=unit;this.render();};units.append(button);
    }
    history.append(units);
    const buckets=summarizeHypePeriods(rows,this.barUnit).reverse(),max=Math.max(0,...buckets.map(r=>r.usd));
    const scroll=el('div','','hype-chart-scroll'),bars=el('div','','hype-daily-bars');
    bars.style.minWidth=`${Math.max(300,buckets.length*40)}px`;
    const selected=el('p',en?'Hover or tap a bar for the amount':'막대에 마우스를 올리거나 터치하면 금액 표시','hype-buyback-note hype-bar-readout');selected.setAttribute('aria-live','polite');
    for(const row of buckets){
      const bar=el('div','','hype-daily-bar'),fill=el('i');fill.style.height=`${max?row.usd/max*100:0}%`;fill.tabIndex=0;
      const period=this.barUnit==='day'?row.key:this.barUnit==='month'?row.key.slice(0,7):`${row.key} ~ ${row.end}`;
      fill.title=`${period} UTC · ${money(row.usd)} · ${row.hype.toFixed(2)} HYPE${row.partial?' · '+(en?'Partial period':'일부 기간 합계'):''}`;
      fill.setAttribute('aria-label',fill.title);
      for(const event of ['mouseenter','focus','click'])fill.addEventListener(event,()=>{selected.textContent=fill.title;});
      bar.append(fill,el('small',this.barUnit==='month'?row.key.slice(2,7):row.key.slice(5).replace('-','.')));bars.append(bar);
    }
    scroll.append(bars);history.append(scroll,selected);
    history.append(el('p',en?'One bar = one UTC day / Monday–Sunday week / calendar month. Selected-range boundary periods are partial sums.':'막대 1개 = UTC 하루 / 월~일 1주 / 달력 1개월. 선택 범위에 일부만 포함된 주·월은 해당 구간 합계.','hype-buyback-note'));
    history.append(overviewChart(rows,allRows,en));
    history.append(el('p',this.archive?(en?'Charts and period table: HYPE Console. Gaps are missing source records, not zero buybacks.':'차트·기간별 표: HYPE Console 기준. 빈 구간은 원본 기록 없음이며 매수액 0원이 아님.'):(en?'Console unavailable · official recent records only':'Console 조회 불가 · 공식 최근 기록만 표시'),'hype-buyback-note'));
    const gapNotes=[];
    for(let i=1;i<allRows.length;i++){
      const from=dayTime(allRows[i-1].date)+DAY_MS,to=dayTime(allRows[i].date)-DAY_MS;
      if(to-from>=6*DAY_MS)gapNotes.push(`${new Date(from).toISOString().slice(0,10)} ~ ${new Date(to).toISOString().slice(0,10)}`);
    }
    if(gapNotes.length)history.append(el('p',`${en?'Source missing periods (7+ days)':'원본 미제공 구간 (7일 이상)'}: ${gapNotes.join(' / ')}`,'hype-buyback-note'));
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
      const tr=el('tr');tr.append(el('td',`${this.periodUnit==='month'?row.key.slice(0,7):row.key+' ~ '+row.end}${row.partial?(en?' · partial':' · 일부'):''}`),el('td',`${price(row.usd)}${row.missingUsd?(en?' (known only)':' (확인분만)'):''}`),el('td',row.hype.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})),el('td',row.average===null?'—':price(row.average)));tbody.append(tr);
    }
    table.append(tbody);tableScroll.append(table);history.append(tableScroll);
    history.append(el('p',en?'Weeks start Monday (UTC). Average = USD spent ÷ HYPE bought. Partial marks unfinished, missing or range-boundary days. All means all records from the selected source, not an independently audited lifetime total.':'UTC 월요일 시작 · 평균 단가 = 매수액 ÷ HYPE 수량. 미완료·누락·선택 경계의 주·월은 일부 표시. 전체는 선택 출처의 보관 기록 전체이며 공식 누적 총액과 별도입니다.','hype-buyback-note'));
    if(this.archive){
      if(Date.now()-Date.parse(this.archive.fetchedAt)>2*86400000)history.append(el('p',en?'Historical feed delayed':'과거 데이터 갱신 지연','hype-buyback-note'));
      history.append(el('p',en?'Daily amounts and HYPE close: HYPE Console, a third-party index. Official summary cards above and Crypto Burn Tracker burn details below use separate sources. 7/30-day averages need complete calendar windows.':'일별 매수액·수량·종가: 제3자 집계 HYPE Console. 상단 공식 API 요약 및 하단 Crypto Burn Tracker 소각 내역은 별도 출처입니다. 7/30일 평균은 원본 기록이 모두 있는 달력 기간만 계산합니다.','hype-buyback-note'));
      history.append(external('https://hype-console.serhiifotex.dev/?period=365d','HYPE Console ↗'),external('https://cryptoburntracker.com/burns/hyperliquid/','Crypto Burn Tracker ↗'));
      const detail=el('details','','hype-burn-history');detail.append(el('summary',en?'Burn history by mechanism':'방식별 소각 이력'));
      for(const m of this.archive.mechanisms??[])detail.append(el('p',`${m.name}: ${compact(m.hype)} HYPE`));
      detail.append(el('p',en?'AF is included in total burns; never add it twice. Gas/protocol burns are not market-buy expenditure.':'AF 보유 소각분은 전체 소각에 이미 포함 · 중복 합산하지 않음. 가스·프로토콜 소각은 시장 매수 지출이 아님.','hype-buyback-note'));
      const month=new Map();for(const r of this.archive.burnDaily??[]){const k=r.date.slice(0,7);month.set(k,(month.get(k)??0)+r.hype);}
      for(const [date,amount] of [...month].sort((a,b)=>b[0].localeCompare(a[0])))detail.append(el('p',`${date} · ${en?'Other recorded burns':'AF 외 기록된 소각'} ${compact(amount)} HYPE`));history.append(detail);
    }
    this.host.replaceChildren(head,grid,history);
  }
}
