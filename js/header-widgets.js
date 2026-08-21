const FX_LATEST_URL = 'https://open.er-api.com/v6/latest/USD';
const FX_REFERENCE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

const COPY = {
  ko: { admin: '관리자', updated: 'Updated', fxLoading: 'USD/KRW 조회 중', fxFailed: 'USD/KRW 조회 실패' },
  en: { admin: 'Admin', updated: 'Updated', fxLoading: 'Loading USD/KRW', fxFailed: 'USD/KRW unavailable' },
};

export function setupHeaderWidgets({ updatedAt = new Date(), updatedElementId = 'updatedAt', onLanguageChange } = {}) {
  let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
  let lastUpdatedAt = updatedAt;
  const ticker = document.getElementById('usdKrwTicker');
  const updated = document.getElementById(updatedElementId);

  function renderUpdatedAt(value = lastUpdatedAt) {
    lastUpdatedAt = value instanceof Date ? value : new Date(value);
    if (!updated || Number.isNaN(lastUpdatedAt.getTime())) return;
    const locale = language === 'en' ? 'en-US' : 'ko-KR';
    updated.textContent = `${COPY[language].updated}: ${lastUpdatedAt.toLocaleString(locale, { timeZone: 'Asia/Seoul' })}`;
  }

  function renderLanguage() {
    document.documentElement.lang = language;
    document.getElementById('langKoButton')?.classList.toggle('active', language === 'ko');
    document.getElementById('langEnButton')?.classList.toggle('active', language === 'en');
    const admin = document.getElementById('adminLink');
    if (admin) admin.textContent = COPY[language].admin;
    if (ticker?.dataset.state === 'loading') ticker.textContent = COPY[language].fxLoading;
    if (ticker?.dataset.state === 'failed') ticker.textContent = COPY[language].fxFailed;
    renderUpdatedAt();
    onLanguageChange?.(language);
  }

  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'ko';
    localStorage.setItem('fundingDashboardLanguage', language);
    renderLanguage();
  }

  document.getElementById('langKoButton')?.addEventListener('click', () => setLanguage('ko'));
  document.getElementById('langEnButton')?.addEventListener('click', () => setLanguage('en'));
  if (ticker) ticker.dataset.state = 'loading';
  renderLanguage();

  if (ticker) {
    Promise.all([
      fetch(FX_LATEST_URL, { cache: 'no-store' }),
      fetch(FX_REFERENCE_URL, { cache: 'no-store' }),
    ])
      .then(async ([latestResponse, referenceResponse]) => [await latestResponse.json(), await referenceResponse.json()])
      .then(([latestJson, referenceJson]) => {
        const latest = Number(latestJson.rates?.KRW);
        const reference = Number(referenceJson.usd?.krw);
        if (!latest || !reference) throw new Error('rate unavailable');
        const change = (latest - reference) / reference;
        const tone = change > 0 ? 'bad' : change < 0 ? 'good' : 'warn';
        ticker.dataset.state = 'ready';
        ticker.className = 'fx-ticker';
        ticker.innerHTML = `USD/KRW ${latest.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="fx-change ${tone}">(${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%)</span>`;
      })
      .catch(() => {
        ticker.dataset.state = 'failed';
        ticker.className = 'fx-ticker warn';
        ticker.textContent = COPY[language].fxFailed;
      });
  }

  return {
    getLanguage: () => language,
    setUpdatedAt: renderUpdatedAt,
  };
}
