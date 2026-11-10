const markets = ['KOSPI', 'KOSDAQ'];
const periods = [['30D', 30], ['90D', 90], ['1Y', 365], ['3Y', 1096], ['5Y', 1827], ['10Y', 3653], ['ALL', null]];
const selected = { KOSPI: '1Y', KOSDAQ: '1Y' };
const charts = {};
let snapshot;
let failed = false;
let language = 'ko';
const nf = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function renderCreditCharts(lang = language) {
  language = lang;
  const en = lang === 'en';
  for (const market of markets) {
    const name = en ? market : market === 'KOSPI' ? '코스피' : '코스닥';
    const title = `${name} ${en ? 'Margin Loan Balance' : '신용융자 잔고'}`;
    document.getElementById(`creditTitle${market}`).textContent = title;
    const summary = document.getElementById(`creditSummary${market}`);
    const note = document.getElementById(`creditNote${market}`);
    note.textContent = en
      ? 'Outstanding margin loans, not short lending or collateral loans. Unit: KRW trillion. Daily data; checked once daily at 20:17 KST. Publication may lag the trading day.'
      : '주식 매수용 신용거래융자 잔고 · 신용대주·담보융자 제외 · 단위: 조원. 일별 자료를 매일 20:17에 확인하며, 공표 시차가 있어 당일 자료는 없을 수 있습니다.';
    if (!snapshot) {
      summary.textContent = failed ? (en ? 'Data unavailable — please retry later.' : '자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') : (en ? 'Loading…' : '조회 중…');
      continue;
    }
    const all = snapshot.rows;
    const latest = all.at(-1);
    const previous = all.at(-2);
    const days = periods.find(([key]) => key === selected[market])[1];
    const cutoff = days ? new Date(`${latest.date}T00:00:00Z`).getTime() - (days - 1) * 86400000 : -Infinity;
    const rows = all.filter(row => new Date(`${row.date}T00:00:00Z`).getTime() >= cutoff);
    const delta = previous ? (latest[market] - previous[market]) / 1000000 : null;
    const stale = Date.now() - new Date(`${latest.date}T00:00:00+09:00`).getTime() > 7 * 86400000;
    summary.textContent = `${nf.format(latest[market] / 1000000)} ${en ? 'KRW trillion' : '조원'} · ${en ? 'as of' : '기준'} ${latest.date}`
      + (delta === null ? '' : ` · ${en ? 'vs prior observation' : '직전 공표일 대비'} ${delta > 0 ? '+' : ''}${nf.format(delta)} ${en ? 'KRW trillion' : '조원'}`)
      + (stale ? (en ? ' · Update delayed' : ' · 갱신 지연') : '');
    note.textContent += ` ${all[0].date} ~ ${latest.date}. ${en ? 'Last collection' : '최근 수집'}: ${new Date(snapshot.updatedAt).toLocaleString(en ? 'en-US' : 'ko-KR', {timeZone: 'Asia/Seoul'})} (KST).`;
    const tabs = document.getElementById(`creditPeriods${market}`);
    tabs.replaceChildren(...periods.map(([key]) => {
      const button = document.createElement('button');
      button.className = `chip ${key === selected[market] ? 'active' : ''}`;
      button.textContent = key === 'ALL' && !en ? '전체' : key;
      button.onclick = () => { selected[market] = key; renderCreditCharts(); };
      return button;
    }));
    charts[market]?.destroy();
    charts[market] = new Chart(document.getElementById(`creditChart${market}`), {
      type: 'line',
      data: { labels: rows.map(row => row.date), datasets: [{ label: title, data: rows.map(row => row[market] / 1000000), borderColor: market === 'KOSPI' ? '#23e7a5' : '#8ea2ff', backgroundColor: market === 'KOSPI' ? 'rgba(35,231,165,.10)' : 'rgba(142,162,255,.10)', fill: true, pointRadius: 0, pointHitRadius: 12, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${nf.format(ctx.parsed.y)} ${en ? 'KRW trillion' : '조원'}` } } },
        scales: { x: { ticks: { color: '#82958b', maxTicksLimit: 6 }, grid: { display: true, color: 'rgba(130,149,139,.25)' } },
          y: { title: { display: true, text: en ? 'KRW trillion' : '조원', color: '#82958b' }, ticks: { color: '#82958b', callback: value => nf.format(value) }, grid: { color: 'rgba(32,54,43,.7)' } } } }
    });
  }
}

export async function initCreditCharts(lang) {
  renderCreditCharts(lang);
  try {
    const response = await fetch('./credit_balance_data.json', {cache: 'no-store'});
    if (!response.ok) throw Error('Credit balance fetch failed');
    const value = await response.json();
    if (value.unit !== 'KRW million' || !Array.isArray(value.rows) || !value.rows.length ||
        value.rows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || markets.some(m => !Number.isFinite(row[m]) || row[m] <= 0))) throw Error('Invalid credit balances');
    snapshot = {...value, rows: [...value.rows].sort((a, b) => a.date.localeCompare(b.date))};
  } catch { failed = true; }
  renderCreditCharts();
}
