import {SusdeYieldPanel,DAY,yieldPath} from './susde-yield.js?v=3';
import {attachChartHover,dateTickRows} from './chart-hover.js?v=1';

const time = day => Date.parse(day + 'T00:00:00Z');
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time(day)) && new Date(time(day)).toISOString().slice(0,10) === day;
const pct = n => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmt = n => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

export function validateSusdeReturns(data, now = Date.now()) {
  if (data?.schemaVersion !== 1 || data.asset !== 'sUSDe' || data.unit !== 'USDe per sUSDe' || !Number.isFinite(Date.parse(data.fetchedAt)) || Date.parse(data.fetchedAt) > now + 300000 || !Array.isArray(data.rows) || !data.rows.length) throw Error('Invalid rate snapshot');
  let previous = '';
  for (const r of data.rows) {
    if (!validDay(r.date) || r.date <= previous || time(r.date) >= time(new Date(now).toISOString().slice(0,10)) || typeof r.rate !== 'number' || !Number.isFinite(r.rate) || r.rate <= 0 || !Number.isFinite(Date.parse(r.timestamp)) || new Date(r.timestamp).toISOString().slice(0,10) !== r.date) throw Error('Invalid rate history');
    previous = r.date;
  }
  if (data.through !== previous) throw Error('Misaligned rate history');
  return data;
}

// N days requires endpoints N days apart, i.e. N+1 daily observations if complete.
// Missing endpoints are unavailable; no interpolation or substitution with APY.
export function returnWindow(rows, days = 0, startDate = null) {
  if (!rows.length) return null;
  const end = rows.at(-1);
  const start = startDate ?? (days ? new Date(time(end.date)-days*DAY).toISOString().slice(0,10) : rows[0].date);
  const first = rows.find(r => r.date === start);
  if (!first || start >= end.date) return null;
  const selected = rows.filter(r=>r.date >= start);
  return {start:first,end,days:(time(end.date)-time(start))/DAY,
    value:(end.rate/first.rate-1)*100,
    rows:selected.map(r=>({...r,average:(r.rate/first.rate-1)*100}))};
}

export class SusdeReturnsPanel extends SusdeYieldPanel {
  constructor(host) {
    super(host,{validate:validateSusdeReturns,url:'./data/susde-returns.json'});
    this.range = 365;
    this.startDate = null;
    host.addEventListener('click',event=>{
      const button=event.target.closest('[data-return-range]');
      if (button) { this.range=Number(button.dataset.returnRange); this.startDate=null; this.render(); }
    });
    host.addEventListener('change',event=>{
      if (event.target.matches('[data-return-start]')) { this.startDate=event.target.value || null; this.render(); }
    });
  }
  render() {
    const en=this.language==='en', d=this.data;
    const w=d?returnWindow(d.rows,this.range,this.startDate):null;
    const stale=d && (Date.now()-time(d.through)>3*DAY || Date.now()-Date.parse(d.fetchedAt)>2*DAY);
    const notice=this.loading?(en?'Checking rate history…':'교환비율 이력 확인 중…'):this.failed?(en?'Refresh failed · last valid history retained':'조회 실패 · 마지막 정상 이력 유지'):stale?(en?'Rate history update delayed':'교환비율 이력 갱신 지연'):(en?'Historical holding return · not annualized APY':'과거 보유 수익률 · 연환산 APY 아님');
    this.host.setAttribute('aria-busy',String(this.loading));
    this.host.innerHTML=`<div class="usde-head"><div><div class="eyebrow">ETHENA · sUSDe / USDe</div><h3 id="susdeReturnsTitle">${en?'Realized staking growth · USDe basis':'실제 누적 수익률 · USDe 기준'}</h3><p>${en?'Growth in the USDe redeemable per sUSDe, assuming continuous holding. Not your personal trading P&L.':'sUSDe를 계속 보유했을 때 실제 교환가치가 늘어난 비율입니다. 개인 매매손익은 아닙니다.'}</p></div><button class="chip" data-yield-refresh type="button" ${this.loading?'disabled':''}>${en?'Refresh':'새로고침'}</button></div>
    <p class="usde-status ${this.failed||stale?'warning':''}" role="status">${notice}${d?` · ${en?'Through':'기준일'} ${d.through} UTC`:''}</p>
    <div class="susde-metrics">${[30,90,365].map(days=>{const r=d?returnWindow(d.rows,days):null;return `<div class="usde-change"><span>${en?`Trailing ${days===365?'1 year':days+' days'} return`:`최근 ${days===365?'1년':days+'일'} 실제 수익률`}</span><strong>${pct(r?.value)}</strong><small>${r?`<span>${r.start.date}</span> → <span>${r.end.date}</span>`:(en?'Exact endpoint unavailable':'정확한 시작 관측값 없음')}</small></div>`;}).join('')}</div>
    <div class="usde-chart-head"><h4>${en?'Cumulative return from selected start':'선택 시작일 대비 누적 수익률'}</h4><div class="usde-ranges" role="group" aria-label="${en?'Holding period':'보유 기간'}">${[30,90,365,0].map(days=>`<button type="button" class="chip ${!this.startDate&&days===this.range?'active':''}" data-return-range="${days}" aria-pressed="${!this.startDate&&days===this.range}">${days===0?(en?'All history':'전체 이력'):days===365?(en?'1Y':'1년'):days+(en?'D':'일')}</button>`).join('')}</div></div>
    <div class="susde-return-controls"><label>${en?'Choose a start date':'시작일 직접 선택'} <input type="date" data-return-start aria-label="${en?'Holding start date':'보유 시작일'}" ${d?`min="${d.rows[0].date}" max="${new Date(time(d.through)-DAY).toISOString().slice(0,10)}"`:''} value="${validDay(this.startDate)?this.startDate:w?.start.date??''}" ${!d?'disabled':''}></label><span>${w?`${w.start.date} → ${w.end.date} · ${w.days}${en?' days':'일'}`:''}</span></div>
    <div class="susde-chart susde-return-chart usde-chart">${this.returnChart(w,en)}</div>
    <div class="susde-return-example">${w?`<b>${en?'Selected period return':'선택 기간 수익률'} ${pct(w.value)}</b><span>${en?'10,000 USDe held':'10,000 USDe 보유 가정'} → <strong>${fmt(10000*(1+w.value/100))} USDe</strong></span><small>${en?'Growth':'증가분'} ${fmt(10000*w.value/100)} USDe · ${en?'Before costs':'비용 차감 전'}</small>`:(en?'No exact starting observation for this period. Choose another date; missing values are not estimated.':'해당 기간의 정확한 시작 관측값이 없습니다. 다른 날짜를 선택해 주세요. 누락값을 추정하지 않습니다.')}</div>
    <p class="usde-note">${en?'Formula: (end USDe per sUSDe ÷ start USDe per sUSDe − 1) × 100. Uses official daily observations on completed UTC dates (typically around 23:00 UTC), not daily averages. Excludes today’s partial data; endpoint timestamps may differ by seconds. Gaps break the line; endpoint returns remain measurable.':'계산: (종료 교환비율 ÷ 시작 교환비율 − 1) × 100. 완료된 UTC 날짜의 공식 관측값(통상 UTC 23시경)을 사용하며 일평균이 아닙니다. 오늘의 부분 데이터는 제외하고, 관측 시각에는 초 단위 차이가 있습니다. 누락일은 선을 끊으며, 양 끝값이 있으면 기간 수익률은 계산됩니다.'}</p>
    <details class="susde-explanation"><summary>${en?'Calculation details & exclusions':'계산 근거와 제외 항목'}</summary><p>${en?'This is the historical growth of a fixed sUSDe balance, calculated from Ethena’s official app rate-history series—not accumulated quoted APYs or the DEX market price. All history means the available record, not a claim about your purchase date.':'고정된 sUSDe 수량의 교환가치가 늘어난 정도를 Ethena 공식 앱의 교환비율 이력으로 계산합니다. 공시 APY를 누적하거나 DEX 시장가격을 사용하지 않습니다. 전체 이력은 확보된 기록의 전체이며 개인 매수일부터의 수익률이 아닙니다.'}</p>
    ${w?`<p>${en?'Start observation':'시작 관측'}: ${w.start.timestamp} · 1 sUSDe = ${w.start.rate.toFixed(8)} USDe<br>${en?'End observation':'종료 관측'}: ${w.end.timestamp} · 1 sUSDe = ${w.end.rate.toFixed(8)} USDe</p>`:''}
    <p>${en?'Excludes gas, trading fees, slippage, taxes, USDe/USD depegging, FX changes and any post-unstake cooldown. Assumes no withdrawal during the holding period. This does not measure guaranteed dollar returns or promise future rewards.':'가스비·매매 수수료·슬리피지·세금·USDe 달러 페그 변동·환율·언스테이킹 후 대기기간은 제외합니다. 기간 중 출금 없이 보유한 가정입니다. 달러 기준 확정 수익이나 미래 보상을 뜻하지 않습니다.'}</p></details>
    <p class="usde-note">${en?'Collected locally every 6h while the host is online; page checks every 5m.':'수집 기기 가동 중 6시간마다 자동 수집 · 화면은 5분마다 갱신 확인.'}${d?`<br>${en?'Last collected':'마지막 수집'} ${new Date(d.fetchedAt).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul',hour12:false})} KST`:''}</p>
    <div class="susde-sources"><a class="usde-source" href="https://app.ethena.fi/stake" target="_blank" rel="noopener noreferrer">Ethena · ${en?'Official staking app':'공식 스테이킹 앱'} ↗</a><a class="usde-source" href="https://app.ethena.fi/api/susde-price-history?range=All" target="_blank" rel="noopener noreferrer">${en?'Official rate history':'공식 교환비율 이력'} ↗</a><a class="usde-source" href="https://docs.ethena.fi/technical-design/staking-usde" target="_blank" rel="noopener noreferrer">${en?'Staking mechanics':'스테이킹 구조'} ↗</a></div>`;
    attachChartHover(this.host.querySelector('.susde-return-chart svg'),this.returnHover??[]);
  }
  returnChart(w,en) {
    this.returnHover=[];
    if (!w) return '<div class="usde-chart-empty">—</div>';
    const {rows}=w, values=rows.map(r=>r.average);
    const low=Math.min(0,...values),high=Math.max(0,...values),padding=Math.max((high-low)*.1,.02),min=low<0?low-padding:0,max=high+padding;
    const width=this.host.clientWidth<600?Math.max(280,this.host.clientWidth-32):800,right=width-20,start=time(rows[0].date),span=Math.max(DAY,time(rows.at(-1).date)-start);
    const x=r=>65+(time(r.date)-start)/span*(right-65),y=v=>20+(max-v)/(max-min)*190;
    this.returnHover=rows.map(r=>({x:x(r),text:`${r.date} UTC\n${en?'Cumulative return':'누적 수익률'}: ${pct(r.average)}\n1 sUSDe = ${r.rate.toFixed(8)} USDe\n10,000 USDe → ${fmt(10000*r.rate/w.start.rate)} USDe`}));
    return `<svg viewBox="0 0 ${width} 245" role="img" aria-label="${en?'sUSDe cumulative holding return':'sUSDe 누적 보유 수익률'} ${w.start.date} – ${w.end.date}"><title>${en?'Realized USDe growth, not APY':'USDe 실제 증가율, APY 아님'} (%)</title>${[0,.5,1].map(r=>`<line x1="65" x2="${right}" y1="${20+190*r}" y2="${20+190*r}" class="usde-gridline"/><text x="55" y="${24+190*r}" text-anchor="end">${pct(max-(max-min)*r)}</text>`).join('')}<path d="${yieldPath(rows,x,y)}" class="usde-line"/>${dateTickRows(rows,this.host.clientWidth<600?3:5).map((r,i,t)=>`<text x="${x(r)}" y="237" text-anchor="${i===0?'start':i===t.length-1?'end':'middle'}">${w.days<=90?r.date.slice(5):r.date.slice(2)}</text>`).join('')}</svg>`;
  }
}
