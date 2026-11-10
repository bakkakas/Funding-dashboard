import {initCreditCharts,renderCreditCharts} from './credit-balance.js?v=4';
import {setupForeignHeader} from './foreign-header.js?v=5';
import {FlowPanel} from './flow-panel.js?v=4';
let lang=localStorage.getItem('fundingDashboardLanguage')==='en'?'en':'ko';
let market='KOSPI',daily,live,chart,panel;
const nf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
const $=id=>document.getElementById(id);
function render(){
 const en=lang==='en';
 document.documentElement.lang=lang;document.title=en?'Market Flow | Funding Dashboard':'수급 | Funding Dashboard';
 for(const [key,ko,eng]of [['navForeign','수급','Market Flow'],['navAssets','내 자산','My Assets'],['navSetup','투자 셋업','Investment Setup']])document.querySelector(`[data-page-i18n="${key}"]`).textContent=en?eng:ko;
 document.querySelector('[data-page-i18n="heading"]').textContent=en?'Market Flow':'수급';
 document.querySelector('[data-page-i18n="subtitle"]').textContent=en?'KOSPI · KOSDAQ market-wide':'코스피 · 코스닥 시장 전체';
 $('marketTabs').replaceChildren(...['KOSPI','KOSDAQ'].map(key=>{const b=document.createElement('button');b.className=`chip ${key===market?'active':''}`;b.textContent=en?key:key==='KOSPI'?'코스피':'코스닥';b.onclick=()=>{market=key;render();};return b;}));
 $('intradayTitle').textContent=`${market} · ${en?'Intraday investor net buying':'장중 투자자별 수급'} · KRX`;
 const all=live?.marketIntraday?.[market]||[],date=all.reduce((a,r)=>r.date>a?r.date:a,''),rows=all.filter(r=>r.date===date),latest=rows.at(-1);
 const names=en?['Foreign','Individuals','Institutions']:['외국인','개인','기관'];
 $('intradaySummary').textContent=latest?`${date} ${latest.sourceTime||latest.time} · `+['foreign','individual','institution'].map((k,i)=>`${names[i]} ${nf.format(latest[k])} ${en?'KRW 100M':'억원'}`).join(' · '):(en?'No intraday data available':'장중 자료 미제공');
 $('intradayNote').textContent=en?'Market-wide cumulative net amounts (KRW 100M). Collected about every 15 minutes during trading hours.':'시장 전체 누적 순매수금액 · 단위: 억원 · 장중 약 15분 간격 수집';
 chart?.destroy();chart=new Chart($('intradayChart'),{type:'line',data:{labels:rows.map(r=>r.time),datasets:['foreign','individual','institution'].map((k,i)=>({label:names[i],data:rows.map(r=>r[k]),borderColor:['#23e7a5','#8ea2ff','#f5c451'][i],pointRadius:2,borderWidth:2}))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#dce8df'}}},scales:{x:{ticks:{color:'#82958b',maxTicksLimit:8}},y:{grid:{display:true,color:'rgba(130,149,139,.3)',lineWidth:1},ticks:{color:'#82958b'},title:{display:true,text:en?'KRW 100M':'억원',color:'#82958b'}}}}});
 panel?.destroy();const records=daily?.markets?.[market]?.records;
 if(records?.length)panel=new FlowPanel($('marketFlowPanel'),{rows:records,name:market,market:true,language:lang});
 else $('marketFlowPanel').textContent=en?'Daily market history unavailable.':'시장 일별 자료를 불러오지 못했습니다.';
 $('foreignUpdatedAt').textContent=`${en?'Daily history through':'일별 자료 기준'}: ${records?.at(-1)?.date||'—'}`;
 $('marketSource').textContent=(en?'Source: Naver Finance · Daily market history checked at 20:27 KST. Today’s provisional values appear only in intraday charts.':'출처: 네이버 금융 · 일별 시장 수급은 매일 20:27에 확인합니다. 당일 잠정치는 장중 그래프에서만 표시합니다.')+(daily?.collectionWarnings?.length?(en?' · Refresh delayed; showing last good data.':' · 갱신 지연: 마지막 정상 자료 표시 중.'):'');
}
async function read(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.json();}
initCreditCharts(lang);
setupForeignHeader({onLanguageChange:next=>{lang=next;renderCreditCharts(lang);render();}});
Promise.allSettled([read('./market_flow_data.json'),read('./foreign_flow_data.json')]).then(([a,b])=>{daily=a.status==='fulfilled'?a.value:null;live=b.status==='fulfilled'?b.value:null;render();});
