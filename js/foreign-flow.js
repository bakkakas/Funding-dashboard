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
  return `<span class="summary-item">순매수일 합계 <strong class="summary-buy">${nf.format(result.buys)}주</strong></span><span class="summary-divider">·</span><span class="summary-item">순매도일 합계 <strong class="summary-sell">${nf.format(result.sells)}주</strong></span><span class="summary-divider">·</span><span class="summary-item">순합계 <strong class="summary-net ${tone(result.net)}">${signed(result.net)}주</strong></span>`;
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
  options.scales.y.title = { display: true, text: '외국인 지분율(%)', color: '#23e7a5' };
  options.scales.y1 = { position: 'right', ticks: { color: '#f5c451', callback: value => `${nf.format(value)}원` }, grid: { drawOnChartArea: false }, title: { display: true, text: '종가(원)', color: '#f5c451' } };
  ownershipChart?.destroy();
  ownershipChart = new Chart(document.getElementById('ownershipChart'), {
    data: {
      labels: ownRows.map(row => row.date),
      datasets: [
        { type: 'line', label: `${stock.name} 외국인 지분율`, data: ownRows.map(row => row.foreignOwnershipPct), borderColor: '#23e7a5', backgroundColor: 'rgba(35,231,165,.1)', fill: true, pointRadius: 0, borderWidth: 2, tension: .15, yAxisID: 'y' },
        { type: 'line', label: `${stock.name} 종가`, data: ownRows.map(row => row.close), borderColor: '#f5c451', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.7, tension: .12, yAxisID: 'y1' }
      ]
    },
    options
  });
}

function renderIntraday() {
  tabs('marketTabs', market, [['KOSPI', null, '코스피'], ['KOSDAQ', null, '코스닥']], key => { market = key; renderIntraday(); }, 'market');
  const rows = data.marketIntraday?.[market] || [];
  intradayChart?.destroy();
  const summary = document.getElementById('intradaySummary');
  if (!rows.length) {
    summary.textContent = '다음 장중 수집부터 표시돼';
    intradayChart = new Chart(document.getElementById('intradayChart'), { type: 'line', data: { labels: [], datasets: [] }, options: baseOptions(false) });
    return;
  }
  const latest = rows.at(-1);
  summary.innerHTML = `${latest.date} ${latest.time} 기준 · 외국인 <strong class="${tone(latest.foreign)}">${signed(latest.foreign)}억원</strong> · 개인 <strong class="${tone(latest.individual)}">${signed(latest.individual)}억원</strong>`;
  const options = baseOptions(false);
  options.scales.y.ticks.callback = value => `${nf.format(value)}억`;
  options.scales.y.title = { display: true, text: '누적 순매수금액(억원)', color: '#82958b' };
  intradayChart = new Chart(document.getElementById('intradayChart'), {
    type: 'line',
    data: {
      labels: rows.map(row => `${row.date.slice(5)} ${row.time}`),
      datasets: [
        { label: '외국인', data: rows.map(row => row.foreign), borderColor: '#23e7a5', backgroundColor: 'rgba(35,231,165,.08)', pointRadius: 1.5, borderWidth: 2, tension: .15 },
        { label: '개인', data: rows.map(row => row.individual), borderColor: '#8ea2ff', backgroundColor: 'transparent', pointRadius: 1.5, borderWidth: 1.7, tension: .15 },
        { label: '기관', data: rows.map(row => row.institution), borderColor: '#f5c451', backgroundColor: 'transparent', pointRadius: 1.5, borderWidth: 1.7, tension: .15 }
      ]
    },
    options
  });
}

function render() {
  const stock = data.stocks[selected];
  const rows = stock.records;
  const latest = rows.at(-1);
  const previous = rows.at(-2) || latest;
  const flowRows = filtered(rows, flowPeriod);
  const tableRows = filtered(rows, tablePeriod);
  const flowTotals = totals(flowRows);

  metric('ownership', `${latest.foreignOwnershipPct.toFixed(2)}%`);
  metric('dailyIndividualNet', signed(individualNet(latest)), tone(individualNet(latest)));
  metric('dailyNet', signed(latest.foreignNetShares), tone(latest.foreignNetShares));
  metric('rollingNet', signed(flowTotals.net), tone(flowTotals.net));
  document.getElementById('rollingPeriod').textContent = `${flowPeriod} 순합계`;
  const ownershipDelta = latest.foreignOwnershipPct - previous.foreignOwnershipPct;
  document.getElementById('ownershipChange').textContent = `전 거래일 대비 ${ownershipDelta >= 0 ? '+' : ''}${ownershipDelta.toFixed(2)}%p`;
  document.getElementById('dailyNetDate').textContent = latest.date;
  document.querySelectorAll('#stockTabs button').forEach(button => button.classList.toggle('active', button.dataset.code === selected));

  tabs('ownershipPeriods', ownershipPeriod, [['ALL'], ...PERIODS], key => { ownershipPeriod = key; render(); });
  tabs('flowPeriods', flowPeriod, PERIODS, key => { flowPeriod = key; render(); });
  tabs('tablePeriods', tablePeriod, PERIODS, key => { tablePeriod = key; render(); });

  renderOwnership(stock, rows);

  const flowOptions = baseOptions(false);
  flowOptions.scales.y.title = { display: true, text: '일별 순매수(주)', color: '#82958b' };
  flowOptions.scales.y1 = { position: 'right', ticks: { color: '#8ea2ff', callback: value => nf.format(value) }, grid: { drawOnChartArea: false }, title: { display: true, text: '기간 누적(주)', color: '#8ea2ff' } };
  flowChart?.destroy();
  flowChart = new Chart(document.getElementById('flowChart'), {
    data: {
      labels: flowRows.map(row => row.date),
      datasets: [
        { type: 'bar', label: '일별 순매수·순매도', data: flowRows.map(row => row.foreignNetShares), backgroundColor: flowRows.map(row => row.foreignNetShares >= 0 ? 'rgba(0,192,118,.72)' : 'rgba(240,138,138,.72)'), yAxisID: 'y' },
        { type: 'line', label: '선택 기간 누적 순매수', data: cumulative(flowRows), borderColor: '#8ea2ff', backgroundColor: 'rgba(142,162,255,.15)', pointRadius: 0, borderWidth: 2, tension: .12, yAxisID: 'y1' }
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
  const response = await fetch('./foreign_flow_data.json', { cache: 'no-store' });
  if (!response.ok) throw Error(response.status);
  data = await response.json();
  document.getElementById('foreignUpdatedAt').textContent = `Updated: ${new Date(data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  document.getElementById('stockTabs').innerHTML = Object.values(data.stocks).map(stock => `<button class="chip ${stock.code === selected ? 'active' : ''}" data-code="${stock.code}">${stock.name}</button>`).join('');
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
  document.querySelector('.foreign-dashboard').insertAdjacentHTML('beforeend', '<p class="note bad">외국인 수급 데이터를 불러오지 못했어.</p>');
});
