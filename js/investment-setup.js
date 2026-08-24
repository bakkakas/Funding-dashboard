import { accountFromSession, authClient, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';
import { applyPageTranslations } from './page-i18n.js?v=1';

const $ = id => document.getElementById(id);
let account = null;
let mode = 'login';
let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
const COPY={
  ko:{
    pageTitle:'투자 셋업',heading:'투자 셋업',navForeign:'외국인 수급',navAssets:'내 자산',navSetup:'투자 셋업',planTab:'투자 계획',analysisTab:'종목 분석',comingSoon:'준비 중',comingSoonNote:'투자 계획과 목표 비중을 관리하는 화면이 추가될 예정이야.',continueGoogle:'Google로 계속하기',or:'또는',passwordPlaceholder:'비밀번호 (6자 이상)',login:'로그인',signup:'회원가입',logout:'로그아웃',close:'닫기',connected:'계정으로 연결됨',accountNotice:'로그인하면 다른 메뉴와 같은 계정으로 투자 셋업이 저장될 예정이야.',invalidEmail:'이메일 형식으로 입력해줘.',invalidPassword:'비밀번호는 6자 이상 입력해줘.',confirmEmail:'확인 메일이 오면 인증을 완료해줘.',signedIn:'로그인 완료',googlePending:'Google 로그인으로 이동 중…',
    researchLibrary:'RESEARCH LIBRARY',moreReports:'분석 보고서는 이 목록에 계속 추가돼.',cryptoResearch:'CRYPTO RESEARCH',heroSummary:'비수탁형 리퀴드 리스테이킹에서 출발해 온체인 금융 앱으로 확장 중인 ether.fi의 거버넌스 토큰.',updatedLabel:'업데이트',price:'가격',liveData:'CoinGecko 실시간',marketCap:'시가총액 (Circulation 기준)',fixedSupply:'공식 고정 공급량 1B',marketFallback:'2026.08.24 기준값 · 실시간 데이터 갱신 중',marketLive:'CoinGecko 최신 시장 데이터',marketUnavailable:'실시간 조회 실패 · 2026.08.24 기준값 표시',circulatingPrefix:'유통량 약',
    overview:'개요',overviewBody:'ether.fi는 ETH 보유자가 자산 통제권을 유지한 채 스테이킹·리스테이킹 수익을 얻도록 설계된 비수탁 프로토콜이다. eETH와 weETH를 통해 유동성을 유지하며 DeFi에서 활용할 수 있다. 현재는 Stake·Liquid·Cash를 묶고 토큰화 주식·금속 거래, Aave 기반 대출, 법정화폐 입출금까지 제공하는 온체인 금융 앱으로 확장하고 있다.',tokenRole:'토큰 역할',tokenRoleValue:'거버넌스 · sETHFI 스테이킹 · 바이백 분배',supply:'공급량',supplyValue:'공식 문서상 고정 10억 개 · 추가 발행 없음',officialOverview:'공식 프로토콜 개요 ↗',
    valueDrivers:'토큰 가치 상승 요인',driverBuybackTitle:'프로토콜 수익 기반 바이백',driverBuybackBody:'eETH 출금 수수료 수익 100%를 주간 바이백에 사용하고, Stake·Liquid·Cash의 프로토콜 수익 일부도 월간 바이백에 배정한다. 매입 ETHFI는 sETHFI 보유자에게 분배된다.',driverAppTitle:'온체인 금융 앱 확장',driverAppBody:'토큰화 주식·금속, 담보 대출, 글로벌 법정화폐 레일, Cash 카드가 하나의 앱으로 통합됐다. 사용량과 수익이 커질수록 바이백 재원이 확대될 가능성이 있다.',driverInstitutionTitle:'기관 채택과 보안 강화',driverInstitutionBody:'KPK가 2,500만 달러 이상을 weETH 핵심 자산으로 배정했고, 프로토콜은 Certora 감사와 권한·출금 구조 강화 작업을 진행했다. 담보 자산 채택 확대는 weETH 수요에 긍정적이다.',driverSupplyTitle:'언락 오버행의 종료 접근',driverSupplyBody:'현재 일정대로라면 2027년 3월에 베스팅이 끝난다. 남은 물량은 단기 매도 압력이지만, 종료 후에는 신규 유통 증가 부담이 크게 낮아진다.',buybackSource:'공식 바이백 프로그램 ↗',
    recentNews:'최근 주요 뉴스',newsSummerTitle:'ether.fi Summer 출시',newsSummerBody:'토큰화 주식·금속 거래, Aave 담보대출, 30개 이상 통화의 입출금 수단을 통합한 차세대 앱 공개.',newsHardeningTitle:'weETH 프로토콜 하드닝 완료',newsHardeningBody:'출금 경로·권한·보안 경계를 강화하고 Steakhouse Prime Vault 담보 시장에 진입.',newsKpkTitle:'KPK, weETH에 2,500만 달러 이상 배정',newsKpkBody:'65개 이상 항목의 실사를 거쳐 전술 포지션이 아닌 핵심 전략 자산으로 채택.',newsSecurityTitle:'핵심 컨트랙트 보안 구조 개편',newsSecurityBody:'Certora 감사와 불변조건 테스트를 적용하고 운영 키 권한을 세분화.',
    unlockSchedule:'토큰 언락 일정',nextUnlock:'다음 언락',supplyPercent:'총 공급량의 0.9%',remainingUnlock:'잔여 언락',remainingDetail:'총 공급량의 6.3% · 7회',vestingEnd:'최종 베스팅 종료',insiderUnlock:'남은 일정은 주로 투자자·핵심 기여자 물량',unlocked:'해제 93.7%',locked:'잔여 6.3%',unlockNote:'공식 배분 문서의 고정 공급량 10억 개와 Tokenomics.com의 베스팅 일정 기준. 데이터 제공처에 따라 ‘유통량’과 ‘언락 물량’ 정의가 달라 수치 차이가 날 수 있다.',allocationSource:'공식 ETHFI 배분 ↗',unlockSource:'언락 일정 원문 ↗',disclaimer:'정보 제공 목적의 리서치이며 투자 권유가 아니야. 시장 데이터와 일정은 변동될 수 있어.'
  },
  en:{
    pageTitle:'Investment Setup',heading:'Investment Setup',navForeign:'Foreign Flow',navAssets:'My Assets',navSetup:'Investment Setup',planTab:'Investment Plan',analysisTab:'Asset Research',comingSoon:'Coming soon',comingSoonNote:'Investment plans and target allocations will be added here.',continueGoogle:'Continue with Google',or:'or',passwordPlaceholder:'Password (6+ characters)',login:'Log in',signup:'Sign up',logout:'Log out',close:'Close',connected:'account connected',accountNotice:'Log in to use the same account as the other dashboard sections.',invalidEmail:'Enter a valid email address.',invalidPassword:'Use at least 6 characters for the password.',confirmEmail:'Check your email if confirmation is required.',signedIn:'Signed in.',googlePending:'Opening Google sign-in…',
    researchLibrary:'RESEARCH LIBRARY',moreReports:'New research reports will be added to this list.',cryptoResearch:'CRYPTO RESEARCH',heroSummary:'The governance token of ether.fi, expanding from non-custodial liquid restaking into a full onchain finance app.',updatedLabel:'Updated',price:'Price',liveData:'Live from CoinGecko',marketCap:'Market cap (circulating)',fixedSupply:'Official fixed supply: 1B',marketFallback:'Baseline as of Aug 24, 2026 · refreshing live data',marketLive:'Latest CoinGecko market data',marketUnavailable:'Live lookup failed · showing Aug 24, 2026 baseline',circulatingPrefix:'Circulating approx.',
    overview:'Overview',overviewBody:'ether.fi is a non-custodial protocol designed to let ETH holders earn staking and restaking rewards while retaining control of their assets. eETH and weETH preserve liquidity and DeFi composability. The project is now expanding into an onchain finance app combining Stake, Liquid and Cash with tokenized stocks and metals, Aave-powered borrowing and global fiat rails.',tokenRole:'Token role',tokenRoleValue:'Governance · sETHFI staking · buyback distribution',supply:'Supply',supplyValue:'Officially fixed at 1 billion · no further issuance',officialOverview:'Official protocol overview ↗',
    valueDrivers:'Token value drivers',driverBuybackTitle:'Protocol-revenue buybacks',driverBuybackBody:'100% of eETH withdrawal-fee revenue funds weekly buybacks, while part of Stake, Liquid and Cash revenue funds monthly buybacks. Purchased ETHFI is distributed to sETHFI holders.',driverAppTitle:'Onchain finance app expansion',driverAppBody:'Tokenized stocks and metals, collateralized borrowing, global fiat rails and the Cash card are now integrated in one app. Greater usage and revenue could expand the buyback pool.',driverInstitutionTitle:'Institutional adoption and security',driverInstitutionBody:'KPK allocated more than $25M to weETH as a core asset, while ether.fi completed Certora-audited upgrades to permissions and withdrawal paths. Broader collateral adoption can support weETH demand.',driverSupplyTitle:'Unlock overhang nearing its end',driverSupplyBody:'The current vesting schedule ends in March 2027. Remaining releases are a near-term source of selling pressure, but issuance overhang should fall materially after vesting ends.',buybackSource:'Official buyback program ↗',
    recentNews:'Recent major news',newsSummerTitle:'ether.fi Summer launched',newsSummerBody:'A next-generation app combining tokenized stocks and metals, Aave borrowing and fiat rails across more than 30 currencies.',newsHardeningTitle:'weETH hardening completed',newsHardeningBody:'Withdrawal paths, permissions and security boundaries were strengthened before entering Steakhouse Prime Vault markets.',newsKpkTitle:'KPK allocated $25M+ to weETH',newsKpkBody:'Following a 65+ point review, KPK adopted weETH as a core strategy asset rather than a tactical position.',newsSecurityTitle:'Core contract security overhaul',newsSecurityBody:'Certora audits and invariant testing were applied while operational-key permissions were segmented.',
    unlockSchedule:'Token unlock schedule',nextUnlock:'Next unlock',supplyPercent:'0.9% of total supply',remainingUnlock:'Remaining unlocks',remainingDetail:'6.3% of total supply · 7 events',vestingEnd:'Final vesting date',insiderUnlock:'Remaining releases are mainly investor and core contributor tokens',unlocked:'Unlocked 93.7%',locked:'Remaining 6.3%',unlockNote:'Based on the official 1B fixed-supply allocation and the Tokenomics.com vesting schedule. Market-data providers may define circulating and unlocked supply differently, so figures can vary.',allocationSource:'Official ETHFI allocation ↗',unlockSource:'Unlock schedule source ↗',disclaimer:'Research for informational purposes only, not investment advice. Market data and schedules may change.'
  }
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

function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  return `$${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', { maximumFractionDigits:4 }).format(amount)}`;
}

function formatSupply(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return amount >= 1e9 ? `${(amount / 1e9).toFixed(2)}B ETHFI` : `${(amount / 1e6).toFixed(1)}M ETHFI`;
}

async function refreshEthfiMarket() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/ether-fi?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
    const data = await response.json();
    const market = data.market_data || {};
    $('ethfiPrice').textContent = formatUsd(market.current_price?.usd);
    $('ethfiMarketCap').textContent = formatUsd(market.market_cap?.usd);
    $('ethfiFdv').textContent = formatUsd(market.fully_diluted_valuation?.usd);
    $('ethfiCirculating').textContent = `${c('circulatingPrefix')} ${formatSupply(market.circulating_supply)}`;
    $('marketStatus').textContent = `${c('marketLive')} · ${new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(data.last_updated || Date.now()))}`;
  } catch (error) {
    $('marketStatus').textContent = c('marketUnavailable');
  }
}

document.querySelector('.setup-tabs').onclick = event => {
  const tab = event.target.closest('[data-panel]');
  if (!tab) return;
  document.querySelectorAll('.setup-tab').forEach(button => {
    const active = button === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    $(button.dataset.panel).hidden = !active;
  });
};

setupHeaderWidgets({ onLanguageChange: next => { language = next; render(); refreshEthfiMarket(); } });

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
refreshEthfiMarket();
authClient.auth.onAuthStateChange((_event, session) => {
  account = accountFromSession(session);
  render();
});
