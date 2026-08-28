import { authClient as db, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';
import { sortAssetsByValue } from './portfolio-sort.js?v=1';
import { applyPageTranslations } from './page-i18n.js?v=1';
import { formatPortfolioKrw } from './portfolio-history.js?v=1';
import { calculatePortfolioTotals } from './portfolio-totals.js?v=1';
const $=id=>document.getElementById(id);
const CLASS_LABELS={ko:{stock:'주식',crypto:'크립토',commodity:'원자재',cash:'Cash'},en:{stock:'Stocks',crypto:'Crypto',commodity:'Commodities',cash:'Cash'}};
const COLORS={stock:'#23e7a5',crypto:'#8ea2ff',commodity:'#f5c451',cash:'#86a8ff'};
const CATALOG=[
  ['BTC','비트코인','crypto','CG:bitcoin','USD'],['ETH','이더리움','crypto','CG:ethereum','USD'],['SOL','솔라나','crypto','CG:solana','USD'],['BNB','BNB','crypto','CG:binancecoin','USD'],['ORBS','Orbs','crypto','CG:orbs','USD'],
  ['USDT','테더 (1달러 고정)','crypto','FIXED:USD','USD'],['GOLD','금 (PAXG 현물 기준)','commodity','BINANCE:PAXGUSDT','USD'],['KRW','원화','cash','CASH:KRW','KRW'],['USD','달러','cash','CASH:USD','USD']
].map(([symbol,name,asset_class,quote_symbol,currency])=>({symbol,name,asset_class,quote_symbol,currency}));
let session=null,assets=[],prices={},priceErrors=new Set(),fx=1380,filter='all',valueSort=null,classChart,historyChart;
let cryptoEntries=[],cryptoPrices={},cryptoPriceErrors=new Set(),cryptoTotalSource='assets',cryptoLocationFilter='all';
let searchTimer=null,searchResults=[],selectedSearchAsset=null,editingAssetId=null;
let cryptoSearchTimer=null,cryptoSearchResults=[],selectedCryptoAsset=null,editingCryptoEntryId=null;
let lang=localStorage.getItem('fundingDashboardLanguage')==='en'?'en':'ko',headerWidgets=null;
const COPY={
  ko:{pageTitle:'내 자산',heading:'내 자산',subtitle:'주식·크립토·원자재·Cash를 한곳에서 관리해.',navForeign:'외국인 수급',navAssets:'내 자산',navSetup:'투자 셋업',addAsset:'+ 자산 추가',gateHeading:'로그인 후 포트폴리오를 관리할 수 있어',gateNote:'자산 내역은 계정별로 분리되어 안전하게 저장돼.',gateLogin:'로그인 / 회원가입',totalAssets:'총 자산',loadingPrices:'가격 불러오는 중',portfolioChange:'포트폴리오 변화',daily:'일별',weekly:'주별',monthly:'월별',holdings:'보유 자산',refreshPrices:'가격 새로고침',all:'전체',stock:'주식',crypto:'크립토',commodity:'원자재',asset:'자산',assetClass:'자산군',quantity:'수량',currentPrice:'현재가',valuation:'평가액',weight:'비중',excludeTotal:'총액만 제외',authHeading:'로그인 / 회원가입',close:'닫기',continueGoogle:'Google로 계속하기',or:'또는',passwordPlaceholder:'비밀번호 (6자 이상)',login:'로그인',signup:'회원가입',logout:'로그아웃',authStatus:'Google 또는 이메일로 로그인해.',assetSearch:'자산 검색',assetSearchPlaceholder:'BTC, 삼성전자, Gold…',nickname:'닉네임',optional:'선택',nicknamePlaceholder:'개인지갑, 업비트, 바이낸스…',unitPrice:'단가',save:'저장',selectSearchResult:'검색 결과에서 자산을 선택해.',processing:'처리 중…',confirmEmail:'확인 메일을 보냈어. 메일 인증 후 로그인해.',signedIn:'로그인 완료',googlePending:'Google 로그인으로 이동 중…',refreshing:'현재 가격 갱신 중…',loadFailed:'포트폴리오를 불러오지 못했어',asOf:'기준',excludedCount:'개 총액만 제외',priceFailures:'개 가격 조회 실패',loading:'조회 중',failed:'조회 실패',excluded:'총액만 제외',excludeTitle:'체크하면 총자산에서만 제외하고 자산군 분류에는 포함',stableCurrency:'Stable 입력 통화',stableAmount:'Stable 금액',full:'전액',edit:'수정',delete:'삭제',emptyAssets:'등록된 자산이 없어. 자산 추가 버튼으로 시작해.',sortAsc:'평가액 오름차순으로 정렬',sortDesc:'평가액 내림차순으로 정렬',saved:'저장 완료',searching:'주식·크립토 검색 중…',noResults:'검색 결과가 없어.',selected:'선택됨',addAssetTitle:'자산 추가',editAssetTitle:'자산 수정',saveEdit:'수정 저장',editHelp:'닉네임과 수량을 수정할 수 있어.',invalidAsset:'자산과 0보다 큰 수량을 입력해.',duplicateNickname:'같은 종목에 동일한 닉네임이 이미 있어. 다른 닉네임을 입력해.',deleteConfirm:'이 자산을 삭제할까?',historyEmpty:'스냅샷이 쌓이면 변화가 표시돼.',cryptoPortfolio:'코인 포트폴리오',cryptoPortfolioNote:'거래소·지갑별 보유 코인을 따로 기록해.',addCryptoEntry:'+ 코인 추가',cryptoTotalSource:'총자산 반영 기준',cryptoTotalSourceNote:'두 방식 중 하나만 반영해 중복 합산을 막아.',existingCryptoTotal:'기존 코인 총액',detailCryptoTotal:'세부 포트폴리오 합계',location:'거래소 / 지갑',locationPlaceholder:'Bybit, Upbit, 개인지갑…',coinSearch:'코인 검색',coinSearchPlaceholder:'BTC, ETH, SOL…',selectCoinResult:'검색 결과에서 코인을 선택해.',addCryptoTitle:'코인 추가',editCryptoTitle:'코인 수정',cryptoEditHelp:'거래소·지갑과 수량을 수정할 수 있어.',invalidCryptoEntry:'거래소·지갑, 코인, 0보다 큰 수량을 입력해.',duplicateCryptoEntry:'같은 거래소·지갑에 이미 등록된 코인이야.',deleteCryptoConfirm:'이 코인 항목을 삭제할까?',emptyCrypto:'등록된 세부 코인 포트폴리오가 없어.',detailSourceEmpty:'코인을 먼저 하나 이상 추가해.',detailSourceActive:'세부 포트폴리오 합계를 총자산에 반영 중',assetSourceActive:'기존 보유 자산의 코인 총액을 반영 중',cryptoEntriesCount:'개 항목',currentSource:'현재 기준',sourceExcluded:'세부 합산 사용 중'},
  en:{pageTitle:'My Assets',heading:'My Assets',subtitle:'Manage stocks, crypto, commodities, and cash in one place.',navForeign:'Foreign Flow',navAssets:'My Assets',navSetup:'Investment Setup',addAsset:'+ Add asset',gateHeading:'Log in to manage your portfolio',gateNote:'Your holdings are stored securely and separately for each account.',gateLogin:'Log in / Sign up',totalAssets:'Total assets',loadingPrices:'Loading prices',portfolioChange:'Portfolio change',daily:'Daily',weekly:'Weekly',monthly:'Monthly',holdings:'Holdings',refreshPrices:'Refresh prices',all:'All',stock:'Stocks',crypto:'Crypto',commodity:'Commodities',asset:'Asset',assetClass:'Asset class',quantity:'Quantity',currentPrice:'Current price',valuation:'Value',weight:'Weight',excludeTotal:'Exclude from total only',authHeading:'Log in / Sign up',close:'Close',continueGoogle:'Continue with Google',or:'or',passwordPlaceholder:'Password (6+ characters)',login:'Log in',signup:'Sign up',logout:'Log out',authStatus:'Log in with Google or email.',assetSearch:'Search asset',assetSearchPlaceholder:'BTC, Samsung, Gold…',nickname:'Nickname',optional:'optional',nicknamePlaceholder:'Personal wallet, Upbit, Binance…',unitPrice:'Unit price',save:'Save',selectSearchResult:'Select an asset from the search results.',processing:'Processing…',confirmEmail:'Check your email and confirm it before logging in.',signedIn:'Signed in.',googlePending:'Opening Google sign-in…',refreshing:'Refreshing current prices…',loadFailed:'Could not load the portfolio',asOf:'as of',excludedCount:' excluded from total',priceFailures:' price lookups failed',loading:'Loading',failed:'Unavailable',excluded:'Excluded from total only',excludeTitle:'Exclude from total assets while keeping the asset in allocation categories',stableCurrency:'Stable input currency',stableAmount:'Stable amount',full:'Full',edit:'Edit',delete:'Delete',emptyAssets:'No assets yet. Use Add asset to get started.',sortAsc:'Sort value ascending',sortDesc:'Sort value descending',saved:'Saved',searching:'Searching stocks and crypto…',noResults:'No results found.',selected:'selected',addAssetTitle:'Add asset',editAssetTitle:'Edit asset',saveEdit:'Save changes',editHelp:'You can edit the nickname and quantity.',invalidAsset:'Select an asset and enter a quantity greater than zero.',duplicateNickname:'That asset already has the same nickname. Use a different nickname.',deleteConfirm:'Delete this asset?',historyEmpty:'Portfolio changes will appear after snapshots accumulate.',cryptoPortfolio:'Crypto portfolio',cryptoPortfolioNote:'Track coins separately by exchange or wallet.',addCryptoEntry:'+ Add coin',cryptoTotalSource:'Total asset source',cryptoTotalSourceNote:'Only one method is counted to prevent duplicates.',existingCryptoTotal:'Existing crypto total',detailCryptoTotal:'Detailed portfolio total',location:'Exchange / Wallet',locationPlaceholder:'Bybit, Upbit, personal wallet…',coinSearch:'Search coin',coinSearchPlaceholder:'BTC, ETH, SOL…',selectCoinResult:'Select a coin from the search results.',addCryptoTitle:'Add coin',editCryptoTitle:'Edit coin',cryptoEditHelp:'You can edit the exchange, wallet, and quantity.',invalidCryptoEntry:'Enter a location, select a coin, and use a quantity greater than zero.',duplicateCryptoEntry:'That coin already exists at the same exchange or wallet.',deleteCryptoConfirm:'Delete this coin entry?',emptyCrypto:'No detailed crypto portfolio entries yet.',detailSourceEmpty:'Add at least one coin first.',detailSourceActive:'Detailed portfolio total is included in total assets',assetSourceActive:'Existing crypto holdings are included in total assets',cryptoEntriesCount:' entries',currentSource:'Current source',sourceExcluded:'Using detailed total'}
};
const c=key=>COPY[lang][key] || COPY.ko[key] || key;
const classLabel=key=>CLASS_LABELS[lang][key] || CLASS_LABELS.ko[key] || key;
const won=new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0});
const num=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});
const modal=(id,on)=>{$(id).classList.toggle('open',on)};
const status=(id,msg,error=false)=>{const el=$(id);el.textContent=msg;el.style.color=error?'var(--bad)':''};

async function init(){
  bind();
  headerWidgets=setupHeaderWidgets({onLanguageChange:next=>{lang=next;applyPageTranslations(COPY,lang);renderSession();if(session){render();renderHistory(document.querySelector('#historyTabs .active')?.dataset.period||'day')}}});
  ({data:{session}}=await db.auth.getSession());
  db.auth.onAuthStateChange((_event,next)=>{session=next;renderSession();if(session)loadPortfolio()});
  renderSession(); if(session) await loadPortfolio();
}
function bind(){
  $('loginButton').onclick=()=>modal('portfolioAuthModal',true); $('signupButton').onclick=()=>session?logout():modal('portfolioAuthModal',true); $('gateLogin').onclick=()=>modal('portfolioAuthModal',true);
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal(b.dataset.close,false));
  $('portfolioAuthForm').onsubmit=e=>{e.preventDefault();authenticate(false)}; $('portfolioSignupSubmit').onclick=()=>authenticate(true); $('portfolioGoogleAuth').onclick=authenticateWithGoogle;
  $('addAsset').onclick=()=>openAssetModal();
  $('addAssetFromHoldings').onclick=()=>openAssetModal();
  $('addCryptoEntry').onclick=()=>openCryptoEntryModal();
  $('assetQuery').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderSearch,250)};
  $('cryptoAssetQuery').oninput=()=>{clearTimeout(cryptoSearchTimer);cryptoSearchTimer=setTimeout(renderCryptoSearch,250)};
  $('saveAsset').onclick=saveAsset; $('refreshPortfolio').onclick=refresh;
  $('saveCryptoEntry').onclick=saveCryptoEntry;
  $('cryptoTotalSource').onclick=e=>{const b=e.target.closest('[data-crypto-source]');if(b)setCryptoTotalSource(b.dataset.cryptoSource)};
  $('cryptoLocationFilter').onclick=e=>{const b=e.target.closest('[data-location-filter]');if(!b)return;cryptoLocationFilter=b.dataset.locationFilter;renderCryptoPortfolio()};
  $('classFilter').onclick=e=>{const b=e.target.closest('[data-class]');if(!b)return;filter=b.dataset.class;document.querySelectorAll('#classFilter .chip').forEach(x=>x.classList.toggle('active',x===b));renderAssets()};
  $('assetValueSort').onclick=()=>{valueSort=valueSort==='desc'?'asc':'desc';renderAssets()};
  $('historyTabs').onclick=e=>{const b=e.target.closest('[data-period]');if(!b)return;document.querySelectorAll('#historyTabs .chip').forEach(x=>x.classList.toggle('active',x===b));renderHistory(b.dataset.period)};
}
async function authenticate(signup){
  const email=$('portfolioEmail').value.trim(),password=$('portfolioPassword').value;
  status('portfolioAuthStatus',c('processing'));
  const {error}=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(error)return status('portfolioAuthStatus',error.message,true);
  status('portfolioAuthStatus',signup?c('confirmEmail'):c('signedIn')); if(!signup)modal('portfolioAuthModal',false);
}
async function authenticateWithGoogle(){
  status('portfolioAuthStatus',c('googlePending'));
  const {error}=await signInWithGoogle('/Funding-dashboard/my-assets.html');
  if(error)status('portfolioAuthStatus',error.message,true);
}
async function logout(){await db.auth.signOut();assets=[];prices={};cryptoEntries=[];cryptoPrices={};cryptoTotalSource='assets';renderSession()}
function renderSession(){
  const logged=Boolean(session);$('portfolioGate').hidden=logged;$('portfolioApp').hidden=!logged;$('addAsset').disabled=!logged;
  $('loginButton').textContent=logged?session.user.email:c('login');
  $('signupButton').textContent=logged?c('logout'):c('signup');
}
async function loadPortfolio(){
  const [assetResult,cryptoResult,settingsResult]=await Promise.all([
    db.from('portfolio_assets').select('*').order('created_at'),
    db.from('crypto_portfolio_entries').select('*').order('created_at'),
    db.from('portfolio_settings').select('crypto_total_source').maybeSingle(),
  ]);
  if(assetResult.error||cryptoResult.error||settingsResult.error){const error=assetResult.error||cryptoResult.error||settingsResult.error;$('totalMeta').textContent=`${c('loadFailed')}: ${error.message}`;return}
  assets=assetResult.data||[];cryptoEntries=cryptoResult.data||[];cryptoTotalSource=settingsResult.data?.crypto_total_source==='details'?'details':'assets';
  if(cryptoTotalSource==='details'&&!cryptoEntries.length)cryptoTotalSource='assets';
  await refresh();
}
async function refresh(){
  $('totalMeta').textContent=c('refreshing');
  try{const f=await fetch('https://open.er-api.com/v6/latest/USD').then(r=>r.json());fx=Number(f.rates?.KRW)||fx}catch{}
  priceErrors=new Set();cryptoPriceErrors=new Set();
  const quoteTasks=new Map();
  const loadPrice=async(item,targetPrices,targetErrors)=>{const key=`${item.asset_class||'crypto'}:${item.quote_symbol}:${item.currency}:${item.manual_price??''}`;if(!quoteTasks.has(key))quoteTasks.set(key,quote(item));try{targetPrices[item.id]=await quoteTasks.get(key)}catch{targetErrors.add(item.id);targetPrices[item.id]=Number(item.manual_price)||0}};
  await Promise.all([...assets.map(a=>loadPrice(a,prices,priceErrors)),...cryptoEntries.map(entry=>loadPrice(entry,cryptoPrices,cryptoPriceErrors))]);
  render();await saveSnapshot();await loadSnapshots();
}
async function quote(a){
  if(String(a.symbol).toUpperCase()==='USDT')return 1;
  if(a.asset_class==='cash')return a.currency==='USD'?1:1;
  if(a.manual_price!=null)return Number(a.manual_price);
  if(a.quote_symbol.startsWith('CG:')){
    const id=a.quote_symbol.slice(3);const data=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`).then(r=>{if(!r.ok)throw Error(`CoinGecko ${r.status}`);return r.json()});
    const price=Number(data[id]?.usd);if(!price)throw Error('price unavailable');return price;
  }
  if(a.quote_symbol.startsWith('BINANCE:')){
    const symbol=a.quote_symbol.slice(8);const data=await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`).then(r=>{if(!r.ok)throw Error(`Binance ${r.status}`);return r.json()});
    const price=Number(data.price);if(!price)throw Error('price unavailable');return price;
  }
  if(a.quote_symbol.startsWith('NAVER:')){
    const {data,error}=await db.functions.invoke('portfolio-market',{body:{action:'quote',quote_symbol:a.quote_symbol,currency:a.currency}});
    if(error||!Number(data?.price))throw error||Error('price unavailable');return Number(data.price);
  }
  throw Error('unsupported quote source');
}
function valueKrw(a){const p=prices[a.id]??(Number(a.manual_price)||0);return Number(a.quantity)*p*(a.currency==='USD'?fx:1)}
function cryptoValueKrw(entry){const p=cryptoPrices[entry.id]??0;return Number(entry.quantity)*p*(entry.currency==='USD'?fx:1)}
function stableCurrency(a){return a.stable_currency==='USD'?'USD':'KRW'}
function stableValueKrw(a){return (Number(a.stable_amount_krw)||0)*(stableCurrency(a)==='USD'?fx:1)}
function normalizeStableAmount(value,currency){return Number(Number(value).toFixed(currency==='USD'?8:0))}
function includedAssets(){return assets.filter(asset=>!asset.excluded_from_total)}
function portfolioTotals(){return calculatePortfolioTotals({assets,cryptoEntries,cryptoTotalSource,assetValue:valueKrw,cryptoValue:cryptoValueKrw})}
function render(){renderAssets();renderCryptoPortfolio();renderSummary()}
function renderSummary(){
  const countedAssets=includedAssets(),totals=portfolioTotals(),total=totals.total,excludedCount=assets.length-countedAssets.length,timeLocale=lang==='en'?'en-US':'ko-KR',failureCount=priceErrors.size+cryptoPriceErrors.size;$('totalValue').textContent=won.format(total);$('totalMeta').textContent=`USD/KRW ${num.format(fx)} · ${new Date().toLocaleTimeString(timeLocale,{hour:'2-digit',minute:'2-digit'})} ${c('asOf')} · ${c('currentSource')}: ${cryptoTotalSource==='details'?c('detailCryptoTotal'):c('existingCryptoTotal')}${excludedCount?` · ${excludedCount}${c('excludedCount')}`:''}${failureCount?` · ${failureCount}${c('priceFailures')}`:''}`;
  headerWidgets?.setUpdatedAt(new Date());
  const allGroups=Object.keys(CLASS_LABELS.ko).map(key=>({key,value:key==='crypto'&&cryptoTotalSource==='details'?totals.detailCryptoTotal:assets.filter(a=>a.asset_class===key).reduce((s,a)=>s+valueKrw(a),0)})),classificationTotal=allGroups.reduce((sum,group)=>sum+group.value,0);
  $('classBreakdown').innerHTML=allGroups.map(group=>`<div class="asset-class-item"><span class="asset-class-dot" style="background:${COLORS[group.key]}"></span><span class="asset-class-name">${classLabel(group.key)}</span><span class="asset-class-values"><span class="asset-class-value">${won.format(group.value)}</span><span class="asset-class-ratio">${classificationTotal?(group.value/classificationTotal*100).toFixed(1):'0.0'}%</span></span></div>`).join('');
  const stableTotal=assets.reduce((sum,asset)=>sum+stableValueKrw(asset),0);
  $('stableSummary').innerHTML=`<div class="asset-class-item"><span class="asset-class-dot" style="background:var(--accent)"></span><span class="asset-class-name">Stable</span><span class="asset-class-values"><span class="asset-class-value">${won.format(stableTotal)}</span><span class="asset-class-ratio">${total?(stableTotal/total*100).toFixed(1):'0.0'}%</span></span></div>`;
  const groups=allGroups.filter(x=>x.value>0);
  const percentLabels={id:'percentLabels',afterDatasetsDraw(chart){
    const data=chart.data.datasets[0].data.map(Number),sum=data.reduce((a,b)=>a+b,0),meta=chart.getDatasetMeta(0),ctx=chart.ctx;if(!sum)return;
    ctx.save();ctx.fillStyle='#f4fff9';ctx.strokeStyle='rgba(4,15,10,.82)';ctx.lineWidth=3;ctx.lineJoin='round';ctx.textAlign='center';ctx.textBaseline='middle';
    meta.data.forEach((arc,index)=>{
      const ratio=data[index]/sum;if(ratio<.035)return;
      const point=arc.tooltipPosition(),name=chart.data.labels[index],percent=`${(ratio*100).toFixed(1)}%`;
      ctx.font='700 11px Inter, Pretendard, sans-serif';ctx.strokeText(name,point.x,point.y-7);ctx.fillText(name,point.x,point.y-7);
      ctx.font='800 12px Inter, Pretendard, sans-serif';ctx.strokeText(percent,point.x,point.y+7);ctx.fillText(percent,point.x,point.y+7);
    });
    ctx.restore();
  }};
  classChart?.destroy();classChart=new Chart($('classChart'),{type:'doughnut',data:{labels:groups.map(x=>classLabel(x.key)),datasets:[{data:groups.map(x=>x.value),backgroundColor:groups.map(x=>COLORS[x.key]),borderWidth:0}]},plugins:[percentLabels],options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#dce8df',font:{size:12,weight:'700'},generateLabels(chart){const data=chart.data.datasets[0].data.map(Number),sum=data.reduce((a,b)=>a+b,0),meta=chart.getDatasetMeta(0);return chart.data.labels.map((text,index)=>{const style=meta.controller.getStyle(index);return{text:`${text} ${sum?(data[index]/sum*100).toFixed(1):'0.0'}%`,fillStyle:style.backgroundColor,strokeStyle:style.borderColor,lineWidth:style.borderWidth,fontColor:'#dce8df',color:'#dce8df',hidden:!chart.getDataVisibility(index),index}})}}}},cutout:'67%'}});
}
function renderCryptoPortfolio(){
  const totals=portfolioTotals(),total=totals.detailCryptoTotal,locations=[...new Set(cryptoEntries.map(entry=>entry.location))].sort((a,b)=>a.localeCompare(b,lang==='en'?'en':'ko'));
  if(cryptoLocationFilter!=='all'&&!locations.includes(cryptoLocationFilter))cryptoLocationFilter='all';
  const sourceButtons=[...document.querySelectorAll('[data-crypto-source]')];sourceButtons.forEach(button=>{button.classList.toggle('active',button.dataset.cryptoSource===cryptoTotalSource);button.disabled=button.dataset.cryptoSource==='details'&&!cryptoEntries.length});
  $('cryptoPortfolioMeta').textContent=`${cryptoEntries.length}${c('cryptoEntriesCount')} · ${won.format(total)} · ${cryptoTotalSource==='details'?c('detailSourceActive'):c('assetSourceActive')}`;
  const locationGroups=locations.map(location=>({location,value:cryptoEntries.filter(entry=>entry.location===location).reduce((sum,entry)=>sum+cryptoValueKrw(entry),0)}));
  $('cryptoLocationSummary').innerHTML=locationGroups.map(group=>`<div class="crypto-location-card"><span class="location-tag">${escapeHtml(group.location)}</span><strong>${won.format(group.value)}</strong><span>${total?(group.value/total*100).toFixed(1):'0.0'}%</span></div>`).join('');
  $('cryptoLocationFilter').innerHTML=cryptoEntries.length?[`<button class="chip ${cryptoLocationFilter==='all'?'active':''}" type="button" data-location-filter="all">${c('all')}</button>`,...locations.map(location=>`<button class="chip ${cryptoLocationFilter===location?'active':''}" type="button" data-location-filter="${escapeHtml(location)}">${escapeHtml(location)}</button>`)].join(''):'';
  const entries=cryptoLocationFilter==='all'?cryptoEntries:cryptoEntries.filter(entry=>entry.location===cryptoLocationFilter);
  $('cryptoEntryRows').innerHTML=entries.length?sortAssetsByValue(entries,'desc',cryptoValueKrw).map(entry=>{const p=cryptoPrices[entry.id],failed=cryptoPriceErrors.has(entry.id),value=cryptoValueKrw(entry);return `<tr><td><span class="location-tag">${escapeHtml(entry.location)}</span></td><td><div class="asset-main">${escapeHtml(entry.name)}</div><div class="asset-sub">${escapeHtml(entry.symbol)}</div></td><td>${num.format(entry.quantity)}</td><td class="${p==null?'price-loading':failed?'price-error':''}">${p==null?c('loading'):failed?c('failed'):(entry.currency==='USD'?'$':'₩')+num.format(p)}</td><td class="asset-value">${won.format(value)}</td><td>${total?num.format(value/total*100):0}%</td><td><div class="asset-actions"><button class="asset-edit" data-crypto-edit="${entry.id}">${c('edit')}</button><button class="asset-delete" data-crypto-delete="${entry.id}">${c('delete')}</button></div></td></tr>`}).join(''):`<tr><td colspan="7" class="empty-assets">${c('emptyCrypto')}</td></tr>`;
  document.querySelectorAll('[data-crypto-edit]').forEach(button=>button.onclick=()=>openCryptoEntryModal(cryptoEntries.find(entry=>String(entry.id)===button.dataset.cryptoEdit)));
  document.querySelectorAll('[data-crypto-delete]').forEach(button=>button.onclick=()=>deleteCryptoEntry(button.dataset.cryptoDelete));
}
async function setCryptoTotalSource(source){
  const next=source==='details'?'details':'assets';if(next===cryptoTotalSource)return;
  if(next==='details'&&!cryptoEntries.length){$('cryptoPortfolioMeta').textContent=c('detailSourceEmpty');return}
  const buttons=[...document.querySelectorAll('[data-crypto-source]')];buttons.forEach(button=>button.disabled=true);
  const {error}=await db.from('portfolio_settings').upsert({user_id:session.user.id,crypto_total_source:next});
  buttons.forEach(button=>button.disabled=false);if(error){$('cryptoPortfolioMeta').textContent=error.message;return}
  cryptoTotalSource=next;render();await saveSnapshot();await loadSnapshots();
}
function renderAssets(){
  const filtered=filter==='all'?assets:assets.filter(a=>a.asset_class===filter),list=sortAssetsByValue(filtered,valueSort,valueKrw),classificationTotal=portfolioTotals().total;
  const heading=$('assetValueHeading'),sortButton=$('assetValueSort'),sortIcon=sortButton.querySelector('.table-sort-icon');
  heading.setAttribute('aria-sort',valueSort==='asc'?'ascending':valueSort==='desc'?'descending':'none');
  sortIcon.textContent=valueSort==='asc'?'↑':valueSort==='desc'?'↓':'↕';
  sortButton.setAttribute('aria-label',valueSort==='desc'?c('sortAsc'):c('sortDesc'));
  sortButton.classList.toggle('active',Boolean(valueSort));
  $('assetRows').innerHTML=list.length?list.map(a=>{const p=prices[a.id],failed=priceErrors.has(a.id),v=valueKrw(a),nickname=String(a.nickname||'').trim(),stable=Number(a.stable_amount_krw)||0,stableUnit=stableCurrency(a),excluded=Boolean(a.excluded_from_total),sourceExcluded=cryptoTotalSource==='details'&&a.asset_class==='crypto',rowClasses=[`asset-row-${a.asset_class}`,excluded?'asset-row-excluded':'',sourceExcluded?'asset-row-source-excluded':''].filter(Boolean).join(' '),safeName=escapeHtml(a.name),weight=sourceExcluded?'—':`${classificationTotal?num.format(v/classificationTotal*100):0}%`;return `<tr class="${rowClasses}"><td><div class="asset-main">${safeName}${nickname?`<span class="asset-nickname">${escapeHtml(nickname)}</span>`:''}</div><div class="asset-sub">${escapeHtml(a.symbol)}</div></td><td><span class="pill asset-class-pill">${classLabel(a.asset_class)}</span></td><td>${num.format(a.quantity)}</td><td class="${p==null?'price-loading':failed?'price-error':''}">${p==null?c('loading'):failed?c('failed'):(a.currency==='USD'?'$':'₩')+num.format(p)}</td><td class="asset-value">${won.format(v)}</td><td>${weight}${excluded?`<div class="excluded-label">${c('excluded')}</div>`:''}${sourceExcluded?`<div class="excluded-label">${c('sourceExcluded')}</div>`:''}</td><td><label class="exclude-toggle" title="${c('excludeTitle')}"><input class="exclude-checkbox" data-excluded="${a.id}" type="checkbox" aria-label="${safeName} ${c('excludeTotal')}" ${excluded?'checked':''}></label></td><td><div class="stable-control"><select class="field stable-currency" data-stable-currency="${a.id}" aria-label="${safeName} ${c('stableCurrency')}"><option value="KRW" ${stableUnit==='KRW'?'selected':''}>KRW</option><option value="USD" ${stableUnit==='USD'?'selected':''}>USD</option></select><input class="field stable-input" data-stable="${a.id}" type="number" min="0" step="any" inputmode="decimal" aria-label="${safeName} ${c('stableAmount')}" value="${stable||''}" placeholder="0"><button class="chip stable-full" data-stable-full="${a.id}" type="button">${c('full')}</button></div></td><td><div class="asset-actions"><button class="asset-edit" data-edit="${a.id}">${c('edit')}</button><button class="asset-delete" data-delete="${a.id}">${c('delete')}</button></div></td></tr>`}).join(''):`<tr><td colspan="9" class="empty-assets">${c('emptyAssets')}</td></tr>`;
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAssetModal(assets.find(a=>String(a.id)===b.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.delete));
  document.querySelectorAll('[data-stable]').forEach(input=>{input.onchange=()=>saveStableAmount(input);input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();input.blur()}}});
  document.querySelectorAll('[data-stable-currency]').forEach(select=>select.onchange=()=>saveStableCurrency(select));
  document.querySelectorAll('[data-stable-full]').forEach(button=>button.onclick=()=>saveStableFull(button));
  document.querySelectorAll('[data-excluded]').forEach(input=>input.onchange=()=>saveTotalExclusion(input));
}
async function saveTotalExclusion(input){
  const asset=assets.find(item=>String(item.id)===input.dataset.excluded);if(!asset)return;
  const excluded=input.checked,previous=Boolean(asset.excluded_from_total);input.disabled=true;
  const {error}=await db.from('portfolio_assets').update({excluded_from_total:excluded}).eq('id',asset.id);
  if(error){input.checked=previous;input.disabled=false;input.title=error.message;return}
  asset.excluded_from_total=excluded;render();await saveSnapshot();
}
async function saveStableAmount(input){
  const asset=assets.find(item=>String(item.id)===input.dataset.stable),amount=Number(input.value||0);if(!asset||!Number.isFinite(amount)||amount<0){input.classList.add('save-error');return}
  const previous=Number(asset.stable_amount_krw)||0;input.disabled=true;input.classList.remove('save-error','saved');input.classList.add('saving');
  const {error}=await db.from('portfolio_assets').update({stable_amount_krw:amount}).eq('id',asset.id);input.disabled=false;input.classList.remove('saving');
  if(error){input.value=previous||'';input.classList.add('save-error');input.title=error.message;return}
  asset.stable_amount_krw=amount;input.classList.add('saved');input.title=c('saved');renderSummary();await saveSnapshot();setTimeout(()=>input.classList.remove('saved'),900);
}
async function saveStableCurrency(select){
  const asset=assets.find(item=>String(item.id)===select.dataset.stableCurrency);if(!asset)return;
  const previousCurrency=stableCurrency(asset),nextCurrency=select.value==='USD'?'USD':'KRW';if(previousCurrency===nextCurrency)return;
  const previousAmount=Number(asset.stable_amount_krw)||0,converted=normalizeStableAmount(stableValueKrw(asset)/(nextCurrency==='USD'?fx:1),nextCurrency);select.disabled=true;
  const {error}=await db.from('portfolio_assets').update({stable_currency:nextCurrency,stable_amount_krw:converted}).eq('id',asset.id);
  if(error){select.value=previousCurrency;select.disabled=false;select.title=error.message;return}
  asset.stable_currency=nextCurrency;asset.stable_amount_krw=converted;render();await saveSnapshot();
}
async function saveStableFull(button){
  const asset=assets.find(item=>String(item.id)===button.dataset.stableFull);if(!asset)return;
  const currency=stableCurrency(asset),amount=normalizeStableAmount(valueKrw(asset)/(currency==='USD'?fx:1),currency),input=document.querySelector(`[data-stable="${asset.id}"]`);if(!input)return;
  button.disabled=true;input.value=amount||'';await saveStableAmount(input);button.disabled=false;
}
async function renderSearch(){
  const raw=$('assetQuery').value.trim(),q=raw.toLowerCase();selectedSearchAsset=null;$('selectedAsset').value='';
  if(!q){searchResults=[];$('assetResults').innerHTML='';return status('assetStatus',c('selectSearchResult'))}
  status('assetStatus',c('searching'));
  const local=CATALOG.filter(a=>`${a.symbol} ${a.name}`.toLowerCase().includes(q));
  const [coins,stocks]=await Promise.all([
    raw.length<2?[]:fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(raw)}`).then(r=>r.ok?r.json():{coins:[]}).then(data=>(data.coins||[]).filter(c=>c.market_cap_rank).slice(0,8).map(c=>({symbol:String(c.symbol).toUpperCase(),name:c.name,asset_class:'crypto',quote_symbol:`CG:${c.id}`,currency:'USD',market:'CoinGecko'}))).catch(()=>[]),
    db.functions.invoke('portfolio-market',{body:{action:'search',query:raw}}).then(({data,error})=>error?[]:(data?.results||[])).catch(()=>[])
  ]);
  if($('assetQuery').value.trim()!==raw)return;
  const seen=new Set();searchResults=[...local,...coins,...stocks].filter(a=>{const key=`${a.asset_class}:${a.symbol}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,14);
  $('assetResults').innerHTML=searchResults.map((a,index)=>`<button class="asset-result" data-index="${index}"><span><b>${escapeHtml(a.name)}</b><br><small>${escapeHtml(a.symbol)} · ${classLabel(a.asset_class)}</small></span><small>${escapeHtml(a.market||a.currency)}</small></button>`).join('');
  document.querySelectorAll('.asset-result').forEach(b=>b.onclick=()=>selectAsset(searchResults[Number(b.dataset.index)],b));
  status('assetStatus',searchResults.length?c('selectSearchResult'):c('noResults'),!searchResults.length);
}
function selectAsset(a,b){selectedSearchAsset=a;$('selectedAsset').value=a.symbol;document.querySelectorAll('.asset-result').forEach(x=>x.classList.toggle('active',x===b));status('assetStatus',`${a.name} ${c('selected')}`);const manual=a.asset_class==='cash';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=!manual);$('assetManualPrice').value=a.symbol==='USD'?'1':a.symbol==='KRW'?'1':''}
function resetAssetForm(){clearTimeout(searchTimer);searchResults=[];selectedSearchAsset=null;editingAssetId=null;$('assetModalTitle').textContent=c('addAssetTitle');$('saveAsset').textContent=c('save');$('assetQuery').disabled=false;$('assetQuery').value='';$('selectedAsset').value='';$('assetNickname').value='';$('assetQuantity').value='';$('assetManualPrice').value='';$('assetResults').innerHTML='';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=true);status('assetStatus',c('selectSearchResult'))}
function openAssetModal(asset=null){
  resetAssetForm();
  if(asset){
    editingAssetId=asset.id;selectedSearchAsset={symbol:asset.symbol,name:asset.name,asset_class:asset.asset_class,quote_symbol:asset.quote_symbol,currency:asset.currency};
    $('assetModalTitle').textContent=c('editAssetTitle');$('saveAsset').textContent=c('saveEdit');$('assetQuery').value=`${asset.name} (${asset.symbol})`;$('assetQuery').disabled=true;$('selectedAsset').value=asset.symbol;$('assetNickname').value=asset.nickname||'';$('assetQuantity').value=asset.quantity;
    const manual=asset.asset_class==='cash';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=!manual);$('assetManualPrice').value=manual?(Number(asset.manual_price)||1):'';status('assetStatus',c('editHelp'));
  }
  modal('assetModal',true);setTimeout(()=>$(asset?'assetQuantity':'assetQuery').focus(),0);
}
async function saveAsset(){
  const a=selectedSearchAsset,quantity=Number($('assetQuantity').value);if(!a||!Number.isFinite(quantity)||quantity<=0)return status('assetStatus',c('invalidAsset'),true);
  const manual=a.asset_class==='cash'?Number($('assetManualPrice').value)||1:null,nickname=$('assetNickname').value.trim();
  let error;
  if(editingAssetId)({error}=await db.from('portfolio_assets').update({nickname,quantity,manual_price:manual}).eq('id',editingAssetId));
  else{const payload={user_id:session.user.id,symbol:a.symbol,name:a.name,nickname,asset_class:a.asset_class,quote_symbol:a.quote_symbol,currency:a.currency,quantity,manual_price:manual};({error}=await db.from('portfolio_assets').upsert(payload,{onConflict:'user_id,symbol,asset_class,nickname'}))}
  if(error)return status('assetStatus',error.code==='23505'?c('duplicateNickname'):error.message,true);
  modal('assetModal',false);await loadPortfolio();
}
async function deleteAsset(id){if(!confirm(c('deleteConfirm')))return;await db.from('portfolio_assets').delete().eq('id',id);await loadPortfolio()}
async function renderCryptoSearch(){
  const raw=$('cryptoAssetQuery').value.trim(),q=raw.toLowerCase();selectedCryptoAsset=null;$('selectedCryptoAsset').value='';
  if(!q){cryptoSearchResults=[];$('cryptoAssetResults').innerHTML='';return status('cryptoEntryStatus',c('selectCoinResult'))}
  status('cryptoEntryStatus',c('searching'));
  const local=CATALOG.filter(a=>a.asset_class==='crypto'&&`${a.symbol} ${a.name}`.toLowerCase().includes(q));
  const coins=raw.length<2?[]:await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(raw)}`).then(r=>r.ok?r.json():{coins:[]}).then(data=>(data.coins||[]).filter(coin=>coin.market_cap_rank).slice(0,12).map(coin=>({symbol:String(coin.symbol).toUpperCase(),name:coin.name,asset_class:'crypto',quote_symbol:`CG:${coin.id}`,currency:'USD',market:'CoinGecko'}))).catch(()=>[]);
  if($('cryptoAssetQuery').value.trim()!==raw)return;
  const seen=new Set();cryptoSearchResults=[...local,...coins].filter(a=>{const key=`${a.symbol}:${a.quote_symbol}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,14);
  $('cryptoAssetResults').innerHTML=cryptoSearchResults.map((a,index)=>`<button class="asset-result crypto-asset-result" data-crypto-index="${index}"><span><b>${escapeHtml(a.name)}</b><br><small>${escapeHtml(a.symbol)} · ${classLabel('crypto')}</small></span><small>${escapeHtml(a.market||a.currency)}</small></button>`).join('');
  document.querySelectorAll('[data-crypto-index]').forEach(button=>button.onclick=()=>selectCryptoAsset(cryptoSearchResults[Number(button.dataset.cryptoIndex)],button));
  status('cryptoEntryStatus',cryptoSearchResults.length?c('selectCoinResult'):c('noResults'),!cryptoSearchResults.length);
}
function selectCryptoAsset(asset,button){selectedCryptoAsset=asset;$('selectedCryptoAsset').value=asset.symbol;document.querySelectorAll('[data-crypto-index]').forEach(item=>item.classList.toggle('active',item===button));status('cryptoEntryStatus',`${asset.name} ${c('selected')}`)}
function resetCryptoEntryForm(){clearTimeout(cryptoSearchTimer);cryptoSearchResults=[];selectedCryptoAsset=null;editingCryptoEntryId=null;$('cryptoEntryModalTitle').textContent=c('addCryptoTitle');$('saveCryptoEntry').textContent=c('save');$('cryptoLocation').value='';$('cryptoAssetQuery').disabled=false;$('cryptoAssetQuery').value='';$('selectedCryptoAsset').value='';$('cryptoQuantity').value='';$('cryptoAssetResults').innerHTML='';status('cryptoEntryStatus',c('selectCoinResult'))}
function openCryptoEntryModal(entry=null){
  resetCryptoEntryForm();
  if(entry){editingCryptoEntryId=entry.id;selectedCryptoAsset={symbol:entry.symbol,name:entry.name,asset_class:'crypto',quote_symbol:entry.quote_symbol,currency:entry.currency};$('cryptoEntryModalTitle').textContent=c('editCryptoTitle');$('saveCryptoEntry').textContent=c('saveEdit');$('cryptoLocation').value=entry.location;$('cryptoAssetQuery').value=`${entry.name} (${entry.symbol})`;$('cryptoAssetQuery').disabled=true;$('selectedCryptoAsset').value=entry.symbol;$('cryptoQuantity').value=entry.quantity;status('cryptoEntryStatus',c('cryptoEditHelp'))}
  modal('cryptoEntryModal',true);setTimeout(()=>$(entry?'cryptoQuantity':'cryptoLocation').focus(),0);
}
async function saveCryptoEntry(){
  const asset=selectedCryptoAsset,location=$('cryptoLocation').value.trim(),quantity=Number($('cryptoQuantity').value);if(!asset||!location||!Number.isFinite(quantity)||quantity<=0)return status('cryptoEntryStatus',c('invalidCryptoEntry'),true);
  let error;if(editingCryptoEntryId)({error}=await db.from('crypto_portfolio_entries').update({location,quantity}).eq('id',editingCryptoEntryId));
  else{const payload={user_id:session.user.id,location,symbol:asset.symbol,name:asset.name,quote_symbol:asset.quote_symbol,currency:asset.currency,quantity};({error}=await db.from('crypto_portfolio_entries').insert(payload))}
  if(error)return status('cryptoEntryStatus',error.code==='23505'?c('duplicateCryptoEntry'):error.message,true);
  modal('cryptoEntryModal',false);await loadPortfolio();
}
async function deleteCryptoEntry(id){
  if(!confirm(c('deleteCryptoConfirm')))return;const {error}=await db.from('crypto_portfolio_entries').delete().eq('id',id);if(error){$('cryptoPortfolioMeta').textContent=error.message;return}
  const remaining=cryptoEntries.filter(entry=>String(entry.id)!==String(id));if(!remaining.length&&cryptoTotalSource==='details')await db.from('portfolio_settings').upsert({user_id:session.user.id,crypto_total_source:'assets'});
  await loadPortfolio();
}
async function saveSnapshot(){if(!session||(!assets.length&&!cryptoEntries.length))return;const totals=portfolioTotals(),class_values={};Object.keys(CLASS_LABELS.ko).forEach(k=>class_values[k]=k==='crypto'?totals.cryptoTotal:assets.filter(a=>a.asset_class===k).reduce((s,a)=>s+valueKrw(a),0));const total_value_krw=totals.total;class_values.stable=assets.reduce((sum,asset)=>sum+stableValueKrw(asset),0);const snapshot_date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await db.from('portfolio_snapshots').upsert({user_id:session.user.id,snapshot_date,total_value_krw,class_values})}
async function loadSnapshots(){const {data}=await db.from('portfolio_snapshots').select('*').order('snapshot_date');window.portfolioSnapshots=data||[];renderHistory(document.querySelector('#historyTabs .active')?.dataset.period||'day')}
function renderHistory(period){
  let rows=[...(window.portfolioSnapshots||[])];if(period!=='day'){const keyed=new Map();rows.forEach(r=>{const d=new Date(r.snapshot_date+'T00:00:00');const key=period==='month'?r.snapshot_date.slice(0,7):`${d.getFullYear()}-${Math.ceil((((d-new Date(d.getFullYear(),0,1))/86400000)+new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;keyed.set(key,r)});rows=[...keyed.values()]}
  const first=Number(rows[0]?.total_value_krw)||0,last=Number(rows.at(-1)?.total_value_krw)||0,change=first?(last/first-1)*100:0;$('historyChange').textContent=rows.length>1?`${change>=0?'+':''}${change.toFixed(2)}%`:c('historyEmpty');
  historyChart?.destroy();historyChart=new Chart($('historyChart'),{type:'line',data:{labels:rows.map(r=>r.snapshot_date),datasets:[{data:rows.map(r=>Number(r.total_value_krw)),borderColor:'#23e7a5',backgroundColor:'rgba(35,231,165,.12)',fill:true,tension:.25,pointRadius:2,pointHoverRadius:6,pointHitRadius:16,pointHoverBorderWidth:3}]},options:{responsive:true,interaction:{mode:'nearest',axis:'x',intersect:false},plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>items[0]?.label||'',label:context=>`${c('totalAssets')}: ${formatPortfolioKrw(context.parsed.y,lang)}`}}},scales:{x:{ticks:{color:'#82958b'},grid:{display:false}},y:{ticks:{color:'#82958b',callback:v=>`${Math.round(v/1000000)}M`},grid:{color:'rgba(130,149,139,.12)'}}}}});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init();
