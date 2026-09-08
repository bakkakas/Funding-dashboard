import { accountFromSession, authClient, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';
import { applyPageTranslations } from './page-i18n.js?v=1';
import {
  assetsForResearchFilter,
  createResearchList,
  deleteResearchList,
  normalizeResearchCollections,
  renameResearchList,
  toggleAssetInResearchList,
  toggleFavorite,
} from './research-collections.js?v=1';
import {
  applyDecisionScenario,
  evaluateInvestmentDecision,
  seriesChange,
} from './investment-score.js?v=2';
import { numberOrNull, localize, safeUrl, decisionStorageKey, validateCatalog, validateAsset, selectAssetId, unlockSummary, resolveProfile, fetchJson, loadProtocolMetrics } from './research-data.js?v=1';
import { renderCatalog, renderAssetContent } from './research-renderer.js?v=1';

const $ = id => document.getElementById(id);
let account = null;
let mode = 'login';
let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
const COLLECTIONS_STORAGE_KEY = 'fundingResearchCollections.v1';
let currentAsset = null;
let catalog = [];
let profiles = {};
let currentPrice = null;
let assetController = null;
let selectionVersion = 0;
let searchQuery = '';
let metricsLoading = false;
let marketFailed = false;
let selectedResearchFilter = 'all';
let collections = loadResearchCollections();
let decisionPreferences = {};
let decisionScenario = 'live';
let decisionMetrics = null;
let decisionMarket = null;
let decisionMetricsError = false;
let decisionUpdatedAt = null;
const COPY={
  "ko": {
    "pageTitle": "투자 셋업",
    "heading": "투자 셋업",
    "navForeign": "외국인 수급",
    "navAssets": "내 자산",
    "navSetup": "투자 셋업",
    "planTab": "투자 계획",
    "analysisTab": "종목 분석",
    "comingSoon": "준비 중",
    "comingSoonNote": "투자 계획·목표 비중 관리 화면 추가 예정.",
    "continueGoogle": "Google로 계속하기",
    "or": "또는",
    "passwordPlaceholder": "비밀번호 (6자 이상)",
    "login": "로그인",
    "signup": "회원가입",
    "logout": "로그아웃",
    "close": "닫기",
    "connected": "계정 연결됨",
    "accountNotice": "로그인 시 다른 메뉴와 같은 계정에 투자 셋업 저장 예정.",
    "invalidEmail": "이메일 형식으로 입력.",
    "invalidPassword": "비밀번호 6자 이상 입력.",
    "confirmEmail": "확인 메일에서 인증 완료.",
    "signedIn": "로그인 완료",
    "googlePending": "Google 로그인으로 이동 중…",
    "researchLibrary": "RESEARCH LIBRARY",
    "moreReports": "분석 보고서 계속 추가 예정.",
    "allAssets": "전체",
    "favorites": "즐겨찾기",
    "myLists": "MY LISTS",
    "noCustomLists": "+를 눌러 첫 리스트 생성.",
    "emptyResearchFilter": "이 리스트에 담긴 종목 없음.",
    "listNamePlaceholder": "리스트 이름",
    "newListPlaceholder": "새 리스트 이름",
    "add": "추가",
    "addFavorite": "즐겨찾기",
    "favorited": "즐겨찾기 완료",
    "addToList": "리스트에 추가",
    "selectList": "담을 리스트 선택",
    "savedInBrowser": "브라우저에 자동 저장",
    "noListsInPicker": "리스트 없음. 아래에서 바로 생성.",
    "renameList": "리스트 이름 변경",
    "deleteList": "리스트 삭제",
    "renamePrompt": "새 리스트 이름 입력.",
    "deleteConfirm": "이 리스트 삭제?",
    "duplicateList": "같은 이름의 리스트 존재.",
    "cryptoResearch": "CRYPTO RESEARCH",
    "updatedLabel": "업데이트",
    "websiteLink": "웹사이트",
    "officialXLink": "공식 X",
    "telegramUnofficial": "Telegram · 비공식",
    "priceChart": "가격 변화 차트",
    "openTradingView": "TradingView에서 열기",
    "chartLoading": "차트 불러오는 중…",
    "chartSizeDefault": "기본",
    "chartResizeHint": "−/+ 버튼 또는 우측 하단 드래그로 세로 크기 조절",
    "price": "가격",
    "liveData": "CoinGecko 실시간",
    "marketCap": "시가총액 (Circulation 기준)",
    "fixedSupply": "최대 공급량",
    "marketFallback": "시장 데이터 불러오는 중",
    "marketLive": "CoinGecko 최신 시장 데이터",
    "marketUnavailable": "시장 데이터 조회 실패 · 재시도 가능",
    "circulatingSupply": "유통량",
    "circulatingRatioPrefix": "Max 대비 유통률",
    "sourceOfficialDocs": "공식 문서",
    "sourceOfficialBlog": "공식 블로그",
    "sourceKpkBlog": "공식 블로그 · KPK",
    "sourceSecurityBlog": "공식 블로그 · 보안",
    "overview": "개요",
    "tokenRole": "토큰 역할",
    "supply": "공급량",
    "officialOverview": "공식 프로토콜 개요 ↗",
    "valueDrivers": "토큰 가치 상승 요인",
    "recentNews": "최근 주요 뉴스",
    "decisionTracker": "INVESTMENT DECISION TRACKER",
    "decisionTitle": "투자 판단 테스트",
    "decisionIntro": "실데이터 규칙과 내 판단을 분리해 표시. 점수는 검토 우선순위이며 매수 신호가 아님.",
    "scenarioTest": "시나리오 테스트",
    "scenarioLive": "실데이터",
    "scenarioWarning": "주의 상황 체험",
    "scenarioInvalidated": "무효화 상황 체험",
    "systemSignal": "시스템 신호",
    "myDecision": "내 판단",
    "decisionInterest": "관심",
    "decisionWatch": "관망",
    "decisionBuyWait": "매수 대기",
    "decisionHolding": "보유",
    "decisionAvoid": "제외",
    "savedLocally": "이 브라우저에 저장",
    "buyZone": "매수 관심 가격",
    "optionalInput": "선택 입력",
    "nextCatalyst": "다음 촉매",
    "catalystNote": "이벤트 이후 공급 압력 재평가",
    "dataConfidence": "데이터 커버리지",
    "oneLineThesis": "내 한 줄 투자 논리",
    "thesisPlaceholder": "왜 이 프로젝트를 보는지 한 문장으로 기록",
    "scoreBreakdown": "자동 점수 · 근거",
    "scoreMethod": "0 위험 · 1 중립 · 2 양호 후 가중치 적용",
    "ruleMonitor": "투자 논리 모니터",
    "ruleMethod": "현재값·임계값·출처로 판정",
    "decisionLoading": "DefiLlama·CoinGecko 데이터 불러오는 중",
    "betaDisclaimer": "Beta 규칙 · 실제 사용 후 임계값 조정 필요",
    "unlockSchedule": "토큰 언락 일정",
    "nextUnlock": "다음 언락",
    "remainingUnlock": "잔여 언락",
    "vestingEnd": "등록 일정 종료",
    "unlockedLabel": "해제",
    "lockedLabel": "잔여",
    "eventsUnit": "회",
    "unlockComplete": "완료",
    "disclaimer": "정보 제공 목적의 리서치 · 투자 권유 아님. 시장 데이터와 일정은 변동 가능."
  },
  "en": {
    "pageTitle": "Investment Setup",
    "heading": "Investment Setup",
    "navForeign": "Foreign Flow",
    "navAssets": "My Assets",
    "navSetup": "Investment Setup",
    "planTab": "Investment Plan",
    "analysisTab": "Asset Research",
    "comingSoon": "Coming soon",
    "comingSoonNote": "Investment plans and target allocations will be added here.",
    "continueGoogle": "Continue with Google",
    "or": "or",
    "passwordPlaceholder": "Password (6+ characters)",
    "login": "Log in",
    "signup": "Sign up",
    "logout": "Log out",
    "close": "Close",
    "connected": "account connected",
    "accountNotice": "Log in to use the same account as the other dashboard sections.",
    "invalidEmail": "Enter a valid email address.",
    "invalidPassword": "Use at least 6 characters for the password.",
    "confirmEmail": "Check your email if confirmation is required.",
    "signedIn": "Signed in.",
    "googlePending": "Opening Google sign-in…",
    "researchLibrary": "RESEARCH LIBRARY",
    "moreReports": "New research reports will be added to this list.",
    "allAssets": "All",
    "favorites": "Favorites",
    "myLists": "MY LISTS",
    "noCustomLists": "Press + to create your first list.",
    "emptyResearchFilter": "There are no assets in this list.",
    "listNamePlaceholder": "List name",
    "newListPlaceholder": "New list name",
    "add": "Add",
    "addFavorite": "Favorite",
    "favorited": "Favorited",
    "addToList": "Add to list",
    "selectList": "Choose lists",
    "savedInBrowser": "Saved automatically in this browser",
    "noListsInPicker": "No lists yet. Create one below.",
    "renameList": "Rename list",
    "deleteList": "Delete list",
    "renamePrompt": "Enter a new list name.",
    "deleteConfirm": "Delete this list?",
    "duplicateList": "A list with that name already exists.",
    "cryptoResearch": "CRYPTO RESEARCH",
    "updatedLabel": "Updated",
    "websiteLink": "Website",
    "officialXLink": "Official X",
    "telegramUnofficial": "Telegram · unofficial",
    "priceChart": "Price chart",
    "openTradingView": "Open in TradingView",
    "chartLoading": "Loading chart…",
    "chartSizeDefault": "Default",
    "chartResizeHint": "Use −/+ or drag the bottom-right corner to resize vertically",
    "price": "Price",
    "liveData": "Live from CoinGecko",
    "marketCap": "Market cap (circulating)",
    "fixedSupply": "Maximum supply",
    "marketFallback": "Loading market data",
    "marketLive": "Latest CoinGecko market data",
    "marketUnavailable": "Market data unavailable · retry available",
    "circulatingSupply": "Circulating supply",
    "circulatingRatioPrefix": "Circulating / max supply",
    "sourceOfficialDocs": "Official docs",
    "sourceOfficialBlog": "Official blog",
    "sourceKpkBlog": "Official blog · KPK",
    "sourceSecurityBlog": "Official blog · security",
    "overview": "Overview",
    "tokenRole": "Token role",
    "supply": "Supply",
    "officialOverview": "Official protocol overview ↗",
    "valueDrivers": "Token value drivers",
    "recentNews": "Recent major news",
    "decisionTracker": "INVESTMENT DECISION TRACKER",
    "decisionTitle": "Decision tracker beta",
    "decisionIntro": "Live-data rules are separate from your decision. The score ranks review priority and is not a buy signal.",
    "scenarioTest": "Scenario test",
    "scenarioLive": "Live data",
    "scenarioWarning": "Preview warning state",
    "scenarioInvalidated": "Preview invalidation",
    "systemSignal": "System signal",
    "myDecision": "My decision",
    "decisionInterest": "Interested",
    "decisionWatch": "Watch",
    "decisionBuyWait": "Waiting to buy",
    "decisionHolding": "Holding",
    "decisionAvoid": "Avoid",
    "savedLocally": "Saved in this browser",
    "buyZone": "Price zone of interest",
    "optionalInput": "Optional",
    "nextCatalyst": "Next catalyst",
    "catalystNote": "Reassess supply pressure after the event",
    "dataConfidence": "Data coverage",
    "oneLineThesis": "My one-line thesis",
    "thesisPlaceholder": "Record why this project is on your watchlist",
    "scoreBreakdown": "Automated score · evidence",
    "scoreMethod": "0 risk · 1 neutral · 2 healthy, then weighted",
    "ruleMonitor": "Thesis monitor",
    "ruleMethod": "Evaluated from value, threshold and source",
    "decisionLoading": "Loading DefiLlama and CoinGecko data",
    "betaDisclaimer": "Beta rules · thresholds need tuning after real use",
    "unlockSchedule": "Token unlock schedule",
    "nextUnlock": "Next unlock",
    "remainingUnlock": "Remaining unlocks",
    "vestingEnd": "Registered schedule end",
    "unlockedLabel": "Unlocked",
    "lockedLabel": "Remaining",
    "eventsUnit": "events",
    "unlockComplete": "Complete",
    "disclaimer": "Research for information only · not investment advice. Market data and schedules may change."
  }
};
const c=key=>COPY[language][key] || COPY.ko[key] || key;

const DECISION_TEXT = {
  ko: {
    category: { protocolGrowth:'프로토콜 성장',tokenValueCapture:'토큰 가치 포착',supplyUnlock:'공급·언락',valuation:'밸류에이션',securityGovernance:'보안·거버넌스' },
    categoryNote: { protocolGrowth:'TVL 30일 변화',tokenValueCapture:'홀더 수익 30일',supplyUnlock:'다음 언락 / 유통량',valuation:'시총 / 연환산 프로토콜 수익',securityGovernance:'사고·정책 변경 확인' },
    signal: { priority:'검토 우선',watch:'관망',low:'낮은 우선순위',invalidated:'논리 무효화',pending:'판정 보류' },
    status: { pass:'정상',watch:'주의',danger:'위험',invalidated:'무효화',pending:'검토 필요' },
    ruleTitle: { growth:'성장',valueCapture:'가치 포착',unlockPressure:'언락 압력',criticalRisk:'치명 리스크' },
    ruleThreshold: { growth:'TVL 30일 10% 이상 하락 시 주의',valueCapture:'홀더 수익 30일 0이면 주의',unlockPressure:'유통량 대비 3% 초과 시 위험',criticalRisk:'중대 사고·가치 포착 폐지 시 무효화' },
    pending:'판정 보류',manualReview:'자동 사고 피드 미연동',incidentFound:'사고 발생 시뮬레이션',noIncident:'발생 없음',liveNote:'점수는 매수 신호 아님',testNote:'TEST · 알림 발송 안 함',invalidatedNote:'치명 조건이 점수보다 우선',loading:'평가 데이터 불러오는 중',checked:'확인',fetchFailed:'일부 실데이터 조회 실패',dataReady:'실데이터 판정 완료',points:'점',events:'월간 언락',sourceManual:'수동 검토',sourceTest:'TEST 데이터',ofCirculation:'유통량 대비',days30:'30일',multiple:'배',
  },
  en: {
    category: { protocolGrowth:'Protocol growth',tokenValueCapture:'Token value capture',supplyUnlock:'Supply & unlocks',valuation:'Valuation',securityGovernance:'Security & governance' },
    categoryNote: { protocolGrowth:'30d TVL change',tokenValueCapture:'30d holder revenue',supplyUnlock:'Next unlock / circulating',valuation:'Market cap / annualized revenue',securityGovernance:'Incident and policy review' },
    signal: { priority:'Review first',watch:'Watch',low:'Low priority',invalidated:'Thesis invalidated',pending:'Pending' },
    status: { pass:'Healthy',watch:'Watch',danger:'Risk',invalidated:'Invalidated',pending:'Review' },
    ruleTitle: { growth:'Growth',valueCapture:'Value capture',unlockPressure:'Unlock pressure',criticalRisk:'Critical risk' },
    ruleThreshold: { growth:'Watch if 30d TVL falls 10%+',valueCapture:'Watch if 30d holder revenue is zero',unlockPressure:'Risk above 3% of circulating',criticalRisk:'Invalidate on a major incident or removed value capture' },
    pending:'Pending',manualReview:'No live incident feed',incidentFound:'Simulated incident',noIncident:'No incident',liveNote:'Score is not a buy signal',testNote:'TEST · notifications disabled',invalidatedNote:'Critical rules override the score',loading:'Loading decision data',checked:'checked',fetchFailed:'Some live data failed',dataReady:'Live evaluation ready',points:'pts',events:'monthly unlock',sourceManual:'Manual review',sourceTest:'TEST data',ofCirculation:'of circulating',days30:'30d',multiple:'x',
  },
};
const d = key => DECISION_TEXT[language][key] ?? DECISION_TEXT.ko[key];

function loadDecisionPreferences() {
  const fallback = { personalDecision:'interest', buyMin:'', buyMax:'', thesis:'' };
  try {
    const saved = JSON.parse(localStorage.getItem(decisionStorageKey(currentAsset.id)) || '{}');
    return { ...fallback, ...saved };
  } catch (_error) {
    return fallback;
  }
}

function saveDecisionPreferences() {
  decisionPreferences = {
    personalDecision: $('personalDecision').value,
    buyMin: $('decisionBuyMin').value,
    buyMax: $('decisionBuyMax').value,
    thesis: $('decisionThesis').value.trim(),
  };
  localStorage.setItem(decisionStorageKey(currentAsset.id), JSON.stringify(decisionPreferences));
}

function loadResearchCollections() {
  try {
    return normalizeResearchCollections(JSON.parse(localStorage.getItem(COLLECTIONS_STORAGE_KEY) || '{}'));
  } catch (_error) {
    return normalizeResearchCollections({});
  }
}

function saveResearchCollections(next) {
  collections = normalizeResearchCollections(next);
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  renderResearchCollections();
}

function createListId() {
  return globalThis.crypto?.randomUUID?.() || `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function setListPickerOpen(open) {
  $('listPicker').hidden = !open;
  $('listPickerButton').setAttribute('aria-expanded', String(open));
  if (open) renderResearchCollections();
}

function renderResearchCollections() {
  if (!currentAsset) return;
  renderCatalog(catalog, currentAsset.id, collections.favorites, language);
  const assetIds = catalog.map(asset => asset.id);
  const matches = new Set(catalog.filter(asset => `${asset.name} ${asset.symbol}`.toLowerCase().includes(searchQuery)).map(asset => asset.id));
  const visibleAssetIds = new Set(assetsForResearchFilter(collections, selectedResearchFilter, assetIds).filter(id => matches.has(id)));
  const isFavorite = collections.favorites.includes(currentAsset.id);

  $('allResearchCount').textContent = String(assetIds.length);
  $('favoriteResearchCount').textContent = String(assetIds.filter(id => collections.favorites.includes(id)).length);
  document.querySelectorAll('.research-filter').forEach(button => button.classList.toggle('active', button.dataset.filter === selectedResearchFilter));
  document.querySelectorAll('[data-asset-id]').forEach(row => { row.hidden = !visibleAssetIds.has(row.dataset.assetId); });
  $('researchFilterEmpty').hidden = visibleAssetIds.size > 0;

  const heroFavorite = $('heroFavoriteButton');
  heroFavorite.querySelector('i').textContent = isFavorite ? '★' : '☆';
  heroFavorite.querySelector('span').textContent = isFavorite ? c('favorited') : c('addFavorite');
  heroFavorite.setAttribute('aria-pressed', String(isFavorite));

  const listNav = $('customListNav');
  listNav.replaceChildren();
  collections.lists.forEach(list => {
    const row = document.createElement('div');
    row.className = `custom-list-row${selectedResearchFilter === list.id ? ' active' : ''}`;
    const select = document.createElement('button');
    select.className = 'custom-list-select';
    select.type = 'button';
    const name = document.createElement('span');
    name.textContent = list.name;
    const count = document.createElement('b');
    count.textContent = String(list.assetIds.filter(id => assetIds.includes(id)).length);
    select.append(name, count);
    select.onclick = () => { selectedResearchFilter = list.id; renderResearchCollections(); };
    const rename = document.createElement('button');
    rename.className = 'custom-list-action';
    rename.type = 'button';
    rename.textContent = '✎';
    rename.title = c('renameList');
    rename.setAttribute('aria-label', `${list.name} ${c('renameList')}`);
    rename.onclick = () => {
      const nextName = window.prompt(c('renamePrompt'), list.name);
      if (nextName === null) return;
      const renamed = renameResearchList(collections, list.id, nextName);
      if (renamed.lists.find(item => item.id === list.id)?.name === list.name && nextName.trim() !== list.name) window.alert(c('duplicateList'));
      saveResearchCollections(renamed);
    };
    const remove = document.createElement('button');
    remove.className = 'custom-list-action delete';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = c('deleteList');
    remove.setAttribute('aria-label', `${list.name} ${c('deleteList')}`);
    remove.onclick = () => {
      if (!window.confirm(c('deleteConfirm'))) return;
      if (selectedResearchFilter === list.id) selectedResearchFilter = 'all';
      saveResearchCollections(deleteResearchList(collections, list.id));
    };
    row.append(select, rename, remove);
    listNav.append(row);
  });
  $('customListEmpty').hidden = collections.lists.length > 0;

  const options = $('listPickerOptions');
  options.replaceChildren();
  if (!collections.lists.length) {
    const empty = document.createElement('div');
    empty.className = 'list-picker-empty';
    empty.textContent = c('noListsInPicker');
    options.append(empty);
  } else {
    collections.lists.forEach(list => {
      const label = document.createElement('label');
      label.className = 'list-picker-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = list.assetIds.includes(currentAsset.id);
      checkbox.onchange = () => saveResearchCollections(toggleAssetInResearchList(collections, list.id, currentAsset.id));
      const name = document.createElement('span');
      name.textContent = list.name;
      label.append(checkbox, name);
      options.append(label);
    });
  }
}

function submitNewList(event, inputId, addCurrentAsset) {
  event.preventDefault();
  const input = $(inputId);
  const name = input.value.trim();
  if (!name) return void input.focus();
  const next = createResearchList(collections, name, createListId());
  if (next.lists.length === collections.lists.length) {
    input.setCustomValidity(c('duplicateList'));
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  input.value = '';
  const created = next.lists.at(-1);
  saveResearchCollections(addCurrentAsset ? toggleAssetInResearchList(next, created.id, currentAsset.id) : next);
  if (!addCurrentAsset) {
    selectedResearchFilter = created.id;
    renderResearchCollections();
  }
}

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
  if (!currentAsset) return;
  renderAssetContent(currentAsset, language, resolveProfile(currentAsset, profiles));
  renderResearchCollections();
  renderMarketData();
  renderUnlockSchedule(currentPrice);
  renderDecisionPanel();
}

function mountTradingViewChart() {
  const host = $('assetTradingViewChart');
  if (!host) return;
  host.replaceChildren();
  if (!currentAsset?.chart?.symbol) return;
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  widget.style.height = '100%';
  widget.style.width = '100%';
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.type = 'text/javascript';
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: currentAsset.chart.symbol,
    interval: 'D',
    timezone: 'Asia/Seoul',
    theme: 'dark',
    backgroundColor: 'rgba(10, 17, 14, 1)',
    gridColor: 'rgba(255, 255, 255, 0.06)',
    style: '1',
    locale: language === 'en' ? 'en' : 'kr',
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
    hide_side_toolbar: false,
    withdateranges: true,
    support_host: 'https://www.tradingview.com'
  });
  host.append(widget, script);
}

function resizeChart(delta) {
  const chart = document.querySelector('.tradingview-chart');
  if (!chart) return;
  const current = chart.getBoundingClientRect().height;
  chart.style.height = `${Math.min(1400, Math.max(320, current + delta))}px`;
}

$('chartShrinkButton').onclick = () => resizeChart(-100);
$('chartGrowButton').onclick = () => resizeChart(100);
$('chartResetButton').onclick = () => {
  const chart = document.querySelector('.tradingview-chart');
  if (chart) chart.style.removeProperty('height');
};

function formatUsd(value) {
  const amount = numberOrNull(value);
  if (amount === null) return '—';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  return `$${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', { maximumFractionDigits:4 }).format(amount)}`;
}

function formatSupply(value) {
  return formatUnlockSupply(value);
}

function formatUnlockSupply(value) {
  const amount = numberOrNull(value);
  if (amount === null) return '—';
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ${currentAsset.symbol}`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ${currentAsset.symbol}`;
  return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR').format(amount)} ${currentAsset.symbol}`;
}

function formatSignedPercent(value) {
  const amount = numberOrNull(value);
  if (amount === null) return d('pending');
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(1)}%`;
}

function decisionInput() {
  const today = kstDateKey();
  const {next:nextUnlock,completed} = unlockSummary(currentAsset,today);
  const circulating = numberOrNull(decisionMarket?.circulatingSupply);
  const nextUnlockToCirculatingPct = nextUnlock && Number.isFinite(circulating) && circulating > 0
    ? nextUnlock.amount / circulating * 100
    : completed ? 0 : null;
  return {
    tvl30dChange: decisionMetrics?.tvl30dChange ?? null,
    holderRevenue30d: decisionMetrics?.holderRevenue30d ?? null,
    nextUnlockToCirculatingPct,
    marketCap: decisionMarket?.marketCap ?? null,
    protocolRevenue30d: decisionMetrics?.protocolRevenue30d ?? null,
    securityIncident: null,
  };
}

function categoryValue(item, input) {
  if (!item.assessed) return d('pending');
  if (item.key === 'protocolGrowth') return `${formatSignedPercent(input.tvl30dChange)} · TVL ${formatUsd(decisionMetrics?.tvl)}`;
  if (item.key === 'tokenValueCapture') return `${formatUsd(input.holderRevenue30d)} · ${d('days30')}`;
  if (item.key === 'supplyUnlock') return `${Number(input.nextUnlockToCirculatingPct).toFixed(2)}% · ${d('ofCirculation')}`;
  if (item.key === 'valuation') return `${Number(item.value).toFixed(1)}${d('multiple')}`;
  return input.securityIncident ? d('incidentFound') : d('noIncident');
}

function ruleValue(rule) {
  if (rule.status === 'pending') return rule.key === 'criticalRisk' ? d('manualReview') : d('pending');
  if (rule.key === 'growth') return formatSignedPercent(rule.value);
  if (rule.key === 'valueCapture') return `${formatUsd(rule.value)} · ${d('days30')}`;
  if (rule.key === 'unlockPressure') return `${Number(rule.value).toFixed(2)}% · ${d('ofCirculation')}`;
  return rule.value ? d('incidentFound') : d('noIncident');
}

function renderDecisionScores(evaluation, input) {
  const host = $('decisionScoreList');
  host.replaceChildren(...evaluation.categories.map(item => {
    const row = document.createElement('div');
    row.className = `decision-score-row ${item.tone}`;
    const copy = document.createElement('span');
    copy.className = 'decision-score-copy';
    const title = document.createElement('strong');
    title.textContent = d('category')[item.key];
    const detail = document.createElement('small');
    detail.textContent = `${d('categoryNote')[item.key]} · ${categoryValue(item, input)}`;
    copy.append(title, detail);
    const bar = document.createElement('span');
    bar.className = 'decision-score-bar';
    const fill = document.createElement('i');
    fill.style.width = `${item.assessed ? item.rawScore / 2 * 100 : 0}%`;
    bar.append(fill);
    const points = document.createElement('b');
    points.className = 'decision-score-points';
    points.textContent = item.points === null ? d('pending') : `${Number(item.points.toFixed(1))}/${item.weight}`;
    row.append(copy, bar, points);
    return row;
  }));
}

function renderDecisionRules(evaluation) {
  const profile = resolveProfile(currentAsset, profiles);
  const host = $('decisionRuleList');
  host.replaceChildren(...evaluation.rules.map(rule => {
    const row = document.createElement('div');
    row.className = `decision-rule-row ${rule.status}`;
    const dot = document.createElement('i');
    dot.className = 'decision-rule-dot';
    const copy = document.createElement('span');
    copy.className = 'decision-rule-copy';
    const title = document.createElement('strong');
    title.textContent = d('ruleTitle')[rule.key];
    const threshold = document.createElement('small');
    const t=profile?.thresholds;
    const descriptions=t?(language==='en'?{
      growth:`Risk: 30d TVL ≤ ${t.growthRisk}%`,valueCapture:`Watch: holder revenue ≤ $${t.holderRevenueMin}`,unlockPressure:`Risk: circulating supply > ${t.unlockRisk}%`,criticalRisk:'Manual review of critical incidents',
    }:{
      growth:`위험: TVL 30일 ${t.growthRisk}% 이하`,valueCapture:`주의: 홀더 수익 $${t.holderRevenueMin} 이하`,unlockPressure:`위험: 유통량 대비 ${t.unlockRisk}% 초과`,criticalRisk:'중대 사고·정책 변경 수동 검토',
    }):{};
    threshold.textContent=descriptions[rule.key] || d('pending');
    copy.append(title, threshold);
    const value = document.createElement('span');
    value.className = 'decision-rule-value';
    const current = document.createElement('strong');
    current.textContent = ruleValue(rule);
    const source = document.createElement('a');
    const registeredSource = currentAsset.ruleSources[rule.key];
    if (safeUrl(registeredSource?.url)) source.href = safeUrl(registeredSource.url);
    source.target = '_blank';
    source.rel = 'noopener';
    source.textContent = evaluation.simulated ? d('sourceTest') : localize(registeredSource?.label, language) || d('pending');
    value.append(current, source);
    const status = document.createElement('b');
    status.className = 'decision-rule-status';
    status.textContent = d('status')[rule.status];
    row.append(dot, copy, value, status);
    return row;
  }));
}

function renderDecisionPanel() {
  if (!$('decisionSignalCard')) return;
  const input = applyDecisionScenario(decisionInput(), decisionScenario);
  const profile = resolveProfile(currentAsset, profiles);
  const evaluation = evaluateInvestmentDecision(input, profile);
  $('decisionSignalCard').dataset.tone = evaluation.signal;
  $('decisionSignal').textContent = d('signal')[evaluation.signal];
  $('decisionScore').textContent = evaluation.score === null ? '--' : String(evaluation.score);
  $('decisionSignalNote').textContent = !profile ? (language === 'en' ? 'Evaluation rules not configured' : '평가 기준 미설정') : evaluation.invalidated ? d('invalidatedNote') : evaluation.simulated ? d('testNote') : d('liveNote');
  $('decisionConfidence').textContent = `${evaluation.coverage}%`;
  $('decisionDataMode').textContent = evaluation.simulated ? 'TEST' : 'LIVE';
  $('decisionDataMode').classList.toggle('test', evaluation.simulated);

  const checked = decisionUpdatedAt
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', { dateStyle:'short', timeStyle:'short', timeZone:'Asia/Seoul' }).format(decisionUpdatedAt)
    : d('loading');
  $('decisionFreshness').textContent = decisionUpdatedAt ? `${checked} ${d('checked')}` : checked;
  $('decisionDataStatus').textContent = decisionMetricsError
    ? d('fetchFailed')
    : decisionMetrics && decisionMarket
      ? `${d('dataReady')} · TVL ${formatUsd(decisionMetrics.tvl)} · Revenue 30d ${formatUsd(decisionMetrics.protocolRevenue30d)}`
      : metricsLoading ? d('loading') : d('pending');

  const today = kstDateKey();
  const next = currentAsset.unlock.events.find(event => event.date >= today);
  if (next) {
    const days = Math.max(0, Math.round((new Date(`${next.date}T00:00:00+09:00`) - new Date(`${today}T00:00:00+09:00`)) / 86_400_000));
    $('decisionCatalyst').textContent = `${d('events')} · ${days === 0 ? 'D-DAY' : `D-${days}`}`;
  } else {
    $('decisionCatalyst').textContent = currentAsset.unlock.status === 'complete' ? c('unlockComplete') : d('pending');
  }
  renderDecisionScores(evaluation, input);
  renderDecisionRules(evaluation);
}

async function refreshDecisionMetrics(asset, version, signal) {
  metricsLoading = true;
  const result = await loadProtocolMetrics(asset, {signal});
  if (version !== selectionVersion) return;
  const metrics = result.metrics;
  decisionMetrics = metrics ? {
    ...metrics,
    tvl:numberOrNull(metrics.tvlRows.at(-1)?.totalLiquidityUSD),
    tvl30dChange:seriesChange(metrics.tvlRows,30),
  } : null;
  metricsLoading = false;
  decisionMetricsError = result.partial;
  decisionUpdatedAt = new Date();
  renderDecisionPanel();
}


function kstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function renderUnlockSchedule(price) {
  const today=kstDateKey();
  const {upcoming,next,known,completed,remaining}=unlockSummary(currentAsset,today);
  const total=numberOrNull(currentAsset.market.maxSupply);
  const ratio=known && total>0 ? remaining/total*100 : null;
  const usd=amount=>price===null || amount===null ? '—' : '≈ '+formatUsd(amount*price);
  const missing=language==='en'?'Schedule not available':'일정 확인 필요';
  if(next && known){
    const days=Math.max(0,Math.round((new Date(next.date+'T00:00:00+09:00')-new Date(today+'T00:00:00+09:00'))/86400000));
    $('nextUnlockCountdown').textContent=days===0?'D-DAY':'D-'+days;
    $('nextUnlockDate').textContent=next.date.replaceAll('-','.');
    $('nextUnlockAmount').textContent=formatUnlockSupply(next.amount);
    $('nextUnlockUsd').textContent=usd(next.amount);
    $('nextUnlockDetail').textContent=total>0?(next.amount/total*100).toFixed(1)+'% '+(language==='en'?'of max supply':' / 최대 공급량'):'—';
  }else{
    $('nextUnlockCountdown').textContent=completed?c('unlockComplete'):missing;
    $('nextUnlockDate').textContent='—';
    $('nextUnlockAmount').textContent=completed?formatUnlockSupply(0):'—';
    $('nextUnlockUsd').textContent=completed?'$0':'—';
    $('nextUnlockDetail').textContent=completed?c('unlockComplete'):missing;
  }
  $('remainingUnlockAmount').textContent=formatUnlockSupply(remaining);
  $('remainingUnlockUsd').textContent=usd(remaining);
  $('remainingUnlockDetail').textContent=known?(language==='en'?'Registered: ':'등록 일정: ')+upcoming.length+' '+c('eventsUnit')+(ratio===null?'':' · '+ratio.toFixed(1)+'%'):missing;
  const showTimeline=known && ratio!==null && ratio<=100 && currentAsset.unlock.completeSchedule===true;
  document.querySelector('.unlock-timeline').hidden=!showTimeline;
  document.querySelector('.unlock-legend').hidden=!showTimeline;
  if(showTimeline){
    $('unlockTimelinePast').style.width=(100-ratio)+'%';
    $('unlockTimelineMarker').style.left=(100-ratio)+'%';
    $('unlockedLegend').textContent=c('unlockedLabel')+' '+(100-ratio).toFixed(1)+'%';
    $('lockedLegend').textContent=c('lockedLabel')+' '+ratio.toFixed(1)+'%';
  }
}


function renderPrice(value, change24h) {
  const host = $('assetPrice');
  const change = numberOrNull(change24h);
  host.replaceChildren(document.createTextNode(formatUsd(value)));
  if (change === null) return;
  const changeNode = document.createElement('em');
  changeNode.className = `market-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`;
  changeNode.textContent = `(${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;
  host.append(' ', changeNode);
}

function renderMarketData() {
  const market = decisionMarket;
  renderPrice(market?.price, market?.change24h);
  $('assetMarketCap').textContent=formatUsd(market?.marketCap);
  $('assetFdv').textContent=formatUsd(market?.fdv);
  $('assetMarketCapRank').textContent=market?.rank>0?'#'+market.rank:'#—';
  $('assetCirculating').textContent=formatSupply(market?.circulatingSupply);
  const ratio=market?.circulatingSupply!==null && market?.maxSupply>0?market.circulatingSupply/market.maxSupply*100:null;
  $('assetCirculatingRatio').textContent=ratio===null?'—':ratio.toFixed(2)+'%';
  $('assetCirculatingBar').style.width=Math.min(100,Math.max(0,ratio??0))+'%';
  $('assetCirculatingBar').parentElement.setAttribute('aria-valuenow',String(Math.min(100,Math.max(0,ratio??0))));
  $('marketStatus').textContent=market?c('marketLive')+' · '+new Intl.DateTimeFormat(language==='en'?'en-US':'ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(market.updatedAt):!currentAsset.market.coingeckoId?(language==='en'?'Market source not configured':'시장 데이터 소스 미등록'):marketFailed?c('marketUnavailable'):c('marketFallback');
}

async function refreshAssetMarket(asset, version, signal) {
  if (!asset.market.coingeckoId) {
    $('marketStatus').textContent=language==='en'?'Market source not configured':'시장 데이터 소스 미등록';
    return;
  }
  try {
    const data=await fetchJson('https://api.coingecko.com/api/v3/coins/'+encodeURIComponent(asset.market.coingeckoId)+'?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',{signal});
    if(version!==selectionVersion)return;
    const market=data.market_data || {};
    const updatedAt=data.last_updated?new Date(data.last_updated):new Date();
    if(!Number.isFinite(updatedAt.getTime()) || Date.now()-updatedAt.getTime()>24*60*60*1000)throw new Error('Stale market data');
    const price=numberOrNull(market.current_price?.usd);
    currentPrice=price>0?price:null;
    decisionMarket={price:currentPrice,change24h:numberOrNull(market.price_change_percentage_24h),marketCap:numberOrNull(market.market_cap?.usd),fdv:numberOrNull(market.fully_diluted_valuation?.usd),rank:numberOrNull(data.market_cap_rank),circulatingSupply:numberOrNull(market.circulating_supply),maxSupply:numberOrNull(market.max_supply) ?? numberOrNull(asset.market.maxSupply),updatedAt};
    renderMarketData();
    renderUnlockSchedule(currentPrice);
    renderDecisionPanel();
  }catch(error){
    if(version!==selectionVersion)return;
    marketFailed=true;
    renderMarketData();
    renderDecisionPanel();
  }
}

function showLoadError(retry) {
  const host=$('researchLoading');
  host.hidden=false;
  host.textContent=language==='en'?'Unable to load research. ':'종목 정보를 불러오지 못했어. ';
  const button=document.createElement('button');
  button.className='chip';button.textContent=language==='en'?'Retry':'다시 시도';
  button.onclick=retry;host.append(button);
}

async function selectAsset(id, updateUrl=true) {
  if(!catalog.some(asset=>asset.id===id))return;
  const version=++selectionVersion;
  assetController?.abort();
  assetController=new AbortController();
  const signal=assetController.signal;
  document.querySelector('.research-report').hidden=true;
  $('researchLoading').hidden=false;
  $('researchLoading').textContent=language==='en'?'Loading research…':'종목 불러오는 중…';
  try {
    const data=await fetchJson('./data/research/'+encodeURIComponent(id)+'.json',{signal});
    if(version!==selectionVersion)return;
    currentAsset=validateAsset(data,id);
    currentPrice=null;decisionMetrics=null;decisionMarket=null;decisionMetricsError=false;decisionUpdatedAt=null;metricsLoading=true;marketFailed=false;
    decisionScenario='live';$('decisionScenario').value='live';
    decisionPreferences=loadDecisionPreferences();
    $('personalDecision').value=decisionPreferences.personalDecision;
    $('decisionBuyMin').value=decisionPreferences.buyMin;
    $('decisionBuyMax').value=decisionPreferences.buyMax;
    $('decisionThesis').value=decisionPreferences.thesis;
    setListPickerOpen(false);
    render();renderMarketData();mountTradingViewChart();
    $('researchLoading').hidden=true;
    document.querySelector('.research-report').hidden=false;
    if(updateUrl){const url=new URL(location.href);url.searchParams.set('asset',id);history.pushState({},'',url);}
    refreshAssetMarket(currentAsset,version,signal);
    refreshDecisionMetrics(currentAsset,version,signal);
  }catch(error){
    if(version!==selectionVersion)return;
    showLoadError(()=>selectAsset(id,updateUrl));
  }
}

async function initializeResearch() {
  try {
    const [index,settings]=await Promise.all([fetchJson('./data/research/index.json'),fetchJson('./data/research/profiles.json')]);
    catalog=validateCatalog(index);profiles=settings;
    renderCatalog(catalog,null,collections.favorites,language);
    const requested=new URL(location.href).searchParams.get('asset');
    const selected=selectAssetId(catalog,requested);
    if(requested!==selected){const url=new URL(location.href);url.searchParams.set('asset',selected);history.replaceState({},'',url);}
    await selectAsset(selected,false);
  }catch(error){showLoadError(initializeResearch);}
}
window.addEventListener('popstate',()=>selectAsset(selectAssetId(catalog,new URL(location.href).searchParams.get('asset')),false));
$('researchReportList').onclick=event=>{
  const favorite=event.target.closest('[data-favorite-asset]');
  if(favorite){saveResearchCollections(toggleFavorite(collections,favorite.dataset.favoriteAsset));return;}
  const button=event.target.closest('[data-select-asset]');
  if(button)selectAsset(button.dataset.selectAsset);
};
$('researchSearch').oninput=event=>{searchQuery=event.target.value.trim().toLowerCase();renderResearchCollections();};

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

$('allResearchFilter').onclick = () => { selectedResearchFilter = 'all'; renderResearchCollections(); };
$('favoriteResearchFilter').onclick = () => { selectedResearchFilter = 'favorites'; renderResearchCollections(); };
$('heroFavoriteButton').onclick = () => saveResearchCollections(toggleFavorite(collections, currentAsset.id));
$('showNewListButton').onclick = () => {
  const form = $('sidebarNewListForm');
  form.hidden = !form.hidden;
  if (!form.hidden) $('sidebarNewListName').focus();
};
$('sidebarNewListForm').onsubmit = event => submitNewList(event, 'sidebarNewListName', false);
$('pickerNewListForm').onsubmit = event => submitNewList(event, 'pickerNewListName', true);
$('sidebarNewListName').oninput = event => event.currentTarget.setCustomValidity('');
$('pickerNewListName').oninput = event => event.currentTarget.setCustomValidity('');
$('listPickerButton').onclick = () => setListPickerOpen($('listPicker').hidden);
$('decisionScenario').onchange = event => {
  decisionScenario = event.currentTarget.value;
  renderDecisionPanel();
};
['personalDecision','decisionBuyMin','decisionBuyMax','decisionThesis'].forEach(id => {
  $(id).addEventListener('input', saveDecisionPreferences);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.list-picker-wrap')) setListPickerOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setListPickerOpen(false);
});

setupHeaderWidgets({ onLanguageChange: next => { language = next; render(); if(currentAsset){renderMarketData();mountTradingViewChart();} } });

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

await initializeResearch();
const { data, error } = await authClient.auth.getSession();
if (error) $('authStatus').textContent = error.message;
account = accountFromSession(data?.session);
render();
authClient.auth.onAuthStateChange((_event, session) => {
  account = accountFromSession(session);
  render();
});
