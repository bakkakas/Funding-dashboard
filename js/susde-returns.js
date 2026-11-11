import {SusdeYieldPanel,DAY,yieldPath} from './susde-yield.js?v=3';
import {attachChartHover,dateTickRows} from './chart-hover.js?v=1';

const time = day => Date.parse(day + 'T00:00:00Z');
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time(day)) && new Date(time(day)).toISOString().slice(0,10) === day;
const pct = n => n == null ? '—' : `${n.toFixed(2)}%`;
export function annualizedRate(startRate, endRate, days) {
  if (![startRate,endRate,days].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)) return null;
  const value=Math.expm1(Math.log(endRate/startRate)*365/days)*100;
  return Number.isFinite(value)?value:null;
}

export function rollingAnnualized(rows, days=30) {
  const index=new Map(rows.map(r=>[r.date,r]));
  return rows.map(r=>{
    const startDate=new Date(time(r.date)-days*DAY).toISOString().slice(0,10);
    const first=index.get(startDate);
    return {...r,average:first?annualizedRate(first.rate,r.rate,days):null,startDate};
  });
}

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
    apy:annualizedRate(first.rate,end.rate,(time(end.date)-time(start))/DAY),
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
    const notice=this.loading?(en?'Checking rate history…':'교환비율 이력 확인 중…'):this.failed?(en?'Refresh failed · last valid history retained':'조회 실패 · 마지막 정상 이력 유지'):stale?(en?'Rate history update delayed':'교환비율 이력 갱신 지연'):(en?'Historical annualized rate · compounded APY':'과거 실적 기반 연이율 · 복리 연환산(APY)');
    this.host.setAttribute('aria-busy',String(this.loading));
    this.host.innerHTML=`<div class="usde-head"><div><div class="eyebrow">ETHENA · sUSDe / USDe</div><h3 id="susdeReturnsTitle">${en?'sUSDe annualized interest rate':'sUSDe 연이율 · 실제 보상 기준'}</h3><p>${en?'Annualizes the actual growth in USDe per sUSDe to help assess deposit rates. Compare with the current official APY below; neither locks in future returns.':'실제로 쌓인 보상을 연이율로 환산해 예치 이율을 가늠합니다. 아래 현재 공식 APY와 함께 보세요. 앞으로 받을 고정금리는 아닙니다.'}</p></div><button class="chip" data-yield-refresh type="button" ${this.loading?'disabled':''}>${en?'Refresh':'새로고침'}</button></div>
    <p class="usde-status ${this.failed||stale?'warning':''}" role="status">${notice}${d?` · ${en?'Through':'기준일'} ${d.through} UTC`:''}</p>
    <div class="susde-metrics">${[30,90,365].map(days=>{const r=d?returnWindow(d.rows,days):null;return `<div class="usde-change"><span>${en?`APY based on trailing ${days===365?'1 year':days+' days'}`:`최근 ${days===365?'1년':days+'일'} 기준 연이율`}</span><strong>${en?'':'연 '}${pct(r?.apy)}</strong><small>${r?`<span>${r.start.date}</span> → <span>${r.end.date}</span>`:(en?'Exact endpoint unavailable':'정확한 시작 관측값 없음')}</small></div>`;}).join('')}</div>
    <div class="usde-chart-head"><h4>${en?'Annualized rate trend · trailing 30D':'연이율 추이 · 매일 직전 30일 기준'}</h4><div class="usde-ranges" role="group" aria-label="${en?'Chart period':'조회 기간'}">${[30,90,365,0].map(days=>`<button type="button" class="chip ${!this.startDate&&days===this.range?'active':''}" data-return-range="${days}" aria-pressed="${!this.startDate&&days===this.range}">${days===0?(en?'All history':'전체 이력'):days===365?(en?'1Y':'1년'):days+(en?'D':'일')}</button>`).join('')}</div></div>
    <div class="susde-return-controls"><label>${en?'Chart start date':'조회 시작일'} <input type="date" data-return-start aria-label="${en?'Chart start date':'조회 시작일'}" ${d?`min="${d.rows[0].date}" max="${new Date(time(d.through)-DAY).toISOString().slice(0,10)}"`:''} value="${validDay(this.startDate)?this.startDate:w?.start.date??''}" ${!d?'disabled':''}></label><span>${w?`${w.start.date} → ${w.end.date} · ${w.days}${en?' days':'일'}`:''}</span></div>
    <div class="susde-chart susde-return-chart usde-chart">${this.returnChart(w,en)}</div>
    <div class="susde-return-example">${w?`<b>${en?'Selected-period annualized rate':'선택 기간 실적의 연환산 이율'} ${en?'':'연 '}${pct(w.apy)}</b><small>${en?'Assumes the same reward pace for a year; not a guaranteed rate.':'같은 보상 속도가 1년간 이어진다는 가정 · 고정금리 아님'}</small>`:(en?'Exact starting observation unavailable; choose another date.':'정확한 시작 관측값이 없습니다. 다른 날짜를 선택해 주세요.')}</div>
    <p class="usde-note">${en?'Line = each day’s trailing 30-day realized rewards, compounded to a yearly rate. Changing the chart range does not change this 30-day basis.':'그래프는 각 날짜 직전 30일의 실제 보상을 복리 연환산한 값입니다. 조회 기간을 바꿔도 30일 계산 기준은 유지됩니다.'}</p>
    <details class="susde-explanation"><summary>${en?'Calculation details & exclusions':'계산 근거와 제외 항목'}</summary><p>${en?'APY = ((end rate ÷ start rate)^(365 ÷ calendar days) − 1) × 100. Compounded annual rate, not simple APR or an average of quoted APYs. Cards use 30/90/365-day periods; the line always uses a rolling 30-day period. The selected-period summary uses the chosen start through the latest observation.':'연이율(APY) = ((종료 교환비율 ÷ 시작 교환비율)^(365 ÷ 경과 일수) − 1) × 100. 단리 APR이나 공시 APY의 평균이 아닌 복리 연환산값입니다. 카드는 30·90·365일, 그래프는 항상 직전 30일을 사용합니다. 선택 기간 요약은 선택 시작일부터 최신 관측일까지를 사용합니다.'}</p>
    <p>${en?'Uses official USDe-per-sUSDe daily observations on completed UTC dates, usually around 23:00 UTC (timestamps may differ by seconds). Excludes today. Missing endpoints are unavailable, not interpolated; gaps break the line. The earliest 30 days have no 30-day rate.':'완료된 UTC 날짜의 공식 USDe/sUSDe 교환비율 관측값(통상 UTC 23시경, 초 단위 차이 가능)을 사용하며 오늘은 제외합니다. 양 끝 관측값이 없으면 추정하지 않고 선을 끊습니다. 이력 최초 30일은 계산할 이전 값이 없습니다.'}</p>
    ${w?`<p>${en?'Start observation':'시작 관측'}: ${w.start.timestamp} · 1 sUSDe = ${w.start.rate.toFixed(8)} USDe<br>${en?'End observation':'종료 관측'}: ${w.end.timestamp} · 1 sUSDe = ${w.end.rate.toFixed(8)} USDe</p>`:''}
    <p>${en?'Excludes gas, trading fees, slippage, taxes, USDe/USD depegging, FX changes and any post-unstake cooldown. Assumes no withdrawal during the holding period. This does not measure guaranteed dollar returns or promise future rewards.':'가스비·매매 수수료·슬리피지·세금·USDe 달러 페그 변동·환율·언스테이킹 후 대기기간은 제외합니다. 기간 중 출금 없이 보유한 가정입니다. 달러 기준 확정 수익이나 미래 보상을 뜻하지 않습니다.'}</p></details>
    <p class="usde-note">${en?'Collected locally every 6h while the host is online; page checks every 5m.':'수집 기기 가동 중 6시간마다 자동 수집 · 화면은 5분마다 갱신 확인.'}${d?`<br>${en?'Last collected':'마지막 수집'} ${new Date(d.fetchedAt).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul',hour12:false})} KST`:''}</p>
    <div class="susde-sources"><a class="usde-source" href="https://app.ethena.fi/stake" target="_blank" rel="noopener noreferrer">Ethena · ${en?'Official staking app':'공식 스테이킹 앱'} ↗</a><a class="usde-source" href="https://app.ethena.fi/api/susde-price-history?range=All" target="_blank" rel="noopener noreferrer">${en?'Official rate history':'공식 교환비율 이력'} ↗</a><a class="usde-source" href="https://docs.ethena.fi/technical-design/staking-usde" target="_blank" rel="noopener noreferrer">${en?'Staking mechanics':'스테이킹 구조'} ↗</a></div>`;
    attachChartHover(this.host.querySelector('.susde-return-chart svg'),this.returnHover??[],{top:10,bottom:105});
  }
  returnChart(w,en) {
    this.returnHover=[];
    if (!w) return '<div class="usde-chart-empty">—</div>';
    const rows=rollingAnnualized(this.data.rows,30).filter(r=>r.date>=w.start.date), values=rows.map(r=>r.average).filter(v=>v!==null);
    if (!values.length) return '<div class="usde-chart-empty">—</div>';
    const low=Math.min(0,...values),high=Math.max(0,...values),padding=Math.max((high-low)*.1,.02),min=low<0?low-padding:0,max=high+padding;
    const width=this.host.clientWidth<600?Math.max(280,this.host.clientWidth-32):800,right=width-20,start=time(rows[0].date),span=Math.max(DAY,time(rows.at(-1).date)-start);
    const x=r=>65+(time(r.date)-start)/span*(right-65),y=v=>10+(max-v)/(max-min)*95;
    this.returnHover=rows.map(r=>({x:x(r),text:`${r.date} UTC\n${en?'Trailing 30D annualized rate (APY)':'직전 30일 기준 연이율(APY)'}: ${pct(r.average)}\n${r.startDate} → ${r.date}\n1 sUSDe = ${r.rate.toFixed(8)} USDe`}));
    return `<svg viewBox="0 0 ${width} 122.5" role="img" aria-label="${en?'sUSDe trailing 30D annualized rate':'sUSDe 직전 30일 기준 연이율'} ${w.start.date} – ${w.end.date}"><title>${en?'Compounded annual rate from realized rewards':'실제 보상 기반 복리 연이율'} (%)</title>${[0,.5,1].map(r=>`<line x1="65" x2="${right}" y1="${10+95*r}" y2="${10+95*r}" class="usde-gridline"/><text x="55" y="${14+95*r}" text-anchor="end">${pct(max-(max-min)*r)}</text>`).join('')}<path d="${yieldPath(rows,x,y)}" class="usde-line"/>${dateTickRows(rows,this.host.clientWidth<600?3:5).map((r,i,t)=>`<text x="${x(r)}" y="118.5" text-anchor="${i===0?'start':i===t.length-1?'end':'middle'}">${w.days<=90?r.date.slice(5):r.date.slice(2)}</text>`).join('')}</svg>`;
  }
}
