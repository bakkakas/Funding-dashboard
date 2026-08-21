import {
  ANALYTICS_BACKEND_CONFIGURED,
  ASSET_LOGO_DOMAINS,
  ASSET_NAME_OVERRIDES,
  FX_LATEST_URL,
  FX_REFERENCE_URL,
  LIVE_REFRESH_MS,
  PRICE_CANDLE_WINDOWS,
  STANDARD_USDT_DISPLAY_ASSETS,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTIONS_BASE_URL,
} from './config.js';
import { accountFromSession, authClient } from './auth.js?v=1';
import { fetchLiveLatest, loadDashboardData } from './api.js?v=4';
import {
  addDynamicFundingAsset,
  hydrateDynamicFundingHistory,
  refreshFundingAssetDefinition,
  searchFundingAssets,
} from './funding-catalog.js?v=3';
import { bindUiEvents } from './events.js?v=13';
import { I18N, t } from './i18n.js?v=3';
import {
  comparisonAnnualized as buildComparisonAnnualized,
  currentComparisonStats as buildCurrentComparisonStats,
  feeDirection,
  feeTone,
  fmtIntervalHours,
  fundingFeeValue,
  intervalHoursFor,
  periodComparisonStats as buildPeriodComparisonStats,
  periodFundingFee,
} from './metrics.js?v=10';
import { renderAssetSummary as renderAssetSummaryView } from './render/asset-summary.js';
import { renderChart, renderPriceChart } from './render/charts.js?v=2';
import { renderComparisons as renderComparisonsView, renderExchangeTabs as renderExchangeTabsView } from './render/comparisons.js?v=4';
import {
  renderCurrentFundingInsights,
  renderPeriodFundingInsights,
  renderSelectedPairFundingMetrics,
} from './render/funding-insights.js?v=8';
import { renderHistoryRows, renderPaymentCounts } from './render/history.js?v=2';
import {
  fmtFx,
  toKST,
  toKSTCompact,
} from './formatters.js';
import { state } from './state.js';
    function selectedWindowDays(){
      const days = state.data && state.data.meta && state.data.meta.windows
        ? Number(state.data.meta.windows[state.selectedWindow])
        : NaN;
      return Number.isFinite(days) ? days : null;
    }
    function selectedWindowLabel(){
      const days = selectedWindowDays();
      if(days == null) return state.selectedWindow;
      if(state.lang === 'en') return `${days}D`;
      return `${days}일`;
    }
    function defaultPriceCandleWindowFor(windowKey){
      const days = state.data && state.data.meta && state.data.meta.windows
        ? Number(state.data.meta.windows[windowKey])
        : NaN;
      if(Number.isFinite(days)){
        if(days <= 1) return '1H';
        if(days <= 7) return '4H';
        return '1D';
      }
      if(windowKey === '1D') return '1H';
      if(windowKey === '7D') return '4H';
      return '1D';
    }
    function selectedFundingDirectionTitle(tone, direction){
      const period = selectedWindowLabel();
      if(state.lang === 'en'){
        return `<span class="period-highlight">${period}</span> Funding Fee Direction : <span class="direction-value ${tone}">${direction}</span>`;
      }
      return `<span class="period-highlight">${period}</span> Funding Fee 방향 : <span class="direction-value ${tone}">${direction}</span>`;
    }
    function setLanguage(lang){
      state.lang = lang === 'en' ? 'en' : 'ko';
      localStorage.setItem('fundingDashboardLanguage', state.lang);
      document.documentElement.lang = state.lang;
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
      document.getElementById('langKoButton')?.classList.toggle('active', state.lang === 'ko');
      document.getElementById('langEnButton')?.classList.toggle('active', state.lang === 'en');
      if(state.data) document.getElementById('updatedAt').textContent=t('updated')+': '+toKST(state.data.updatedAt);
      const fxTicker=document.getElementById('usdKrwTicker');
      if(fxTicker && (fxTicker.textContent === I18N.ko.usdKrwLoading || fxTicker.textContent === I18N.en.usdKrwLoading)) fxTicker.textContent=t('usdKrwLoading');
      renderAuth();
      renderAssetPicker();
      renderFavoriteTabs();
      renderComparisons();
      if(state.data && state.selectedPair) render();
    }

    function displaySymbol(pair){ return pair.displaySymbol || pair.symbol; }
    function assetId(pair){ return pair.assetId || displaySymbol(pair); }
    function assetName(pair){
      const id = assetId(pair);
      const override = ASSET_NAME_OVERRIDES[id] && ASSET_NAME_OVERRIDES[id][state.lang];
      return override || pair.assetName || displaySymbol(pair);
    }
    function pairDisplayName(pair){
      if(STANDARD_USDT_DISPLAY_ASSETS.has(assetId(pair))) return `${displaySymbol(pair)}:USDT`;
      if(pair.exchange === 'Hyperliquid') return pair.symbol;
      if(pair.exchange === 'OKX' && pair.symbol.endsWith('-USDT-SWAP')) return `${pair.symbol.replace('-USDT-SWAP', '')}:USDT`;
      if(pair.symbol.endsWith('USDT')) return `${pair.symbol.slice(0, -4)}:USDT`;
      return pair.symbol;
    }
    function pairTradeUrl(pair){
      if(pair.exchange === 'Binance') return `https://www.binance.com/en/futures/${pair.symbol}`;
      if(pair.exchange === 'Bybit') return `https://www.bybit.com/trade/usdt/${pair.symbol}`;
      if(pair.exchange === 'Hyperliquid') return `https://app.hyperliquid.xyz/trade/${pair.symbol}`;
      if(pair.exchange === 'Aster') return `https://www.asterdex.com/en/trade/pro/futures/${pair.symbol}`;
      if(pair.exchange === 'OKX') return `https://www.okx.com/trade-swap/${pair.symbol.toLowerCase()}`;
      if(pair.exchange === 'Variational') return `https://omni.variational.io/perpetual/${encodeURIComponent(pair.symbol)}`;
      if(pair.exchange === 'Orbs Perps Hub') return `https://perps.thena.fi/trade/${pair.symbol}`;
      return '#';
    }
    function exchangeLogoUrl(exchange){
      return exchangeLogoFallbackUrl(exchange);
    }
    function exchangeLogoFallbackUrl(exchange){
      const domains = {
        Aster: 'asterdex.com',
        Binance: 'binance.com',
        Bybit: 'bybit.com',
        Hyperliquid: 'hyperliquid.xyz',
        OKX: 'okx.com',
        'Orbs Perps Hub': 'orbs.com',
        Variational: 'variational.io',
      };
      const domain = domains[exchange] || exchange.toLowerCase() + '.com';
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
    function assetLogoUrl(symbol){
      const dynamicPair=state.data ? getPairsForAsset(symbol).map(([,pair])=>pair).find(pair=>pair.logoUrl) : null;
      if(dynamicPair) return dynamicPair.logoUrl;
      return assetLogoFallbackUrl(symbol);
    }
    function assetLogoFallbackUrl(symbol){
      const domain = ASSET_LOGO_DOMAINS[symbol];
      return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : '';
    }
    function setLogoImage(img, primaryUrl, fallbackUrl){
      const nextPrimary=primaryUrl || '';
      const nextFallback=fallbackUrl || '';
      if(img.dataset.primaryUrl === nextPrimary && img.dataset.fallbackUrl === nextFallback && img.getAttribute('src')){
        return;
      }
      img.dataset.primaryUrl = nextPrimary;
      img.dataset.fallbackUrl = nextFallback;
      img.onerror = () => {
        if(img.dataset.fallbackUrl && img.src !== img.dataset.fallbackUrl){
          img.src = img.dataset.fallbackUrl;
          return;
        }
        img.classList.remove('loaded');
      };
      img.onload = () => img.classList.add('loaded');
      if(primaryUrl){
        img.src = primaryUrl;
      } else {
        img.classList.remove('loaded');
        img.removeAttribute('src');
      }
    }
    function exchangeSortWeight(exchange){
      return ['Hyperliquid','Binance','Bybit','Aster','OKX','Orbs Perps Hub','Variational'].indexOf(exchange);
    }
    function comparisonAnnualized(pairKey, pair, latest){
      return buildComparisonAnnualized(pair, latest, state.selectedWindow);
    }
    function trackLocalVisit(){
      const today = new Date().toISOString().slice(0,10);
      const total = Number(localStorage.getItem('dashboardLocalVisits') || '0') + 1;
      const lastDay = localStorage.getItem('dashboardLastVisitDay');
      const daily = Number(localStorage.getItem('dashboardDailyVisits') || '0') + (lastDay === today ? 1 : 0);
      localStorage.setItem('dashboardLocalVisits', String(total));
      localStorage.setItem('dashboardDailyVisits', String(lastDay === today ? daily : 1));
      localStorage.setItem('dashboardLastVisitDay', today);
      trackSupabaseVisit();
    }
    function visitorStorageKey(){ return 'fundingDashboardVisitorId'; }
    function getVisitorId(){
      let visitorId = localStorage.getItem(visitorStorageKey());
      if(!visitorId){
        visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(visitorStorageKey(), visitorId);
      }
      return visitorId;
    }
    function trackSupabaseVisit(){
      if(!ANALYTICS_BACKEND_CONFIGURED) return;
      if(/HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(navigator.userAgent || '')) return;
      fetch(`${SUPABASE_FUNCTIONS_BASE_URL}/track-visit`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_ANON_KEY,
        },
        body:JSON.stringify({
          visitorId:getVisitorId(),
          path:location.pathname + location.search,
          referrer:document.referrer || '',
        }),
      }).catch(console.error);
    }
    function favoriteStorageKey(){
      return state.auth && state.auth.email ? `favoritePairs:${state.auth.email.toLowerCase()}` : 'favoritePairs';
    }
    function favoriteDefinitionsStorageKey(){
      return `${favoriteStorageKey()}:dynamicAssets`;
    }
    function removeDynamicFundingAssets(){
      if(!state.data?.pairs) return;
      Object.keys(state.data.pairs).forEach(pairKey=>{
        if(state.data.pairs[pairKey]?.dynamic) delete state.data.pairs[pairKey];
      });
    }
    function loadFavoriteDefinitions(){
      try { return JSON.parse(localStorage.getItem(favoriteDefinitionsStorageKey()) || '[]'); } catch(e) { return []; }
    }
    function saveFavoriteDefinitions(){
      const favoriteIds=new Set(state.favorites);
      const definitions=getAssetGroups().filter(group=>favoriteIds.has(group.id)).map(group=>{
        const dynamicPairs=group.pairs.map(([,pair])=>pair).filter(pair=>pair.dynamic);
        if(!dynamicPairs.length) return null;
        return {
          id:group.id,
          name:group.name,
          thumb:dynamicPairs.find(pair=>pair.logoUrl)?.logoUrl || '',
          pairs:dynamicPairs.map(pair=>({
            exchange:pair.exchange,
            symbol:pair.symbol,
            fundingIntervalHours:pair.fundingIntervalHours || (24 / pair.fundingPeriodsPerDay) || 8,
          })),
          remote:true,
        };
      }).filter(Boolean);
      localStorage.setItem(favoriteDefinitionsStorageKey(), JSON.stringify(definitions));
    }
    async function restoreFavoriteAssets(items){
      for(const definition of loadFavoriteDefinitions()){
        const refreshed=await refreshFundingAssetDefinition(definition).catch(()=>definition);
        addDynamicFundingAsset(state.data, refreshed);
      }
      const existing=new Set(getAssetGroups().map(group=>group.id));
      const missing=[...new Set(items)].filter(id=>!existing.has(id));
      await Promise.allSettled(missing.map(async id=>{
        const results=await searchFundingAssets(id);
        const match=results.find(result=>result.id===id);
        if(match) addDynamicFundingAsset(state.data, match);
      }));
    }
    async function applyAuthSession(session){
      state.auth = accountFromSession(session);
      removeDynamicFundingAssets();
      const stored=loadFavorites();
      await restoreFavoriteAssets(stored);
      state.favorites = normalizeFavorites(stored);
      saveFavorites();
      renderAuth();
      renderFavoriteTabs();
      render();
    }
    async function loadAuth(){
      const { data, error } = await authClient.auth.getSession();
      if(error) console.error(error);
      state.auth = accountFromSession(data?.session);
      authClient.auth.onAuthStateChange((_event, session) => applyAuthSession(session));
    }
    function loadFavorites(){
      try { return JSON.parse(localStorage.getItem(favoriteStorageKey()) || '[]'); } catch(e) { return []; }
    }
    function normalizeFavorites(items){
      const seen = new Set();
      return items.map(item => {
        const pair = state.data && state.data.pairs ? state.data.pairs[item] : null;
        return pair ? assetId(pair) : item;
      }).filter(item => {
        const exists = getAssetGroups().some(group => group.id === item);
        if(!exists || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
    }
    function saveFavorites(){
      localStorage.setItem(favoriteStorageKey(), JSON.stringify(state.favorites.slice(0,12)));
      saveFavoriteDefinitions();
    }
    function renderAuth(){
      const loginButton=document.getElementById('loginButton');
      if(!loginButton) return;
      loginButton.textContent=state.auth ? state.auth.email : t('login');
      document.getElementById('signupButton').textContent=state.auth ? t('logout') : t('signup');
    }
    function openAuthModal(mode){
      state.authMode=mode;
      const modal=document.getElementById('authModal');
      document.getElementById('authModalTitle').textContent=mode === 'signup' ? t('signup') : t('login');
      document.getElementById('authSubmitButton').textContent=mode === 'signup' ? t('signupSave') : t('loginSave');
      document.getElementById('authStatus').innerHTML=t('authSynced');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      document.getElementById('authEmail').focus();
    }
    function closeAuthModal(){
      const modal=document.getElementById('authModal');
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    }
    async function fetchUsdKrw(){
      const ticker=document.getElementById('usdKrwTicker');
      try {
        const [latestRes, refRes] = await Promise.all([
          fetch(FX_LATEST_URL, { cache:'no-store' }),
          fetch(FX_REFERENCE_URL, { cache:'no-store' }),
        ]);
        const latestJson = await latestRes.json();
        const refJson = await refRes.json();
        const latest = Number(latestJson.rates && latestJson.rates.KRW);
        const reference = Number(refJson.usd && refJson.usd.krw);
        if(!latest || !reference) throw new Error('USD/KRW rate unavailable');
        const change = (latest - reference) / reference;
        const tone = change > 0 ? 'bad' : change < 0 ? 'good' : 'warn';
        ticker.innerHTML = `USD/KRW ${fmtFx(latest)} <span class="fx-change ${tone}">(${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%)</span>`;
        ticker.className = 'fx-ticker';
        ticker.title = `latest: ${latestJson.time_last_update_utc || 'open.er-api'}, reference date: ${refJson.date || '-'}`;
      } catch(err) {
        console.error(err);
        ticker.textContent = t('usdKrwFailed');
        ticker.className = 'fx-ticker warn';
      }
    }
    function getAssetGroups(){
      const groups = new Map();
      Object.entries(state.data.pairs).forEach(([pairKey, pair]) => {
        const id = assetId(pair);
        if(!groups.has(id)) groups.set(id, { id, name: assetName(pair), pairs: [] });
        groups.get(id).pairs.push([pairKey, pair]);
      });
      return Array.from(groups.values()).sort((a,b)=>a.name.localeCompare(b.name, state.lang === 'en' ? 'en' : 'ko'));
    }
    function getPairsForAsset(selectedAsset=state.selectedAsset){
      return Object.entries(state.data.pairs)
        .filter(([_, pair]) => assetId(pair) === selectedAsset)
        .sort((a,b)=>{
          const aw=exchangeSortWeight(a[1].exchange);
          const bw=exchangeSortWeight(b[1].exchange);
          if(aw !== bw) return (aw < 0 ? 99 : aw) - (bw < 0 ? 99 : bw);
          return a[1].exchange.localeCompare(b[1].exchange);
        });
    }
    function getSortedEntries(){ let entries=Object.entries(state.data.pairs); if(state.sortMode==='annualized_desc'){ entries.sort((a,b)=>b[1].windows[state.selectedWindow].annualizedPct-a[1].windows[state.selectedWindow].annualizedPct); } else if(state.sortMode==='annualized_asc'){ entries.sort((a,b)=>a[1].windows[state.selectedWindow].annualizedPct-b[1].windows[state.selectedWindow].annualizedPct); } else { entries.sort((a,b)=>assetName(a[1]).localeCompare(assetName(b[1]), state.lang === 'en' ? 'en' : 'ko') || a[1].exchange.localeCompare(b[1].exchange)); } return entries; }

    function renderAssetPicker(){
      const input=document.getElementById('assetSearch');
      const groups=getAssetGroups();
      const selected=groups.find(group=>group.id===state.selectedAsset);
      input.value=selected ? selected.name : '';
      renderAssetDropdown();
    }

    function renderAssetDropdown(filter=''){
      const dropdown=document.getElementById('assetDropdown');
      const normalized=filter.trim().toLocaleLowerCase('ko');
      const localGroups=getAssetGroups().filter(group=>{
        if(!normalized) return true;
        return group.name.toLocaleLowerCase('ko').includes(normalized) || group.id.toLocaleLowerCase('ko').includes(normalized);
      });
      const localIds=new Set(localGroups.map(group=>group.id));
      const remoteGroups=(normalized ? state.remoteAssetResults : []).filter(group=>!localIds.has(group.id));
      const groups=[...localGroups, ...remoteGroups];
      dropdown.innerHTML='';
      if(!groups.length){
        const empty=document.createElement('div');
        empty.className='asset-empty';
        empty.textContent=state.remoteSearchLoading
          ? (state.lang === 'en' ? 'Searching supported perpetual markets…' : '지원되는 무기한 선물 종목 검색 중…')
          : t('noSearchResults');
        dropdown.appendChild(empty);
        return;
      }
      groups.forEach(group=>{
        const option=document.createElement('button');
        option.type='button';
        option.className='asset-option'+(group.id===state.selectedAsset?' active':'');
        const name=document.createElement('span');
        name.className='asset-option-name';
        name.textContent=group.name;
        const symbol=document.createElement('span');
        symbol.className='asset-option-symbol';
        symbol.textContent=group.remote
          ? `${group.id} · ${group.pairs.length}${state.lang === 'en' ? ' exchanges' : '개 거래소'}`
          : group.id;
        option.append(name, symbol);
        option.addEventListener('mousedown', e=>e.preventDefault());
        option.addEventListener('click', async ()=>{
          if(group.remote) await selectRemoteAsset(group);
          else selectAsset(group.id);
          closeAssetDropdown();
        });
        dropdown.appendChild(option);
      });
      if(state.remoteSearchLoading && normalized){
        const loading=document.createElement('div');
        loading.className='asset-empty';
        loading.textContent=state.lang === 'en' ? 'Searching more crypto markets…' : '추가 크립토 마켓 검색 중…';
        dropdown.appendChild(loading);
      }
    }

    async function searchRemoteAssets(filter){
      const query=String(filter || '').trim();
      const token=++state.remoteSearchToken;
      if(query.length < 2){
        state.remoteAssetResults=[];
        state.remoteSearchLoading=false;
        return;
      }
      state.remoteAssetResults=[];
      state.remoteSearchLoading=true;
      renderAssetDropdown(query);
      try{
        const results=await searchFundingAssets(query);
        if(token !== state.remoteSearchToken) return;
        state.remoteAssetResults=results;
      } catch(error){
        console.error(error);
        if(token !== state.remoteSearchToken) return;
        state.remoteAssetResults=[];
      } finally {
        if(token !== state.remoteSearchToken) return;
        state.remoteSearchLoading=false;
        const input=document.getElementById('assetSearch');
        if(input.value.trim() === query) renderAssetDropdown(query);
      }
    }

    function openAssetDropdown(){
      const input=document.getElementById('assetSearch');
      document.getElementById('assetDropdown').classList.add('open');
      renderAssetDropdown(input.value);
    }

    function closeAssetDropdown(){
      document.getElementById('assetDropdown').classList.remove('open');
    }

    function renderExchangePicker(){
      return;
    }

    function selectAssetFromSearch(value){
      const normalized=value.trim().toLocaleLowerCase('ko');
      if(!normalized) return;
      const groups=getAssetGroups();
      const exact=groups.find(group=>group.name.toLocaleLowerCase('ko')===normalized || group.id.toLocaleLowerCase('ko')===normalized);
      if(exact){ selectAsset(exact.id); return; }
      const matches=groups.filter(group=>group.name.toLocaleLowerCase('ko').includes(normalized) || group.id.toLocaleLowerCase('ko').includes(normalized));
      if(matches.length===1) selectAsset(matches[0].id);
    }

    function selectAsset(selectedAsset){
      state.selectedAsset=selectedAsset;
      const current=state.data.pairs[state.selectedPair];
      if(!current || assetId(current) !== selectedAsset){
        const first=getPairsForAsset(selectedAsset)[0];
        if(first) state.selectedPair=first[0];
      }
      renderFavoriteTabs(); renderAssetPicker(); renderExchangePicker(); renderComparisons(); render();
      const pairKeys=getPairsForAsset(selectedAsset).map(([pairKey])=>pairKey);
      refreshLiveAll().then(()=>hydrateDynamicPairs(pairKeys)).catch(console.error);
    }
    async function hydrateDynamicPairs(pairKeys){
      await Promise.allSettled(pairKeys.map(async pairKey=>{
        const pair=state.data.pairs[pairKey];
        await hydrateDynamicFundingHistory(pair, state.data.meta.windows);
        if(state.selectedAsset === assetId(pair)) render();
      }));
    }
    async function selectRemoteAsset(group){
      const pairKeys=addDynamicFundingAsset(state.data, group);
      if(!pairKeys.length) return;
      state.selectedAsset=group.id;
      state.selectedPair=pairKeys[0];
      state.remoteAssetResults=[];
      renderFavoriteTabs();
      renderAssetPicker();
      renderComparisons();
      render();
      await refreshLiveAll();
      hydrateDynamicPairs(pairKeys).catch(console.error);
    }
    function selectPair(pairKey){
      state.selectedPair=pairKey;
      state.selectedAsset=assetId(state.data.pairs[pairKey]);
      renderFavoriteTabs(); renderAssetPicker(); renderExchangePicker(); renderComparisons(); render();
      refreshLiveAll().catch(console.error);
      hydrateDynamicPairs([pairKey]).catch(console.error);
    }
    function reorderFavorite(fromId, toId){
      if(!fromId || !toId || fromId === toId) return;
      const next = state.favorites.slice();
      const fromIndex = next.indexOf(fromId);
      const toIndex = next.indexOf(toId);
      if(fromIndex < 0 || toIndex < 0) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      state.favorites = next;
      saveFavorites();
      renderFavoriteTabs();
    }
    function renderFavoriteTabs(){
      const tabs=document.getElementById('favoriteTabs');
      tabs.innerHTML='';
      const groups=getAssetGroups();
      state.favorites.forEach(favoriteAssetId=>{
        const group=groups.find(item=>item.id===favoriteAssetId);
        if(!group) return;
        const btn=document.createElement('button');
        btn.className='chip'+(favoriteAssetId===state.selectedAsset?' active':'');
        btn.textContent=`★ ${group.name}`;
        btn.draggable=true;
        btn.dataset.favoriteId=favoriteAssetId;
        btn.onclick=()=>selectAsset(favoriteAssetId);
        btn.addEventListener('dragstart', e=>{
          state.draggedFavorite=favoriteAssetId;
          btn.classList.add('dragging');
          e.dataTransfer.effectAllowed='move';
          e.dataTransfer.setData('text/plain', favoriteAssetId);
        });
        btn.addEventListener('dragend', ()=>{
          state.draggedFavorite=null;
          btn.classList.remove('dragging');
        });
        btn.addEventListener('dragover', e=>{
          e.preventDefault();
          e.dataTransfer.dropEffect='move';
        });
        btn.addEventListener('drop', e=>{
          e.preventDefault();
          reorderFavorite(e.dataTransfer.getData('text/plain') || state.draggedFavorite, favoriteAssetId);
        });
        tabs.appendChild(btn);
      });
    }
    function renderWindowTabs(){ const tabs=document.getElementById('windowTabs'); tabs.innerHTML=''; Object.keys(state.data.meta.windows).forEach(key=>{ const btn=document.createElement('button'); btn.className='chip'+(key===state.selectedWindow?' active':''); btn.textContent=key; btn.onclick=()=>{ state.selectedWindow=key; state.priceCandleWindow=defaultPriceCandleWindowFor(key); renderWindowTabs(); renderPriceCandleTabs(); render({ skipComparisons:true }); }; tabs.appendChild(btn); }); }
    function renderPriceCandleTabs(){
      const tabs=document.getElementById('priceCandleTabs');
      tabs.innerHTML='';
      PRICE_CANDLE_WINDOWS.forEach(item=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='chip'+(item.key===state.priceCandleWindow?' active':'');
        btn.textContent=item.key;
        btn.onclick=()=>{
          state.priceCandleWindow=item.key;
          renderPriceCandleTabs();
          render();
        };
        tabs.appendChild(btn);
      });
    }
    function comparisonRenderDeps(){
      return {
        assetId,
        comparisonAnnualized,
        currentComparisonStats:getComparisonStats,
        exchangeLogoFallbackUrl,
        exchangeLogoUrl,
        feeTone,
        fmtIntervalHours,
        fundingFeeValue,
        getLatestForPair,
        getPairsForAsset,
        intervalHoursFor,
        pairDisplayName,
        pairTradeUrl,
        selectPair,
        setLogoImage,
      };
    }
    function renderComparisons(){ renderComparisonsView(comparisonRenderDeps()); }
    function getFilteredRows(pair){ const days=state.data.meta.windows[state.selectedWindow]; const minTs=Date.now()-days*24*3600*1000; return pair.rows.filter(r=>r.fundingTime>=minTs); }

    function formatCountdown(nextFundingTime){
      if (!nextFundingTime) return t('fetchFailed');
      const diff = nextFundingTime - Date.now();
      if (diff <= 0) return t('settling');
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function startCountdown(nextFundingTime){
      if(state.countdownTimer) clearInterval(state.countdownTimer);
      const renderCountdown=()=>{
        document.getElementById('nextFunding').textContent = formatCountdown(nextFundingTime);
        document.getElementById('nextFundingAt').textContent = nextFundingTime ? (`${t('settlementTime')}: ` + toKSTCompact(nextFundingTime)) : t('settlementTimeFailed');
      };
      renderCountdown();
      state.countdownTimer=setInterval(renderCountdown,1000);
    }

    function getLatestForPair(pairKey, pair){
      return state.liveLatestByPair[pairKey] || pair.latest || {};
    }

    function getComparisonStats(){
      return buildCurrentComparisonStats({
        data:state.data,
        selectedPair:state.selectedPair,
        selectedAsset:state.selectedAsset,
        selectedWindow:state.selectedWindow,
        liveLatestByPair:state.liveLatestByPair,
        getPairsForAsset,
        getLatestForPair,
      });
    }

    function periodComparisonStats(windowKey){
      return buildPeriodComparisonStats({
        data:state.data,
        selectedPair:state.selectedPair,
        selectedAsset:state.selectedAsset,
        windowKey,
        getPairsForAsset,
        getLatestForPair,
      });
    }

    function renderExchangeTabs(){ renderExchangeTabsView(comparisonRenderDeps()); }

    function renderAssetSummary(selected){
      renderAssetSummaryView(selected, {
        assetId,
        assetLogoFallbackUrl,
        assetLogoUrl,
        assetName,
        displaySymbol,
        getLatestForPair,
        getPairsForAsset,
        setLogoImage,
      });
    }

    function render(options={}){
      const pair=state.data.pairs[state.selectedPair];
      const windowSummary=pair.windows[state.selectedWindow];
      const rows=getFilteredRows(pair);
      const latest=getLatestForPair(state.selectedPair, pair);
      renderAssetSummary(pair);
      if(!options.skipComparisons) renderComparisons();
      const comparisonStats=getComparisonStats();
      renderExchangeTabs();
      renderCurrentFundingInsights({
        stats:comparisonStats,
        latest,
        feeTone,
        periodComparisonStats,
        deps:{
          exchangeLogoFallbackUrl,
          exchangeLogoUrl,
          pairTradeUrl,
          setLogoImage,
        },
      });
      const periodStats=periodComparisonStats(state.selectedWindow);
      renderPeriodFundingInsights({
        stats:periodStats,
        windowLabel:selectedWindowLabel(),
        lang:state.lang,
        feeTone,
      });
      renderPaymentCounts(rows);
      const favBtn=document.getElementById('favoriteToggle'); favBtn.textContent=(state.favorites.includes(state.selectedAsset)?'★':'☆')+' '+t('favorite');
      const periodFee = periodFundingFee(windowSummary);
      const periodFeeTone = feeTone(periodFee);
      renderSelectedPairFundingMetrics({
        windowSummary,
        periodFee,
        periodFeeTone,
        directionTitle:selectedFundingDirectionTitle(periodFeeTone, feeDirection(periodFee)),
      });
      startCountdown(latest.nextFundingTime);

      renderHistoryRows(rows);
      renderPriceChart(rows);
      renderChart(rows);
    }

    async function refreshLiveAll(){
      const selected = state.data.pairs[state.selectedPair];
      const pairKeys = selected
        ? getPairsForAsset(assetId(selected)).map(([pairKey]) => pairKey)
        : Object.keys(state.data.pairs);
      await Promise.all(pairKeys.map(async (pairKey) => {
        try {
          await fetchLiveLatest(pairKey, state.data.pairs[pairKey]);
        } catch (err) {
          console.error(err);
        }
      }));
      render();
    }

    async function init(){
      const data=await loadDashboardData();
      state.data=data;
      state.selectedPair=Object.keys(data.pairs)[0];
      state.selectedAsset=assetId(data.pairs[state.selectedPair]);
      trackLocalVisit();
      await loadAuth();
      const storedFavorites=loadFavorites();
      await restoreFavoriteAssets(storedFavorites);
      state.favorites = normalizeFavorites(storedFavorites);
      saveFavorites();
      bindUiEvents({
        closeAssetDropdown,
        closeAuthModal,
        loadFavorites,
        normalizeFavorites,
        openAssetDropdown,
        openAuthModal,
        render,
        renderAssetDropdown,
        renderAssetPicker,
        renderAuth,
        renderExchangePicker,
        renderFavoriteTabs,
        saveFavorites,
        searchRemoteAssets,
        selectAssetFromSearch,
        setLanguage,
      });
      setLanguage(state.lang);
      renderAuth();
      fetchUsdKrw();
      document.getElementById('updatedAt').textContent=t('updated')+': '+toKST(data.updatedAt);
      renderAssetPicker();
      renderExchangePicker();
      renderFavoriteTabs();
      renderWindowTabs();
      renderPriceCandleTabs();
      renderComparisons();
      render();
      await refreshLiveAll();
      state.liveRefreshTimer = setInterval(() => { refreshLiveAll().catch(console.error); }, LIVE_REFRESH_MS);
    }
    init();
