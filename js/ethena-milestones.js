import { fetchUsdeObservation, milestoneProgress, BUYBACK_MILESTONES, CAP_MILESTONES, BUYBACK_SOURCE } from './usde-observation.js?v=1';

const COPY = {
  ko: {
    title: 'ENA 바이백 마일스톤', approved: '거버넌스 통과',
    intro: '공식 기준은 USDe 유통량 · 시총 알림과 구분',
    supply: 'USDe 유통량', cap: 'USDe 현재 시총', goal: '첫 바이백 기준 7.5B USDe',
    loading: '최신 데이터 확인 중…', unavailable: '최신 데이터 조회 실패 · 다시 시도', stale: '지연 데이터 · 달성 판정 보류',
    refresh: '새로고침', remaining: '남음', reached: '수치 도달', reference: '참고',
    rate: '공식 표 기준 비율', watch: '시총 관심 구간', unknown: '확인 필요',
    rule: '7.5B USDe부터 단계별 비율 적용. 재단에 지급되는 3개 사업 순수익의 95%를 바이백에 배정한다는 설명과 위 단계별 비율은 계산 기준이 다름.',
    note: '14일 평균 유통량은 위원회 권고이며 최종 적용 방식은 별도 확인 대상. 수치 도달만으로 실제 바이백 집행을 확정하지 않음.',
    source: '공식 제안·통과 확인', live: 'CoinGecko 최신 관측',
    capNote: '관심 구간은 USD 시총 기준. 위 바이백 마일스톤은 유통량 기준. 아래 일별 차트(DefiLlama)와 기준 시각·출처가 다름.',
  },
  en: {
    title: 'ENA buyback milestones', approved: 'Governance passed',
    intro: 'Official metric: circulating USDe supply, separate from market-cap alerts',
    supply: 'USDe circulating supply', cap: 'Current USDe market cap', goal: 'First buyback threshold: 7.5B USDe',
    loading: 'Checking latest data…', unavailable: 'Latest data unavailable · retry', stale: 'Delayed data · threshold status withheld',
    refresh: 'Refresh', remaining: 'remaining', reached: 'Level reached', reference: 'reference',
    rate: 'Rate in official table', watch: 'Market-cap watch levels', unknown: 'Unavailable',
    rule: 'The tiered schedule starts at 7.5B USDe. The 95% allocation of net revenue paid to the Foundation across three businesses has a different denominator from these tier rates.',
    note: 'A 14-day supply average is a committee recommendation; final implementation needs separate confirmation. Reaching a level does not verify actual buyback execution.',
    source: 'Official proposal & passage', live: 'Latest CoinGecko observation',
    capNote: 'Watch levels use USD market cap; buyback milestones use circulating supply. The daily DefiLlama chart below has a different source and observation time.',
  },
};

export class EthenaMilestonesPanel {
  constructor(host) {
    this.host = host;
    this.version = 0;
    this.language = 'ko';
    this.observation = null;
    this.loading = false;
    this.failed = false;
    host.addEventListener('click', event => {
      if (event.target.closest('[data-milestone-refresh]')) void this.refresh();
    });
    setInterval(() => { if (!host.hidden && !document.hidden) void this.refresh(); }, 300000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !host.hidden && Date.now() - (this.observation?.fetchedAt ?? 0) >= 300000) void this.refresh();
    });
  }

  setAsset(id, language, signal) {
    this.controller?.abort();
    this.version++;
    this.loading = false;
    this.language = language;
    this.signal = signal;
    this.host.hidden = id !== 'ena';
    if (this.host.hidden) return;
    this.render();
    if (Date.now() - (this.observation?.fetchedAt ?? 0) >= 300000) void this.refresh();
  }

  setLanguage(language) { this.language = language; this.render(); }

  async refresh() {
    if (this.host.hidden || this.loading || this.signal?.aborted) return;
    const version = this.version;
    this.controller = new AbortController();
    const signal = this.signal ? AbortSignal.any([this.signal, this.controller.signal]) : this.controller.signal;
    this.loading = true; this.failed = false; this.render();
    try {
      const observation = await fetchUsdeObservation({ signal });
      if (version !== this.version || signal.aborted) return;
      this.observation = observation;
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
    const o = this.observation;
    const fresh = o && Date.now() - o.observedAt <= 3600000;
    const supply = fresh ? o.supply : null, cap = fresh ? o.cap : null;
    const tiers = milestoneProgress(supply, BUYBACK_MILESTONES.map(row => row.supply));
    const watch = milestoneProgress(cap, CAP_MILESTONES);
    const compact = value => value === null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 3 }).format(value);
    const time = o ? new Intl.DateTimeFormat(this.language === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(o.observedAt) + ' KST' : '';
    const status = this.loading ? t.loading : this.failed ? t.unavailable : !fresh ? t.stale : `${t.live} · ${time}`;
    const first = tiers[0];
    this.host.setAttribute('aria-busy', String(this.loading));
    this.host.innerHTML = `
      <div class="usde-head"><div><div class="eyebrow">ETHENA · FEE SWITCH</div><h3 id="ethenaMilestoneTitle">${t.title}</h3><p>${t.intro}</p></div><span class="milestone-approved">${t.approved}</span></div>
      <div class="milestone-current"><div><span>${t.supply}</span><strong>${compact(supply)} <small>USDe</small></strong></div><div><span>${t.cap}</span><strong>${cap === null ? '—' : '$' + compact(cap)}</strong></div><button class="chip" data-milestone-refresh type="button" ${this.loading ? 'disabled' : ''}>${t.refresh}</button></div>
      <div class="usde-status ${this.failed || !fresh ? 'warning' : ''}" role="status">${status}</div>
      <div class="milestone-goal"><span>${t.goal}</span><b>${first.remaining === null ? t.unknown : first.reached ? t.reached : `${compact(first.remaining)} USDe ${t.remaining} · ${first.percent.toFixed(1)}%`}</b></div>
      <progress class="milestone-progress" aria-label="${t.goal}" value="${first.percent ?? 0}" max="100"></progress>
      <div class="buyback-tiers">${tiers.map((row, index) => `<div class="buyback-tier ${row.reached ? 'reached' : ''}"><b>${row.threshold / 1e9}B${index === 4 ? '+' : ''} USDe</b><strong>${BUYBACK_MILESTONES[index].rate}%</strong><small>${t.rate}</small></div>`).join('')}</div>
      <h4 class="milestone-watch-title">${t.watch}</h4><div class="milestone-watch">${watch.map(row => `<div><b>$${row.threshold / 1e9}B</b><span>${row.remaining === null ? t.unknown : row.reached ? t.reached : '$' + compact(row.remaining) + ' ' + t.remaining}</span></div>`).join('')}</div>
      <p class="usde-note">${t.rule}<br>${t.note}<br>${t.capNote}</p>
      <a class="usde-source" href="${BUYBACK_SOURCE}" target="_blank" rel="noopener noreferrer">${t.source} ↗</a>`;
  }
}
