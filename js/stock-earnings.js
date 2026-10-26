import { earningsDelta, comparisonTrend, TREND_METRICS } from './earnings-data.js?v=2';
import { safeUrl } from './research-data.js?v=1';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v==null?'미제공':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(v);
const signed=v=>v==null?'—':(v>0?'+':'')+n(v);
export function renderEarnings(host,data){
 const comparison=data.comparison||{},records=comparison.rows||[];
 const hasEPS=records.some(r=>r.metrics.some(m=>m.label==='EPS'));
 const domestic=/억 KRW/.test(data.financialUnit||'');
 const metrics=hasEPS?[{id:'eps',label:'EPS'},...TREND_METRICS.filter(m=>m.id!=='parentNet')]:TREND_METRICS.filter(m=>domestic||m.id!=='parentNet');
 const stale=comparison.asOf&&Date.now()-Date.parse(comparison.asOf)>7*86400000;
 const comparisonPeriod=(records.find(r=>r.metrics.some(m=>m.actual!=null))?.period||'').replace(/\D/g,'').slice(0,6);
 const financialPeriod=(data.quarters?.[0]?.key||'').replace(/\D/g,'').slice(0,6);
 const lagging=comparisonPeriod&&financialPeriod&&comparisonPeriod<financialPeriod;
 host.innerHTML=`<h3>최근 4분기 실적 변화</h3><p class="data-note">시간순 · 파란색은 발표 전 시장 예상, 초록색은 실제 실적. 예상치 미제공은 빈칸으로 표시합니다. ${hasEPS?'해외 예상치 비교는 EPS만 제공됩니다.':'국내 실제 막대는 확정 실적이며, 아래 최초 발표·잠정치와 다를 수 있습니다.'}</p>
 ${stale||lagging?'<p class="stock-notice">예상치 자료의 업데이트가 지연됐습니다. 아래 출처·수집 시각을 확인하세요.</p>':''}<div class="earnings-metric-tabs" role="group" aria-label="실적 지표">${metrics.map((m,i)=>`<button class="chip ${i===0?'active':''}" type="button" data-earnings-metric="${m.id}" aria-pressed="${i===0}">${m.label}</button>`).join('')}</div><div data-earnings-trend></div>
 <div class="earnings-comparison"><h3>시장 예상치 vs 실제 발표치</h3>${stale||lagging?'<p class="stock-notice">예상치 비교 자료의 업데이트가 지연됐습니다. 아래 수집 시각과 대상 분기를 확인해 주세요.</p>':''}<p class="data-note">${e(comparison.note||'발표 전 예상치 미제공')}</p><label>비교 분기 <select aria-label="예상 실제 비교 분기" data-earnings-period>${records.map((r,i)=>`<option value="${i}">${e(r.period)}${r.metrics.some(m=>m.actual!=null)?' · 발표':' · 미발표 예상'}</option>`).join('')}</select></label><div data-earnings-comparison></div>
 <p class="data-note">${safeUrl(comparison.url)?`<a href="${e(safeUrl(comparison.url))}" target="_blank" rel="noopener noreferrer">${e(comparison.source)} 원문 ↗</a>`:'예상치 출처 연결 불가'}${comparison.asOf?' · 조회 '+e(comparison.asOf.slice(0,16).replace('T',' '))+' UTC':''}${comparison.cached?' · 정기 수집 자료':''}${comparison.partial?' · 일부 지표 조회 실패':''}<br>차이율 = (실제 − 예상) ÷ |예상|. 표시된 수치 기준이며, 예상이 0이거나 미제공이면 계산하지 않습니다.</p></div>`;
 const trend=host.querySelector('[data-earnings-trend]');
 const draw=id=>{
  const rows=comparisonTrend(data.quarters,records,id,data.financialUnit),label=metrics.find(m=>m.id===id).label,values=rows.flatMap(r=>[r.value,r.estimate]).filter(v=>v!=null);
  const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,y=v=>170-(v-min)/span*130,zero=y(0);
  const bars=rows.map((r,i)=>{
   const x=110+i*180,d=earningsDelta(r.value,r.estimate);
   const difference=d.amount==null?(r.estimate==null?'예상 미제공':'실제 미제공'):`차액 ${signed(d.amount)}`;
   const percentage=d.percent==null?(r.estimate===0&&r.value!=null?'예상 0 · 차이율 계산 불가':'차이율 —'):`예상 대비 ${signed(d.percent)}%`;
   return `<g data-quarter="${e(r.period)}"><text x="${x}" y="214" text-anchor="middle">${e(r.period)}</text>${[['estimate',r.estimate,-44,'#7fb4ff','예상'],['actual',r.value,44,'#32d69a','실제']].map(([kind,value,offset,color,title])=>{
    const center=x+offset;
    if(value==null)return `<text class="earnings-value" x="${center}" y="190" text-anchor="middle">${title} —</text>`;
    return `<rect data-series="${kind}" x="${center-17}" y="${Math.min(y(value),zero)}" width="34" height="${Math.abs(y(value)-zero)}" rx="3" fill="${color}"><title>${e(r.period)} ${e(label)} ${title} ${n(value)} · ${e(r.unit)}</title></rect>${value===0?`<line x1="${center-17}" x2="${center+17}" y1="${zero}" y2="${zero}" stroke="${color}" stroke-width="3"/>`:''}<text class="earnings-value" data-value="${kind}" x="${center}" y="${value<0?y(value)+16:y(value)-9}" text-anchor="middle">${title} ${n(value)}</text>`;
   }).join('')}<text class="earnings-difference" x="${x}" y="238" text-anchor="middle">${e(difference)}</text><text class="earnings-difference" x="${x}" y="259" text-anchor="middle">${e(percentage)}</text></g>`;
  }).join('');
  trend.innerHTML=`<p class="data-note">${e(rows[0]?.unit||data.financialUnit)} · ${e(rows[0]?.basis||'확정 실적')}${id==='eps'?'': ' · 최근 4개 확정 분기'}</p><div class="earnings-legend"><span><i class="estimate"></i>시장 예상</span><span><i class="actual"></i>실제 실적</span></div>`;
  trend.innerHTML+=values.length?`<p class="data-note earnings-scroll-hint">좌우로 밀어 다른 분기도 확인하세요.</p><div class="earnings-chart-scroll" tabindex="0" role="region" aria-label="${e(label)} 분기별 실적 그래프 · 좌우 스크롤"><svg class="earnings-chart" viewBox="0 0 760 280" role="img" aria-label="${e(label)} 최근 4분기 예상액·실제액·차액·차이율. 동일한 수치는 아래 표에서도 확인할 수 있습니다."><line x1="30" x2="730" y1="${zero}" y2="${zero}" stroke="#537463"/>${bars}</svg></div>`:'<p class="data-note">이 지표의 분기 수치가 제공되지 않습니다.</p>';
  trend.innerHTML+=`<div class="earnings-table-wrap"><table class="earnings-table"><caption>${e(label)} · 분기별 예상 / 실제</caption><thead><tr><th>분기</th><th>시장 예상</th><th>실제 실적</th><th>차액</th><th>차이율</th></tr></thead><tbody>${rows.map(r=>{const d=earningsDelta(r.value,r.estimate);return `<tr><th>${e(r.period)}</th><td>${n(r.estimate)}</td><td>${n(r.value)}</td><td>${signed(d.amount)}</td><td>${d.percent==null?'—':signed(d.percent)+'%'}</td></tr>`;}).join('')}</tbody></table></div>${id==='eps'?'':`<div class="earnings-table-wrap"><table class="earnings-table"><caption>실제 실적 · 전분기 대비</caption><thead><tr><th>분기</th><th>증감액</th><th>증감률</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${e(r.period)}</th><td>${signed(r.delta)}</td><td>${r.percent!=null?signed(r.percent)+'%':r.previous!=null&&r.previous<0&&r.value>0?'흑자전환':r.previous!=null&&r.previous>0&&r.value<0?'적자전환':'—'}</td></tr>`).join('')}</tbody></table></div>`}<p class="data-note">차액 = 실제 − 예상. 차이율 = 차액 ÷ |예상| × 100. 예상치가 없으면 차액·차이율을 계산하지 않습니다. 예상이 0이면 차이율을 계산하지 않습니다.${id==='eps'?' 같은 통화·회계 기준의 발표 완료 분기만 비교합니다.':' 전분기 비교는 확정 실적 기준이며, 0·적자 기준 증감률과 분기 누락 시 비교는 보류합니다.'}</p>`;

 };
 for(const button of host.querySelectorAll('[data-earnings-metric]'))button.onclick=()=>{for(const b of host.querySelectorAll('[data-earnings-metric]')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}draw(button.dataset.earningsMetric);};draw(metrics[0].id);
 const select=host.querySelector('[data-earnings-period]');select.disabled=!records.length;
 const compare=()=>{
  const row=records[Number(select.value)],target=host.querySelector('[data-earnings-comparison]');
  if(!row){target.innerHTML='<p class="data-note">확인된 비교 자료가 없습니다. 미제공 예상치는 실제 실적으로 대체하지 않습니다.</p>';return;}
  target.innerHTML=`<p class="data-note">${e(row.basis)}</p><div class="earnings-table-wrap"><table class="earnings-table earnings-compare-table"><caption>${e(row.period)} 예상 / 발표 비교</caption><thead><tr><th>시장 예상</th><th>실제 발표</th><th>차액</th><th>차이율</th></tr></thead>${row.metrics.map(m=>{const delta=earningsDelta(m.actual,m.estimate);return `<tbody><tr class="earnings-metric-title"><th colspan="4">${e(m.label)} <small>${e(m.unit)}</small></th></tr><tr><td>${n(m.estimate)}</td><td>${m.actual==null?'미발표/미제공':n(m.actual)}${m.actual!=null&&m.announcedAt?`<small>발표 ${e(m.announcedAt)}</small>`:''}</td><td>${signed(delta.amount)}</td><td class="${delta.percent>0?'positive':delta.percent<0?'negative':''}">${delta.percent==null?'—':signed(delta.percent)+'%'}</td></tr></tbody>`;}).join('')}</table></div>`;
 };
 const newestActual=records.findIndex(r=>r.metrics.some(m=>m.actual!=null));if(newestActual>=0)select.value=String(newestActual);select.onchange=compare;compare();
}
