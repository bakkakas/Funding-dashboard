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
import {
  fmtAbsAnnual,
  fmtAbsPct,
  fmtAnnual,
  fmtFx,
  fmtNumber,
  fmtPct,
  fmtSignedPct,
  toKST,
  toKSTChartLabel,
  toKSTCompact,
  toUTC,
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
    function spreadAlertLevel(annualSpread){
      const absSpread=Math.abs(Number(annualSpread));
      if(!Number.isFinite(absSpread)) return { label:'-', tone:'warn' };
      if(absSpread >= 20) return { label:t('alertWide'), tone:'bad' };
      if(absSpread >= 5) return { label:t('alertNarrow'), tone:'warn' };
      return { label:t('noAlert'), tone:'info' };
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
    function renderComparisons(){
      const body=document.getElementById('comparisonBody'); body.innerHTML='';
      const selected=state.data.pairs[state.selectedPair];
      document.getElementById('supportTitle').textContent=t('supportExchange');
      const sameSymbolPairs=getPairsForAsset(assetId(selected));
      sameSymbolPairs.forEach(([pairKey,pair])=>{
        const tr=document.createElement('tr');
        const isSelected=pairKey===state.selectedPair;
        const exchangeCell=document.createElement('td');
        const exchangeBtn=document.createElement('button');
        exchangeBtn.type='button';
        exchangeBtn.className='chip' + (isSelected ? ' active' : '');
        const exchangeLabel=document.createElement('span');
        exchangeLabel.className='exchange-label';
        const exchangeLogo=document.createElement('img');
        exchangeLogo.className='exchange-logo';
        exchangeLogo.alt='';
        setLogoImage(exchangeLogo, exchangeLogoUrl(pair.exchange), exchangeLogoFallbackUrl(pair.exchange));
        const exchangeName=document.createElement('span');
        exchangeName.textContent=pair.exchange;
        exchangeLabel.appendChild(exchangeLogo);
        exchangeLabel.appendChild(exchangeName);
        exchangeBtn.appendChild(exchangeLabel);
        exchangeBtn.onclick=()=>selectPair(pairKey);
        exchangeCell.appendChild(exchangeBtn);

        const pairCell=document.createElement('td');
        const pairLink=document.createElement('a');
        pairLink.className='pair-link';
        pairLink.href=pairTradeUrl(pair);
        pairLink.target='_blank';
        pairLink.rel='noopener noreferrer';
        pairLink.textContent=pairDisplayName(pair);
        pairCell.appendChild(pairLink);

        const feeCell=document.createElement('td');
        const latest=getLatestForPair(pairKey, pair);
        const fee=fundingFeeValue(latest);
        const feeEl=document.createElement('span');
        feeEl.className='fee-value ' + feeTone(fee);
        const intervalText=fmtIntervalHours(intervalHoursFor(pair, latest));
        feeEl.textContent=fee == null || Number.isNaN(fee) ? '-' : `${fmtSignedPct(fee)}(${intervalText})`;
        feeCell.appendChild(feeEl);

        const annualCell=document.createElement('td');
        const annualized=comparisonAnnualized(pairKey, pair, latest);
        const annualEl=document.createElement('span');
        annualEl.className='fee-value ' + feeTone(annualized == null ? null : annualized);
        annualEl.textContent=annualized == null || Number.isNaN(annualized) ? '-' : fmtAnnual(annualized);
        annualCell.appendChild(annualEl);

        tr.appendChild(exchangeCell);
        tr.appendChild(pairCell);
        tr.appendChild(feeCell);
        tr.appendChild(annualCell);
        body.appendChild(tr);
      });
    }
    function getFilteredRows(pair){ const days=state.data.meta.windows[state.selectedWindow]; const minTs=Date.now()-days*24*3600*1000; return pair.rows.filter(r=>r.fundingTime>=minTs); }

    function applyChartRange(chart, start, end){
      chart.$zoomStart = Math.max(0, start);
      chart.$zoomEnd = Math.min(chart.$fullLabels.length - 1, end);
      chart.data.labels = chart.$fullLabels.slice(chart.$zoomStart, chart.$zoomEnd + 1);
      chart.data.datasets[0].data = chart.$fullData.slice(chart.$zoomStart, chart.$zoomEnd + 1);
      if(chart.$fullOhlcData) chart.$ohlcData = chart.$fullOhlcData.slice(chart.$zoomStart, chart.$zoomEnd + 1);
      chart.update('none');
    }
    function enableWheelZoom(chart, canvas){
      if(canvas.$wheelZoomHandler) canvas.removeEventListener('wheel', canvas.$wheelZoomHandler);
      if(canvas.$panHandlers){
        canvas.removeEventListener('pointerdown', canvas.$panHandlers.down);
        canvas.removeEventListener('pointermove', canvas.$panHandlers.move);
        canvas.removeEventListener('pointerup', canvas.$panHandlers.up);
        canvas.removeEventListener('pointercancel', canvas.$panHandlers.up);
      }
      canvas.$wheelZoomHandler = event => {
        const total = chart.$fullLabels.length;
        if(total <= 2) return;
        event.preventDefault();
        const visible = chart.$zoomEnd - chart.$zoomStart + 1;
        const scale = event.deltaY < 0 ? 0.78 : 1.28;
        const nextVisible = Math.max(8, Math.min(total, Math.round(visible * scale)));
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const center = chart.$zoomStart + Math.round((visible - 1) * ratio);
        let start = Math.round(center - (nextVisible - 1) * ratio);
        let end = start + nextVisible - 1;
        if(start < 0){ end -= start; start = 0; }
        if(end >= total){ start -= end - total + 1; end = total - 1; }
        applyChartRange(chart, Math.max(0, start), Math.min(total - 1, end));
      };
      canvas.addEventListener('wheel', canvas.$wheelZoomHandler, { passive:false });
      const panState = { active:false, pointerId:null, startX:0, startStart:0, startEnd:0 };
      const finishPan = event => {
        if(!panState.active) return;
        panState.active=false;
        canvas.style.cursor='grab';
        if(event && event.pointerId === panState.pointerId) {
          try { canvas.releasePointerCapture(event.pointerId); } catch(e) {}
        }
      };
      canvas.$panHandlers = {
        down: event => {
          if(event.button !== 0 || chart.$fullLabels.length <= 2) return;
          panState.active=true;
          panState.pointerId=event.pointerId;
          panState.startX=event.clientX;
          panState.startStart=chart.$zoomStart;
          panState.startEnd=chart.$zoomEnd;
          canvas.style.cursor='grabbing';
          canvas.setPointerCapture(event.pointerId);
        },
        move: event => {
          if(!panState.active || event.pointerId !== panState.pointerId) return;
          event.preventDefault();
          const total = chart.$fullLabels.length;
          const visible = panState.startEnd - panState.startStart + 1;
          if(visible >= total) return;
          const rect = canvas.getBoundingClientRect();
          const shift = Math.round((panState.startX - event.clientX) / rect.width * visible);
          let start = panState.startStart + shift;
          let end = panState.startEnd + shift;
          if(start < 0){ end -= start; start = 0; }
          if(end >= total){ start -= end - total + 1; end = total - 1; }
          applyChartRange(chart, Math.max(0, start), Math.min(total - 1, end));
        },
        up: finishPan,
      };
      canvas.addEventListener('pointerdown', canvas.$panHandlers.down);
      canvas.addEventListener('pointermove', canvas.$panHandlers.move);
      canvas.addEventListener('pointerup', canvas.$panHandlers.up);
      canvas.addEventListener('pointercancel', canvas.$panHandlers.up);
    }
    const candleOverlayPlugin = {
      id:'candleOverlay',
      afterDatasetsDraw(chart){
        if(!chart.$isCandleChart || !chart.$ohlcData) return;
        const { ctx, chartArea, scales } = chart;
        const xScale = scales.x;
        const yScale = scales.y;
        const width = Math.max(3, Math.min(13, chartArea.width / Math.max(chart.$ohlcData.length, 1) * 0.56));
        ctx.save();
        chart.$ohlcData.forEach((candle, index)=>{
          const x = xScale.getPixelForValue(index);
          const openY = yScale.getPixelForValue(candle.open);
          const closeY = yScale.getPixelForValue(candle.close);
          const highY = yScale.getPixelForValue(candle.high);
          const lowY = yScale.getPixelForValue(candle.low);
          const up = candle.close >= candle.open;
          const color = up ? '#00c076' : '#f08a8a';
          ctx.strokeStyle = color;
          ctx.fillStyle = up ? 'rgba(0,192,118,0.82)' : 'rgba(240,138,138,0.82)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, highY);
          ctx.lineTo(x, lowY);
          ctx.stroke();
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));
          ctx.fillRect(x - width / 2, bodyTop, width, bodyHeight);
        });
        ctx.restore();
      }
    };
    Chart.register(candleOverlayPlugin);
    function selectedPriceCandleWindow(){
      return PRICE_CANDLE_WINDOWS.find(item=>item.key===state.priceCandleWindow) || PRICE_CANDLE_WINDOWS[0];
    }
    function aggregatePriceCandles(rows){
      const bucketMs = selectedPriceCandleWindow().hours * 3600000;
      const grouped = new Map();
      rows.forEach(row=>{
        const price = Number(row.markPrice);
        const time = Number(row.fundingTime);
        if(!Number.isFinite(price) || !Number.isFinite(time)) return;
        const bucket = Math.floor(time / bucketMs) * bucketMs;
        if(!grouped.has(bucket)){
          grouped.set(bucket, { time:bucket, open:price, high:price, low:price, close:price });
          return;
        }
        const candle = grouped.get(bucket);
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
      });
      return Array.from(grouped.values()).sort((a,b)=>a.time-b.time).map(candle=>{
        const pad = Math.max(Math.abs(candle.close - candle.open) * 0.25, Math.abs(candle.close || candle.open || 1) * 0.00015);
        return {
          ...candle,
          high:Math.max(candle.high, candle.open, candle.close) + pad,
          low:Math.min(candle.low, candle.open, candle.close) - pad,
        };
      });
    }
    function renderPriceChart(rows){
      const ctx=document.getElementById('priceChart');
      const candles=aggregatePriceCandles(rows);
      const labels=candles.map(candle=>toKSTChartLabel(candle.time));
      const values=candles.map(candle=>candle.close);
      if(state.priceChart) state.priceChart.destroy();
      state.priceChart=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'Mark Price', data:values, borderColor:'rgba(0,192,118,0)', backgroundColor:'rgba(0,192,118,0)', borderWidth:0, pointRadius:0, pointHoverRadius:0, tension:0 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ ticks:{ color:'#7d8a98' }, grid:{ color:'rgba(255,255,255,0.045)' } }, x:{ ticks:{ color:'#7d8a98', maxTicksLimit:8 }, grid:{ color:'rgba(255,255,255,0.025)' } } }, plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ label:context=>{ const candle=state.priceChart.$ohlcData && state.priceChart.$ohlcData[context.dataIndex]; return candle ? `O ${fmtNumber(candle.open)}  H ${fmtNumber(candle.high)}  L ${fmtNumber(candle.low)}  C ${fmtNumber(candle.close)}` : `Mark ${fmtNumber(context.parsed.y)}`; } } } }, interaction:{ mode:'index', intersect:false } } });
      state.priceChart.$isCandleChart=true;
      state.priceChart.$fullLabels=labels;
      state.priceChart.$fullData=values;
      state.priceChart.$fullOhlcData=candles;
      state.priceChart.$ohlcData=candles;
      state.priceChart.$zoomStart=0;
      state.priceChart.$zoomEnd=Math.max(0, labels.length - 1);
      enableWheelZoom(state.priceChart, ctx);
    }

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

    function renderChart(rows){
      const ctx=document.getElementById('fundingChart');
      const labels=rows.map(r=>toKSTChartLabel(r.fundingTime));
      const values=rows.map(r=>r.fundingRate*100);
      if(state.chart) state.chart.destroy();
      state.chart=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'Funding Rate', data:values, borderColor:'#23e7a5', backgroundColor:'rgba(35,231,165,0.13)', borderWidth:2, fill:true, pointRadius:0, pointHoverRadius:4, tension:0.25 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ ticks:{ color:'#7d8a98', callback:v=>`${v.toFixed(3)}%` }, grid:{ color:'rgba(255,255,255,0.045)' } }, x:{ ticks:{ color:'#7d8a98', maxTicksLimit:8 }, grid:{ color:'rgba(255,255,255,0.025)' } } }, plugins:{ legend:{ labels:{ color:'#dce3ea' } }, tooltip:{ mode:'index', intersect:false } }, interaction:{ mode:'index', intersect:false } } });
      state.chart.$fullLabels=labels;
      state.chart.$fullData=values;
      state.chart.$zoomStart=0;
      state.chart.$zoomEnd=Math.max(0, labels.length - 1);
      enableWheelZoom(state.chart, ctx);
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

    function renderFundingBars(containerId, stats){
      const bars=document.getElementById(containerId);
      bars.innerHTML='';
      const sorted=stats.slice().sort((a,b)=>b.fee-a.fee);
      if(!sorted.length){
        const empty=document.createElement('div');
        empty.className='mini';
        empty.textContent=t('noData');
        bars.appendChild(empty);
        return;
      }
      const maxAbs=Math.max(...sorted.map(item=>Math.abs(item.fee)), 0.000001);
      sorted.forEach(item=>{
        const row=document.createElement('div');
        row.className='funding-bar-row';
        const name=document.createElement('div');
        name.className='funding-bar-name';
        name.textContent=item.pair.exchange;
        const track=document.createElement('div');
        track.className='funding-bar-track';
        const fill=document.createElement('div');
        fill.className='funding-bar-fill ' + feeTone(item.fee);
        fill.style.width=`${Math.max(3, Math.min(50, Math.abs(item.fee) / maxAbs * 50))}%`;
        track.appendChild(fill);
        const value=document.createElement('div');
        value.className='funding-bar-value ' + feeTone(item.fee);
        value.textContent=fmtSignedPct(item.fee);
        row.append(name, track, value);
        bars.appendChild(row);
      });
    }

    function renderExchangeTabs(){
      const tabs=document.getElementById('exchangeTabs');
      tabs.innerHTML='';
      getPairsForAsset(state.selectedAsset).forEach(([pairKey, pair])=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='chip' + (pairKey===state.selectedPair ? ' active' : '');
        const label=document.createElement('span');
        label.className='exchange-label';
        const logo=document.createElement('img');
        logo.className='exchange-logo';
        logo.alt='';
        setLogoImage(logo, exchangeLogoUrl(pair.exchange), exchangeLogoFallbackUrl(pair.exchange));
        const name=document.createElement('span');
        name.textContent=pair.exchange;
        label.append(logo, name);
        btn.appendChild(label);
        btn.onclick=()=>selectPair(pairKey);
        tabs.appendChild(btn);
      });
    }

    function renderSpreadInsights(stats, ids={
      spreadValue:'fundingSpreadValue',
      spreadMeta:'fundingSpreadMeta',
      alertValue:'spreadAlertValue',
      alertMeta:'spreadAlertMeta',
    }){
      const spreadValue=document.getElementById(ids.spreadValue);
      const spreadMeta=document.getElementById(ids.spreadMeta);
      const alertValue=document.getElementById(ids.alertValue);
      const alertMeta=document.getElementById(ids.alertMeta);
      if(!stats.length){
        spreadValue.textContent='-';
        spreadValue.className='value warn';
        spreadMeta.textContent='-';
        alertValue.textContent='-';
        alertValue.className='value warn';
        alertMeta.textContent='-';
        alertMeta.className='mini warn';
        return;
      }
      const sorted=stats.slice().sort((a,b)=>b.fee-a.fee);
      const high=sorted[0];
      const low=sorted[sorted.length-1];
      const spread=high.fee-low.fee;
      const annualSpread = high.annualized != null && low.annualized != null
        ? high.annualized - low.annualized
        : null;
      spreadValue.textContent=annualSpread == null || Number.isNaN(annualSpread)
        ? fmtAbsPct(spread)
        : `${fmtAbsPct(spread)} / ${fmtAbsAnnual(annualSpread)}`;
      spreadValue.className='value warn';
      spreadMeta.textContent=`${high.pair.exchange} - ${low.pair.exchange}`;
      const alert=spreadAlertLevel(annualSpread);
      alertValue.innerHTML='';
      alertValue.className='value with-alert ' + alert.tone;
      const alertNumber=document.createElement('span');
      alertNumber.textContent=annualSpread == null || Number.isNaN(annualSpread) ? '-' : fmtAbsAnnual(annualSpread);
      const alertLabel=document.createElement('span');
      alertLabel.className='alert-inline';
      alertLabel.textContent=alert.label;
      alertValue.append(alertNumber, alertLabel);
      alertMeta.textContent=stats.length ? `${stats.length}${state.lang === 'ko' ? '개 거래소 비교' : ' exchanges compared'}` : '-';
      alertMeta.className='mini ' + alert.tone;
    }

    function renderPeriodBestWorst(){
      const wrap=document.getElementById('periodBestWorst');
      wrap.innerHTML='';
      Object.keys(state.data.meta.windows).forEach(windowKey=>{
        const stats=periodComparisonStats(windowKey);
        const box=document.createElement('div');
        box.className='period-summary-box';
        const title=document.createElement('div');
        title.className='period-summary-title';
        title.textContent=state.lang === 'ko' ? `${state.data.meta.windows[windowKey]}일 Best / Worst` : `${windowKey} Best / Worst`;
        box.appendChild(title);
        if(!stats.length){
          const empty=document.createElement('div');
          empty.className='mini';
          empty.textContent=t('noData');
          box.appendChild(empty);
          wrap.appendChild(box);
          return;
        }
        const longBest=stats.slice().sort((a,b)=>b.fee-a.fee)[0];
        const shortBest=stats.slice().sort((a,b)=>b.shortFee-a.shortFee)[0];
        const makeRow=(label, item, side)=>{
          const row=document.createElement('div');
          row.className='period-summary-row';
          const labelEl=document.createElement('span');
          labelEl.textContent=label;
          const valueEl=document.createElement('span');
          const fee=side === 'short' ? item.shortFee : item.fee;
          const annual=side === 'short' ? item.shortAnnualized : item.annualized;
          valueEl.className='period-summary-value';
          const exchangeEl=document.createElement('span');
          exchangeEl.className='period-summary-exchange';
          exchangeEl.textContent=item.pair.exchange;
          const metricEl=document.createElement('span');
          metricEl.className='period-summary-metric ' + feeTone(fee);
          metricEl.textContent=`${fmtSignedPct(fee)} / ${annual == null || Number.isNaN(annual) ? '-' : fmtAnnual(annual)}`;
          valueEl.append(exchangeEl, metricEl);
          row.append(labelEl, valueEl);
          return row;
        };
        box.appendChild(makeRow(t('bestLong'), longBest, 'long'));
        box.appendChild(makeRow(t('bestShort'), shortBest, 'short'));
        wrap.appendChild(box);
      });
    }

    function renderFundingInsights(stats, selectedPairKey, latest){
      const longSorted=stats.slice().sort((a,b)=>b.fee-a.fee);
      const shortSorted=stats.slice().sort((a,b)=>b.shortFee-a.shortFee);
      const longFavored=longSorted[0];
      const shortFavored=shortSorted[0];
      const mark=Number(latest.markPrice);
      const index=Number(latest.indexPrice);
      const gap = Number.isFinite(mark) && Number.isFinite(index) && index !== 0 ? (mark - index) / index : null;
      const gapEl=document.getElementById('markIndexGap');
      gapEl.textContent=gap == null ? '-' : fmtSignedPct(gap);
      gapEl.className='detail-value ' + feeTone(gap);
      const renderFavored = (box, el, label, item, side) => {
        if(!item){
          box.removeAttribute('href');
          box.classList.add('disabled');
          el.textContent='-';
          return;
        }
        box.href=pairTradeUrl(item.pair);
        box.classList.remove('disabled');
        const value = side === 'short' ? item.shortFee : item.fee;
        const annualizedValue = side === 'short' ? item.shortAnnualized : item.annualized;
        const annualized = annualizedValue == null || Number.isNaN(annualizedValue) ? '-' : fmtAnnual(annualizedValue);
        el.innerHTML = '';
        const main=document.createElement('span');
        main.className='detail-main';
        const labelEl=document.createElement('span');
        labelEl.className='label';
        labelEl.textContent=label;
        const logo=document.createElement('img');
        logo.className='exchange-logo';
        logo.alt='';
        setLogoImage(logo, exchangeLogoUrl(item.pair.exchange), exchangeLogoFallbackUrl(item.pair.exchange));
        const name=document.createElement('span');
        name.className='favored-exchange-name';
        name.textContent=item.pair.exchange;
        const sub=document.createElement('span');
        sub.className='detail-sub';
        sub.textContent=`${fmtSignedPct(value)} / ${annualized} Annualized`;
        main.append(labelEl, logo, name);
        el.append(main, sub);
      };
      renderFavored(document.getElementById('longFavoredBox'), document.getElementById('longFavoredExchange'), t('longFavored'), longFavored, 'long');
      renderFavored(document.getElementById('shortFavoredBox'), document.getElementById('shortFavoredExchange'), t('shortFavored'), shortFavored, 'short');
      renderSpreadInsights(stats);
      renderPeriodBestWorst();

      renderFundingBars('fundingBars', longSorted);
    }

    function renderPaymentCounts(rows){
      const longToShort = rows.filter(row=>Number(row.fundingRate) >= 0).length;
      const shortToLong = rows.filter(row=>Number(row.fundingRate) < 0).length;
      document.getElementById('longToShortCount').textContent=longToShort.toLocaleString('en-US');
      document.getElementById('shortToLongCount').textContent=shortToLong.toLocaleString('en-US');
    }

    function currentPricePairForAsset(selected){
      const pairs=getPairsForAsset(assetId(selected));
      return pairs.find(([_, pair])=>pair.exchange === 'Binance')
        || pairs.find(([_, pair])=>pair.exchange === 'Orbs Perps Hub')
        || pairs[0];
    }

    function renderAssetSummary(selected){
      const pricePair=currentPricePairForAsset(selected);
      const [pricePairKey, pairForPrice]=pricePair || [state.selectedPair, selected];
      const latest=getLatestForPair(pricePairKey, pairForPrice);
      const symbol=assetId(selected);
      const logo=document.getElementById('assetLogo');
      const logoUrl=assetLogoUrl(symbol);
      setLogoImage(logo, logoUrl, assetLogoFallbackUrl(symbol));
      document.getElementById('assetLogoMark').textContent=symbol.slice(0,2).toUpperCase();
      document.getElementById('assetHeaderSymbol').textContent=displaySymbol(selected);
      document.getElementById('assetHeaderName').textContent=assetName(selected);
      document.getElementById('assetHeaderPrice').textContent=latest.markPrice == null ? '-' : fmtNumber(latest.markPrice);
      document.getElementById('assetHeaderPriceMeta').textContent=latest.markPrice == null
        ? '-'
        : `${pairForPrice.exchange} ${t('mark')}`;
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
      renderFundingInsights(comparisonStats, state.selectedPair, latest);
      const periodStats=periodComparisonStats(state.selectedWindow);
      const periodBarsTitle=document.getElementById('periodFundingBarsTitle');
      periodBarsTitle.textContent=state.lang === 'ko'
        ? `${selectedWindowLabel()} Funding Fee 비교 (8H 환산)`
        : `${selectedWindowLabel()} funding fee comparison (8H eq.)`;
      renderSpreadInsights(periodStats, {
        spreadValue:'periodFundingSpreadValue',
        spreadMeta:'periodFundingSpreadMeta',
        alertValue:'periodSpreadAlertValue',
        alertMeta:'periodSpreadAlertMeta',
      });
      renderFundingBars('periodFundingBars', periodStats);
      renderPaymentCounts(rows);
      const favBtn=document.getElementById('favoriteToggle'); favBtn.textContent=(state.favorites.includes(state.selectedAsset)?'★':'☆')+' '+t('favorite');
      const periodFee = periodFundingFee(windowSummary);
      const periodFeeTone = feeTone(periodFee);
      document.getElementById('avgFunding').textContent=periodFee == null ? '-' : fmtSignedPct(periodFee);
      document.getElementById('avgFunding').className='asset-metric-value '+periodFeeTone;
      const currentFee = fundingFeeValue(latest);
      const displayedAnnualized = windowSummary.annualizedPct;
      const annual=document.getElementById('annualized'); annual.textContent=fmtAnnual(displayedAnnualized); annual.className='value '+(displayedAnnualized>=0?'good':'bad');
      const sumFundingTone = windowSummary.sumFundingRate < 0 ? 'good' : 'bad';
      document.getElementById('sumFunding').textContent=fmtPct(windowSummary.sumFundingRate);
      document.getElementById('sumFunding').className='asset-metric-value '+sumFundingTone;
      document.getElementById('sumFundingMeta').textContent='';
      document.getElementById('interpretation').innerHTML=windowSummary.sumFundingRate < 0 ? '<span class="pill good asset-direction-pill">Short → Long</span>' : '<span class="pill bad asset-direction-pill">Long → Short</span>';
      document.getElementById('interpretation').className='asset-metric-value';

      const coreTitle = document.getElementById('coreTitle');
      coreTitle.innerHTML = selectedFundingDirectionTitle(periodFeeTone, feeDirection(periodFee));
      coreTitle.className = 'section-title';
      if (periodFee == null || Number.isNaN(periodFee)) {
        document.getElementById('latestFunding').textContent='-';
        document.getElementById('latestFunding').className='value warn';
      } else {
        document.getElementById('latestFunding').textContent=fmtSignedPct(periodFee);
        document.getElementById('latestFunding').className='value '+periodFeeTone;
      }
      startCountdown(latest.nextFundingTime);

      const body=document.getElementById('historyBody'); body.innerHTML='';
      rows.slice().reverse().forEach((row,idx)=>{ const positive=row.fundingRate>=0; const tr=document.createElement('tr'); tr.innerHTML=`<td>${rows.length-idx}</td><td>${toUTC(row.fundingTime)}</td><td style="color:${positive?'var(--bad)':'var(--good)'}; font-weight:700;">${fmtPct(row.fundingRate)}</td><td>${row.markPrice == null ? '-' : fmtNumber(row.markPrice)}</td><td>${positive?'<span class="pill bad">Long → Short</span>':'<span class="pill good">Short → Long</span>'}</td>`; body.appendChild(tr); });
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
