import { setupForeignHeader } from './foreign-header.js?v=3';
import { applyPageTranslations } from './page-i18n.js?v=1';

const nf = new Intl.NumberFormat('ko-KR');
const PERIODS = [['7D', 7], ['30D', 30], ['90D', 90], ['180D', 180], ['1Y', 365], ['3Y', 1095], ['5Y', 1825], ['10Y', 3650]];
let data;
let selected = '005930';
let ownershipPeriod = 'ALL';
let flowPeriod = '90D';
let tablePeriod = '30D';
let market = 'KOSPI';
let ownershipChart;
let flowChart;
let intradayChart;
let lang=localStorage.getItem('fundingDashboardLanguage')==='en'?'en':'ko';
const COPY={
  ko:{pageTitle:'외국인 수급 | Funding Dashboard',heading:'외국인 지분율 · 수급',subtitle:'삼성전자 · SK하이닉스',navForeign:'외국인 수급',navAssets:'내 자산',navSetup:'투자 셋업',foreignOwnership:'외국인 지분율',selectedCumulative:'선택 기간 누적 순매수',ownershipPrice:'외국인 지분율 · 주가',ownershipPriceNote:'지분율과 종가를 함께 비교 · 휠 확대/축소, 드래그 이동',intradayTitle:'장중 외국인 수급 지수',dailyFlowTitle:'일별 외국인 순매수·순매도 + 누적',dailyData:'일별 데이터',date:'날짜',closeChange:'종가 · 등락률',foreignNet:'외국인 순매수',foreignCumulative:'외국인 기간 누적',individualEstimated:'개인 순매수(추정)',individualCumulative:'개인 기간 누적',sourceNote:'종목 수급은 주식 수 기준이며 개인 순매수는 외국인·기관 순매수의 반대값으로 계산한 추정치라 기타법인 거래만큼 차이가 날 수 있어. 장중 지수는 코스피·코스닥 시장 전체의 누적 순매수금액(억원)이며 약 15분 간격으로 수집해. 출처: Naver Finance / KRX 기반 데이터.',buyDays:'순매수일 합계',sellDays:'순매도일 합계',netTotal:'순합계',shares:'주',ownershipAxis:'외국인 지분율(%)',closeAxis:'종가(원)',ownershipSeries:'외국인 지분율',closeSeries:'종가',kospi:'코스피',kosdaq:'코스닥',nextCollection:'다음 장중 수집부터 표시돼',asOf:'기준',foreign:'외국인',individual:'개인',institution:'기관',hundredMillion:'억원',intradayAxis:'누적 순매수금액(억원)',dayOverDay:'전 거래일 대비',latest:'최신',dailyIndividual:'당일 개인 순매수',dailyForeign:'당일 외국인 순매수',noIntraday:'수집된 장중 데이터 없음',confirmedNet:'종목 확정치 순합계',dailyNetAxis:'일별 순매수(주)',cumulativeAxis:'기간 누적(주)',dailyNetSeries:'일별 순매수·순매도',cumulativeSeries:'선택 기간 누적 순매수',loadFailed:'외국인 수급 데이터를 불러오지 못했어.'},
  en:{pageTitle:'Foreign Flow | Funding Dashboard',heading:'Foreign Ownership & Flow',subtitle:'Samsung Electronics · SK hynix',navForeign:'Foreign Flow',navAssets:'My Assets',navSetup:'Investment Setup',foreignOwnership:'Foreign ownership',selectedCumulative:'Selected-period cumulative net buying',ownershipPrice:'Foreign Ownership & Price',ownershipPriceNote:'Compare ownership and closing price · wheel to zoom, drag to pan',intradayTitle:'Intraday Investor Flow Index',dailyFlowTitle:'Daily Foreign Net Buying/Selling + Cumulative',dailyData:'Daily Data',date:'Date',closeChange:'Close · Change',foreignNet:'Foreign net buying',foreignCumulative:'Foreign cumulative',individualEstimated:'Individual net buying (est.)',individualCumulative:'Individual cumulative',sourceNote:'Stock flows are measured in shares. Individual net buying is estimated as the opposite of foreign and institutional net buying, so it may differ by corporate trading. Intraday data covers cumulative KOSPI and KOSDAQ investor flows and is collected about every 15 minutes. Source: Naver Finance / KRX-based data.',buyDays:'Buy-day total',sellDays:'Sell-day total',netTotal:'Net total',shares:' shares',ownershipAxis:'Foreign ownership (%)',closeAxis:'Close (KRW)',ownershipSeries:'foreign ownership',closeSeries:'close',kospi:'KOSPI',kosdaq:'KOSDAQ',nextCollection:'Data will appear after the next intraday collection.',asOf:'as of',foreign:'Foreign',individual:'Individuals',institution:'Institutions',hundredMillion:' KRW 100M',intradayAxis:'Cumulative net buying (KRW 100M)',dayOverDay:'vs. previous trading day',latest:'latest',dailyIndividual:'daily individual net buying',dailyForeign:'daily foreign net buying',noIntraday:'No intraday data collected',confirmedNet:'confirmed stock-flow net total',dailyNetAxis:'Daily net buying (shares)',cumulativeAxis:'Period cumulative (shares)',dailyNetSeries:'Daily net buying/selling',cumulativeSeries:'Selected-period cumulative net buying',loadFailed:'Could not load foreign-flow data.'}
};
const c=key=>COPY[lang][key] || COPY.ko[key] || key;
const stockName=stock=>lang==='en'?({'005930':'Samsung Electronics','000660':'SK hynix'}[stock.code]||stock.name):stock.name;

const tone = value => value > 0 ? 'good' : value < 0 ? 'bad' : 'warn';
const signed = value => `${value > 0 ? '+' : ''}${nf.format(value)}`;
const individualNet = row => row.individualNetSharesEstimated ?? -((row.foreignNetShares || 0) + (row.institutionNetShares || 0));
const periodDays = key => PERIODS.find(([label]) => label === key)?.[1] || null;

function filtered(rows, key) {
  const days = periodDays(key);
  if (!days || !rows.length) return rows;
  const end = new Date(`${rows.at(-1).date}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return rows.filter(row => new Date(`${row.date}T00:00:00`) >= start);
}

function totals(rows, valueFor = row => row.foreignNetShares || 0) {
  let buys = 0, sells = 0, net = 0;
  for (const row of rows) {
    const value = valueFor(row);
    net += value;
    if (value > 0) buys += value;
    else sells += Math.abs(value);
  }
  return { buys, sells, net };
}

function cumulative(rows, valueFor = row => row.foreignNetShares || 0) {
  let sum = 0;
  return rows.map(row => sum += valueFor(row));
}

function summaryText(rows) {
  const result = totals(rows);
  return `<span class="summary-item">${c('buyDays')} <strong class="summary-buy">${nf.format(result.buys)}${c('shares')}</strong></span><span class="summary-divider">·</span><span class="summary-item">${c('sellDays')} <strong class="summary-sell">${nf.format(result.sells)}${c('shares')}</strong></span><span class="summary-divider">·</span><span class="summary-item">${c('netTotal')} <strong class="summary-net ${tone(result.net)}">${signed(result.net)}${c('shares')}</strong></span>`;
}

function metric(id, text, className) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.remove('good', 'bad', 'warn');
  if (className) element.classList.add(className);
}

function tabs(id, active, items, handler, dataKey = 'period') {
  const root = document.getElementById(id);
  root.innerHTML = items.map(([key, , label]) => `<button class="chip ${key === active ? 'active' : ''}" data-${dataKey}="${key}">${label || key}</button>`).join('');
  root.onclick = event => {
    const key = event.target.dataset[dataKey];
    if (key) handler(key);
  };
}

function baseOptions(percent = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#dce8df' } },
      zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true, speed: .08 }, pinch: { enabled: true }, mode: 'x' } }
    },
    scales: {
      x: { ticks: { color: '#82958b', maxTicksLimit: 12 }, grid: { color: 'rgba(32,54,43,.45)' } },
      y: { ticks: { color: '#82958b', callback: value => percent ? `${value}%` : nf.format(value) }, grid: { color: 'rgba(32,54,43,.7)' } }
    }
  };
}

function renderOwnership(stock, rows) {
  const ownRows = filtered(rows, ownershipPeriod);
  const options = baseOptions(true);
  options.scales.y.title = { display: true, text: c('ownershipAxis'), color: '#23e7a5' };
  options.scales.y1 = { position: 'right', ticks: { color: '#f5c451', callback: value => lang==='en'?`KRW ${nf.format(value)}`:`${nf.format(value)}원` }, grid: { drawOnChartArea: false }, title: { display: true, text: c('closeAxis'), color: '#f5c451' } };
  ownershipChart?.destroy();
  ownershipChart = new Chart(document.getElementById('ownershipChart'), {
    data: {
      labels: ownRows.map(row => row.date),
      datasets: [
        { type: 'line', label: `${stockName(stock)} ${c('ownershipSeries')}`, data: ownRows.map(row => row.foreignOwnershipPct), borderColor: '#23e7a5', backgroundColor: 'rgba(35,231,165,.1)', fill: true, pointRadius: 0, borderWidth: 2, tension: .15, yAxisID: 'y' },
        { type: 'line', label: `${stockName(stock)} ${c('closeSeries')}`, data: ownRows.map(row => row.close), borderColor: '#f5c451', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.7, tension: .12, yAxisID: 'y1' }
      ]
    },
    options
  });
}

function renderIntraday() {
  tabs('marketTabs', market, [['KOSPI', null, c('kospi')], ['KOSDAQ', null, c('kosdaq')]], key => { market = key; renderIntraday(); renderTopMetrics(); }, 'market');
  const allRows = data.marketIntraday?.[market] || [];
  const latestDate = allRows.reduce((latest, row) => row.date > latest ? row.date : latest, '');
  const rows = allRows.filter(row => row.date === latestDate);
  intradayChart?.destroy();
  const summary = document.getElementById('intradaySummary');
  if (!rows.length) {
    summary.textContent = c('nextCollection');
    intradayChart = new Chart(document.getElementById('intradayChart'), { type: 'line', data: { labels: [], datasets: [] }, options: baseOptions(false) });
    return;
  }
  const latest = rows.at(-1);
  summary.innerHTML = `${latest.date} ${latest.time} ${c('asOf')} · <span class="intraday-metric intraday-foreign">${c('foreign')} <strong>${signed(latest.foreign)}${c('hundredMillion')}</strong></span> · <span class="intraday-metric intraday-individual">${c('individual')} <strong>${signed(latest.individual)}${c('hundredMillion')}</strong></span> · <span class="intraday-metric intraday-institution">${c('institution')} <strong>${signed(latest.institution)}${c('hundredMillion')}</strong></span>`;
  const options = baseOptions(false);
  options.scales.y.ticks.callback = value => `${nf.format(value)}${lang==='en'?'':'억'}`;
  options.scales.y.title = { display: true, text: c('intradayAxis'), color: '#82958b' };
  intradayChart = new Chart(document.getElementById('intradayChart'), {
    type: 'line',
    data: {
      labels: rows.map(row => `${row.date.slice(5)} ${row.time}`),
      datasets: [
        { label: c('foreign'), data: rows.map(row => row.foreign), borderColor: '#23e7a5', backgroundColor: 'rgba(35,231,165,.08)', pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#23e7a5', pointBorderColor: '#07110c', pointBorderWidth: 1.5, borderWidth: 2, tension: .15 },
        { label: c('individual'), data: rows.map(row => row.individual), borderColor: '#8ea2ff', backgroundColor: 'transparent', pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#8ea2ff', pointBorderColor: '#07110c', pointBorderWidth: 1.5, borderWidth: 1.7, tension: .15 },
        { label: c('institution'), data: rows.map(row => row.institution), borderColor: '#f5c451', backgroundColor: 'transparent', pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#f5c451', pointBorderColor: '#07110c', pointBorderWidth: 1.5, borderWidth: 1.7, tension: .15 }
      ]
    },
    options
  });
}

function renderTopMetrics() {
  const stock = data.stocks[selected];
  const rows = stock.records;
  const latest = rows.at(-1);
  const previous = rows.at(-2) || latest;
  const liveOwnership = stock.liveSnapshot?.foreignOwnershipPct ?? latest.foreignOwnershipPct;
  const intraday = data.marketIntraday?.[market] || [];
  const latestMarket = intraday.at(-1);
  const flowRows = filtered(rows, flowPeriod);
  const marketName = market === 'KOSPI' ? c('kospi') : c('kosdaq');

  metric('ownership', `${liveOwnership.toFixed(2)}%`);
  const ownershipDelta = liveOwnership - previous.foreignOwnershipPct;
  document.getElementById('ownershipChange').textContent = `${c('dayOverDay')} ${ownershipDelta >= 0 ? '+' : ''}${ownershipDelta.toFixed(2)}%p · ${c('latest')}`;
  document.getElementById('dailyIndividualLabel').textContent = `${marketName} ${c('dailyIndividual')}`;
  document.getElementById('dailyNetLabel').textContent = `${marketName} ${c('dailyForeign')}`;
  if (latestMarket) {
    metric('dailyIndividualNet', `${signed(latestMarket.individual)}${c('hundredMillion')}`, tone(latestMarket.individual));
    metric('dailyNet', `${signed(latestMarket.foreign)}${c('hundredMillion')}`, tone(latestMarket.foreign));
    const asOf = `${latestMarket.date} ${latestMarket.sourceTime || latestMarket.time} ${c('asOf')}`;
    document.getElementById('dailyIndividualDate').textContent = asOf;
    document.getElementById('dailyNetDate').textContent = asOf;
  } else {
    metric('dailyIndividualNet', '-', 'warn');
    metric('dailyNet', '-', 'warn');
    document.getElementById('dailyIndividualDate').textContent = c('noIntraday');
    document.getElementById('dailyNetDate').textContent = c('noIntraday');
  }
  const flowTotals = totals(flowRows);
  metric('rollingNet', signed(flowTotals.net), tone(flowTotals.net));
  document.getElementById('rollingPeriod').textContent = `${flowPeriod} ${c('confirmedNet')}`;
}

function render() {
  const stock = data.stocks[selected];
  const rows = stock.records;
  const latest = rows.at(-1);
  const flowRows = filtered(rows, flowPeriod);
  const tableRows = filtered(rows, tablePeriod);
  renderTopMetrics();
  document.querySelectorAll('#stockTabs button').forEach(button => button.classList.toggle('active', button.dataset.code === selected));

  tabs('ownershipPeriods', ownershipPeriod, [['ALL'], ...PERIODS], key => { ownershipPeriod = key; render(); });
  tabs('flowPeriods', flowPeriod, PERIODS, key => { flowPeriod = key; render(); });
  tabs('tablePeriods', tablePeriod, PERIODS, key => { tablePeriod = key; render(); });

  renderOwnership(stock, rows);

  const flowOptions = baseOptions(false);
  flowOptions.scales.y.title = { display: true, text: c('dailyNetAxis'), color: '#82958b' };
  flowOptions.scales.y1 = { position: 'right', ticks: { color: '#8ea2ff', callback: value => nf.format(value) }, grid: { drawOnChartArea: false }, title: { display: true, text: c('cumulativeAxis'), color: '#8ea2ff' } };
  flowChart?.destroy();
  flowChart = new Chart(document.getElementById('flowChart'), {
    data: {
      labels: flowRows.map(row => row.date),
      datasets: [
        { type: 'bar', label: c('dailyNetSeries'), data: flowRows.map(row => row.foreignNetShares), backgroundColor: flowRows.map(row => row.foreignNetShares >= 0 ? 'rgba(0,192,118,.72)' : 'rgba(240,138,138,.72)'), yAxisID: 'y' },
        { type: 'line', label: c('cumulativeSeries'), data: cumulative(flowRows), borderColor: '#8ea2ff', backgroundColor: 'rgba(142,162,255,.15)', pointRadius: 0, borderWidth: 2, tension: .12, yAxisID: 'y1' }
      ]
    },
    options: flowOptions
  });

  document.getElementById('flowSummary').innerHTML = summaryText(flowRows);
  document.getElementById('tableSummary').innerHTML = summaryText(tableRows);
  const foreignCum = cumulative(tableRows);
  const individualCum = cumulative(tableRows, individualNet);
  document.getElementById('foreignRows').innerHTML = tableRows.map((row, index) => ({ ...row, foreignCum: foreignCum[index], individualCum: individualCum[index], previousClose: rows[rows.findIndex(source => source.date === row.date) - 1]?.close })).reverse().map(row => {
    const changePct = row.previousClose ? (row.close / row.previousClose - 1) * 100 : 0;
    return `<tr><td>${row.date}</td><td>${nf.format(row.close)}<span class="price-change ${tone(changePct)}">${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%</span></td><td class="${tone(row.foreignNetShares)}">${signed(row.foreignNetShares)}</td><td class="${tone(row.foreignCum)}">${signed(row.foreignCum)}</td><td class="${tone(individualNet(row))}">${signed(individualNet(row))}</td><td class="${tone(row.individualCum)}">${signed(row.individualCum)}</td><td>${row.foreignOwnershipPct.toFixed(2)}%</td></tr>`;
  }).join('');
}

async function init() {
  setupForeignHeader({onLanguageChange:next=>{
    lang=next;
    applyPageTranslations(COPY,lang);
    if(data){
      document.getElementById('foreignUpdatedAt').textContent=`Updated: ${new Date(data.updatedAt).toLocaleString(lang==='en'?'en-US':'ko-KR',{timeZone:'Asia/Seoul'})}`;
      document.getElementById('stockTabs').innerHTML=Object.values(data.stocks).map(stock=>`<button class="chip ${stock.code===selected?'active':''}" data-code="${stock.code}">${stockName(stock)}</button>`).join('');
      render();renderIntraday();
    }
  }});
  const response = await fetch('./foreign_flow_data.json', { cache: 'no-store' });
  if (!response.ok) throw Error(response.status);
  data = await response.json();
  document.getElementById('foreignUpdatedAt').textContent = `Updated: ${new Date(data.updatedAt).toLocaleString(lang==='en'?'en-US':'ko-KR', { timeZone: 'Asia/Seoul' })}`;
  document.getElementById('stockTabs').innerHTML = Object.values(data.stocks).map(stock => `<button class="chip ${stock.code === selected ? 'active' : ''}" data-code="${stock.code}">${stockName(stock)}</button>`).join('');
  document.getElementById('stockTabs').onclick = event => {
    if (event.target.dataset.code) {
      selected = event.target.dataset.code;
      render();
    }
  };
  render();
  renderIntraday();
}

init().catch(error => {
  console.error(error);
  document.querySelector('.foreign-dashboard').insertAdjacentHTML('beforeend', `<p class="note bad">${c('loadFailed')}</p>`);
});
