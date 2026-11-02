import { setupFxTicker } from './fx-rate.js?v=2';
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

  setupFxTicker(ticker);

  return {
    getLanguage: () => language,
    setUpdatedAt: renderUpdatedAt,
  };
}
