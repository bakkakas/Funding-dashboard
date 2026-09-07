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
} from './investment-score.js?v=1';

const $ = id => document.getElementById(id);
let account = null;
let mode = 'login';
let language = localStorage.getItem('fundingDashboardLanguage') === 'en' ? 'en' : 'ko';
const COLLECTIONS_STORAGE_KEY = 'fundingResearchCollections.v1';
const DECISION_STORAGE_KEY = 'fundingInvestmentDecision.ethfi.v1';
const CURRENT_ASSET_ID = 'ethfi';
const ETHFI_TOTAL_SUPPLY = 1_000_000_000;
const ETHFI_UNLOCK_EVENTS = [
  { date: '2026-09-15', amount: 8_945_833 },
  { date: '2026-10-15', amount: 8_945_833 },
  { date: '2026-11-15', amount: 8_945_833 },
  { date: '2026-12-15', amount: 8_945_833 },
  { date: '2027-01-15', amount: 8_945_833 },
  { date: '2027-02-15', amount: 8_945_833 },
  { date: '2027-03-15', amount: 8_945_833 },
];
let currentEthfiPrice = 0.638;
let selectedResearchFilter = 'all';
let collections = loadResearchCollections();
let decisionPreferences = loadDecisionPreferences();
let decisionScenario = 'live';
let decisionMetrics = null;
let decisionMarket = null;
let decisionMetricsError = false;
let decisionUpdatedAt = null;
const COPY={
  ko:{
    pageTitle:'투자 셋업',heading:'투자 셋업',navForeign:'외국인 수급',navAssets:'내 자산',navSetup:'투자 셋업',planTab:'투자 계획',analysisTab:'종목 분석',comingSoon:'준비 중',comingSoonNote:'투자 계획·목표 비중 관리 화면 추가 예정.',continueGoogle:'Google로 계속하기',or:'또는',passwordPlaceholder:'비밀번호 (6자 이상)',login:'로그인',signup:'회원가입',logout:'로그아웃',close:'닫기',connected:'계정 연결됨',accountNotice:'로그인 시 다른 메뉴와 같은 계정에 투자 셋업 저장 예정.',invalidEmail:'이메일 형식으로 입력.',invalidPassword:'비밀번호 6자 이상 입력.',confirmEmail:'확인 메일에서 인증 완료.',signedIn:'로그인 완료',googlePending:'Google 로그인으로 이동 중…',
    researchLibrary:'RESEARCH LIBRARY',moreReports:'분석 보고서 계속 추가 예정.',allAssets:'전체',favorites:'즐겨찾기',myLists:'MY LISTS',noCustomLists:'+를 눌러 첫 리스트 생성.',emptyResearchFilter:'이 리스트에 담긴 종목 없음.',listNamePlaceholder:'리스트 이름',newListPlaceholder:'새 리스트 이름',add:'추가',addFavorite:'즐겨찾기',favorited:'즐겨찾기 완료',addToList:'리스트에 추가',selectList:'담을 리스트 선택',savedInBrowser:'브라우저에 자동 저장',noListsInPicker:'리스트 없음. 아래에서 바로 생성.',renameList:'리스트 이름 변경',deleteList:'리스트 삭제',renamePrompt:'새 리스트 이름 입력.',deleteConfirm:'이 리스트 삭제?',duplicateList:'같은 이름의 리스트 존재.',cryptoResearch:'CRYPTO RESEARCH',heroSummary:'비수탁형 리퀴드 리스테이킹에서 출발해 온체인 금융 앱으로 확장 중인 ether.fi 거버넌스 토큰.',updatedLabel:'업데이트',websiteLink:'웹사이트',officialXLink:'공식 X',telegramUnofficial:'Telegram · 비공식',priceChart:'가격 변화 차트',openTradingView:'TradingView에서 열기',chartLoading:'차트 불러오는 중…',chartSizeDefault:'기본',chartResizeHint:'−/+ 버튼 또는 우측 하단 드래그로 세로 크기 조절',price:'가격',liveData:'CoinGecko 실시간',marketCap:'시가총액 (Circulation 기준)',fixedSupply:'공식 고정 공급량 1B',marketFallback:'2026.08.24 기준값 · 실시간 데이터 갱신 중',marketLive:'CoinGecko 최신 시장 데이터',marketUnavailable:'실시간 조회 실패 · 2026.08.24 기준값 표시',circulatingSupply:'유통량',circulatingRatioPrefix:'Max 대비 유통률',sourceOfficialDocs:'공식 문서',sourceOfficialBlog:'공식 블로그',sourceKpkBlog:'공식 블로그 · KPK',sourceSecurityBlog:'공식 블로그 · 보안',
    overview:'개요',overviewBody:'ether.fi는 ETH 보유자가 자산 통제권을 유지한 채 스테이킹·리스테이킹 수익을 얻도록 설계된 비수탁 프로토콜. eETH·weETH로 유동성과 DeFi 활용성 유지. 현재 Stake·Liquid·Cash, 토큰화 주식·금속 거래, Aave 기반 대출, 법정화폐 입출금을 묶은 온체인 금융 앱으로 확장 중.',tokenRole:'토큰 역할',tokenRoleValue:'거버넌스 · sETHFI 스테이킹 · 바이백 분배',supply:'공급량',supplyValue:'공식 문서상 고정 10억 개 · 추가 발행 없음',officialOverview:'공식 프로토콜 개요 ↗',
    valueDrivers:'토큰 가치 상승 요인',driverBuybackTitle:'프로토콜 수익 기반 바이백',driverBuybackBody:'eETH 출금 수수료 수익 100%를 주간 바이백에 사용. Stake·Liquid·Cash 수익 일부도 월간 바이백에 배정. 매입 ETHFI는 sETHFI 보유자에게 분배.',driverAppTitle:'온체인 금융 앱 확장',driverAppBody:'토큰화 주식·금속, 담보 대출, 글로벌 법정화폐 레일, Cash 카드를 하나의 앱에 통합. 사용량·수익 증가 시 바이백 재원 확대 가능.',driverInstitutionTitle:'기관 채택과 보안 강화',driverInstitutionBody:'KPK가 2,500만 달러 이상을 weETH 핵심 자산으로 배정. Certora 감사와 권한·출금 구조 강화 완료. 담보 채택 확대는 weETH 수요에 긍정적.',driverSupplyTitle:'언락 오버행의 종료 접근',driverSupplyBody:'현 일정 기준 2027년 3월 베스팅 종료. 잔여 물량은 단기 매도 압력. 종료 후 신규 유통 부담 축소.',
    recentNews:'최근 주요 뉴스',newsSummerTitle:'ether.fi Summer 출시',newsSummerBody:'토큰화 주식·금속 거래, Aave 담보대출, 30개 이상 통화의 입출금 수단을 통합한 차세대 앱 공개.',newsHardeningTitle:'weETH 프로토콜 하드닝 완료',newsHardeningBody:'출금 경로·권한·보안 경계를 강화하고 Steakhouse Prime Vault 담보 시장에 진입.',newsKpkTitle:'KPK, weETH에 2,500만 달러 이상 배정',newsKpkBody:'65개 이상 항목의 실사를 거쳐 전술 포지션이 아닌 핵심 전략 자산으로 채택.',newsSecurityTitle:'핵심 컨트랙트 보안 구조 개편',newsSecurityBody:'Certora 감사와 불변조건 테스트를 적용하고 운영 키 권한을 세분화.',
    decisionTracker:'INVESTMENT DECISION TRACKER',decisionTitle:'투자 판단 테스트',decisionIntro:'실데이터 규칙과 내 판단을 분리해 표시. 점수는 검토 우선순위이며 매수 신호가 아님.',scenarioTest:'시나리오 테스트',scenarioLive:'실데이터',scenarioWarning:'주의 상황 체험',scenarioInvalidated:'무효화 상황 체험',systemSignal:'시스템 신호',myDecision:'내 판단',decisionInterest:'관심',decisionWatch:'관망',decisionBuyWait:'매수 대기',decisionHolding:'보유',decisionAvoid:'제외',savedLocally:'이 브라우저에 저장',buyZone:'매수 관심 가격',optionalInput:'선택 입력',nextCatalyst:'다음 촉매',catalystNote:'이벤트 이후 공급 압력 재평가',dataConfidence:'판단 신뢰도',oneLineThesis:'내 한 줄 투자 논리',thesisPlaceholder:'왜 이 프로젝트를 보는지 한 문장으로 기록',scoreBreakdown:'자동 점수 · 근거',scoreMethod:'0 위험 · 1 중립 · 2 양호 후 가중치 적용',ruleMonitor:'투자 논리 모니터',ruleMethod:'현재값·임계값·출처로 판정',decisionLoading:'DefiLlama·CoinGecko 데이터 불러오는 중',betaDisclaimer:'Beta 규칙 · 실제 사용 후 임계값 조정 필요',
    unlockSchedule:'토큰 언락 일정',nextUnlock:'다음 언락',remainingUnlock:'잔여 언락',vestingEnd:'최종 베스팅 종료',insiderUnlock:'주요 잔여 물량: 투자자·핵심 기여자',unlockedLabel:'해제',lockedLabel:'잔여',eventsUnit:'회',unlockComplete:'완료',unlockNote:'대규모 월간 언락 수치는 Tokenomics.com 기준. 공식 배분·Tokenomist·DropsTab 교차 참고. 플랫폼별 유통량·언락 정의 차이로 수치 편차 가능. 달러 가치는 CoinGecko 현재가 연동.',allocationSource:'공식 ETHFI 배분 ↗',disclaimer:'정보 제공 목적의 리서치 · 투자 권유 아님. 시장 데이터와 일정은 변동 가능.'
  },
  en:{
    pageTitle:'Investment Setup',heading:'Investment Setup',navForeign:'Foreign Flow',navAssets:'My Assets',navSetup:'Investment Setup',planTab:'Investment Plan',analysisTab:'Asset Research',comingSoon:'Coming soon',comingSoonNote:'Investment plans and target allocations will be added here.',continueGoogle:'Continue with Google',or:'or',passwordPlaceholder:'Password (6+ characters)',login:'Log in',signup:'Sign up',logout:'Log out',close:'Close',connected:'account connected',accountNotice:'Log in to use the same account as the other dashboard sections.',invalidEmail:'Enter a valid email address.',invalidPassword:'Use at least 6 characters for the password.',confirmEmail:'Check your email if confirmation is required.',signedIn:'Signed in.',googlePending:'Opening Google sign-in…',
    researchLibrary:'RESEARCH LIBRARY',moreReports:'New research reports will be added to this list.',allAssets:'All',favorites:'Favorites',myLists:'MY LISTS',noCustomLists:'Press + to create your first list.',emptyResearchFilter:'There are no assets in this list.',listNamePlaceholder:'List name',newListPlaceholder:'New list name',add:'Add',addFavorite:'Favorite',favorited:'Favorited',addToList:'Add to list',selectList:'Choose lists',savedInBrowser:'Saved automatically in this browser',noListsInPicker:'No lists yet. Create one below.',renameList:'Rename list',deleteList:'Delete list',renamePrompt:'Enter a new list name.',deleteConfirm:'Delete this list?',duplicateList:'A list with that name already exists.',cryptoResearch:'CRYPTO RESEARCH',heroSummary:'The governance token of ether.fi, expanding from non-custodial liquid restaking into a full onchain finance app.',updatedLabel:'Updated',websiteLink:'Website',officialXLink:'Official X',telegramUnofficial:'Telegram · unofficial',priceChart:'Price chart',openTradingView:'Open in TradingView',chartLoading:'Loading chart…',chartSizeDefault:'Default',chartResizeHint:'Use −/+ or drag the bottom-right corner to resize vertically',price:'Price',liveData:'Live from CoinGecko',marketCap:'Market cap (circulating)',fixedSupply:'Official fixed supply: 1B',marketFallback:'Baseline as of Aug 24, 2026 · refreshing live data',marketLive:'Latest CoinGecko market data',marketUnavailable:'Live lookup failed · showing Aug 24, 2026 baseline',circulatingSupply:'Circulating supply',circulatingRatioPrefix:'Circulating / max supply',sourceOfficialDocs:'Official docs',sourceOfficialBlog:'Official blog',sourceKpkBlog:'Official blog · KPK',sourceSecurityBlog:'Official blog · security',
    overview:'Overview',overviewBody:'ether.fi is a non-custodial protocol designed to let ETH holders earn staking and restaking rewards while retaining control of their assets. eETH and weETH preserve liquidity and DeFi composability. The project is now expanding into an onchain finance app combining Stake, Liquid and Cash with tokenized stocks and metals, Aave-powered borrowing and global fiat rails.',tokenRole:'Token role',tokenRoleValue:'Governance · sETHFI staking · buyback distribution',supply:'Supply',supplyValue:'Officially fixed at 1 billion · no further issuance',officialOverview:'Official protocol overview ↗',
    valueDrivers:'Token value drivers',driverBuybackTitle:'Protocol-revenue buybacks',driverBuybackBody:'100% of eETH withdrawal-fee revenue funds weekly buybacks, while part of Stake, Liquid and Cash revenue funds monthly buybacks. Purchased ETHFI is distributed to sETHFI holders.',driverAppTitle:'Onchain finance app expansion',driverAppBody:'Tokenized stocks and metals, collateralized borrowing, global fiat rails and the Cash card are now integrated in one app. Greater usage and revenue could expand the buyback pool.',driverInstitutionTitle:'Institutional adoption and security',driverInstitutionBody:'KPK allocated more than $25M to weETH as a core asset, while ether.fi completed Certora-audited upgrades to permissions and withdrawal paths. Broader collateral adoption can support weETH demand.',driverSupplyTitle:'Unlock overhang nearing its end',driverSupplyBody:'The current vesting schedule ends in March 2027. Remaining releases are a near-term source of selling pressure, but issuance overhang should fall materially after vesting ends.',buybackSource:'Official buyback program ↗',
    recentNews:'Recent major news',newsSummerTitle:'ether.fi Summer launched',newsSummerBody:'A next-generation app combining tokenized stocks and metals, Aave borrowing and fiat rails across more than 30 currencies.',newsHardeningTitle:'weETH hardening completed',newsHardeningBody:'Withdrawal paths, permissions and security boundaries were strengthened before entering Steakhouse Prime Vault markets.',newsKpkTitle:'KPK allocated $25M+ to weETH',newsKpkBody:'Following a 65+ point review, KPK adopted weETH as a core strategy asset rather than a tactical position.',newsSecurityTitle:'Core contract security overhaul',newsSecurityBody:'Certora audits and invariant testing were applied while operational-key permissions were segmented.',
    decisionTracker:'INVESTMENT DECISION TRACKER',decisionTitle:'Decision tracker beta',decisionIntro:'Live-data rules are separate from your decision. The score ranks review priority and is not a buy signal.',scenarioTest:'Scenario test',scenarioLive:'Live data',scenarioWarning:'Preview warning state',scenarioInvalidated:'Preview invalidation',systemSignal:'System signal',myDecision:'My decision',decisionInterest:'Interested',decisionWatch:'Watch',decisionBuyWait:'Waiting to buy',decisionHolding:'Holding',decisionAvoid:'Avoid',savedLocally:'Saved in this browser',buyZone:'Price zone of interest',optionalInput:'Optional',nextCatalyst:'Next catalyst',catalystNote:'Reassess supply pressure after the event',dataConfidence:'Data confidence',oneLineThesis:'My one-line thesis',thesisPlaceholder:'Record why this project is on your watchlist',scoreBreakdown:'Automated score · evidence',scoreMethod:'0 risk · 1 neutral · 2 healthy, then weighted',ruleMonitor:'Thesis monitor',ruleMethod:'Evaluated from value, threshold and source',decisionLoading:'Loading DefiLlama and CoinGecko data',betaDisclaimer:'Beta rules · thresholds need tuning after real use',
    unlockSchedule:'Token unlock schedule',nextUnlock:'Next unlock',remainingUnlock:'Remaining unlocks',vestingEnd:'Final vesting date',insiderUnlock:'Main remaining allocation: investors and core contributors',unlockedLabel:'Unlocked',lockedLabel:'Remaining',eventsUnit:'events',unlockComplete:'Complete',unlockNote:'Major monthly unlock figures follow Tokenomics.com, cross-checked with the official allocation, Tokenomist and DropsTab. Figures may vary because providers define circulating and unlocked supply differently. USD values use the current CoinGecko price.',allocationSource:'Official ETHFI allocation ↗',disclaimer:'Research for information only · not investment advice. Market data and schedules may change.'
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
    const saved = JSON.parse(localStorage.getItem(DECISION_STORAGE_KEY) || '{}');
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
  localStorage.setItem(DECISION_STORAGE_KEY, JSON.stringify(decisionPreferences));
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
  const assetIds = [...document.querySelectorAll('[data-asset-id]')].map(row => row.dataset.assetId);
  const visibleAssetIds = new Set(assetsForResearchFilter(collections, selectedResearchFilter, assetIds));
  const isFavorite = collections.favorites.includes(CURRENT_ASSET_ID);

  $('allResearchCount').textContent = String(assetIds.length);
  $('favoriteResearchCount').textContent = String(assetIds.filter(id => collections.favorites.includes(id)).length);
  document.querySelectorAll('.research-filter').forEach(button => button.classList.toggle('active', button.dataset.filter === selectedResearchFilter));
  document.querySelectorAll('[data-asset-id]').forEach(row => { row.hidden = !visibleAssetIds.has(row.dataset.assetId); });
  $('researchFilterEmpty').hidden = visibleAssetIds.size > 0;

  const sidebarFavorite = $('reportFavoriteButton');
  sidebarFavorite.textContent = isFavorite ? '★' : '☆';
  sidebarFavorite.setAttribute('aria-pressed', String(isFavorite));
  sidebarFavorite.setAttribute('aria-label', isFavorite ? `ETHFI ${c('favorited')}` : `ETHFI ${c('addFavorite')}`);
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
      checkbox.checked = list.assetIds.includes(CURRENT_ASSET_ID);
      checkbox.onchange = () => saveResearchCollections(toggleAssetInResearchList(collections, list.id, CURRENT_ASSET_ID));
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
  saveResearchCollections(addCurrentAsset ? toggleAssetInResearchList(next, created.id, CURRENT_ASSET_ID) : next);
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
  renderResearchCollections();
  renderUnlockSchedule(currentEthfiPrice);
  renderDecisionPanel();
}

function mountTradingViewChart() {
  const host = $('ethfiTradingViewChart');
  if (!host) return;
  host.replaceChildren();
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
    symbol: 'BINANCE:ETHFIUSDT',
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

function formatUnlockSupply(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ETHFI`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ETHFI`;
  return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR').format(amount)} ETHFI`;
}

function formatSignedPercent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return d('pending');
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(1)}%`;
}

function decisionInput() {
  const today = kstDateKey();
  const nextUnlock = ETHFI_UNLOCK_EVENTS.find(event => event.date >= today);
  const circulating = Number(decisionMarket?.circulatingSupply);
  const nextUnlockToCirculatingPct = nextUnlock && Number.isFinite(circulating) && circulating > 0
    ? nextUnlock.amount / circulating * 100
    : null;
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
  if (rule.status === 'pending') return d('manualReview');
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
  const sourceUrls = {
    growth:'https://defillama.com/protocol/ether.fi?fees=true&tvl=true',
    valueCapture:'https://defillama.com/protocol/ether.fi?fees=true&tvl=false',
    unlockPressure:'https://app.tokenomics.com/tokenomics/ether-fi/unlocks',
    criticalRisk:'https://www.ether.fi/blog',
  };
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
    threshold.textContent = d('ruleThreshold')[rule.key];
    copy.append(title, threshold);
    const value = document.createElement('span');
    value.className = 'decision-rule-value';
    const current = document.createElement('strong');
    current.textContent = ruleValue(rule);
    const source = document.createElement('a');
    source.href = sourceUrls[rule.key];
    source.target = '_blank';
    source.rel = 'noopener';
    source.textContent = `${evaluation.simulated ? d('sourceTest') : rule.key === 'criticalRisk' ? d('sourceManual') : rule.source} ↗`;
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
  const evaluation = evaluateInvestmentDecision(input);
  $('decisionSignalCard').dataset.tone = evaluation.signal;
  $('decisionSignal').textContent = d('signal')[evaluation.signal];
  $('decisionScore').textContent = evaluation.score === null ? '--' : String(evaluation.score);
  $('decisionSignalNote').textContent = evaluation.invalidated ? d('invalidatedNote') : evaluation.simulated ? d('testNote') : d('liveNote');
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
      : d('loading');

  const today = kstDateKey();
  const next = ETHFI_UNLOCK_EVENTS.find(event => event.date >= today);
  if (next) {
    const days = Math.max(0, Math.round((new Date(`${next.date}T00:00:00+09:00`) - new Date(`${today}T00:00:00+09:00`)) / 86_400_000));
    $('decisionCatalyst').textContent = `${d('events')} · ${days === 0 ? 'D-DAY' : `D-${days}`}`;
  } else {
    $('decisionCatalyst').textContent = c('unlockComplete');
  }
  renderDecisionScores(evaluation, input);
  renderDecisionRules(evaluation);
}

async function refreshDecisionMetrics() {
  const base = 'https://api.llama.fi';
  const fetchJson = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DefiLlama ${response.status}`);
    return response.json();
  };
  try {
    const [protocol, fees, revenue, holders] = await Promise.all([
      fetchJson(`${base}/protocol/ether.fi`),
      fetchJson(`${base}/summary/fees/ether.fi?dataType=dailyFees`),
      fetchJson(`${base}/summary/fees/ether.fi?dataType=dailyRevenue`),
      fetchJson(`${base}/summary/fees/ether.fi?dataType=dailyHoldersRevenue`),
    ]);
    const tvlRows = Array.isArray(protocol.tvl) ? protocol.tvl : [];
    decisionMetrics = {
      tvl: Number(tvlRows.at(-1)?.totalLiquidityUSD),
      tvl30dChange: seriesChange(tvlRows, 30),
      fees30d: Number(fees.total30d),
      protocolRevenue30d: Number(revenue.total30d),
      holderRevenue30d: Number(holders.total30d),
    };
    decisionMetricsError = false;
    decisionUpdatedAt = new Date();
  } catch (_error) {
    decisionMetricsError = true;
  }
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
  const today = kstDateKey();
  const upcoming = ETHFI_UNLOCK_EVENTS.filter(event => event.date >= today);
  const next = upcoming[0];
  const remaining = upcoming.reduce((sum, event) => sum + event.amount, 0);
  const remainingRatio = remaining / ETHFI_TOTAL_SUPPLY * 100;
  const unlockedRatio = Math.max(0, 100 - remainingRatio);

  if (next) {
    const days = Math.max(0, Math.round((new Date(`${next.date}T00:00:00+09:00`) - new Date(`${today}T00:00:00+09:00`)) / 86_400_000));
    $('nextUnlockCountdown').textContent = days === 0 ? 'D-DAY' : `D-${days}`;
    $('nextUnlockDate').textContent = next.date.replaceAll('-', '.');
    $('nextUnlockAmount').textContent = formatUnlockSupply(next.amount);
    $('nextUnlockUsd').textContent = `≈ ${formatUsd(next.amount * price)}`;
    $('nextUnlockDetail').textContent = language === 'en'
      ? `${(next.amount / ETHFI_TOTAL_SUPPLY * 100).toFixed(1)}% of total supply`
      : `총 공급량의 ${(next.amount / ETHFI_TOTAL_SUPPLY * 100).toFixed(1)}%`;
  } else {
    $('nextUnlockCountdown').textContent = c('unlockComplete');
    $('nextUnlockDate').textContent = '2027.03.15';
    $('nextUnlockAmount').textContent = '0 ETHFI';
    $('nextUnlockUsd').textContent = '$0';
    $('nextUnlockDetail').textContent = c('unlockComplete');
  }

  $('remainingUnlockAmount').textContent = formatUnlockSupply(remaining);
  $('remainingUnlockUsd').textContent = `≈ ${formatUsd(remaining * price)}`;
  $('remainingUnlockDetail').textContent = language === 'en'
    ? `${remainingRatio.toFixed(1)}% of total supply · ${upcoming.length} ${c('eventsUnit')}`
    : `총 공급량의 ${remainingRatio.toFixed(1)}% · ${upcoming.length}${c('eventsUnit')}`;
  $('unlockTimelinePast').style.width = `${unlockedRatio}%`;
  $('unlockTimelineMarker').style.left = `${unlockedRatio}%`;
  $('unlockedLegend').textContent = `${c('unlockedLabel')} ${unlockedRatio.toFixed(1)}%`;
  $('lockedLegend').textContent = `${c('lockedLabel')} ${remainingRatio.toFixed(1)}%`;
}

function renderPrice(value, change24h) {
  const host = $('ethfiPrice');
  const change = Number(change24h);
  host.replaceChildren(document.createTextNode(formatUsd(value)));
  if (!Number.isFinite(change)) return;
  const changeNode = document.createElement('em');
  changeNode.className = `market-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`;
  changeNode.textContent = `(${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;
  host.append(' ', changeNode);
}

async function refreshEthfiMarket() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/ether-fi?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
    const data = await response.json();
    const market = data.market_data || {};
    const livePrice = Number(market.current_price?.usd);
    if (Number.isFinite(livePrice) && livePrice > 0) currentEthfiPrice = livePrice;
    renderPrice(currentEthfiPrice, market.price_change_percentage_24h);
    $('ethfiMarketCap').textContent = formatUsd(market.market_cap?.usd);
    $('ethfiFdv').textContent = formatUsd(market.fully_diluted_valuation?.usd);
    const rank = Number(data.market_cap_rank);
    $('ethfiMarketCapRank').textContent = Number.isFinite(rank) ? `#${rank}` : '#-';
    $('ethfiCirculating').textContent = formatSupply(market.circulating_supply);
    const circulating = Number(market.circulating_supply);
    const maxSupply = Number(market.max_supply);
    decisionMarket = {
      marketCap: Number(market.market_cap?.usd),
      circulatingSupply: circulating,
      volume24h: Number(market.total_volume?.usd),
      price: currentEthfiPrice,
    };
    const circulatingRatio = Number.isFinite(circulating) && Number.isFinite(maxSupply) && maxSupply > 0
      ? Math.min(100, Math.max(0, circulating / maxSupply * 100))
      : null;
    $('ethfiCirculatingRatio').textContent = circulatingRatio === null ? '-' : `${circulatingRatio.toFixed(2)}%`;
    $('ethfiCirculatingBar').style.width = `${circulatingRatio ?? 0}%`;
    $('ethfiCirculatingBar').parentElement.setAttribute('aria-valuenow', String(circulatingRatio ?? 0));
    renderUnlockSchedule(currentEthfiPrice);
    renderDecisionPanel();
    $('marketStatus').textContent = `${c('marketLive')} · ${new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(data.last_updated || Date.now()))}`;
  } catch (error) {
    $('marketStatus').textContent = c('marketUnavailable');
    renderDecisionPanel();
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

$('allResearchFilter').onclick = () => { selectedResearchFilter = 'all'; renderResearchCollections(); };
$('favoriteResearchFilter').onclick = () => { selectedResearchFilter = 'favorites'; renderResearchCollections(); };
$('reportFavoriteButton').onclick = () => saveResearchCollections(toggleFavorite(collections, CURRENT_ASSET_ID));
$('heroFavoriteButton').onclick = () => saveResearchCollections(toggleFavorite(collections, CURRENT_ASSET_ID));
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
$('personalDecision').value = decisionPreferences.personalDecision;
$('decisionBuyMin').value = decisionPreferences.buyMin;
$('decisionBuyMax').value = decisionPreferences.buyMax;
$('decisionThesis').value = decisionPreferences.thesis;
['personalDecision','decisionBuyMin','decisionBuyMax','decisionThesis'].forEach(id => {
  $(id).addEventListener(id === 'decisionThesis' ? 'input' : 'change', saveDecisionPreferences);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.list-picker-wrap')) setListPickerOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setListPickerOpen(false);
});

setupHeaderWidgets({ onLanguageChange: next => { language = next; render(); refreshEthfiMarket(); mountTradingViewChart(); } });

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
refreshDecisionMetrics();
authClient.auth.onAuthStateChange((_event, session) => {
  account = accountFromSession(session);
  render();
});
