import {
  ANALYTICS_BACKEND_CONFIGURED,
  ASSET_LOGO_DOMAINS,
  ASSET_NAME_OVERRIDES,
  AUTH_BACKEND_CONFIGURED,
  COMPARISON_INTERVAL_HOURS,
  FX_LATEST_URL,
  FX_REFERENCE_URL,
  LIVE_REFRESH_MS,
  PRICE_CANDLE_WINDOWS,
  STANDARD_USDT_DISPLAY_ASSETS,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTIONS_BASE_URL,
} from './config.js';
import { fetchLiveLatest, loadDashboardData } from './api.js';
import { I18N, t } from './i18n.js';
import { renderAssetSummary as renderAssetSummaryView } from './render/asset-summary.js';
import { renderChart, renderPriceChart } from './render/charts.js';
import { renderComparisons as renderComparisonsView, renderExchangeTabs as renderExchangeTabsView } from './render/comparisons.js';
import {
  renderCurrentFundingInsights,
  renderPeriodFundingInsights,
  renderSelectedPairFundingMetrics,
} from './render/funding-insights.js';
import { renderHistoryRows, renderPaymentCounts } from './render/history.js';
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
      if(pair.exchange === 'Aster') return `https://www.asterdex.com/en/futures/${pair.symbol}`;
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
    function fundingFeeValue(latest){
      if(latest.longFundingFee != null) return Number(latest.longFundingFee);
      return latest.lastFundingRate == null ? null : -Number(latest.lastFundingRate);
    }
    function shortFundingFeeValue(latest){
      if(latest.shortFundingFee != null) return Number(latest.shortFundingFee);
      return latest.lastFundingRate == null ? null : Number(latest.lastFundingRate);
    }
    function feeTone(value){
      if(value == null || Number.isNaN(value)) return 'warn';
      return value >= 0 ? 'good' : 'bad';
    }
    function feeDirection(value){
      if(value == null || Number.isNaN(value)) return '-';
      return value >= 0 ? 'Short -> Long' : 'Long -> Short';
    }
    function exchangeSortWeight(exchange){
      return ['Hyperliquid','Binance','Bybit','Aster','OKX','Orbs Perps Hub','Variational'].indexOf(exchange);
    }
    function intervalHoursFor(pair, latest={}){
      if(latest.fundingIntervalHours) return Number(latest.fundingIntervalHours);
      if(pair.fundingIntervalHours) return Number(pair.fundingIntervalHours);
      return pair.exchange === 'Hyperliquid' ? 1 : 8;
    }
    function fmtIntervalHours(hours){
      const value = Number(hours);
      if(!Number.isFinite(value)) return '-';
      return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/,'')}H`;
    }
    function annualizedFromFee(pair, fee, latest={}){
      if(fee == null || Number.isNaN(fee)) return null;
      return fee * (24 / intervalHoursFor(pair, latest)) * 365 * 100;
    }
    function comparableFeeFromAnnualized(annualizedPct){
      const value=Number(annualizedPct);
      if(!Number.isFinite(value)) return null;
      return value / 100 / (24 / COMPARISON_INTERVAL_HOURS * 365);
    }
    function periodFundingFee(summary){
      if(!summary || summary.avgFundingRate == null || Number.isNaN(summary.avgFundingRate)) return null;
      return -Number(summary.avgFundingRate);
    }
    function comparisonAnnualized(pairKey, pair, latest){
      const fee = fundingFeeValue(latest);
      const annualized = annualizedFromFee(pair, fee, latest);
      if(annualized != null && !Number.isNaN(annualized)) return annualized;
      const summary = pair.windows && pair.windows[state.selectedWindow];
      return summary ? summary.annualizedPct : null;
    }
    function comparisonShortAnnualized(pair, latest){
      return annualizedFromFee(pair, shortFundingFeeValue(latest), latest);
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
    function authStorageKey(){ return 'fundingDashboardAuthUser'; }
    function favoriteStorageKey(){
      return state.auth && state.auth.email ? `favoritePairs:${state.auth.email.toLowerCase()}` : 'favoritePairs';
    }
    function loadAuth(){
      try { state.auth = JSON.parse(localStorage.getItem(authStorageKey()) || 'null'); } catch(e) { state.auth = null; }
    }
    function saveAuth(email){
      state.auth = { email, provider:'email', synced:AUTH_BACKEND_CONFIGURED };
      localStorage.setItem(authStorageKey(), JSON.stringify(state.auth));
      state.favorites = normalizeFavorites(loadFavorites());
      saveFavorites();
      renderAuth();
      renderFavoriteTabs();
      render();
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
      document.getElementById('authStatus').innerHTML=AUTH_BACKEND_CONFIGURED
        ? t('authSynced')
        : t('authLocal');
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
      const groups=getAssetGroups().filter(group=>{
        if(!normalized) return true;
        return group.name.toLocaleLowerCase('ko').includes(normalized) || group.id.toLocaleLowerCase('ko').includes(normalized);
      });
      dropdown.innerHTML='';
      if(!groups.length){
        const empty=document.createElement('div');
        empty.className='asset-empty';
        empty.textContent=t('noSearchResults');
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
        symbol.textContent=group.id;
        option.append(name, symbol);
        option.addEventListener('mousedown', e=>e.preventDefault());
        option.addEventListener('click', ()=>{
          selectAsset(group.id);
          closeAssetDropdown();
        });
        dropdown.appendChild(option);
      });
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
      refreshLiveAll().catch(console.error);
    }
    function selectPair(pairKey){ state.selectedPair=pairKey; state.selectedAsset=assetId(state.data.pairs[pairKey]); renderFavoriteTabs(); renderAssetPicker(); renderExchangePicker(); renderComparisons(); render(); refreshLiveAll().catch(console.error); }
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

    function metricEntryToComparisonItem(entry){
      const pair=state.data.pairs[entry.pairKey];
      if(!pair) return null;
      return {
        pairKey:entry.pairKey,
        pair,
        latest:getLatestForPair(entry.pairKey, pair),
        fee:entry.longFundingFee8h,
        shortFee:entry.shortFundingFee8h,
        rawFee:entry.rawLongFundingFee,
        rawShortFee:entry.rawShortFundingFee,
        annualized:entry.annualizedPct,
        shortAnnualized:entry.shortAnnualizedPct,
        reliabilityStatus:entry.reliabilityStatus,
      };
    }

    function serverAssetMetrics(asset=state.selectedAsset){
      return state.data && state.data.assetMetrics ? state.data.assetMetrics[asset] : null;
    }

    function serverPeriodComparisonStats(windowKey){
      const metrics=serverAssetMetrics();
      const entries=metrics && metrics.windows && metrics.windows[windowKey] ? metrics.windows[windowKey].exchanges : null;
      if(!entries || !entries.length) return null;
      return entries.map(metricEntryToComparisonItem).filter(Boolean);
    }

    function serverCurrentComparisonStats(){
      const metrics=serverAssetMetrics();
      const entries=metrics && metrics.current ? metrics.current.exchanges : null;
      if(!entries || !entries.length) return null;
      return entries.map(metricEntryToComparisonItem).filter(Boolean);
    }

    function getComparisonStats(){
      const selected=state.data.pairs[state.selectedPair];
      const hasLiveForAsset=getPairsForAsset(assetId(selected)).some(([pairKey])=>state.liveLatestByPair[pairKey]);
      const serverStats=hasLiveForAsset ? null : serverCurrentComparisonStats();
      if(serverStats) return serverStats;
      return getPairsForAsset(assetId(selected)).map(([pairKey, pair])=>{
        const latest=getLatestForPair(pairKey, pair);
        const rawFee=fundingFeeValue(latest);
        const rawShortFee=shortFundingFeeValue(latest);
        const annualized=comparisonAnnualized(pairKey, pair, latest);
        const shortAnnualized=comparisonShortAnnualized(pair, latest);
        const fee=comparableFeeFromAnnualized(annualized);
        const shortFee=comparableFeeFromAnnualized(shortAnnualized);
        return {
          pairKey,
          pair,
          latest,
          fee,
          shortFee,
          rawFee,
          rawShortFee,
          annualized,
          shortAnnualized,
        };
      }).filter(item=>item.fee != null && !Number.isNaN(item.fee) && item.shortFee != null && !Number.isNaN(item.shortFee));
    }

    function periodComparisonStats(windowKey){
      const serverStats=serverPeriodComparisonStats(windowKey);
      if(serverStats) return serverStats;
      const selected=state.data.pairs[state.selectedPair];
      return getPairsForAsset(assetId(selected)).map(([pairKey, pair])=>{
        const summary=pair.windows && pair.windows[windowKey];
        if(!summary || !summary.count) return null;
        const longAnnualized=summary.annualizedPct;
        const longFee=comparableFeeFromAnnualized(longAnnualized);
        if(longFee == null || Number.isNaN(longFee)) return null;
        return {
          pairKey,
          pair,
          fee:longFee,
          shortFee:comparableFeeFromAnnualized(-longAnnualized),
          rawFee:periodFundingFee(summary),
          rawShortFee:-periodFundingFee(summary),
          annualized:longAnnualized,
          shortAnnualized:longAnnualized == null || Number.isNaN(longAnnualized) ? null : -longAnnualized,
          count:summary.count || 0,
        };
      }).filter(Boolean);
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
      loadAuth();
      state.favorites = normalizeFavorites(loadFavorites());
      saveFavorites();
      document.getElementById('langKoButton').addEventListener('click', ()=>setLanguage('ko'));
      document.getElementById('langEnButton').addEventListener('click', ()=>setLanguage('en'));
      setLanguage(state.lang);
      renderAuth();
      fetchUsdKrw();
      document.getElementById('updatedAt').textContent=t('updated')+': '+toKST(data.updatedAt);
      document.getElementById('assetSearch').addEventListener('input', e=>{
        renderAssetDropdown(e.target.value);
        openAssetDropdown();
      });
      document.getElementById('assetSearch').addEventListener('keydown', e=>{
        if(e.key==='Enter'){
          selectAssetFromSearch(e.target.value);
          closeAssetDropdown();
        }
        if(e.key==='Escape'){
          closeAssetDropdown();
          renderAssetPicker();
        }
      });
      document.getElementById('assetSearch').addEventListener('focus', e=>{
        e.target.value='';
        openAssetDropdown();
      });
      document.getElementById('assetSearch').addEventListener('click', e=>{
        e.target.value='';
        openAssetDropdown();
      });
      document.getElementById('assetSearch').addEventListener('blur', ()=>{
        setTimeout(()=>{
          closeAssetDropdown();
          renderAssetPicker();
        }, 120);
      });
      document.getElementById('sortMode').addEventListener('change', e=>{ state.sortMode=e.target.value; renderAssetPicker(); renderExchangePicker(); });
      document.getElementById('favoriteToggle').addEventListener('click', ()=>{ const favoriteAssetId=state.selectedAsset; if(state.favorites.includes(favoriteAssetId)){ state.favorites=state.favorites.filter(x=>x!==favoriteAssetId); } else { state.favorites.unshift(favoriteAssetId); } saveFavorites(); renderFavoriteTabs(); render(); });
      document.getElementById('loginButton').addEventListener('click', ()=>openAuthModal('login'));
      document.getElementById('signupButton').addEventListener('click', ()=>{
        if(state.auth){
          localStorage.removeItem(authStorageKey());
          state.auth=null;
          state.favorites=normalizeFavorites(loadFavorites());
          renderAuth();
          renderFavoriteTabs();
          render();
          return;
        }
        openAuthModal('signup');
      });
      document.getElementById('authGoogleButton').addEventListener('click', ()=>{
        document.getElementById('authStatus').innerHTML=t('googlePending');
      });
      document.getElementById('authCloseButton').addEventListener('click', closeAuthModal);
      document.getElementById('authModal').addEventListener('click', e=>{ if(e.target.id === 'authModal') closeAuthModal(); });
      document.getElementById('authSubmitButton').addEventListener('click', ()=>{
        const email=document.getElementById('authEmail').value.trim();
        if(!email || !email.includes('@')){
          document.getElementById('authStatus').textContent=t('invalidEmail');
          return;
        }
        saveAuth(email);
        closeAuthModal();
      });
      document.getElementById('authForm').addEventListener('submit', e=>{
        e.preventDefault();
        document.getElementById('authSubmitButton').click();
      });
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
