import {fetchJson} from './research-data.js?v=1';
import {attachChartHover,dateTickRows} from './chart-hover.js?v=1';

export const DAY = 86400000;
const time = day => Date.parse(day + 'T00:00:00Z');
const validDate = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time(day)) && new Date(time(day)).toISOString().slice(0,10) === day;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const pct = value => value === null || value === undefined ? '—' : `${value.toFixed(2)}%`;

export function movingYield(rows, days = 7) {
  const index = new Map(rows.map(row => [time(row.date), row.apy]));
  return rows.map(row => {
    const values = Array.from({length: days}, (_,i) => index.get(time(row.date) - i * DAY));
    return {...row, average: values.every(finite) ? values.reduce((a,b) => a+b, 0) / days : null};
  });
}

export function validateSusdeYield(d, now = Date.now()) {
  if (d?.schemaVersion !== 1 || d.asset !== 'sUSDe' || d.seriesName !== 'sUSDe Yield' || !Number.isFinite(Date.parse(d.fetchedAt)) || Date.parse(d.fetchedAt) > now + 300000 || !Array.isArray(d.rows) || !d.rows.length) throw Error('Invalid sUSDe snapshot');
  let previous = '';
  for (const row of d.rows) {
    if (!validDate(row.date) || row.date <= previous || time(row.date) > now + 300000 || !finite(row.apy)) throw Error('Invalid sUSDe history');
    previous = row.date;
  }
  for (const key of ['apy','avg30d','avg90d']) {
    const m = d.current?.[key];
    if (!validDate(m?.date) || time(m.date) > now + 300000 || !finite(m.value) || m.value < 0) throw Error('Invalid published APY');
  }
  if (d.through !== previous || d.current.apy.date !== previous) throw Error('Misaligned APY dates');
  const last = movingYield(d.rows).at(-1).average;
  if (last === null || Math.abs(last - d.current.apy.value) > .02) throw Error('Unreconciled APY');
  return d;
}

export function selectYieldRows(rows, days) {
  const end = time(rows.at(-1)?.date);
  return rows.filter(row => !days || time(row.date) >= end - (days-1)*DAY);
}

export function yieldStatus(d, now = Date.now()) {
  return {sourceStale: !d || now - time(d.current.apy.date) > 10*DAY,
    collectionStale: !d || now - Date.parse(d.fetchedAt) > 2*DAY};
}

export function yieldPath(rows, x, y) {
  let previous = null, pen = false;
  return rows.map(row => {
    if (previous !== null && time(row.date) - previous > DAY) pen = false;
    previous = time(row.date);
    if (row.average === null) { pen = false; return ''; }
    const segment = `${pen ? 'L' : 'M'}${x(row).toFixed(2)},${y(row.average).toFixed(2)}`;
    pen = true;
    return segment;
  }).join(' ');
}

export class SusdeYieldPanel {
  constructor(host) {
    Object.assign(this,{host,data:null,language:'ko',range:90,version:0,loading:false,failed:false,lastChecked:0});
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width && width !== this.hostWidth) { this.hostWidth = width; if (!host.hidden) this.render(); }
    });
    this.resizeObserver.observe(host);
    host.addEventListener('click', event => {
      const range = event.target.closest('[data-yield-range]');
      if (range) { this.range = Number(range.dataset.yieldRange); this.render(); }
      if (event.target.closest('[data-yield-refresh]')) void this.refresh();
    });
    setInterval(() => { if (!host.hidden && !document.hidden) void this.refresh(); },300000);
    document.addEventListener('visibilitychange', () => {
      if (!host.hidden && !document.hidden && Date.now()-this.lastChecked >= 300000) void this.refresh();
    });
  }
  setAsset(id,language,signal) {
    this.controller?.abort(); this.version++; this.loading = false;
    this.language = language; this.signal = signal; this.host.hidden = id !== 'ena';
    if (this.host.hidden) return;
    this.render();
    if (!this.data || Date.now()-this.lastChecked >= 300000) void this.refresh();
  }
  setLanguage(language) { this.language = language; if (!this.host.hidden) this.render(); }
  async refresh() {
    if (this.host.hidden || this.loading || this.signal?.aborted) return;
    const version = this.version; this.controller = new AbortController();
    const signal = this.signal ? AbortSignal.any([this.signal,this.controller.signal]) : this.controller.signal;
    this.loading = true; this.render();
    try {
      const data = validateSusdeYield(await fetchJson(`./data/susde-yield.json?v=${Math.floor(Date.now()/300000)}`,{signal}));
      if (version !== this.version || signal.aborted) return;
      if (this.data && (data.through < this.data.through || data.fetchedAt < this.data.fetchedAt)) throw Error('Regressed snapshot');
      this.data = data; this.failed = false; this.lastChecked = Date.now();
    } catch {
      if (version === this.version && !signal.aborted) this.failed = true;
    } finally {
      if (version === this.version) { this.loading = false; this.render(); }
    }
  }
  render() {
    const en = this.language === 'en', d = this.data, status = yieldStatus(d);
    const stamp = value => new Date(value).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul',hour12:false});
    const title = en ? 'sUSDe staking rewards' : 'sUSDe 스테이킹 보상률';
    const notice = this.loading ? (en?'Checking latest snapshot…':'최신 데이터 확인 중…') : this.failed ? (en?'Refresh failed · last valid snapshot retained':'조회 실패 · 마지막 정상 데이터 유지') : status.collectionStale ? (en?'Collection delayed':'수집 지연') : status.sourceStale ? (en?'Official update delayed':'공식 갱신 지연') : (en?'Latest published APY · variable, not guaranteed':'최신 공식 공시 APY · 변동형, 보장 수익 아님');
    this.host.setAttribute('aria-busy',String(this.loading));
    this.host.innerHTML = `<div class="usde-head"><div><div class="eyebrow">ETHENA · sUSDe</div><h3 id="susdeYieldTitle">${title}</h3><p>${en?'Hold sUSDe to accrue rewards. Simply holding USDe does not earn these rewards.':'USDe를 스테이킹한 sUSDe의 보상률. USDe 단순 보유에는 이 보상이 붙지 않습니다.'}</p></div><button class="chip" data-yield-refresh type="button" ${this.loading?'disabled':''}>${en?'Refresh':'새로고침'}</button></div>
    <p role="status" class="usde-status ${this.failed || status.collectionStale || status.sourceStale ? 'warning':''}">${notice}${d?` · ${en?'Official as of':'공식 기준일'} ${d.current.apy.date}`:''}</p>
    <div class="susde-metrics">${[['apy',en?'Latest official APY':'현재 공식 APY'],['avg30d',en?'Official 30D average APY':'공식 30일 평균 APY'],['avg90d',en?'Official 90D average APY':'공식 90일 평균 APY']].map(([key,label])=>`<div class="usde-change"><span>${label}</span><strong>${pct(d?.current[key]?.value)}</strong><small>${d?.current[key]?.date??'—'} · ${en?'Annualized, not period return':'연환산 · 해당 기간 수익률 아님'}</small></div>`).join('')}</div>
    <div class="usde-chart-head"><h4>${en?'Recent APY trend · reconstructed 7D mean':'보상률 추이 · 7일 평균 재구성'}</h4><div class="usde-ranges" role="group" aria-label="${en?'APY chart period':'APY 차트 기간'}">${[7,30,90,365,0].map(days=>`<button type="button" class="chip ${days===this.range?'active':''}" data-yield-range="${days}" aria-pressed="${days===this.range}">${days===0?(en?'All':'전체'):days===365?(en?'1Y':'1년'):days+(en?'D':'일')}</button>`).join('')}</div></div>
    <div class="susde-chart usde-chart">${this.chart(en)}</div>
    <p class="usde-note">${en?'Line: 7-calendar-day arithmetic mean of Ethena’s daily “sUSDe Yield” series; not cumulative returns. Missing days are not filled. Latest mean reconciles to the published APY; historical means are reconstructed, not archived APY announcements.':'선: Ethena 일별 ‘sUSDe Yield’의 7일 산술평균 · 누적 수익률이 아닙니다. 누락일은 채우지 않습니다. 최신 평균은 공시 APY와 대조하며, 과거 평균은 당시 공시값의 저장본이 아닌 재구성 값입니다.'}</p>
    <details class="susde-explanation"><summary>${en?'How is the rewards rate determined?':'보상률은 어떻게 정해지나요?'}</summary>
      <ol><li><b>${en?'Backing assets generate revenue':'담보자산 운용에서 수익 발생'}</b><p>${en?'Funding and basis spreads, DeFi / institutional lending, RWA yields and stablecoin rewards. A positive funding rate generally pays the short hedge; negative funding can reduce revenue.':'펀딩·베이시스, DeFi·기관 대출, RWA 수익, 스테이블코인 보상 등이 재원입니다. 양수 펀딩은 보통 숏 헤지 포지션의 수익이 되고, 음수 펀딩은 수익을 낮출 수 있습니다.'}</p></li>
      <li><b>${en?'A discretionary amount is allocated to stakers':'스테이커에게 배분할 보상액 결정'}</b><p>${en?'The Foundation’s subsidiary calculates APY weekly. The distributed amount and staked USDe balance both affect the rate. Not all protocol revenue must be paid to sUSDe; the deposited USDe itself is not lent out by the staking vault.':'재단 자회사가 주간 정산으로 보상률을 계산합니다. 배분액과 스테이킹된 USDe 규모가 함께 영향을 줍니다. 프로토콜 수익 전액이 반드시 sUSDe에 지급되는 것은 아니며, 스테이킹 금고에 맡긴 USDe 자체를 대출하는 구조도 아닙니다.'}</p></li>
      <li><b>${en?'USDe rewards increase the redemption value of sUSDe':'USDe 보상이 sUSDe의 교환가치에 누적'}</b><p>${en?'Rewards for the preceding week are paid in smaller installments the following week. APY uses weekly compounding: (1 + weekly return)^52 − 1. Your sUSDe token count need not increase; the USDe redeemable per token grows.':'전주분 보상을 다음 주에 나누어 지급합니다. APY는 주간 복리를 반영한 연환산값으로, 개념적으로 (1 + 주간 수익률)^52 − 1입니다. sUSDe 개수가 늘기보다 1개로 돌려받는 USDe가 늘어납니다.'}</p></li></ol>
      <p>${en?'Rewards may fall to zero. A quoted 5% APY is neither a fixed one-year rate nor a guarantee of dollar principal. Raw historical yield data can be negative; those observations are retained and do not mean rewards were deducted from the staking vault. “Indicative sUSDe APY” is a different series and is not mixed into this chart.':'보상은 0이 될 수 있습니다. APY 5%는 1년 고정금리나 달러 원금 보장을 뜻하지 않습니다. 과거 원천 수익률의 음수도 보존하며, 이는 스테이킹 금고에서 보상이 차감됐다는 뜻이 아닙니다. 별도 지표인 ‘Indicative sUSDe APY’는 이 차트에 섞지 않습니다.'}</p>
    </details>
    <p class="usde-note">${en?'Local collection every 6h while the host is available; screen checks every 5m. Source APY updates separately.':'수집 기기 가동 중 6시간 주기 자동 수집 · 화면에서 5분마다 갱신 확인. 공식 APY 갱신은 별도이며 기기 오프라인 시 수집이 지연됩니다.'}${d?`<br>${en?'Last collected':'마지막 수집'} ${stamp(d.fetchedAt)} KST`:''}</p>
    <div class="susde-sources"><a class="usde-source" href="https://app.ethena.fi/dashboards/market-data" target="_blank" rel="noopener noreferrer">Ethena · ${en?'Official dashboard':'공식 대시보드'} ↗</a><a class="usde-source" href="https://docs.ethena.fi/protocol-overview/rewards-mechanism" target="_blank" rel="noopener noreferrer">${en?'Rewards mechanism':'보상 계산 방식'} ↗</a><a class="usde-source" href="https://docs.ethena.fi/backing-assets/protocol-revenue" target="_blank" rel="noopener noreferrer">${en?'Revenue sources':'수익 재원'} ↗</a></div>`;
    attachChartHover(this.host.querySelector('.susde-chart svg'),this.hoverPoints??[]);
  }
  chart(en) {
    this.hoverPoints = [];
    if (!this.data) return `<div class="usde-chart-empty">${this.failed?(en?'APY data unavailable':'보상률 데이터 미확인'):'—'}</div>`;
    const rows = selectYieldRows(movingYield(this.data.rows),this.range), values = rows.map(r=>r.average).filter(finite);
    if (!values.length) return '<div class="usde-chart-empty">—</div>';
    const low = Math.min(...values), high = Math.max(...values), padding = Math.max((high-low)*.15,.25);
    const min = low < 0 ? low-padding : Math.max(0,low-padding), max = high+padding;
    const start = time(rows[0].date), span = Math.max(DAY,time(rows.at(-1).date)-start);
    const width = this.host.clientWidth < 600 ? 440 : 800, right = width-20;
    const x = row => 65+(time(row.date)-start)/span*(right-65), y = value => 20+(max-value)/(max-min)*190;
    this.hoverPoints = rows.map(row=>({x:x(row),text:`${row.date} UTC\n${en?'7D mean APY':'7일 평균 APY'}: ${pct(row.average)}\n${en?'Source daily yield (not daily return)':'원천 일별 연환산 수익률 (일 수익률 아님)'}: ${pct(row.apy)}`}));
    return `<svg viewBox="0 0 ${width} 245" role="img" aria-label="${en?'sUSDe 7-day average APY':'sUSDe 7일 평균 APY'}: ${rows[0].date} – ${rows.at(-1).date}"><title>sUSDe APY (%)</title>
    ${[0,.5,1].map(r=>`<line x1="65" x2="${right}" y1="${20+190*r}" y2="${20+190*r}" class="usde-gridline"/><text x="55" y="${24+190*r}" text-anchor="end">${pct(max-(max-min)*r)}</text>`).join('')}
    <path d="${yieldPath(rows,x,y)}" class="usde-line"/>
    ${rows.filter(r=>r.average!==null).length===1?`<circle cx="${x(rows.find(r=>r.average!==null))}" cy="${y(values[0])}" r="3" fill="var(--accent)"/>`:''}
    ${dateTickRows(rows).map((row,i,ticks)=>`<text x="${x(row)}" y="237" text-anchor="${i===0?'start':i===ticks.length-1?'end':'middle'}">${this.range&&this.range<=90?row.date.slice(5):row.date.slice(2,7)}</text>`).join('')}</svg>`;
  }
}
