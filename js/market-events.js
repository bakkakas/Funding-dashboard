const DAY=86400000;
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export function koreaDate(now=new Date()){return dateFormat.format(now);}
function dayNumber(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp/DAY:NaN;}
export function upcomingEvents(events,now=new Date()){
 const today=dayNumber(koreaDate(now)),seen=new Set();
 return (Array.isArray(events)?events:[]).map(event=>({...event,daysLeft:dayNumber(event.date)-today}))
 .filter(event=>Number.isInteger(event.daysLeft)&&event.daysLeft>=0&&event.daysLeft<=30&&event.id&&event.name)
 .sort((a,b)=>a.daysLeft-b.daysLeft||a.id.localeCompare(b.id)).filter(event=>{const key=event.series+':'+event.date;if(seen.has(key))return false;seen.add(key);return true;});
}
export function eventLabel(event){const [,m,d]=event.date.split('-');return `D-${event.daysLeft} ${event.name}${event.status==='estimated'?'·예정':''}${event.dateBasis==='US-local'?'·현지':''}(${Number(m)}월${Number(d)}일)`;}
export function nextKoreanMidnight(now=new Date()){return Date.parse(koreaDate(now)+'T00:00:00+09:00')+DAY;}
const earnings=new Set(['NVDA','MSFT','AAPL','AMZN','GOOGL','META','TSM','005930','000660']);
function category(event){
 if(earnings.has(event.series))return '실적';
 if(['fomc','ecb','boj','bok'].includes(event.series))return '금리';
 if(['cpi','pce'].includes(event.series))return '물가';
 if(event.series==='jobs')return '고용';
 if(event.series==='us-election')return '선거';
 return '주요 일정';
}
export function groupedEvents(events,now=new Date()){
 const days=new Map();
 for(const event of upcomingEvents(events,now)){
  if(!days.has(event.date))days.set(event.date,{date:event.date,daysLeft:event.daysLeft,categories:[]});
  const day=days.get(event.date),name=category(event);
  let group=day.categories.find(group=>group.name===name);
  if(!group){group={name,events:[]};day.categories.push(group);}
  group.events.push(event);
 }
 return [...days.values()];
}
const sourceNames={fed:'FOMC',bls:'미국 CPI·고용',bea:'PCE',ecb:'ECB',boj:'BOJ',bok:'한국은행',samsung:'삼성전자',hynix:'SK하이닉스',nasdaq:'해외 기업 실적',elections:'미국 선거'};
export class MarketEvents {
 constructor(host){
  this.host=host;this.data=null;this.lastFetch=0;this.loading=false;
  host.innerHTML='<div class="market-event-list" data-event-list aria-label="다가오는 주요 시장 일정"></div><div class="market-event-status" data-event-status role="status">시장 일정 확인 중…</div>';
  this.list=host.querySelector('[data-event-list]');this.status=host.querySelector('[data-event-status]');
  this.visibility=()=>{if(!document.hidden){this.render();if(Date.now()-this.lastFetch>30*60*1000)void this.load();}};
  document.addEventListener('visibilitychange',this.visibility);
  this.refreshTimer=setInterval(()=>void this.load(),30*60*1000);this.scheduleMidnight();void this.load();
 }
 scheduleMidnight(){clearTimeout(this.midnightTimer);this.midnightTimer=setTimeout(()=>{this.render();this.scheduleMidnight();},nextKoreanMidnight()-Date.now()+30);}
 async load(){
  if(this.loading)return;this.loading=true;
  try{const response=await fetch('./market_events.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP');const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.events))throw Error('Schema');this.data=data;this.lastFetch=Date.now();this.failed=false;}
  catch{this.failed=true;}
  finally{this.loading=false;this.render();}
 }
 render(now=new Date()){
  this.list.replaceChildren();const events=upcomingEvents(this.data?.events,now);
  for(const day of groupedEvents(this.data?.events,now)){
   const badge=document.createElement('div');badge.className='market-event-badge'+(day.daysLeft===0?' is-today':day.daysLeft<=3?' is-soon':'');badge.dataset.date=day.date;if(day.categories.length>1||day.categories.some(group=>group.events.length>1))badge.classList.add('is-wide');
   for(const group of day.categories){
    const row=document.createElement('div');row.className='market-event-row';
    const label=document.createElement('span');label.className='market-event-category';label.textContent=`D-${day.daysLeft} ${group.name} : `;row.append(label);
    group.events.forEach((event,index)=>{
     if(index)row.append(document.createTextNode(', '));
     const link=document.createElement('a');link.className='market-event-link';link.dataset.eventId=event.id;
     link.textContent=(group.name==='실적'?event.name.replace(/ 실적$/, ''):event.name)+(event.status==='estimated'?'·예정':'')+(event.dateBasis==='US-local'?'·현지':'');
     try{const url=new URL(event.sourceUrl);if(url.protocol==='https:'){link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';}}catch{}
     link.title=[event.name,event.date+' · '+(event.dateNote||'한국 날짜'),event.status==='estimated'?'일정 제공처의 예정일 · 확정/변경 가능':event.status==='reported'?'공개 일정 · TradingView 대체 출처':'공식 일정',event.stale?'최근 조회 실패 · 마지막 확인 일정':'','클릭하면 출처 열기'].filter(Boolean).join('\n');
     row.append(link);
    });
    badge.append(row);
   }
   const when=document.createElement('span');when.className='market-event-date';const [,m,d]=day.date.split('-');when.textContent=`(${Number(m)}월${Number(d)}일)`;badge.append(when);
   this.list.append(badge);
  }
  const outdated=this.data&&Date.now()-Date.parse(this.data.updatedAt)>48*60*60*1000;
  const stale=this.data?.warnings||[];
  if(!this.data)this.status.textContent='시장 일정을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.';
  else if(this.failed||outdated||stale.length)this.status.textContent=`${events.length?'':'30일 이내 확인된 일정 없음 · '}일부 일정 갱신 지연 · 마지막 확인 일정 표시`;
  else this.status.textContent=events.length?'한국 날짜 기준(현지 표기 제외) · 예정일은 변경될 수 있어요':'30일 이내 확인된 일정 없음 · 새 일정은 매일 자동 확인';
  this.status.title=this.data?`마지막 수집: ${new Date(this.data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}${stale.length?'\n갱신 확인 필요: '+stale.map(k=>sourceNames[k]||k).join(', '):''}\n발표일 미공개 기업은 날짜 확정/제공 후 표시`:'네트워크 오류';
 }
 destroy(){clearInterval(this.refreshTimer);clearTimeout(this.midnightTimer);document.removeEventListener('visibilitychange',this.visibility);}
}
