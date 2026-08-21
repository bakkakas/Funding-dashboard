import { accountFromSession, authClient, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';

const $ = id => document.getElementById(id);
let account = null;
let mode = 'login';
let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';

function openAuth(nextMode) {
  mode = nextMode;
  $('authModalTitle').textContent = mode === 'signup' ? '회원가입' : '로그인';
  $('authSubmitButton').textContent = mode === 'signup' ? '회원가입' : '로그인';
  $('authModal').classList.add('open');
  $('authModal').setAttribute('aria-hidden', 'false');
}

function closeAuth() {
  $('authModal').classList.remove('open');
  $('authModal').setAttribute('aria-hidden', 'true');
}

function render() {
  $('loginButton').textContent = account?.email || (language === 'en' ? 'Login' : '로그인');
  $('signupButton').textContent = account ? (language === 'en' ? 'Log out' : '로그아웃') : (language === 'en' ? 'Sign up' : '회원가입');
  $('accountNotice').textContent = account
    ? `${account.email} 계정으로 연결됨`
    : '로그인하면 다른 메뉴와 같은 계정으로 투자 셋업이 저장될 예정이야.';
}

setupHeaderWidgets({ onLanguageChange: next => { language = next; render(); } });

async function submitAuth(event) {
  event.preventDefault();
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email.includes('@')) return void ($('authStatus').textContent = '이메일 형식으로 입력해줘.');
  if (password.length < 6) return void ($('authStatus').textContent = '비밀번호는 6자 이상 입력해줘.');
  const result = mode === 'signup'
    ? await authClient.auth.signUp({ email, password })
    : await authClient.auth.signInWithPassword({ email, password });
  if (result.error) return void ($('authStatus').textContent = result.error.message);
  $('authStatus').textContent = mode === 'signup' ? '확인 메일이 오면 인증을 완료해줘.' : '로그인 완료';
  if (mode !== 'signup' || result.data.session) closeAuth();
}

$('loginButton').onclick = () => openAuth('login');
$('signupButton').onclick = async () => account ? authClient.auth.signOut() : openAuth('signup');
$('authCloseButton').onclick = closeAuth;
$('authModal').onclick = event => { if (event.target === $('authModal')) closeAuth(); };
$('authForm').onsubmit = submitAuth;
$('authGoogleButton').onclick = async () => {
  $('authStatus').textContent = 'Google 로그인으로 이동 중…';
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
