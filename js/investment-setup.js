import { accountFromSession, authClient, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';
import { applyPageTranslations } from './page-i18n.js?v=1';

const $ = id => document.getElementById(id);
let account = null;
let mode = 'login';
let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
const COPY={
  ko:{pageTitle:'투자 셋업',heading:'투자 셋업',navForeign:'외국인 수급',navAssets:'내 자산',navSetup:'투자 셋업',comingSoon:'준비 중',comingSoonNote:'내 자산 대시보드 완성 후 투자 계획과 목표 비중을 관리하는 화면이 추가될 예정이야.',continueGoogle:'Google로 계속하기',or:'또는',passwordPlaceholder:'비밀번호 (6자 이상)',login:'로그인',signup:'회원가입',logout:'로그아웃',close:'닫기',connected:'계정으로 연결됨',accountNotice:'로그인하면 다른 메뉴와 같은 계정으로 투자 셋업이 저장될 예정이야.',invalidEmail:'이메일 형식으로 입력해줘.',invalidPassword:'비밀번호는 6자 이상 입력해줘.',confirmEmail:'확인 메일이 오면 인증을 완료해줘.',signedIn:'로그인 완료',googlePending:'Google 로그인으로 이동 중…'},
  en:{pageTitle:'Investment Setup',heading:'Investment Setup',navForeign:'Foreign Flow',navAssets:'My Assets',navSetup:'Investment Setup',comingSoon:'Coming soon',comingSoonNote:'Investment plans and target allocations will be added after the My Assets dashboard is complete.',continueGoogle:'Continue with Google',or:'or',passwordPlaceholder:'Password (6+ characters)',login:'Log in',signup:'Sign up',logout:'Log out',close:'Close',connected:'account connected',accountNotice:'Log in to use the same account as the other dashboard sections.',invalidEmail:'Enter a valid email address.',invalidPassword:'Use at least 6 characters for the password.',confirmEmail:'Check your email if confirmation is required.',signedIn:'Signed in.',googlePending:'Opening Google sign-in…'}
};
const c=key=>COPY[language][key] || COPY.ko[key] || key;

function openAuth(nextMode) {
  mode = nextMode;
  $('authModalTitle').textContent = mode === 'signup' ? c('signup') : c('login');
  $('authSubmitButton').textContent = mode === 'signup' ? c('signup') : c('login');
  $('authModal').classList.add('open');
  $('authModal').setAttribute('aria-hidden', 'false');
}

function closeAuth() {
  $('authModal').classList.remove('open');
  $('authModal').setAttribute('aria-hidden', 'true');
}

function render() {
  applyPageTranslations(COPY,language);
  $('loginButton').textContent = account?.email || c('login');
  $('signupButton').textContent = account ? c('logout') : c('signup');
  $('authCloseButton').textContent=c('close');
  $('authModalTitle').textContent=mode==='signup'?c('signup'):c('login');
  $('authSubmitButton').textContent=mode==='signup'?c('signup'):c('login');
  $('accountNotice').textContent = account
    ? `${account.email} ${c('connected')}`
    : c('accountNotice');
}

setupHeaderWidgets({ onLanguageChange: next => { language = next; render(); } });

async function submitAuth(event) {
  event.preventDefault();
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email.includes('@')) return void ($('authStatus').textContent = c('invalidEmail'));
  if (password.length < 6) return void ($('authStatus').textContent = c('invalidPassword'));
  const result = mode === 'signup'
    ? await authClient.auth.signUp({ email, password })
    : await authClient.auth.signInWithPassword({ email, password });
  if (result.error) return void ($('authStatus').textContent = result.error.message);
  $('authStatus').textContent = mode === 'signup' ? c('confirmEmail') : c('signedIn');
  if (mode !== 'signup' || result.data.session) closeAuth();
}

$('loginButton').onclick = () => openAuth('login');
$('signupButton').onclick = async () => account ? authClient.auth.signOut() : openAuth('signup');
$('authCloseButton').onclick = closeAuth;
$('authModal').onclick = event => { if (event.target === $('authModal')) closeAuth(); };
$('authForm').onsubmit = submitAuth;
$('authGoogleButton').onclick = async () => {
  $('authStatus').textContent = c('googlePending');
  const { error } = await signInWithGoogle('/Funding-dashboard/investment-setup.html');
  if (error) $('authStatus').textContent = error.message;
};

const { data, error } = await authClient.auth.getSession();
if (error) $('authStatus').textContent = error.message;
account = accountFromSession(data?.session);
render();
authClient.auth.onAuthStateChange((_event, session) => {
  account = accountFromSession(session);
  render();
});
