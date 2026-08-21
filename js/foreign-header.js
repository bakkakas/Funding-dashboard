import { accountFromSession, authClient, signInWithGoogle } from './auth.js?v=1';

const FX_LATEST_URL = 'https://open.er-api.com/v6/latest/USD';
const FX_REFERENCE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

export function setupForeignHeader({ onLanguageChange } = {}) {
  let lang = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
  let auth = null;

  const copy = {
    ko: { login: '로그인', signup: '회원가입', logout: '로그아웃', admin: '관리자', close: '닫기', save: '저장', loading: 'USD/KRW 조회 중', failed: 'USD/KRW 조회 실패', google:'Google로 계속하기', or:'또는', password:'비밀번호 (6자 이상)', authStatus:'모든 메뉴에서 같은 Supabase 계정을 사용해.' },
    en: { login: 'Login', signup: 'Sign up', logout: 'Log out', admin: 'Admin', close: 'Close', save: 'Save', loading: 'Loading USD/KRW', failed: 'USD/KRW unavailable', google:'Continue with Google', or:'or', password:'Password (6+ characters)', authStatus:'The same Supabase account is used across every section.' }
  };
  const modal = document.getElementById('authModal');
  const authStatus = document.getElementById('authStatus');

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
    document.getElementById('authGoogleLabel').textContent = text.google;
    document.getElementById('authOrLabel').textContent = text.or;
    document.getElementById('authPassword').placeholder = text.password;
    if(!modal.classList.contains('open')) authStatus.textContent = text.authStatus;
    onLanguageChange?.(lang);
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
  document.getElementById('signupButton').onclick = async () => {
    if (auth) {
      const { error } = await authClient.auth.signOut();
      if (error) authStatus.textContent = error.message;
    } else openModal('signup');
  };
  document.getElementById('authGoogleButton').onclick = async () => {
    authStatus.textContent = lang === 'en' ? 'Opening Google sign-in…' : 'Google 로그인으로 이동 중…';
    const { error } = await signInWithGoogle('/Funding-dashboard/foreign-flow.html');
    if (error) authStatus.textContent = error.message;
  };
  document.getElementById('authCloseButton').onclick = closeModal;
  modal.onclick = event => { if (event.target === modal) closeModal(); };
  document.getElementById('authForm').onsubmit = async event => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || !email.includes('@')) {
      authStatus.textContent = lang === 'en' ? 'Enter a valid email.' : '이메일 형식으로 입력해줘.';
      return;
    }
    if (password.length < 6) {
      authStatus.textContent = lang === 'en' ? 'Use at least 6 characters for the password.' : '비밀번호는 6자 이상 입력해줘.';
      return;
    }
    const result = modal.dataset.mode === 'signup'
      ? await authClient.auth.signUp({ email, password })
      : await authClient.auth.signInWithPassword({ email, password });
    if (result.error) {
      authStatus.textContent = result.error.message;
      return;
    }
    authStatus.textContent = modal.dataset.mode === 'signup'
      ? (lang === 'en' ? 'Check your email if confirmation is required.' : '확인 메일이 오면 인증을 완료해줘.')
      : (lang === 'en' ? 'Signed in.' : '로그인 완료');
    if (modal.dataset.mode !== 'signup' || result.data.session) closeModal();
  };

  render();
  authClient.auth.getSession().then(({ data, error }) => {
    if (error) authStatus.textContent = error.message;
    auth = accountFromSession(data?.session);
    render();
  });
  authClient.auth.onAuthStateChange((_event, session) => {
    auth = accountFromSession(session);
    render();
  });
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
