import {attachChartHover,dateTickRows} from './chart-hover.js?v=1';
const DAY=86400000;
const time=date=>Date.parse(date+'T00:00:00Z');
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
const external=(url,text)=>{const n=el('a',text);n.href=url;n.target='_blank';n.rel='noopener noreferrer';return n;};
const fmt=(n,digits=2)=>n===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(n);
const usd=n=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const compact=n=>n===null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);

export function validateUniBurns(d){
  if(d?.schemaVersion!==1||!Number.isFinite(Date.parse(d.sourceUpdatedAt))||!Number.isFinite(Date.parse(d.fetchedAt))||!Array.isArray(d.rows)||!d.rows.length)throw Error('Invalid UNI snapshot');
  let previous='';
  for(const r of d.rows){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(time(r.date))||new Date(time(r.date)).toISOString().slice(0,10)!==r.date||r.date<=previous||['uni','usdValue','price'].some(k=>r[k]!==null&&!finite(r[k]))||typeof r.partial!=='boolean')throw Error('Invalid UNI history');
    if(r.usdValue!==null&&(r.uni===null||r.price===null||Math.abs(r.usdValue-r.uni*r.price)>.01))throw Error('Invalid UNI valuation');
    previous=r.date;
  }
  if(d.through!==previous||!Array.isArray(d.chains)||!d.chains.length||d.chains.some(c=>!c.name||!finite(c.uni)))throw Error('Invalid UNI coverage');
  for(const key of ['feeSettledUni','nonFeeUni','totalDeadUni','documentedTreasuryUni','otherNonFeeUni'])if(!finite(d.mainnet?.[key]))throw Error('Invalid settlement totals');
  if(Math.abs(d.mainnet.totalDeadUni-d.mainnet.feeSettledUni-d.mainnet.nonFeeUni)>.01||Math.abs(d.mainnet.nonFeeUni-d.mainnet.documentedTreasuryUni-d.mainnet.otherNonFeeUni)>.01)throw Error('Inconsistent burn composition');
  return d;
}
export function selectUniDays(rows,days,through){const end=time(through),start=days===null?-Infinity:end-(days-1)*DAY;return rows.filter(r=>time(r.date)>=start&&time(r.date)<=end);}
export function summarizeUni(rows){
  let uni=0,value=0,missingUni=false,missingUsd=false;
  for(const r of rows){if(r.uni===null)missingUni=true;else uni+=r.uni;if(r.usdValue===null)missingUsd=true;else value+=r.usdValue;}
  return {uni:missingUni?null:uni,usdValue:missingUsd?null:value,knownUni:uni,knownUsd:value,partial:rows.some(r=>r.partial)||missingUni||missingUsd};
}
export function uniWindow(rows,days,through){const selected=selectUniDays(rows,days,through),result=summarizeUni(selected);const complete=selected.length===days&&!selected.some(r=>r.partial);return {...result,complete,uni:complete?result.uni:null,usdValue:complete?result.usdValue:null};}
export function uniAnnualized(thirtyDayValue,marketCap){return finite(thirtyDayValue)&&finite(marketCap)&&marketCap>0?thirtyDayValue*365/30/marketCap*100:null;}
export function groupUniDays(rows,unit){
  const buckets=new Map();
  for(const r of rows){const day=new Date(time(r.date));if(unit==='week')day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);if(unit==='month')day.setUTCDate(1);const key=day.toISOString().slice(0,10);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
  return [...buckets].map(([date,values])=>{const end=new Date(time(date));if(unit==='month')end.setUTCMonth(end.getUTCMonth()+1);else end.setUTCDate(end.getUTCDate()+(unit==='week'?7:1));const total=summarizeUni(values);return {date,end:new Date(+end-DAY).toISOString().slice(0,10),...total,partial:total.partial||values.length!==(end-time(date))/DAY,days:values.length};});
}
export function uniMovingAverage(rows,days){return rows.map(r=>{const w=uniWindow(rows,days,r.date);return w.usdValue===null?null:w.usdValue/days;});}

export function uniOverview(rows,allRows,en){
  const host=el('div','','hype-overview');if(!rows.length)return host;
  const ma7=uniMovingAverage(allRows,7),ma30=uniMovingAverage(allRows,30),indices=new Map(allRows.map((r,i)=>[r.date,i]));
  const start=time(rows[0].date),span=Math.max(DAY,time(rows.at(-1).date)-start),x=r=>70+(time(r.date)-start)/span*760;
  const maxUsd=Math.max(1,...rows.map(r=>r.usdValue??0))*1.08,maxPrice=Math.max(1,...rows.map(r=>r.price??0))*1.08,y=(v,max)=>240-v/max*210;
  const path=(get,max)=>{let pen=false,prior=null;return rows.map(r=>{const v=get(r);if(prior!==null&&time(r.date)-prior>DAY)pen=false;prior=time(r.date);if(v===null){pen=false;return '';}const s=`${pen?'L':'M'}${x(r).toFixed(2)},${y(v,max).toFixed(2)}`;pen=true;return s;}).join(' ');};
  host.innerHTML=`<h4>${en?'Burn valuation & UNI reference price':'소각 환산액 · UNI 기준가'}</h4><p>${en?'Left: daily burn valuation / 7d and 30d averages (USD). Right: UNI daily reference price. Not buyback execution spend.':'왼쪽: 일별 소각 환산액·7일/30일 평균 (USD) · 오른쪽: UNI 일별 기준가. 실제 매수 체결액이 아닙니다.'}</p><div class="hype-overview-plot"><svg viewBox="0 0 900 280" role="img" aria-label="UNI burn valuation and reference price">
  ${[0,.25,.5,.75,1].map(t=>`<line x1="70" x2="830" y1="${30+t*210}" y2="${30+t*210}" stroke="#ffffff12"/><text x="62" y="${34+t*210}" text-anchor="end">$${compact(maxUsd*(1-t))}</text><text x="840" y="${34+t*210}">$${fmt(maxPrice*(1-t))}</text>`).join('')}
  ${rows.filter(r=>r.usdValue!==null).map(r=>`<rect x="${x(r)-1}" y="${y(r.usdValue,maxUsd)}" width="${Math.max(1,Math.min(10,760/(span/DAY+1)*.7))}" height="${r.usdValue/maxUsd*210}" fill="#ed9fce"/>`).join('')}
  <path d="${path(r=>ma30[indices.get(r.date)],maxUsd)}" fill="none" stroke="#c7a7df" stroke-width="1.8"/><path d="${path(r=>ma7[indices.get(r.date)],maxUsd)}" fill="none" stroke="#e9db8b" stroke-width="1.8"/><path d="${path(r=>r.price,maxPrice)}" fill="none" stroke="#fff" stroke-width="2"/>
  ${dateTickRows(rows).map(r=>`<text x="${x(r)}" y="268" text-anchor="middle">${r.date.slice(2)}</text>`).join('')}</svg></div><div class="hype-chart-legend"><span style="color:#fff">━ UNI</span><span style="color:#c7a7df">━ 30${en?'d average':'일 평균'}</span><span style="color:#e9db8b">━ 7${en?'d average':'일 평균'}</span><span style="color:#ed9fce">▮ ${en?'Burn value':'소각 환산액'} USD</span></div>`;
  attachChartHover(host.querySelector('svg'),rows.map(r=>({x:x(r),text:`${r.date} UTC${r.partial?' · '+(en?'partial':'잠정'):''}\nUNI: ${fmt(r.uni)}\n${en?'Burn value':'소각 환산액'}: ${usd(r.usdValue)}\n${en?'Reference price':'기준가'}: $${fmt(r.price,4)}\n7d: ${usd(ma7[indices.get(r.date)])}\n30d: ${usd(ma30[indices.get(r.date)])}`})),{top:30,bottom:240});return host;
}

export class UniBurnPanel{
  constructor(host,fetchJson){Object.assign(this,{host,fetchJson,request:0,data:null,marketCap:null,rangeDays:30,barUnit:'day',tableUnit:'week',barValue:'usdValue',language:'ko'});}
  async setAsset(id,language,signal){
    const request=++this.request;this.language=language;this.marketCap=null;this.data=null;this.host.hidden=id!=='uni';if(this.host.hidden)return;
    this.host.replaceChildren(el('p',language==='en'?'Loading UNI burn history…':'UNI 소각 이력 불러오는 중…'));
    try{const data=validateUniBurns(await this.fetchJson('./data/uni-burns.json',{signal}));if(request!==this.request)return;this.data=data;this.render();}
    catch{if(request!==this.request)return;this.host.replaceChildren(el('p',this.language==='en'?'UNI burn data unavailable; missing is not zero.':'UNI 소각 데이터를 불러오지 못했어. 미확인은 0이 아니야.'),external('https://www.defiburn.com/burn','DeFiBurn ↗'));}
  }
  setLanguage(language){this.language=language;if(this.data&&!this.host.hidden)this.render();}
  setMarketCap(value){this.marketCap=finite(value)?value:null;if(this.data&&!this.host.hidden)this.render();}
  render(){
    const d=this.data,en=this.language==='en',all=summarizeUni(d.rows),month=uniWindow(d.rows,30,d.through),week=uniWindow(d.rows,7,d.through),annual=uniAnnualized(month.usdValue,this.marketCap);
    const head=el('div','','hype-buyback-head'),intro=el('div');intro.append(el('div','UNI FEE BURN','eyebrow'),el('h3',en?'Protocol fees → UNI burns':'프로토콜 수수료 → UNI 소각'),el('p',en?'Burn UNI to claim TokenJar assets. USD = daily recorded burns × daily reference price, not actual buyback spend.':'TokenJar 자산을 가져가려는 참여자가 UNI를 소각. USD는 일별 기록 소각량 × 일별 기준가이며 실제 매수 체결액이 아닙니다.'));head.append(intro,external('https://developers.uniswap.org/docs/protocols/protocol-fee/overview',en?'Official mechanism ↗':'공식 작동 방식 ↗'));
    const grid=el('div','','hype-buyback-metrics');
    for(const [label,value,note] of [
      [en?'Recorded fee burns':'누적 수수료 소각 기록',`${compact(all.uni)} UNI`,en?'Source-chain basis · one-time treasury burn excluded':'원천 체인 기록 기준 · 일회성 재무금고 소각 제외'],
      [en?'Cumulative burn valuation':'누적 소각 당시가 환산액',usd(all.usdValue),en?'Sum of daily UNI × reference price · not spend':'일별 UNI × 기준가의 합 · 집행 매수액 아님'],
      [en?'30d annualized value / market cap':'30일 환산액 연환산 / 시총',annual===null?'—':fmt(annual)+'%',`${usd(month.usdValue)} · ${en?'30d burn valuation, not dividend yield':'30일 소각 환산액 · 배당수익률 아님'}`]
    ]){const c=el('div','','hype-buyback-metric');c.append(el('span',label),el('strong',value),el('small',note));grid.append(c);}
    const recent=el('p',`${en?'Latest recorded day':'최근 기록일'} ${d.through} UTC · ${fmt(d.rows.at(-1).uni)} UNI / 7${en?'d':'일'} ${compact(week.uni)} UNI / 30${en?'d':'일'} ${compact(month.uni)} UNI`,'hype-buyback-note');
    const history=el('div','','hype-buyback-history');history.append(el('strong',en?'Recorded burn history':'수수료 소각 기록 추이'));
    const controls=(options,key,cls='')=>{const wrap=el('div','','hype-period-controls '+cls);for(const [value,label] of options){const b=el('button',label,'chip');b.type='button';b.classList.toggle('active',this[key]===value);b.setAttribute('aria-pressed',String(this[key]===value));b.onclick=()=>{this[key]=value;this.render();};wrap.append(b);}return wrap;};
    history.append(controls([[30,en?'30 days':'30일'],[90,en?'90 days':'90일'],[365,en?'1 year':'1년'],[null,en?'All':'전체']],'rangeDays','uni-ranges'),controls([['day',en?'Daily':'일별'],['week',en?'Weekly':'주별'],['month',en?'Monthly':'월별']],'barUnit','uni-bar-units'),controls([['usdValue',en?'Burn value (USD)':'소각 환산액 (USD)'],['uni',en?'Burned UNI':'소각 수량 (UNI)']],'barValue','uni-bar-value'));
    const rows=selectUniDays(d.rows,this.rangeDays,d.through),buckets=groupUniDays(rows,this.barUnit),max=Math.max(1,...buckets.map(r=>r[this.barValue]??0));
    const scroll=el('div','','hype-chart-scroll'),bars=el('div','','hype-daily-bars');bars.style.minWidth=`${Math.max(300,buckets.length*30)}px`;
    for(const r of buckets){const b=el('div','','hype-daily-bar'),fill=el('i'),value=r[this.barValue];fill.style.height=`${(value??0)/max*100}%`;if(value===null||value===0)fill.style.minHeight='0';fill.tabIndex=0;fill.title=`${r.date}${r.end!==r.date?' ~ '+r.end:''} UTC${r.partial?' · '+(en?'partial':'일부 기간'):''}\nUNI: ${fmt(r.uni)}\n${en?'Burn valuation':'소각 환산액'}: ${usd(r.usdValue)}`;fill.setAttribute('aria-label',fill.title);fill.onclick=()=>{tip.textContent=fill.title;};fill.onfocus=fill.onclick;fill.onpointerenter=fill.onclick;fill.style.background='#ed9fce';b.append(fill,el('small',this.barUnit==='month'?r.date.slice(2,7):r.date.slice(5)));bars.append(b);}
    const tip=el('p',en?'Tap, hover or focus a bar for details.':'막대를 터치·가리키거나 키보드로 선택하면 상세 값을 표시.','hype-buyback-note uni-bar-tooltip');tip.style.whiteSpace='pre-line';tip.setAttribute('aria-live','polite');scroll.append(bars);history.append(scroll,tip,uniOverview(rows,d.rows,en));
    history.append(controls([['week',en?'Weekly table':'주별 표'],['month',en?'Monthly table':'월별 표']],'tableUnit','uni-table-units'));
    const table=el('table','','hype-period-table'),thead=el('thead'),th=el('tr');for(const label of [en?'Period (UTC)':'기간 (UTC)','UNI',en?'Burn valuation (USD)':'소각 당시가 환산액 (USD)'])th.append(el('th',label));thead.append(th);table.append(thead);const tbody=el('tbody');
    for(const r of groupUniDays(rows,this.tableUnit).reverse()){const tr=el('tr');tr.append(el('td',(this.tableUnit==='month'?r.date.slice(0,7):r.date+' ~ '+r.end)+(r.partial?(en?' · partial':' · 일부'):'')),el('td',fmt(r.uni)),el('td',usd(r.usdValue)));tbody.append(tr);}table.append(tbody);const ts=el('div','','hype-table-scroll');ts.append(table);history.append(ts,el('p',`${rows[0]?.date??'—'} ~ ${rows.at(-1)?.date??'—'} · ${en?'UTC calendar periods; unfinished or range-clipped periods marked partial. Missing days/values are not interpolated or treated as zero.':'UTC 달력 기준 · 미완료·선택범위에 걸친 기간은 일부 표시. 누락일·미확인 값은 보간하거나 0으로 채우지 않음.'}`,'hype-buyback-note'));
    const details=el('div','','uni-burn-details');details.append(el('h4',en?'Mainnet settlement & one-off burn (separate basis)':'메인넷 정산·일회성 소각 (별도 집계 기준)'));
    details.append(el('p',`${en?'Documented treasury one-off':'확인된 재무금고 일회성'}: ${fmt(d.mainnet.documentedTreasuryUni,0)} UNI · 2025-12-28\n${en?'Other non-fee balance':'그 외 비수수료 소각주소 잔액'}: ${fmt(d.mainnet.otherNonFeeUni)} UNI\n${en?'Fee burns settled on mainnet':'메인넷 정산된 수수료 소각'}: ${fmt(d.mainnet.feeSettledUni)} UNI\n${en?'Mainnet dead-address total':'메인넷 소각주소 총량'}: ${fmt(d.mainnet.totalDeadUni)} UNI`,'uni-composition'));
    details.append(el('p',en?'Do not add source-chain burns to mainnet settlements: they include the same UNI at different times (cross-chain settlement may lag 1–7 days). The source labels the non-fee bucket treasury; only 100M is classified here as the documented one-off, with the remainder kept separate. These are dead-address/recorded burns, not a measurement of the ERC-20 totalSupply counter or net issuance.':'원천 체인 소각과 메인넷 정산은 같은 UNI를 다른 시점에 기록하므로 더하지 않습니다(크로스체인 정산 1~7일 지연 가능). 원천의 비수수료 분류 중 공식 일회성 1억 개만 분리하고 나머지는 별도 표시. 소각주소·소각 기록 기준이며 ERC-20 totalSupply 함수 감소나 순발행 측정값이 아닙니다.','hype-buyback-note'));
    const chains=el('div','','uni-chain-list');for(const c of d.chains){const r=el('span',`${c.name}: ${compact(c.uni)} UNI`);chains.append(r);}details.append(el('h4',en?'Source-chain cumulative recorded burns':'원천 체인별 누적 소각 기록'),chains);
    const links=el('div','','hype-source-links');links.append(external('https://www.defiburn.com/burn','DeFiBurn ↗'),external('https://etherscan.io/token/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984?a=0x000000000000000000000000000000000000dead',en?'Mainnet burn address ↗':'메인넷 소각주소 ↗'),external('https://blog.uniswap.org/unification','UNIfication ↗'));details.append(links);
    if(d.settlements?.length){details.append(el('h4',en?'Recent mainnet settlement evidence':'최근 메인넷 정산 근거'));const list=el('div','','hype-source-links');for(const e of d.settlements.slice(0,4))list.append(external('https://etherscan.io/tx/'+e.txHash,`${e.ts.slice(0,10)} · ${e.chain} · ${fmt(e.uniAmount)} UNI ↗`));details.append(list);}
    const stale=Date.now()-Date.parse(d.sourceUpdatedAt)>48*3600000||Date.now()-time(d.through)>3*DAY;
    const note=el('p',`${stale?(en?'⚠ Stale data · ':'⚠ 데이터 지연 · '):''}${en?'Third-party source, not an independent full-chain audit. Source update':'제3자 집계 · 전체 온체인 독립 감사 아님. 원본 갱신'}: ${new Date(d.sourceUpdatedAt).toISOString().slice(0,16).replace('T',' ')} UTC · ${en?'Scheduled every 2h; last valid snapshot retained on failure.':'2시간마다 갱신 예정 · 실패 시 마지막 정상값 유지.'}`,'hype-buyback-note');
    this.host.replaceChildren(head,grid,recent,history,details,note);
  }
}
