const FX_LATEST_URL = 'https://open.er-api.com/v6/latest/USD';
const FX_REFERENCE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

export function setupForeignHeader() {
  let lang = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
  let auth;
  try { auth = JSON.parse(localStorage.getItem('fundingDashboardAuthUser') || 'null'); } catch { auth = null; }

  const copy = {
    ko: { login: '로그인', signup: '회원가입', logout: '로그아웃', admin: '관리자', close: '닫기', save: '저장', loading: 'USD/KRW 조회 중', failed: 'USD/KRW 조회 실패' },
    en: { login: 'Login', signup: 'Sign up', logout: 'Log out', admin: 'Admin', close: 'Close', save: 'Save', loading: 'Loading USD/KRW', failed: 'USD/KRW unavailable' }
  };
  const modal = document.getElementById('authModal');

  function render() {
    const text = copy[lang];
    document.documentElement.lang = lang;
    document.getElementById('langKoButton').classList.toggle('active', lang === 'ko');
    document.getElementById('langEnButton').classList.toggle('active', lang === 'en');
    document.getElementById('loginButton').textContent = auth?.email || text.login;
    document.getElementById('signupButton').textContent = auth ? text.logout : text.signup;
    document.getElementById('adminLink').textContent = text.admin;
    document.getElementById('authCloseButton').textContent = text.close;
    document.getElementById('authSubmitButton').textContent = text.save;
  }

  function setLanguage(next) {
    lang = next;
    localStorage.setItem('fundingDashboardLanguage', lang);
    render();
  }

  function openModal(mode) {
    document.getElementById('authModalTitle').textContent = mode === 'signup' ? copy[lang].signup : copy[lang].login;
    modal.dataset.mode = mode;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('authEmail').focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('langKoButton').onclick = () => setLanguage('ko');
  document.getElementById('langEnButton').onclick = () => setLanguage('en');
  document.getElementById('loginButton').onclick = () => openModal('login');
  document.getElementById('signupButton').onclick = () => {
    if (auth) {
      localStorage.removeItem('fundingDashboardAuthUser');
      auth = null;
      render();
    } else openModal('signup');
  };
  document.getElementById('authCloseButton').onclick = closeModal;
  modal.onclick = event => { if (event.target === modal) closeModal(); };
  document.getElementById('authForm').onsubmit = event => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    if (!email || !email.includes('@')) return;
    auth = { email, provider: 'email', synced: false };
    localStorage.setItem('fundingDashboardAuthUser', JSON.stringify(auth));
    closeModal();
    render();
  };

  render();
  Promise.all([fetch(FX_LATEST_URL, { cache: 'no-store' }), fetch(FX_REFERENCE_URL, { cache: 'no-store' })])
    .then(async ([latestResponse, referenceResponse]) => [await latestResponse.json(), await referenceResponse.json()])
    .then(([latestJson, referenceJson]) => {
      const latest = Number(latestJson.rates?.KRW);
      const reference = Number(referenceJson.usd?.krw);
      if (!latest || !reference) throw Error('rate unavailable');
      const change = (latest - reference) / reference;
      const tone = change > 0 ? 'bad' : change < 0 ? 'good' : 'warn';
      document.getElementById('usdKrwTicker').innerHTML = `USD/KRW ${latest.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="fx-change ${tone}">(${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%)</span>`;
    })
    .catch(() => { document.getElementById('usdKrwTicker').textContent = copy[lang].failed; });
}
