import { attachChartHover } from './chart-hover.js?v=1';
import { earningsDelta, comparisonTrend, TREND_METRICS, earningsAmount, earningsPercent, earningsUnit, earningsPeriodLabel } from './earnings-data.js?v=8';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=v=>v>0?'positive':v<0?'negative':'';
const amount=(v,unit,signed=false)=>e(earningsAmount(v,unit,signed));
const percent=v=>e(earningsPercent(v));
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
  host.innerHTML=`<div class="earnings-heading"><h3>${periodName}별 예상·실제 실적</h3><small data-earnings-unit>${e(earningsUnit(rows[0]?.unit||unit))}</small></div>
   <div class="earnings-period-tabs" role="group" aria-label="실적 기간">${[['quarter','분기별'],['annual','연도별']].map(([id,name])=>`<button class="chip ${period===id?'active':''}" type="button" data-earnings-frequency="${id}" aria-pressed="${period===id}">${name}</button>`).join('')}</div>
   <div class="earnings-metric-tabs" role="group" aria-label="실적 지표">${metrics.map(m=>`<button class="chip ${metric===m.id?'active':''}" type="button" data-earnings-metric="${m.id}" aria-pressed="${metric===m.id}">${m.label}</button>`).join('')}</div>
   <div data-earnings-trend>
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
  host.querySelector('[data-earnings-chart]').innerHTML=values.length?`<div class="earnings-chart-scroll" tabindex="0" role="region" aria-label="${e(label)} ${periodName}별 그래프 · 좌우 스크롤"><svg class="earnings-chart" style="min-width:${width}px" viewBox="0 0 ${width} ${annual?292:316}" role="img" aria-label="${e(label)} ${periodName}별 예상·실제·차액·차이율"><line x1="25" x2="${width-25}" y1="${zero}" y2="${zero}" stroke="#537463"/>${bars}</svg></div>`:'<p class="earnings-empty">이 기간의 수치는 제공되지 않습니다.</p>';
  attachChartHover(host.querySelector('.earnings-chart'), rows.map((r,i) => {
   const d=earningsDelta(r.value,r.estimate);
   return {x:step/2+i*step,text:`${periodLabel(r)} · ${label} · ${earningsUnit(r.unit)}\n예상 ${earningsAmount(r.estimate,r.unit)}\n실제 ${r.value==null?(r.missing?'미제공':'미발표'):earningsAmount(r.value,r.unit)}${annual?'':`\nQoQ : ${growth(r,'qoq')}`}\nYoY : ${growth(r,'yoy')}\n컨센대비 ${d.amount==null?'—':earningsAmount(d.amount,r.unit,true)} (${earningsPercent(d.percent)})`};
  }), {top:20,bottom:200});
  host.querySelector('[data-earnings-table]').innerHTML=`<div class="earnings-table-wrap"><table class="earnings-table"><caption>${e(label)} · ${periodName}별 예상 / 실제 · ${e(earningsUnit(rows[0]?.unit||unit))}</caption><thead><tr><th>${periodName}</th><th>시장 예상</th><th>실제 실적</th><th>차액 (예상 대비)</th></tr></thead><tbody>${rows.map(r=>{const d=earningsDelta(r.value,r.estimate);return `<tr><th>${e(r.period)}${r.fiscalPeriod?`<small>${e(r.fiscalPeriod)}</small>`:''}${r.missing?' · 미제공':r.value==null?' · 미발표':r.preliminary||r.basis?.includes('잠정')?' · 잠정/최초 발표':''}</th><td>${amount(r.estimate,r.unit)}</td><td>${amount(r.value,r.unit)}</td><td class="${tone(d.amount)}">${d.amount==null?'—':`${amount(d.amount,r.unit,true)} (${percent(d.percent)})`}</td></tr>`;}).join('')}</tbody></table></div>
   <div class="earnings-table-wrap"><table class="earnings-table"><caption>실제 실적 증감</caption><thead><tr><th>${periodName}</th>${annual?'':'<th>QoQ (전분기 대비)</th>'}<th>YoY (${annual?'전년':'전년 동분기'} 대비)</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${e(periodLabel(r))}</th>${annual?'':`<td class="${tone(r.qoq?.amount)}">${e(growth(r,'qoq'))}</td>`}<td class="${tone(r.yoy?.amount)}">${e(growth(r,'yoy'))}</td></tr>`).join('')}</tbody></table></div>
   `;
  const scroller=host.querySelector('.earnings-chart-scroll');if(scroller)scroller.scrollLeft=Math.max(0,rows.findLastIndex(r=>r.value!=null)*step);
  for(const button of host.querySelectorAll('[data-earnings-frequency]'))button.onclick=()=>{period=button.dataset.earningsFrequency;render();};
  for(const button of host.querySelectorAll('[data-earnings-metric]'))button.onclick=()=>{metric=button.dataset.earningsMetric;render();};
  const select=host.querySelector('[data-earnings-period]');select.disabled=!records.length;
  const compare=()=>{
   const row=records[Number(select.value)],target=host.querySelector('[data-earnings-comparison]');
   if(!row){target.innerHTML='<p class="earnings-empty">확인된 비교 자료가 없습니다.</p>';return;}
   target.innerHTML=`<div class="earnings-table-wrap"><table class="earnings-table earnings-compare-table"><caption>${e(row.period)} 예상 / 발표 비교</caption><thead><tr><th>시장 예상</th><th>실제 발표</th><th>차액 (예상 대비)</th></tr></thead>${row.metrics.map(m=>{const d=earningsDelta(m.actual,m.estimate);return `<tbody><tr class="earnings-metric-title"><th colspan="3">${e(m.label)} <small>${e(earningsUnit(m.unit))}</small></th></tr><tr><td>${amount(m.estimate,m.unit)}</td><td>${amount(m.actual,m.unit)}${m.actual!=null&&m.announcedAt?`<small>발표 ${e(m.announcedAt)}</small>`:''}</td><td class="${tone(d.amount)}">${d.amount==null?'—':`${amount(d.amount,m.unit,true)} (${percent(d.percent)})`}</td></tr></tbody>`;}).join('')}</table></div>`;
  };
  const newestActual=records.findIndex(r=>r.metrics.some(m=>m.actual!=null));if(newestActual>=0)select.value=String(newestActual);select.onchange=compare;compare();
 };
 render();
}
