import {GOLD_LABELS,validateGold,goldWindow,goldCorrelations,correlationMeaning,isGoldRate} from './gold-research-data.js?v=5';
import {FX_URL,parseFx} from './fx-rate.js?v=2';
const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=v=>Number.isFinite(v)?`${v>0?'+':''}${fmt(v)}%`:'—';
const COLORS={gold:'#e9b949',sp500:'#56c8a0',NASDAQCOM:'#9f98ff',rate:'#ed8a97',FEDTARGET:'#58c6e8',fed:'#58c6e8'};
export class GoldResearch{
 constructor(host){this.host=host;this.version=0;this.visible={fed:true,rate:true,sp500:true,NASDAQCOM:true};this.period='all';this.rate='DGS10';this.corrPeriod='all';this.corrRate='DGS10';this.corrFrom='';this.corrTo='';}
 cancel(){this.version++;this.chart?.destroy();this.chart=null;this.host.hidden=true;}
 async show(){
  const version=++this.version;this.host.hidden=false;this.host.textContent='금 장기 분석 불러오는 중…';
  try{if(!this.data){const r=await fetch('./data/gold-research.json',{cache:'no-cache'});if(!r.ok)throw Error('조회 실패');this.data=validateGold(await r.json());}if(version!==this.version)return;this.mount();this.loadFx(version);}
  catch{if(version!==this.version)return;this.host.textContent='금 분석 자료를 불러오지 못했어. ';const retry=document.createElement('button');retry.textContent='다시 시도';retry.onclick=()=>this.show();this.host.append(retry);}
 }
 mount(){
  this.chart?.destroy();
  this.host.innerHTML=`<section class="gold-hero"><span class="gold-eyebrow">GOLD · MACRO RESEARCH</span><h1>금 장기 분석</h1><p>금과 금리·주식시장의 흐름을 같은 기간으로 비교합니다.</p><div class="gold-stats" id="goldStats"></div><p class="gold-note" id="goldFxNote">원화 환산 조회 중…</p></section>
  <section class="gold-box"><h2>장기 비교 차트</h2><p class="gold-note">금·주가지수: 시작월 = 100 · 금리: 오른쪽 축 (%) · 모든 구간 월평균, 주가지수 배당 제외</p>
  <div class="gold-controls"><div class="gold-periods">${[['1','1Y'],['3','3Y'],['5','5Y'],['10','10Y'],['20','20Y'],['all','전체'],['custom','직접 선택']].map(([v,l])=>`<button type="button" data-gold-period="${v}" aria-pressed="${v===this.period}">${l}</button>`).join('')}</div><label>국채·실효금리 <select id="goldRate"><option value="DGS10">10년 국채금리</option><option value="DFF">연방기금 실효금리</option><option value="DFII10">10년 실질금리</option></select></label></div>
  <div id="goldCustom" class="gold-controls" hidden><label>시작월 <input type="month" id="goldFrom"></label><label>종료월 <input type="month" id="goldTo"></label></div>
  <div class="gold-legend"><span style="color:${COLORS.gold}">● 금 (기본)</span>${[['sp500','S&P 500'],['NASDAQCOM','나스닥 종합'],['rate','국채·실효금리'],['fed','연준 기준금리']].map(([k,l])=>`<button type="button" data-gold-toggle="${k}" aria-pressed="${this.visible[k]}" style="--line-color:${COLORS[k]}">● ${l}</button>`).join('')}</div><p id="goldFedNote" class="gold-note"></p><p class="gold-note">비교군 이름을 누르면 숨김 · 다시 누르면 표시</p><p id="goldRange" class="gold-note" aria-live="polite"></p><div class="gold-canvas"><canvas id="goldChart" role="img" aria-label="금과 연준 기준금리, 10년 국채금리 등, S&P 500, 나스닥 종합의 장기 비교"></canvas></div></section>
  <section class="gold-box"><h2>선택 기간 성과</h2><div class="gold-table-wrap"><table><thead><tr><th>지표</th><th>시작 → 종료</th><th>변화</th><th>최대낙폭</th></tr></thead><tbody id="goldPerformance"></tbody></table></div><p class="gold-note">월평균 가격의 변동률·최대낙폭이며 실제 투자 수익률이 아닙니다. 일중·일별 고점과 저점은 반영하지 않아 일별 최대낙폭보다 작을 수 있습니다. 두 금리 모두 수익률 대신 %p 변화입니다.</p></section>
  <section class="gold-box"><h2>금과의 상관관계</h2><p class="gold-note">위 차트와 별도로 기간·금리를 선택합니다. 비교선을 숨겨도 네 비교군은 모두 계산합니다.</p>
  <div class="gold-controls"><div class="gold-periods" aria-label="상관관계 기간">${[['1','1Y'],['3','3Y'],['5','5Y'],['10','10Y'],['20','20Y'],['all','전체'],['custom','직접 선택']].map(([v,l])=>`<button type="button" data-gold-corr-period="${v}" aria-pressed="${v===this.corrPeriod}">${l}</button>`).join('')}</div><label>상관관계 국채·실효금리 <select id="goldCorrRate"><option value="DGS10">10년 국채금리</option><option value="DFF">연방기금 실효금리</option><option value="DFII10">10년 실질금리</option></select></label></div>
  <div id="goldCorrCustom" class="gold-controls" hidden><label>시작월 <input type="month" id="goldCorrFrom"></label><label>종료월 <input type="month" id="goldCorrTo"></label></div>
  <p id="goldCorrRange" class="gold-note" aria-live="polite"></p>
  <div class="gold-corr-guide"><strong>절댓값 = 관계의 강도 · 부호 = 움직이는 방향</strong><p>+0.8: 강한 같은 방향 · −0.8: 강한 반대 방향 · 0에 가까울수록 약한 선형 관계</p><p>절댓값 0.2 미만: 매우 약함 · 0.2~0.4 미만: 약함 · 0.4~0.7 미만: 보통 · 0.7 이상: 강함</p><small>이 구분은 읽기 위한 참고 기준이며 통계적 유의성 판정이 아닙니다. 0이라고 모든 관계가 없다는 뜻도 아닙니다.</small></div><div class="gold-table-wrap"><table class="gold-correlation-table"><thead><tr><th>비교군</th><th>상관계수</th><th>해석</th><th>관측쌍</th></tr></thead><tbody id="goldCorrelation"></tbody></table></div><p class="gold-note">월별 수익률·금리 변화 기준 · 선택 기간의 연속 관측값 기준 Pearson 상관계수(-1~+1). 금·주가지수는 기간별 수익률, 금리는 %p 변화와 비교합니다. +1은 같은 방향, -1은 반대 방향, 0은 선형 관계가 약함을 뜻하며 인과관계나 미래 움직임을 보장하지 않습니다. 누락 구간은 건너뛰어 연결하지 않습니다. 관측쌍은 두 지표를 함께 비교할 수 있는 월간 변화의 수입니다. 표본이 적으면 계수가 크게 달라질 수 있습니다.</p></section><section class="gold-box"><h2>자료와 비교 기준</h2><p class="gold-note">금: World Bank 월평균 USD/트로이온스 (1960년 이후) · S&P 500: Shiller/DataHub 월평균 가격지수 · 나스닥: Nasdaq Composite, Nasdaq-100과 다름 · 금리: FRED 일별 관측값의 월평균. 연준 기준금리는 FRED 목표금리 이력과 목표 범위 중간값을 연결합니다. 연방기금 실효금리는 정책 목표범위 자체가 아닙니다. 목표금리 원자료: <a href="https://fred.stlouisfed.org/series/DFEDTAR" target="_blank" rel="noopener noreferrer">과거 단일 목표</a> · <a href="https://fred.stlouisfed.org/series/DFEDTARL" target="_blank" rel="noopener noreferrer">하단</a> · <a href="https://fred.stlouisfed.org/series/DFEDTARU" target="_blank" rel="noopener noreferrer">상단</a>.</p><p class="gold-note">선택한 비교군의 공통 시작·종료월로 맞춥니다. 실질금리는 2003년부터 제공됩니다. 현재 진행 중인 달은 제외하고, 자료가 빠진 달을 0이나 추정값으로 채우지 않습니다. 일별 금 이력은 미제공이므로 1Y도 월별로 표시합니다.</p><div id="goldSources" class="gold-note"></div></section>`;
  this.el('goldRate').value=this.rate;this.el('goldCustom').hidden=this.period!=='custom';
  this.host.querySelectorAll('[data-gold-period]').forEach(b=>b.onclick=()=>{this.period=b.dataset.goldPeriod;this.el('goldCustom').hidden=this.period!=='custom';this.host.querySelectorAll('[data-gold-period]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));this.draw();});
  this.host.querySelectorAll('[data-gold-toggle]').forEach(b=>b.onclick=()=>{const key=b.dataset.goldToggle;this.visible[key]=!this.visible[key];b.setAttribute('aria-pressed',String(this.visible[key]));this.draw();});
  this.el('goldRate').onchange=e=>{this.rate=e.target.value;this.draw();};
  for(const id of ['goldFrom','goldTo'])this.el(id).onchange=()=>this.draw();
  this.el('goldCorrRate').value=this.corrRate;
  this.el('goldCorrFrom').value=this.corrFrom;this.el('goldCorrTo').value=this.corrTo;
  this.el('goldCorrCustom').hidden=this.corrPeriod!=='custom';
  this.host.querySelectorAll('[data-gold-corr-period]').forEach(b=>b.onclick=()=>{this.corrPeriod=b.dataset.goldCorrPeriod;this.el('goldCorrCustom').hidden=this.corrPeriod!=='custom';this.host.querySelectorAll('[data-gold-corr-period]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));this.drawCorrelation();});
  this.el('goldCorrRate').onchange=e=>{this.corrRate=e.target.value;this.drawCorrelation();};
  for(const [id,key] of [['goldCorrFrom','corrFrom'],['goldCorrTo','corrTo']])this.el(id).onchange=e=>{this[key]=e.target.value;this.drawCorrelation();};
  const target=this.data.series.FEDTARGET.latestRange;
  this.el('goldFedNote').textContent=`연준 기준금리: 목표 범위 ${fmt(target.lower)}~${fmt(target.upper)}% (${target.date} 기준). 차트·상관관계는 목표 중간값의 월평균이며 위 최근 범위와 시점이 다를 수 있습니다. 2008-12-16 이전은 단일 목표금리, 1982~1993년은 연구 기반 복원치입니다. 목표금리 월별 자료는 1982년 10월부터 제공됩니다.`;
  this.summary();this.draw();this.drawCorrelation();
  const sources=this.el('goldSources');
  for(const [key,s] of Object.entries(this.data.series)){const p=document.createElement('p'),a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=GOLD_LABELS[key]+' · '+s.source;p.append(a,document.createTextNode(` · ${s.values[0][0]} ~ ${s.values.at(-1)[0]}`));sources.append(p);}
  const p=document.createElement('p');p.textContent=`자료 수집: ${this.data.updatedAt.slice(0,10)} · 월별 발표 지연 가능`;sources.append(p);
 }
 el(id){return this.host.querySelector('#'+id);}
 summary(){const values=this.data.series.gold.values,[month,value]=values.at(-1),prev=values.at(-2)?.[1],base=values.find(r=>r[0]===`${Number(month.slice(0,4))-1}-12`)?.[1],peak=Math.max(...values.map(r=>r[1]));
  this.el('goldStats').innerHTML=[['국제 금 월평균',`$${fmt(value)}`,`${month} · USD/트로이온스`],['원화 환산 / g','<span id="goldKrw">—</span>','월평균 금값 × 최근 참고환율'],['전월 대비',pct((value/prev-1)*100),'당일 등락: 일별 자료 미제공'],['전년 말 대비',pct((value/base-1)*100),'전년 12월 월평균 대비'],['월평균 최고값 대비',pct((value/peak-1)*100),'1960년 이후 월평균 기준']].map(([l,v,n])=>`<div><small>${l}</small><strong>${v}</strong><small>${n}</small></div>`).join('');
 }
 async loadFx(version){try{const r=await fetch(FX_URL,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const quote=parseFx(await r.json());if(version!==this.version)return;this.el('goldKrw').textContent='₩'+fmt(this.data.series.gold.values.at(-1)[1]*quote.rate/31.1034768,0);this.el('goldFxNote').textContent=`환산 참고값: 1 USD = ${fmt(quote.rate)}원 (${new Date(quote.at).toISOString().slice(0,10)}, ExchangeRate-API). 과거 월평균 금값에 이 환율을 적용하며 현재 금 시세·국내 실물 판매가격이 아닙니다.`;}catch{if(version===this.version)this.el('goldFxNote').textContent='유효한 최근 환율을 조회하지 못해 원화 환산은 표시하지 않습니다.';}}
 drawCorrelation(){
  const w=goldWindow(this.data,{rate:this.corrRate,visible:{fed:true,rate:true,sp500:true,NASDAQCOM:true},period:this.corrPeriod,from:this.corrFrom,to:this.corrTo});
  this.el('goldCorrelation').replaceChildren();
  this.el('goldCorrRange').textContent=w.months.length?`${w.start} ~ ${w.end} · 월별 기준 · 네 비교군 공통 구간` : w.reason;
  if(!w.months.length)return;
  for(const [key,c] of Object.entries(goldCorrelations(w,this.corrRate))){
   const tr=document.createElement('tr');
   const coefficient=c.value===null?'—':`${c.value>0?'+':''}${fmt(c.value,3)}`;
   for(const text of [GOLD_LABELS[key],coefficient,c.value===null?c.reason:correlationMeaning(c.value),`${c.n}쌍${c.n<30?' · 적은 표본':''}`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
   this.el('goldCorrelation').append(tr);
  }
 }
 draw(){
  this.host.querySelector('[data-gold-toggle=rate]').textContent='● '+GOLD_LABELS[this.rate];
  const w=goldWindow(this.data,{rate:this.rate,visible:this.visible,period:this.period,from:this.el('goldFrom').value,to:this.el('goldTo').value});this.window=w;
  this.chart?.destroy();this.chart=null;this.el('goldPerformance').replaceChildren();
  this.el('goldRange').textContent=w.months.length?`${w.start} ~ ${w.end} · 월별 ${w.months.length}개월 · 선택한 비교군 공통 구간` : w.reason;
  if(!w.months.length)return;
  for(const k of w.keys){const row=w.rows[k],isRate=isGoldRate(k),tr=document.createElement('tr');for(const value of [GOLD_LABELS[k],`${fmt(row.raw[0])} → ${fmt(row.raw.at(-1))}${isRate?' %':k==='gold'?' USD/oz':' pt'}`,isRate?`${row.rateChange>0?'+':''}${fmt(row.rateChange)}%p`:pct(row.change),isRate?'—':pct(row.mdd)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}this.el('goldPerformance').append(tr);}
  const datasets=w.keys.map(k=>({label:GOLD_LABELS[k],key:k,data:isGoldRate(k)?w.rows[k].raw:w.rows[k].indexed,yAxisID:isGoldRate(k)?'rate':'price',borderColor:COLORS[k==='FEDTARGET'?k:isGoldRate(k)?'rate':k],borderWidth:k==='gold'?2.5:1.6,pointRadius:0,pointHitRadius:14,spanGaps:false,tension:0}));
  this.chart=new Chart(this.el('goldChart'),{type:'line',data:{labels:w.months,datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const k=ctx.dataset.key;return `${GOLD_LABELS[k]}: ${fmt(w.rows[k].raw[ctx.dataIndex])}${isGoldRate(k)?'%':k==='gold'?' USD/oz':' pt'}${isGoldRate(k)?'':` · 기준100: ${fmt(ctx.parsed.y)}`}`;}}}},scales:{x:{ticks:{color:'#a9b4c8',maxTicksLimit:8,maxRotation:0},grid:{color:'#ffffff0c'}},price:{position:'left',title:{display:true,text:'시작월 = 100',color:'#a9b4c8'},ticks:{color:'#a9b4c8'},grid:{color:'#ffffff10'}},rate:{display:this.visible.rate||this.visible.fed,position:'right',title:{display:true,text:'금리 (%)',color:COLORS.rate},ticks:{color:COLORS.rate},grid:{drawOnChartArea:false}}}}});
 }
}
