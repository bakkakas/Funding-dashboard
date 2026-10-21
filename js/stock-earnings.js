import { earningsDelta, fourQuarterTrend, TREND_METRICS } from './earnings-data.js?v=1';
import { safeUrl } from './research-data.js?v=1';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v==null?'미제공':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(v);
const signed=v=>v==null?'—':(v>0?'+':'')+n(v);
export function renderEarnings(host,data){
 const comparison=data.comparison||{},records=comparison.rows||[];
 const stale=comparison.asOf&&Date.now()-Date.parse(comparison.asOf)>7*86400000;
 const comparisonPeriod=(records.find(r=>r.metrics.some(m=>m.actual!=null))?.period||'').replace(/\D/g,'').slice(0,6);
 const financialPeriod=(data.quarters?.[0]?.key||'').replace(/\D/g,'').slice(0,6);
 const lagging=comparisonPeriod&&financialPeriod&&comparisonPeriod<financialPeriod;
 host.innerHTML=`<h3>최근 4분기 실적 변화</h3><p class="data-note">최근 4개 확정 분기 · 시간순 · ${e(data.financialUnit)}. EPS는 해당 통화/주, 주식 수는 행에 표시된 단위입니다. 잠정치·예상치는 아래 비교 표에서 별도로 확인하세요.</p>
 <div class="earnings-metric-tabs" role="group" aria-label="실적 지표">${TREND_METRICS.map((m,i)=>`<button class="chip ${i===0?'active':''}" type="button" data-earnings-metric="${m.id}" aria-pressed="${i===0}">${m.label}</button>`).join('')}</div><div data-earnings-trend></div>
 <div class="earnings-comparison"><h3>시장 예상치 vs 실제 발표치</h3>${stale||lagging?'<p class="stock-notice">예상치 비교 자료의 업데이트가 지연됐습니다. 아래 수집 시각과 대상 분기를 확인해 주세요.</p>':''}<p class="data-note">${e(comparison.note||'발표 전 예상치 미제공')}</p><label>비교 분기 <select aria-label="예상 실제 비교 분기" data-earnings-period>${records.map((r,i)=>`<option value="${i}">${e(r.period)}${r.metrics.some(m=>m.actual!=null)?' · 발표':' · 미발표 예상'}</option>`).join('')}</select></label><div data-earnings-comparison></div>
 <p class="data-note">${safeUrl(comparison.url)?`<a href="${e(safeUrl(comparison.url))}" target="_blank" rel="noopener noreferrer">${e(comparison.source)} 원문 ↗</a>`:'예상치 출처 연결 불가'}${comparison.asOf?' · 조회 '+e(comparison.asOf.slice(0,16).replace('T',' '))+' UTC':''}${comparison.cached?' · 정기 수집 자료':''}${comparison.partial?' · 일부 지표 조회 실패':''}<br>차이율 = (실제 − 예상) ÷ |예상|. 표시된 수치 기준이며, 예상이 0이거나 미제공이면 계산하지 않습니다.</p></div>`;
 const trend=host.querySelector('[data-earnings-trend]');
 const draw=id=>{
  const rows=fourQuarterTrend(data.quarters,id),label=TREND_METRICS.find(m=>m.id===id).label,values=rows.map(r=>r.value).filter(v=>v!=null);
  const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,y=v=>150-(v-min)/span*120,zero=y(0);
  const bars=rows.map((r,i)=>{const x=88+i*130;return `<text x="${x}" y="185" text-anchor="middle">${e(r.period)}</text>${r.value==null?`<text x="${x}" y="85" text-anchor="middle">미제공</text>`:`<rect x="${x-30}" y="${Math.min(y(r.value),zero)}" width="60" height="${Math.max(1,Math.abs(y(r.value)-zero))}" rx="3" fill="${r.value<0?'#ff8a8a':'#32d69a'}"><title>${e(r.period)} ${e(label)} ${n(r.value)}</title></rect><text x="${x}" y="${r.value<0?y(r.value)+16:y(r.value)-9}" text-anchor="middle">${n(r.value)}</text>`}`;}).join('');
  trend.innerHTML=values.length?`<svg class="earnings-chart" viewBox="0 0 560 205" role="img" aria-label="${e(label)} 최근 4개 확정 분기. 정확한 수치는 아래 표"><line x1="30" x2="535" y1="${zero}" y2="${zero}" stroke="#537463"/>${bars}</svg>`:'<p class="data-note">이 지표의 확정 분기 수치가 제공되지 않습니다.</p>';
  trend.innerHTML+=`<div class="earnings-table-wrap"><table class="earnings-table"><caption>${e(label)} · 전분기 대비</caption><thead><tr><th>분기</th><th>실제 실적</th><th>증감액</th><th>증감률</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${e(r.period)}</th><td>${n(r.value)}</td><td>${signed(r.delta)}</td><td>${r.percent!=null?signed(r.percent)+'%':r.previous!=null&&r.previous<0&&r.value>0?'흑자전환':r.previous!=null&&r.previous>0&&r.value<0?'적자전환':'—'}</td></tr>`).join('')}</tbody></table></div><p class="data-note">0·적자 기준에서는 증감률을 표시하지 않습니다. 직전 분기가 없으면 비교를 보류합니다.</p>`;
 };
 for(const button of host.querySelectorAll('[data-earnings-metric]'))button.onclick=()=>{for(const b of host.querySelectorAll('[data-earnings-metric]')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}draw(button.dataset.earningsMetric);};draw('revenue');
 const select=host.querySelector('[data-earnings-period]');select.disabled=!records.length;
 const compare=()=>{
  const row=records[Number(select.value)],target=host.querySelector('[data-earnings-comparison]');
  if(!row){target.innerHTML='<p class="data-note">확인된 비교 자료가 없습니다. 미제공 예상치는 실제 실적으로 대체하지 않습니다.</p>';return;}
  target.innerHTML=`<p class="data-note">${e(row.basis)}</p><div class="earnings-table-wrap"><table class="earnings-table earnings-compare-table"><caption>${e(row.period)} 예상 / 발표 비교</caption><thead><tr><th>시장 예상</th><th>실제 발표</th><th>차이율</th></tr></thead>${row.metrics.map(m=>{const delta=earningsDelta(m.actual,m.estimate);return `<tbody><tr class="earnings-metric-title"><th colspan="3">${e(m.label)} <small>${e(m.unit)}</small></th></tr><tr><td>${n(m.estimate)}</td><td>${m.actual==null?'미발표/미제공':n(m.actual)}${m.actual!=null&&m.announcedAt?`<small>발표 ${e(m.announcedAt)}</small>`:''}</td><td class="${delta.percent>0?'positive':delta.percent<0?'negative':''}">${delta.percent==null?'—':signed(delta.percent)+'%'}</td></tr></tbody>`;}).join('')}</table></div>`;
 };
 const newestActual=records.findIndex(r=>r.metrics.some(m=>m.actual!=null));if(newestActual>=0)select.value=String(newestActual);select.onchange=compare;compare();
}
