import { attachChartHover } from './chart-hover.js?v=1';
import { earningsDelta, comparisonTrend, TREND_METRICS, earningsAmount, earningsPercent, earningsUnit, earningsPeriodLabel } from './earnings-data.js?v=8';
import { safeUrl } from './research-data.js?v=1';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=v=>v>0?'positive':v<0?'negative':'';
const amount=(v,unit,signed=false)=>e(earningsAmount(v,unit,signed));
const percent=v=>e(earningsPercent(v));
const source=r=>`${safeUrl(r.url)?`<a href="${e(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${e(r.source)} 원문 ↗</a>`:e(r.source||'확정 재무제표')} · 자료 확인 ${e(r.asOf?.slice(0,16).replace('T',' ')||'시각 미제공')}${r.asOf?' UTC':''}${['verified-snapshot','scheduled-cache'].includes(r.refreshMode)?' · 저장 자료 (실시간 아님)':''}${r.asOf&&Date.now()-Date.parse(r.asOf)>7*86400000?' · 업데이트 지연':''}${r.estimateSource&&r.estimateSource!==r.source?` · 예상: ${e(r.estimateSource)} (자료 확인 ${e(r.estimateAsOf?.slice(0,10)||'미제공')})`:''}`;
export function renderEarnings(host,data){
 let period='quarter',metric='revenue';
 const domestic=/억 KRW/.test(data.financialUnit||'');
 const render=()=>{
  const annual=period==='annual',periodName=annual?'연도':'분기';
  const records=(annual?data.annualRecords:data.earningsRecords||data.comparison?.rows)||[];
  const quarters=annual?data.annualQuarters:data.quarters,unit=annual?data.annualUnit:data.financialUnit;
  const hasEPS=records.some(r=>r.metrics.some(m=>m.label==='EPS')),hasEBIT=records.some(r=>r.metrics.some(m=>m.label==='EBIT'));
  const metrics=[...TREND_METRICS.filter(m=>(domestic||m.id!=='parentNet')&&(hasEBIT||m.id!=='ebit')),...(hasEPS?[{id:'eps',label:'EPS'}]:[])];
  if(!metrics.some(m=>m.id===metric))metric='revenue';
  const rows=comparisonTrend(quarters,records,metric,unit,annual),label=metrics.find(m=>m.id===metric).label;
  const periodLabel=r=>earningsPeriodLabel(r,annual,data.fiscalYearEnd||12);
  const growth=(r,key)=>{const d=r[key];return d?.amount==null?'—':`${earningsAmount(d.amount,r.unit,true)} (${earningsPercent(d.percent)})`;};
  const sources=[...new Map(rows.filter(r=>r.source).map(r=>[r.source+'|'+r.asOf+'|'+(r.estimateSource||'')+'|'+(r.estimateAsOf||''),r])).values()];
  const missing=!rows.some(r=>r.estimate!=null);
  const missingNote=missing?(metric==='operating'&&!domestic?'영업이익 예상치는 현재 연결된 자료에 없습니다. EBIT는 별도 지표입니다.':metric==='net'&&domestic?'전체 순이익 예상치는 미제공입니다. 지배주주 순이익 탭에서 해당 기준의 예상치를 확인하세요.':'이 지표의 예상치는 현재 연결된 자료에 없습니다.') : '';
  host.innerHTML=`<h3>${periodName}별 예상·실제 실적</h3>
   <div class="earnings-period-tabs" role="group" aria-label="실적 기간">${[['quarter','분기별'],['annual','연도별']].map(([id,name])=>`<button class="chip ${period===id?'active':''}" type="button" data-earnings-frequency="${id}" aria-pressed="${period===id}">${name}</button>`).join('')}</div>
   <p class="data-note">파란색은 예상, 초록색은 실제 실적. 최근 발표 ${periodName}와 제공되는 다음 ${periodName} 예상치를 표시합니다. ${annual?`연속 5개년 · 자료가 없는 연도는 미제공. 연간 자료 기준 · ${data.fiscalYearEnd||12}월 결산 회계연도 (분기 일부의 합산 아님).`:''} ${domestic?'확정 실적 우선, 더 최근의 잠정치는 구분합니다.':'같은 제공처의 예상·발표 수치를 비교하며 확정 재무제표·조정 EPS와 다를 수 있습니다.'}</p>
   <div class="earnings-metric-tabs" role="group" aria-label="실적 지표">${metrics.map(m=>`<button class="chip ${metric===m.id?'active':''}" type="button" data-earnings-metric="${m.id}" aria-pressed="${metric===m.id}">${m.label}</button>`).join('')}</div>
   <div data-earnings-trend><p class="data-note">${e(earningsUnit(rows[0]?.unit||unit))} · ${e(rows[0]?.basis||'확정 실적')}${metric==='ebit'?' · EBIT는 영업이익과 다를 수 있습니다.':''}</p>
   ${!annual&&data.earningsNote?`<p class="data-note">${e(data.earningsNote)}</p>`:''}${sources.map(r=>`<p class="data-note">${source(r)}</p>`).join('')}${annual&&!sources.length?`<p class="data-note">연간 자료 확인 ${e(data.annualAsOf?.slice(0,10)||'미제공')}</p>`:''}
   ${missingNote?`<p class="stock-notice">${e(missingNote)}</p>`:''}
   <div class="earnings-legend"><span><i class="estimate"></i>시장 예상</span><span><i class="actual"></i>실제 실적</span></div><div data-earnings-chart></div><div data-earnings-table></div></div>
   <div class="earnings-comparison"><h3>시장 예상치 vs 실제 발표치</h3><label>비교 ${periodName} <select aria-label="예상 실제 비교 기간" data-earnings-period>${records.map((r,i)=>`<option value="${i}">${e(r.period)} · ${e(r.metrics.map(m=>m.label).join('/'))}${r.metrics.some(m=>m.actual!=null)?' · 발표':' · 미발표 예상'}</option>`).join('')}</select></label><div data-earnings-comparison></div></div>`;
  const values=rows.flatMap(r=>[r.value,r.estimate]).filter(v=>v!=null);
  const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,y=v=>180-(v-min)/span*130,zero=y(0);
  const step=annual?180:220,width=Math.max(660,rows.length*step),barWidth=70*2/3;
  const bars=rows.map((r,i)=>{
   const x=step/2+i*step,d=earningsDelta(r.value,r.estimate);
   const difference=d.amount==null?(r.missing?'자료 미제공':r.value==null?'미발표 · 차액 미산출':'예상 미제공'):`컨센대비 ${earningsAmount(d.amount,r.unit,true)}`;
   return `<g data-quarter="${e(r.period)}"><text x="${x}" y="218" text-anchor="middle">${e(periodLabel(r))}${r.preliminary?' 잠정':''}${r.missing?' 미제공':r.value==null?' 예상':''}</text>
    ${[['estimate',r.estimate,-barWidth,'#7fb4ff','예상'],['actual',r.value,0,'#32d69a','실제']].map(([kind,value,offset,color,title])=>{
     const left=x+offset,anchor=kind==='estimate'?'end':'start',textX=x+(kind==='estimate'?-4:4);
     if(value==null)return `<text class="earnings-value" x="${textX}" y="198" text-anchor="${anchor}">${title} —</text>`;
     return `<rect data-series="${kind}" x="${left}" y="${Math.min(y(value),zero)}" width="${barWidth}" height="${Math.abs(y(value)-zero)}" fill="${color}"><title>${e(r.period)} ${e(label)} ${title} ${amount(value,r.unit)} · ${e(earningsUnit(r.unit))}</title></rect>${value===0?`<line x1="${left}" x2="${left+barWidth}" y1="${zero}" y2="${zero}" stroke="${color}" stroke-width="3"/>`:''}<text class="earnings-value" data-value="${kind}" x="${textX}" y="${value<0?y(value)+16:y(value)-10}" text-anchor="${anchor}">${title} ${amount(value,r.unit)}</text>`;
    }).join('')}
    ${[...(annual?[]:[['qoq','QoQ']]),['yoy','YoY']].map(([key,name],j)=>`<text class="earnings-difference" x="${x}" y="${244+j*24}" text-anchor="middle">${name} : <tspan class="${tone(r[key]?.amount)}">${e(growth(r,key))}</tspan></text>`).join('')}
    <text class="earnings-difference ${tone(d.amount)}" x="${x}" y="${annual?268:292}" text-anchor="middle">${e(difference)}${d.amount!=null?` (${d.percent==null?'차이율 —':percent(d.percent)})`:''}</text></g>`;
  }).join('');
  host.querySelector('[data-earnings-chart]').innerHTML=values.length?`<p class="data-note earnings-scroll-hint">최근 발표 ${periodName}부터 표시합니다. 좌우로 밀어 다른 ${periodName}도 확인하세요.</p><div class="earnings-chart-scroll" tabindex="0" role="region" aria-label="${e(label)} ${periodName}별 그래프 · 좌우 스크롤"><svg class="earnings-chart" style="min-width:${width}px" viewBox="0 0 ${width} ${annual?292:316}" role="img" aria-label="${e(label)} ${periodName}별 예상·실제·차액·차이율"><line x1="25" x2="${width-25}" y1="${zero}" y2="${zero}" stroke="#537463"/>${bars}</svg></div>`:'<p class="data-note">이 기간의 수치는 제공되지 않습니다.</p>';
  attachChartHover(host.querySelector('.earnings-chart'), rows.map((r,i) => {
   const d=earningsDelta(r.value,r.estimate);
   return {x:step/2+i*step,text:`${periodLabel(r)} · ${label} · ${earningsUnit(r.unit)}\n예상 ${earningsAmount(r.estimate,r.unit)}\n실제 ${r.value==null?(r.missing?'미제공':'미발표'):earningsAmount(r.value,r.unit)}${annual?'':`\nQoQ : ${growth(r,'qoq')}`}\nYoY : ${growth(r,'yoy')}\n컨센대비 ${d.amount==null?'—':earningsAmount(d.amount,r.unit,true)} (${earningsPercent(d.percent)})`};
  }), {top:20,bottom:200});
  host.querySelector('[data-earnings-table]').innerHTML=`<div class="earnings-table-wrap"><table class="earnings-table"><caption>${e(label)} · ${periodName}별 예상 / 실제 · ${e(earningsUnit(rows[0]?.unit||unit))}</caption><thead><tr><th>${periodName}</th><th>시장 예상</th><th>실제 실적</th><th>차액 (예상 대비)</th></tr></thead><tbody>${rows.map(r=>{const d=earningsDelta(r.value,r.estimate);return `<tr><th>${e(r.period)}${r.fiscalPeriod?`<small>${e(r.fiscalPeriod)}</small>`:''}${r.missing?' · 미제공':r.value==null?' · 미발표':r.preliminary||r.basis?.includes('잠정')?' · 잠정/최초 발표':''}</th><td>${amount(r.estimate,r.unit)}</td><td>${amount(r.value,r.unit)}</td><td class="${tone(d.amount)}">${d.amount==null?'—':`${amount(d.amount,r.unit,true)} (${percent(d.percent)})`}</td></tr>`;}).join('')}</tbody></table></div>
   <div class="earnings-table-wrap"><table class="earnings-table"><caption>실제 실적 증감</caption><thead><tr><th>${periodName}</th>${annual?'':'<th>QoQ (전분기 대비)</th>'}<th>YoY (${annual?'전년':'전년 동분기'} 대비)</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${e(periodLabel(r))}</th>${annual?'':`<td class="${tone(r.qoq?.amount)}">${e(growth(r,'qoq'))}</td>`}<td class="${tone(r.yoy?.amount)}">${e(growth(r,'yoy'))}</td></tr>`).join('')}</tbody></table></div>
   <p class="data-note">QoQ·YoY는 실제 실적의 증감액과 증감률입니다. 증감률 = (이번 실제 − 비교기간 실제) ÷ |비교기간 실제| × 100. 비교기간 자료가 없으면 —, 비교값이 0이면 증감률은 —입니다. 음수 실적도 개선되면 +로 표시합니다.</p>
   <p class="data-note">차액 = 실제 − 예상. 차이율 = 차액 ÷ |예상| × 100. 예상보다 높으면 +·초록색, 낮으면 −·빨간색. 미제공은 차액을 계산하지 않고, 예상이 0이면 차이율을 계산하지 않습니다. USD 금액은 백만 달러 단위로 소수점 두 자리까지 표시합니다. 그 외 금액은 억 단위 소수점을 절삭하고, 1조 이상은 조 단위 소수점 두 자리로 반올림합니다. EPS는 주당 단위를 유지합니다. 차이율은 표시 단위 환산·반올림 전 원자료로 계산합니다.</p>`;
  const scroller=host.querySelector('.earnings-chart-scroll');if(scroller)scroller.scrollLeft=Math.max(0,rows.findLastIndex(r=>r.value!=null)*step);
  for(const button of host.querySelectorAll('[data-earnings-frequency]'))button.onclick=()=>{period=button.dataset.earningsFrequency;render();};
  for(const button of host.querySelectorAll('[data-earnings-metric]'))button.onclick=()=>{metric=button.dataset.earningsMetric;render();};
  const select=host.querySelector('[data-earnings-period]');select.disabled=!records.length;
  const compare=()=>{
   const row=records[Number(select.value)],target=host.querySelector('[data-earnings-comparison]');
   if(!row){target.innerHTML='<p class="data-note">확인된 비교 자료가 없습니다.</p>';return;}
   target.innerHTML=`<p class="data-note">${e(row.basis)}</p><div class="earnings-table-wrap"><table class="earnings-table earnings-compare-table"><caption>${e(row.period)} 예상 / 발표 비교</caption><thead><tr><th>시장 예상</th><th>실제 발표</th><th>차액 (예상 대비)</th></tr></thead>${row.metrics.map(m=>{const d=earningsDelta(m.actual,m.estimate);return `<tbody><tr class="earnings-metric-title"><th colspan="3">${e(m.label)} <small>${e(earningsUnit(m.unit))}</small><small>${source(m)}</small></th></tr><tr><td>${amount(m.estimate,m.unit)}</td><td>${amount(m.actual,m.unit)}${m.actual!=null&&m.announcedAt?`<small>발표 ${e(m.announcedAt)}</small>`:''}</td><td class="${tone(d.amount)}">${d.amount==null?'—':`${amount(d.amount,m.unit,true)} (${percent(d.percent)})`}</td></tr></tbody>`;}).join('')}</table></div>`;
  };
  const newestActual=records.findIndex(r=>r.metrics.some(m=>m.actual!=null));if(newestActual>=0)select.value=String(newestActual);select.onchange=compare;compare();
 };
 render();
}
