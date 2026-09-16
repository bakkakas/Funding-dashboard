import { fetchJson, numberOrNull } from './research-data.js?v=1';

export const USDE_HISTORY_URL = 'https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=146';
export const DAY = 86400000;
export const PERIODS = [1, 7, 30, 365];

// Use USD valuation, not token supply or Ethena protocol TVL. The provider's
// all-chain aggregate already handles chain accounting; never sum it again.
export function normalizeUsdeHistory(data, now = Date.now()) {
  if (!Array.isArray(data)) throw new Error('Invalid USDe history');
  const unique = new Map();
  for (const row of data) {
    const date = numberOrNull(row?.date);
    const cap = numberOrNull(row?.totalCirculatingUSD?.peggedUSD);
    if (date === null || date <= 0 || date * 1000 > now + 300000 || cap === null || cap < 0) continue;
    unique.set(date * 1000, { time: date * 1000, cap });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}

export function summarizeUsde(history, now = Date.now()) {
  const latest = history.at(-1) ?? null;
  return {
    latest,
    stale: !latest || now - latest.time > 2 * DAY,
    changes: PERIODS.map(days => {
      const target = latest ? latest.time - days * DAY : null;
      // Require the requested UTC day. A missing observation is not 0% and
      // must not silently turn a one-day change into a two-day change.
      const baseline = target === null ? null : history.find(row => Math.floor(row.time / DAY) === Math.floor(target / DAY)) ?? null;
      return { days, baseline, amount: baseline ? latest.cap - baseline.cap : null,
        percent: baseline?.cap > 0 ? (latest.cap / baseline.cap - 1) * 100 : null };
    }),
  };
}

const COPY = {
  ko: {
    title: 'USDe 총 시가총액', subtitle: 'Ethena · 전체 체인 유통 USDe의 USD 가치',
    note: 'ENA 시총·프로토콜 TVL과 별도 지표. sUSDe를 별도 합산하지 않음.',
    loading: 'USDe 시총 이력 불러오는 중…', error: '데이터를 불러오지 못했어. 다시 시도해 줘.',
    failed: '갱신 실패 · 마지막 수신 데이터 표시', stale: '지연 데이터', daily: '최신 일별 관측값',
    refresh: '새로고침', basis: '기준', previous: '비교', missing: '비교 데이터 없음',
    chart: 'USDe 시총 추이', all: '전체', year: '1년', day: '일',
    method: '변화량 = 최신 일별 시총 − 해당 기간 전 시총. 1년 = 365일. 서버 수집 6시간 주기 · 화면 갱신 확인 5분 주기.',
  },
  en: {
    title: 'USDe total market cap', subtitle: 'Ethena · USD value of circulating USDe across all chains',
    note: 'Separate from ENA market cap and protocol TVL. sUSDe is not added again.',
    loading: 'Loading USDe market cap history…', error: 'Unable to load data. Please retry.',
    failed: 'Refresh failed · showing last received data', stale: 'Delayed data', daily: 'Latest daily observation',
    refresh: 'Refresh', basis: 'As of', previous: 'Compared with', missing: 'Comparison unavailable',
    chart: 'USDe market cap history', all: 'All', year: '1Y', day: 'D',
    method: 'Change = latest daily market cap − market cap that many days earlier. 1Y = 365 days. Collected every 6 hours; checks for updates every 5 minutes while visible.',
  },
};

export class UsdeMarketCapPanel {
  constructor(host) {
    this.host = host;
    this.language = 'ko';
    this.history = [];
    this.range = 365;
    this.version = 0;
    this.fetchedAt = 0;
    this.loading = false;
    this.failed = false;
    host.addEventListener('click', event => {
      const range = event.target.closest('[data-usde-range]');
      if (range) { this.range = Number(range.dataset.usdeRange); this.render(); }
      if (event.target.closest('[data-usde-refresh]')) void this.refresh();
    });
    setInterval(() => {
      if (!host.hidden && !document.hidden) void this.refresh();
    }, 300000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !host.hidden && Date.now() - this.fetchedAt >= 300000) void this.refresh();
    });
  }

  setAsset(assetId, language, signal) {
    this.controller?.abort();
    this.version++;
    this.loading = false;
    this.language = language;
    this.signal = signal;
    this.host.hidden = assetId !== 'ena';
    if (this.host.hidden) return;
    this.render();
    if (!this.history.length || Date.now() - this.fetchedAt >= 300000) void this.refresh();
  }

  setLanguage(language) { this.language = language; this.render(); }

  async refresh() {
    if (this.host.hidden || this.loading || this.signal?.aborted) return;
    const version = this.version;
    this.controller = new AbortController();
    const signal = this.signal ? AbortSignal.any([this.signal, this.controller.signal]) : this.controller.signal;
    this.loading = true;
    this.failed = false;
    this.render();
    try {
      // Same-origin snapshot avoids the provider's duplicate CORS headers.
      const snapshot = await fetchJson(`./data/usde-market-cap.json?v=${Math.floor(Date.now() / 300000)}`, { signal });
      const history = normalizeUsdeHistory(snapshot.history);
      if (!history.length) throw new Error('Empty USDe history');
      if (version !== this.version || signal.aborted) return;
      this.history = history;
      this.fetchedAt = Date.now();
    } catch (error) {
      if (version !== this.version || signal.aborted) return;
      this.failed = true;
    } finally {
      if (version === this.version) { this.loading = false; this.render(); }
    }
  }

  render() {
    if (this.host.hidden) return;
    const t = COPY[this.language];
    const summary = summarizeUsde(this.history);
    const usd = value => value === null ? '—' : new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(value);
    const date = time => new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
    }).format(time);
    const signed = value => value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${usd(Math.abs(value))}`;
    const status = this.loading ? t.loading : this.failed ? (summary.latest ? t.failed : t.error) : summary.stale ? t.stale : t.daily;
    this.host.setAttribute('aria-busy', String(this.loading));
    this.host.innerHTML = `
      <div class="usde-head"><div><div class="eyebrow">ETHENA · USDe</div><h3 id="usdeTitle">${t.title}</h3><p>${t.subtitle}</p></div>
        <button class="chip" type="button" data-usde-refresh ${this.loading ? 'disabled' : ''}>${t.refresh}</button></div>
      <div class="usde-total">${usd(summary.latest?.cap ?? null)}</div>
      <div class="usde-status ${this.failed || (summary.latest && summary.stale) ? 'warning' : ''}" role="status">${status}${summary.latest ? ` · ${t.basis} ${date(summary.latest.time)} 00:00 UTC` : ''}</div>
      <div class="usde-changes">${summary.changes.map(change => {
        const tone = change.amount > 0 ? 'positive' : change.amount < 0 ? 'negative' : 'neutral';
        const pct = change.percent === null ? '—' : `${change.percent > 0 ? '+' : ''}${change.percent.toFixed(2)}%`;
        return `<div class="usde-change ${tone}"><span>${change.days === 365 ? t.year : change.days + t.day}</span><strong>${pct}</strong><b>${signed(change.amount)}</b><small>${change.baseline ? `${t.previous} ${date(change.baseline.time)}` : t.missing}</small></div>`;
      }).join('')}</div>
      <div class="usde-chart-head"><h4>${t.chart}</h4><div class="usde-ranges" role="group" aria-label="${t.chart}">${[30, 90, 365, 0].map(days => `<button type="button" class="chip ${days === this.range ? 'active' : ''}" data-usde-range="${days}" aria-pressed="${days === this.range}">${days === 0 ? t.all : days === 365 ? t.year : days + t.day}</button>`).join('')}</div></div>
      <div class="usde-chart">${this.chart(t, date, usd)}</div>
      <p class="usde-note">${t.note}<br>${t.method}</p>
      <a class="usde-source" href="https://defillama.com/stablecoin/ethena-usde" target="_blank" rel="noopener noreferrer">DefiLlama · USDe ↗</a>`;
  }

  chart(t, date, usd) {
    const latest = this.history.at(-1);
    if (!latest) return '<div class="usde-chart-empty">—</div>';
    const rows = this.history.filter(row => !this.range || row.time >= latest.time - this.range * DAY);
    if (rows.length < 2) return '<div class="usde-chart-empty">—</div>';
    const values = rows.map(row => row.cap);
    const low = Math.min(...values), high = Math.max(...values);
    const padding = Math.max((high - low) * .12, high * .01, 1);
    const min = Math.max(0, low - padding), max = high + padding;
    const x = row => 80 + (row.time - rows[0].time) / (latest.time - rows[0].time) * 700;
    const y = row => 20 + (max - row.cap) / (max - min) * 190;
    const points = rows.map(row => `${x(row).toFixed(2)},${y(row).toFixed(2)}`).join(' ');
    const shortUsd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
    return `<svg viewBox="0 0 800 245" role="img" aria-label="${t.chart}: ${date(rows[0].time)} – ${date(latest.time)}; ${usd(latest.cap)}">
      <title>${t.chart} (USD)</title>
      ${[0, .5, 1].map(ratio => `<line x1="80" y1="${20 + 190 * ratio}" x2="780" y2="${20 + 190 * ratio}" class="usde-gridline"/><text x="70" y="${24 + 190 * ratio}" text-anchor="end">${shortUsd(max - (max - min) * ratio)}</text>`).join('')}
      <polygon points="80,210 ${points} 780,210" class="usde-area"/>
      <polyline points="${points}" class="usde-line"/>
      ${rows.map(row => `<circle cx="${x(row).toFixed(2)}" cy="${y(row).toFixed(2)}" r="5" class="usde-point"><title>${date(row.time)} · ${usd(row.cap)}</title></circle>`).join('')}
      <text x="80" y="237">${date(rows[0].time)}</text><text x="780" y="237" text-anchor="end">${date(latest.time)} (UTC)</text>
    </svg>`;
  }
}
