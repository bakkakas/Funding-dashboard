import { authClient as db, signInWithGoogle } from './auth.js?v=1';
import { setupHeaderWidgets } from './header-widgets.js?v=1';
const $=id=>document.getElementById(id);
const CLASSES={stock:'주식',crypto:'크립토',commodity:'원자재',cash:'현금'};
const COLORS={stock:'#23e7a5',crypto:'#8ea2ff',commodity:'#f5c451',cash:'#86a8ff'};
const CATALOG=[
  ['BTC','비트코인','crypto','CG:bitcoin','USD'],['ETH','이더리움','crypto','CG:ethereum','USD'],['SOL','솔라나','crypto','CG:solana','USD'],['BNB','BNB','crypto','CG:binancecoin','USD'],['ORBS','Orbs','crypto','CG:orbs','USD'],
  ['USDT','테더 (1달러 고정)','crypto','FIXED:USD','USD'],['GOLD','금 (PAXG 현물 기준)','commodity','BINANCE:PAXGUSDT','USD'],['KRW','원화','cash','CASH:KRW','KRW'],['USD','달러','cash','CASH:USD','USD']
].map(([symbol,name,asset_class,quote_symbol,currency])=>({symbol,name,asset_class,quote_symbol,currency}));
let session=null,assets=[],prices={},priceErrors=new Set(),fx=1380,filter='all',classChart,historyChart;
let searchTimer=null,searchResults=[],selectedSearchAsset=null,editingAssetId=null;
let lang=localStorage.getItem('fundingDashboardLanguage')==='en'?'en':'ko',headerWidgets=null;
const won=new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0});
const num=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});
const modal=(id,on)=>{$(id).classList.toggle('open',on)};
const status=(id,msg,error=false)=>{const el=$(id);el.textContent=msg;el.style.color=error?'var(--bad)':''};

async function init(){
  bind();
  headerWidgets=setupHeaderWidgets({onLanguageChange:next=>{lang=next;renderSession()}});
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
  $('assetQuery').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderSearch,250)};
  $('saveAsset').onclick=saveAsset; $('refreshPortfolio').onclick=refresh;
  $('classFilter').onclick=e=>{const b=e.target.closest('[data-class]');if(!b)return;filter=b.dataset.class;document.querySelectorAll('#classFilter .chip').forEach(x=>x.classList.toggle('active',x===b));renderAssets()};
  $('historyTabs').onclick=e=>{const b=e.target.closest('[data-period]');if(!b)return;document.querySelectorAll('#historyTabs .chip').forEach(x=>x.classList.toggle('active',x===b));renderHistory(b.dataset.period)};
}
async function authenticate(signup){
  const email=$('portfolioEmail').value.trim(),password=$('portfolioPassword').value;
  status('portfolioAuthStatus','처리 중…');
  const {error}=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(error)return status('portfolioAuthStatus',error.message,true);
  status('portfolioAuthStatus',signup?'확인 메일을 보냈어. 메일 인증 후 로그인해.':'로그인 완료'); if(!signup)modal('portfolioAuthModal',false);
}
async function authenticateWithGoogle(){
  status('portfolioAuthStatus','Google 로그인으로 이동 중…');
  const {error}=await signInWithGoogle('/Funding-dashboard/my-assets.html');
  if(error)status('portfolioAuthStatus',error.message,true);
}
async function logout(){await db.auth.signOut();assets=[];prices={};renderSession()}
function renderSession(){
  const logged=Boolean(session);$('portfolioGate').hidden=logged;$('portfolioApp').hidden=!logged;$('addAsset').disabled=!logged;
  $('loginButton').textContent=logged?session.user.email:(lang==='en'?'Login':'로그인');
  $('signupButton').textContent=logged?(lang==='en'?'Log out':'로그아웃'):(lang==='en'?'Sign up':'회원가입');
}
async function loadPortfolio(){
  const {data,error}=await db.from('portfolio_assets').select('*').order('created_at');
  if(error){$('totalMeta').textContent='포트폴리오를 불러오지 못했어: '+error.message;return} assets=data||[];await refresh();
}
async function refresh(){
  $('totalMeta').textContent='현재 가격 갱신 중…';
  try{const f=await fetch('https://open.er-api.com/v6/latest/USD').then(r=>r.json());fx=Number(f.rates?.KRW)||fx}catch{}
  priceErrors=new Set();
  const quoteTasks=new Map();
  await Promise.all(assets.map(async a=>{const key=`${a.asset_class}:${a.quote_symbol}:${a.currency}:${a.manual_price??''}`;if(!quoteTasks.has(key))quoteTasks.set(key,quote(a));try{prices[a.id]=await quoteTasks.get(key)}catch{priceErrors.add(a.id);prices[a.id]=Number(a.manual_price)||0}}));
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
function render(){renderAssets();renderSummary()}
function renderSummary(){
  const values=assets.map(a=>valueKrw(a)),total=values.reduce((a,b)=>a+b,0);$('totalValue').textContent=won.format(total);$('totalMeta').textContent=`USD/KRW ${num.format(fx)} · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 기준${priceErrors.size?` · ${priceErrors.size}개 가격 조회 실패`:''}`;
  headerWidgets?.setUpdatedAt(new Date());
  const allGroups=Object.keys(CLASSES).map(key=>({key,value:assets.filter(a=>a.asset_class===key).reduce((s,a)=>s+valueKrw(a),0)}));
  $('classBreakdown').innerHTML=allGroups.map(group=>`<div class="asset-class-item"><span class="asset-class-dot" style="background:${COLORS[group.key]}"></span><span class="asset-class-name">${CLASSES[group.key]}</span><span class="asset-class-values"><span class="asset-class-value">${won.format(group.value)}</span><span class="asset-class-ratio">${total?(group.value/total*100).toFixed(1):'0.0'}%</span></span></div>`).join('');
  const groups=allGroups.filter(x=>x.value>0);
  classChart?.destroy();classChart=new Chart($('classChart'),{type:'doughnut',data:{labels:groups.map(x=>CLASSES[x.key]),datasets:[{data:groups.map(x=>x.value),backgroundColor:groups.map(x=>COLORS[x.key]),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#dce8df'}}},cutout:'67%'}});
}
function renderAssets(){
  const list=filter==='all'?assets:assets.filter(a=>a.asset_class===filter),total=assets.reduce((s,a)=>s+valueKrw(a),0);
  $('assetRows').innerHTML=list.length?list.map(a=>{const p=prices[a.id],failed=priceErrors.has(a.id),v=valueKrw(a),nickname=String(a.nickname||'').trim();return `<tr><td><div class="asset-main">${escapeHtml(a.name)}${nickname?`<span class="asset-nickname">${escapeHtml(nickname)}</span>`:''}</div><div class="asset-sub">${escapeHtml(a.symbol)}</div></td><td><span class="pill">${CLASSES[a.asset_class]}</span></td><td>${num.format(a.quantity)}</td><td class="${p==null?'price-loading':failed?'price-error':''}">${p==null?'조회 중':failed?'조회 실패':(a.currency==='USD'?'$':'₩')+num.format(p)}</td><td class="asset-value">${won.format(v)}</td><td>${total?num.format(v/total*100):0}%</td><td><div class="asset-actions"><button class="asset-edit" data-edit="${a.id}">수정</button><button class="asset-delete" data-delete="${a.id}">삭제</button></div></td></tr>`}).join(''):'<tr><td colspan="7" class="empty-assets">등록된 자산이 없어. 자산 추가 버튼으로 시작해.</td></tr>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAssetModal(assets.find(a=>String(a.id)===b.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.delete));
}
async function renderSearch(){
  const raw=$('assetQuery').value.trim(),q=raw.toLowerCase();selectedSearchAsset=null;$('selectedAsset').value='';
  if(!q){searchResults=[];$('assetResults').innerHTML='';return status('assetStatus','검색 결과에서 자산을 선택해.')}
  status('assetStatus','주식·크립토 검색 중…');
  const local=CATALOG.filter(a=>`${a.symbol} ${a.name}`.toLowerCase().includes(q));
  const [coins,stocks]=await Promise.all([
    raw.length<2?[]:fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(raw)}`).then(r=>r.ok?r.json():{coins:[]}).then(data=>(data.coins||[]).filter(c=>c.market_cap_rank).slice(0,8).map(c=>({symbol:String(c.symbol).toUpperCase(),name:c.name,asset_class:'crypto',quote_symbol:`CG:${c.id}`,currency:'USD',market:'CoinGecko'}))).catch(()=>[]),
    db.functions.invoke('portfolio-market',{body:{action:'search',query:raw}}).then(({data,error})=>error?[]:(data?.results||[])).catch(()=>[])
  ]);
  if($('assetQuery').value.trim()!==raw)return;
  const seen=new Set();searchResults=[...local,...coins,...stocks].filter(a=>{const key=`${a.asset_class}:${a.symbol}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,14);
  $('assetResults').innerHTML=searchResults.map((a,index)=>`<button class="asset-result" data-index="${index}"><span><b>${escapeHtml(a.name)}</b><br><small>${escapeHtml(a.symbol)} · ${CLASSES[a.asset_class]}</small></span><small>${escapeHtml(a.market||a.currency)}</small></button>`).join('');
  document.querySelectorAll('.asset-result').forEach(b=>b.onclick=()=>selectAsset(searchResults[Number(b.dataset.index)],b));
  status('assetStatus',searchResults.length?'검색 결과에서 자산을 선택해.':'검색 결과가 없어.',!searchResults.length);
}
function selectAsset(a,b){selectedSearchAsset=a;$('selectedAsset').value=a.symbol;document.querySelectorAll('.asset-result').forEach(x=>x.classList.toggle('active',x===b));status('assetStatus',`${a.name} 선택됨`);const manual=a.asset_class==='cash';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=!manual);$('assetManualPrice').value=a.symbol==='USD'?'1':a.symbol==='KRW'?'1':''}
function resetAssetForm(){clearTimeout(searchTimer);searchResults=[];selectedSearchAsset=null;editingAssetId=null;$('assetModalTitle').textContent='자산 추가';$('saveAsset').textContent='저장';$('assetQuery').disabled=false;$('assetQuery').value='';$('selectedAsset').value='';$('assetNickname').value='';$('assetQuantity').value='';$('assetManualPrice').value='';$('assetResults').innerHTML='';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=true);status('assetStatus','검색 결과에서 자산을 선택해.')}
function openAssetModal(asset=null){
  resetAssetForm();
  if(asset){
    editingAssetId=asset.id;selectedSearchAsset={symbol:asset.symbol,name:asset.name,asset_class:asset.asset_class,quote_symbol:asset.quote_symbol,currency:asset.currency};
    $('assetModalTitle').textContent='자산 수정';$('saveAsset').textContent='수정 저장';$('assetQuery').value=`${asset.name} (${asset.symbol})`;$('assetQuery').disabled=true;$('selectedAsset').value=asset.symbol;$('assetNickname').value=asset.nickname||'';$('assetQuantity').value=asset.quantity;
    const manual=asset.asset_class==='cash';document.querySelectorAll('.manual-price').forEach(x=>x.hidden=!manual);$('assetManualPrice').value=manual?(Number(asset.manual_price)||1):'';status('assetStatus','닉네임과 수량을 수정할 수 있어.');
  }
  modal('assetModal',true);setTimeout(()=>$(asset?'assetQuantity':'assetQuery').focus(),0);
}
async function saveAsset(){
  const a=selectedSearchAsset,quantity=Number($('assetQuantity').value);if(!a||!Number.isFinite(quantity)||quantity<=0)return status('assetStatus','자산과 0보다 큰 수량을 입력해.',true);
  const manual=a.asset_class==='cash'?Number($('assetManualPrice').value)||1:null,nickname=$('assetNickname').value.trim();
  let error;
  if(editingAssetId)({error}=await db.from('portfolio_assets').update({nickname,quantity,manual_price:manual}).eq('id',editingAssetId));
  else{const payload={user_id:session.user.id,symbol:a.symbol,name:a.name,nickname,asset_class:a.asset_class,quote_symbol:a.quote_symbol,currency:a.currency,quantity,manual_price:manual};({error}=await db.from('portfolio_assets').upsert(payload,{onConflict:'user_id,symbol,asset_class,nickname'}))}
  if(error)return status('assetStatus',error.code==='23505'?'같은 종목에 동일한 닉네임이 이미 있어. 다른 닉네임을 입력해.':error.message,true);
  modal('assetModal',false);await loadPortfolio();
}
async function deleteAsset(id){if(!confirm('이 자산을 삭제할까?'))return;await db.from('portfolio_assets').delete().eq('id',id);await loadPortfolio()}
async function saveSnapshot(){if(!session||!assets.length)return;const class_values={};Object.keys(CLASSES).forEach(k=>class_values[k]=assets.filter(a=>a.asset_class===k).reduce((s,a)=>s+valueKrw(a),0));const total_value_krw=Object.values(class_values).reduce((a,b)=>a+b,0);const snapshot_date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await db.from('portfolio_snapshots').upsert({user_id:session.user.id,snapshot_date,total_value_krw,class_values})}
async function loadSnapshots(){const {data}=await db.from('portfolio_snapshots').select('*').order('snapshot_date');window.portfolioSnapshots=data||[];renderHistory(document.querySelector('#historyTabs .active')?.dataset.period||'day')}
function renderHistory(period){
  let rows=[...(window.portfolioSnapshots||[])];if(period!=='day'){const keyed=new Map();rows.forEach(r=>{const d=new Date(r.snapshot_date+'T00:00:00');const key=period==='month'?r.snapshot_date.slice(0,7):`${d.getFullYear()}-${Math.ceil((((d-new Date(d.getFullYear(),0,1))/86400000)+new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;keyed.set(key,r)});rows=[...keyed.values()]}
  const first=Number(rows[0]?.total_value_krw)||0,last=Number(rows.at(-1)?.total_value_krw)||0,change=first?(last/first-1)*100:0;$('historyChange').textContent=rows.length>1?`${change>=0?'+':''}${change.toFixed(2)}%`:'스냅샷이 쌓이면 변화가 표시돼.';
  historyChart?.destroy();historyChart=new Chart($('historyChart'),{type:'line',data:{labels:rows.map(r=>r.snapshot_date),datasets:[{data:rows.map(r=>Number(r.total_value_krw)),borderColor:'#23e7a5',backgroundColor:'rgba(35,231,165,.12)',fill:true,tension:.25,pointRadius:2}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#82958b'},grid:{display:false}},y:{ticks:{color:'#82958b',callback:v=>`${Math.round(v/1000000)}M`},grid:{color:'rgba(130,149,139,.12)'}}}}});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init();
