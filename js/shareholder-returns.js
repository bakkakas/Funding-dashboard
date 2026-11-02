import { safeUrl } from './research-data.js?v=1';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label='공식 원문')=>safeUrl(url)?`<a href="${e(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>`:'';
export async function loadShareholderReturns(id){
 try{const r=await fetch(`./data/shareholder-returns/${encodeURIComponent(id)}.json`,{cache:'no-cache'});return r.ok?await r.json():null;}catch{return null;}
}
export function dividendStats(stats){return stats.map(r=> /배당|dividend/i.test(r.label)?{...r,label:`${r.label} · 제공처 기준`,asOf:`${r.asOf||'기준기간 미제공'} · 최신 분기배당과 별도`}:r);}
export function quarterlyYield(dividend,price,currency){
 return dividend?.currency===currency&&Number.isFinite(dividend.dps)&&dividend.dps>=0&&Number.isFinite(price)&&price>0?dividend.dps/price*100:null;
}
export function renderShareholderReturns(data,issuer,price){
 const d=data||{},rows=d.history||[],div=d.dividend,yieldValue=quarterlyYield(div,price,issuer.currency),docs=d.documents||[];
 const status=d.monitor?.status,checked=d.monitor?.checkedAt?.slice(0,10),stale=!checked||Date.now()-Date.parse(d.monitor.checkedAt)>2*86400000;
 return `<section class="card shareholder-returns" data-board-block="stock-shareholder-returns" data-board-label="배당 · 주주환원"><h3>배당 · 주주환원</h3>
 ${div?`<div class="stock-stat-details"><div><span>최신 확인 분기배당 · ${e(div.period)}</span><strong>${e(div.dps.toLocaleString('ko-KR'))} ${e(div.currency)}/주</strong><small>기준일 ${e(div.recordDate)} · 총액 ${e(div.total)}${div.note?' · '+e(div.note):''} · ${link(div.url)}</small></div><div><span>해당 분기배당 / 현재가</span><strong>${yieldValue==null?'—':yieldValue.toFixed(2)+'%'}</strong><small>연간 배당수익률 아님 · 4배 연환산하지 않음</small></div></div>`:''}
 <h4>확인된 정책 · 변경 이력</h4>
 ${rows.length?`<div class="policy-table-scroll"><table class="policy-table"><thead><tr><th>기간 · 구분</th><th>총 재원</th><th>배당</th><th>매입 · 소각</th><th>FCF · 기준</th><th>공식 링크</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r.period)}<small>${e(r.status)}</small></td><td>${e(r.total)}</td><td>${e(r.dividend)}</td><td>${e(r.buyback)}</td><td>${e(r.fcf)}</td><td>${link(r.url)}</td></tr>`).join('')}</tbody></table></div><p class="data-note">정리 기준 ${e(d.reviewedAt)} · 계획/전망은 집행액이 아닙니다. 아래 신규 원문은 이 표보다 최근일 수 있습니다.</p>`:`<p class="data-note">금액·FCF 기준을 검증한 정책 표는 아직 미등록입니다. 미등록은 무배당·환원 없음이라는 뜻이 아닙니다. ${link(d.source||issuer.ir,'공식 IR')}</p>`}
 <h4>공식 발표 · 자동 수집</h4><p class="data-note">공식 페이지의 관련 문단을 그대로 표시합니다. ${!rows.length?'자동 수집 미연결':`${checked?'최근 확인 '+e(checked):'수집 대기'}${status!=='ok'||stale?' · 일부 원문 확인 지연':''}`}. 정책 금액 표와 원문 수집은 별도입니다.</p>
 <div class="policy-documents">${docs.length?docs.slice(0,12).map((doc,i)=>`<details ${i===0?'open':''}><summary>${e(doc.publishedAt||'발표일 미제공')} · ${e(doc.title)}</summary><p>${link(doc.url)}</p>${doc.paragraphs.map(p=>`<p>${e(p)}</p>`).join('')}</details>`).join(''):`<p>${link(d.source||issuer.ir,'최신 공식 발표 확인')}</p>`}</div></section>`;
}
