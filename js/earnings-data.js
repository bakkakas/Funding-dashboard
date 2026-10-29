import { numeric } from './stock-data.js';

// Keep actual/consensus on the same source, accounting basis, currency and period.
export function earningsDelta(actual, estimate) {
  if (actual == null || estimate == null) return { amount: null, percent: null };
  return { amount: actual - estimate, percent: estimate === 0 ? null : (actual - estimate) / Math.abs(estimate) * 100 };
}
export function wiseEarnings(payloads, annual = false) {
  const periods = new Map();
  for (const { label, data } of payloads) {
    const table = data?.tableData;
    const rows = table?.tableData || [], headers = table?.tableHeaderData?.[0] || {};
    const actual = rows.find(r => r.QTR === (annual?'연간실적(A)':'분기실적(A)'));
    const estimate = rows.find(r => r.QTR === '발표직전(E)');
    for (const field of ['FY_2', 'FY_1', 'FY0', 'FY1']) {
      const raw = headers['CNS_' + field];
      if (!(annual?/^\d{4}$/:/^\d{4}\/\d{2}$/).test(raw || '')) continue;
      const period = raw.replace('/', '-');
      if (!periods.has(period)) periods.set(period, { period, basis: 'IFRS 연결 · 최초 발표치(잠정 포함)', metrics: [] });
      const value = numeric(actual?.[field]), expected = numeric(estimate?.[field]);
      if (value == null && expected == null) continue;
      periods.get(period).metrics.push({ label, actual: value, estimate: expected, unit: '억 KRW', announcedAt: /^\d{4}\/\d{2}\/\d{2}$/.test(actual?.[field + '_S'] || '') ? actual[field + '_S'].replaceAll('/', '-') : null });
    }
  }
  return [...periods.values()].filter(p => p.metrics.length).sort((a,b) => b.period.localeCompare(a.period));
}
const clean = text => text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function yahooEarnings(html) {
  const section = html.match(/<section\b[^>]*data-testid="earningsHistory"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  if (!section) throw Error('Earnings history not provided');
  const currency = clean(section).match(/Currency in ([A-Z]{3})\b/)?.[1];
  const toggle = [...section.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).find(t=>/\bchecked\b/.test(t));
  const basis = toggle?.match(/value="(gaap|nongaap)"/)?.[1];
  if (!currency || !basis) throw Error('Earnings basis or currency unavailable');
  const headers = [...section.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m => clean(m[1]));
  const rows = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c => clean(c[1])));
  const estimates = rows.find(r => r[0] === 'EPS Est.'), actuals = rows.find(r => r[0] === 'EPS Actual');
  if (!estimates || !actuals) throw Error('Comparable EPS rows unavailable');
  return headers.flatMap((date,index) => {
    const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if (!match) return [];
    const period = `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
    return [{period,basis:basis==='gaap'?'GAAP EPS':'조정 EPS (Normalized)',metrics:[{label:'EPS',estimate:numeric(estimates[index]),actual:numeric(actuals[index]),unit:currency+' / 주',announcedAt:null}]}];
  }).sort((a,b)=>b.period.localeCompare(a.period));
}
export const TREND_METRICS = [
  {id:'revenue',label:'매출액',names:['매출액','매출']},
  {id:'operating',label:'영업이익',names:['영업이익']},
  {id:'net',label:'순이익',names:['당기순이익','순이익']},
  {id:'ebit',label:'EBIT',names:['EBIT']},
  {id:'parentNet',label:'지배주주 순이익',names:['지배주주순이익','지배주주 순이익']},
];
export function fourQuarterTrend(quarters, metric, limit = 4) {
  const all = [...(quarters || [])].sort((a,b)=>a.key.localeCompare(b.key));
  const names = TREND_METRICS.find(m=>m.id===metric)?.names || [];
  return all.slice(-limit).map(q => {
    const index = all.indexOf(q), value = q.metrics.find(m=>names.includes(m.label))?.value ?? null;
    const prior = index ? all[index-1].metrics.find(m=>names.includes(m.label))?.value ?? null : null;
    // A gap is not quarter-on-quarter. Quarter keys can be YYYYMM or YYYY.MM.DD.
    const month = key => {const s=key.replace(/\D/g,'');return Number(s.slice(0,4))*12+Number(s.slice(4,6));};
    const annual=q.key.length===4;
    const consecutive = index && (annual?Number(q.key)-Number(all[index-1].key)===1:month(q.key)-month(all[index-1].key)===3);
    const delta = consecutive ? earningsDelta(value,prior) : {amount:null,percent:null};
    return {period:q.period,key:q.key,value,previous:consecutive?prior:null,delta:delta.amount,percent:prior>0?delta.percent:null};
  });
}

// Prefer live values, but fill missing periods/metrics from a dated snapshot.
// Metadata stays on each metric so a live response cannot make cached data look fresh.
export function comparisonRecords(live, cache, fundamentals) {
  if(fundamentals?.kind==='reported-supplement')return reportedSupplementRecords(comparisonRecords(live,cache),fundamentals);
  const result = new Map();
  for (const dataset of [cache, live, fundamentals]) {
    for (const row of dataset?.rows || []) {
      const key = [row.period, row.basis, !!row.directComparison].join('|');
      const old = result.get(key);
      const metrics = new Map((old?.metrics || []).map(m => [m.label+'|'+m.unit,m]));
      for (const m of row.metrics) {
        const id=m.label+'|'+m.unit, prior=metrics.get(id);
        // Keep an intact source pair instead of mixing one provider's actual and another's estimate.
        if (prior?.estimate != null && m.estimate == null) continue;
        metrics.set(id, {...m, source:dataset.source, url:dataset.url, asOf:dataset.asOf, refreshMode:dataset.refreshMode});
      }
      result.set(key, {...row, metrics:[...metrics.values()]});
    }
  }
  return [...result.values()].sort((a,b)=>b.period.localeCompare(a.period));
}
const monthKey = period => period.replace(/\D/g,'').slice(0,6);
function chartWindow(rows) {
  const ordered=[...rows].sort((a,b)=>monthKey(a.period).localeCompare(monthKey(b.period)));
  const announced=ordered.filter(r=>r.value!=null).slice(-4);
  const last=announced.at(-1);
  return [...announced,...ordered.filter(r=>r.value==null && r.estimate!=null && (!last || monthKey(r.period)>monthKey(last.period))).slice(0,2)];
}
export function comparisonTrend(quarters, records, metric, financialUnit = '', annual = false) {
  const selectWindow=rows=>{const compared=actualComparisons(rows,annual);return annual?fiveYearWindow(compared,[...(quarters||[]).map(q=>q.key),...records.map(r=>r.period)],financialUnit):chartWindow(compared);};
  const label = {revenue:'매출액',operating:'영업이익',parentNet:'지배주주 순이익',net:'순이익',ebit:'EBIT',eps:'EPS'}[metric];
  const direct=records.filter(r=>(metric==='eps' || r.directComparison) && r.metrics.some(m=>m.label===label));
  if (direct.length) {
    const latest=[...direct].sort((a,b)=>b.period.localeCompare(a.period)).find(r=>r.metrics.some(m=>m.label===label && m.actual!=null)) || direct[0];
    const unit=latest.metrics.find(m=>m.label===label).unit;
    return selectWindow(direct.filter(r=>r.basis===latest.basis).flatMap(r=>{
      const m=r.metrics.find(m=>m.label===label && m.unit===unit);
      return m?[{...m,period:r.period.slice(0,7),fiscalPeriod:r.fiscalPeriod,value:m.actual,basis:r.basis,directComparison:true}]:[];
    }));
  }
  // Total net income must never be matched to parent-shareholders' net income.
  const domestic=/억 KRW/.test(financialUnit) && ['revenue','operating','parentNet'].includes(metric);
  const matching=domestic?records.filter(r=>r.basis?.startsWith('IFRS 연결')):[];
  const rows=fourQuarterTrend(quarters,metric,(quarters||[]).length).map(r=>{
    const record=matching.find(x=>monthKey(x.period)===monthKey(r.key));
    const match=record?.metrics.find(m=>m.label===label && m.unit==='억 KRW');
    return {...match,...r,period:r.key.length===4?r.key:r.key.replace(/\D/g,'').slice(0,4)+'-'+r.key.replace(/\D/g,'').slice(4,6),estimate:match?.estimate??null,unit:financialUnit,actualSource:'naver-financials',basis:'확정 실적 / 발표 전 예상'};
  });
  const latest=rows.at(-1);
  for(const record of matching) {
    if(latest && monthKey(record.period)<=monthKey(latest.period))continue;
    const m=record.metrics.find(m=>m.label===label && m.unit==='억 KRW');
    if(m)rows.push({...m,period:record.period,value:m.actual,basis:record.basis});
  }
  return selectWindow(rows);
}

// Use a shared consecutive five-year axis across metrics; gaps remain unknown, not zero.
export function fiveYearWindow(rows, periods, unit='') {
 const years=periods.filter(p=>/^20\d{2}$/.test(p)).map(Number);
 if(!years.length)return [];
 const end=Math.max(...years),byYear=new Map(rows.map(r=>[r.period,r]));
 return Array.from({length:5},(_,i)=>{
  const period=String(end-4+i),row=byYear.get(period);
  return row?{...row,missing:row.value==null&&row.estimate==null}:{period,value:null,estimate:null,unit:rows[0]?.unit||unit,basis:rows[0]?.basis,missing:true};
 });
}

export const wiseAnnualEarnings = payloads => wiseEarnings(payloads,true);
// Keep source values intact: USD uses millions; other currencies retain 억/조 display.
export function earningsAmount(value, unit='', signed=false) {
 if(value==null)return '미제공';
 const perShare=/주/.test(unit);
 if(perShare)return (signed&&value>0?'+':'')+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value);
 if(/\bUSD\b/.test(unit)){
  const millions=value*(/백만/.test(unit)?1:/조/.test(unit)?1000000:/억/.test(unit)?100:1/1000000);
  const displayed=Number(millions.toFixed(2))||0;
  return (signed&&displayed>0?'+':'')+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(displayed)+'백만';
 }
 const eok=value/(/백만/.test(unit)?100:1),trillion=Math.abs(eok)>=10000;
 const displayed=trillion?eok/10000:(Math.trunc(eok)||0);
 const number=new Intl.NumberFormat('ko-KR',trillion?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0}).format(displayed);
 return (signed&&displayed>0?'+':'')+number+(trillion?'조':'억');
}
export function earningsPercent(value) {
 if(value==null)return '—';
 return (value>0?'+':'')+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value)+'%';
}
export function earningsUnit(unit='') {
 if(/주/.test(unit))return unit;
 if(/\bUSD\b/.test(unit))return '금액: 백만 USD';
 return '금액: 억·조 '+(unit.match(/KRW|USD|DKK/)?.[0]||'원문 통화');
}

// Exact fiscal-period offsets, before selecting the visible window. No gap bridging.
export function actualComparisons(rows, annual=false) {
 const index=r=>{const p=r.period.replace(/\D/g,'');return annual?Number(p.slice(0,4))*12:Number(p.slice(0,4))*12+Number(p.slice(4,6))-1;};
 const match=(a,b)=>a.unit===b.unit && a.basis===b.basis && (a.actualSource||a.source)===(b.actualSource||b.source);
 return rows.map(row=>{
  const previous=months=>rows.find(r=>index(r)===index(row)-months&&match(row,r));
  return {...row,qoq:annual?{amount:null,percent:null}:earningsDelta(row.value,previous(3)?.value),yoy:earningsDelta(row.value,previous(12)?.value)};
 });
}
export function earningsPeriodLabel(row, annual=false, fiscalYearEnd=12) {
 if(annual)return row.period+'년';
 const fiscal=row.fiscalPeriod?.match(/^(\d{4})-Q([1-4])$/);
 if(fiscal)return fiscal[1].slice(2)+'.'+fiscal[2]+'Q';
 const digits=row.period.replace(/\D/g,''),year=Number(digits.slice(0,4)),month=Number(digits.slice(4,6));
 if(!month)return row.period;
 const end=Number(fiscalYearEnd)||12,quarter=Math.ceil(((month-end+11)%12+1)/3),fiscalYear=year+(month>end?1:0);
 return String(fiscalYear).slice(2)+'.'+quarter+'Q';
}

// Reviewed reported values supplement, not overwrite, the independently refreshed feed.
// Match labels exactly: total net income is never filled from parent-shareholder income.
export function reportedSupplementRecords(records, supplement) {
 const basis=supplement.basis,labels=new Set(supplement.rows.flatMap(r=>r.metrics.map(m=>m.label)));
 const existing=records.filter(r=>r.basis?.startsWith('IFRS 연결'));
 const latest=supplement.rows.map(r=>r.period).sort().at(-1);
 const supplements=supplement.rows.map(r=>({...r,basis,directComparison:true,metrics:r.metrics.map(m=>{
  const prior=existing.filter(x=>monthKey(x.period)===monthKey(r.period)).flatMap(x=>x.metrics).find(x=>x.label===m.label&&x.unit===m.unit&&x.estimate!=null);
  const usePrior=m.estimate==null&&prior;
  return {...m,estimate:usePrior?prior.estimate:m.estimate,source:supplement.source,url:supplement.url,asOf:supplement.asOf,refreshMode:supplement.refreshMode,actualSource:supplement.source,estimateSource:usePrior?prior.source:supplement.source,estimateUrl:usePrior?prior.url:null,estimateAsOf:usePrior?prior.asOf:supplement.asOf};
 })}));
 // Keep newer forecasts (and later reported periods) from the ongoing feed visible.
 const future=existing.filter(r=>monthKey(r.period)>monthKey(latest)).map(r=>({...r,basis,directComparison:true,metrics:r.metrics.filter(m=>labels.has(m.label)&&m.unit==='억 KRW')})).filter(r=>r.metrics.length);
 const replacements=[...supplements,...future];
 const remaining=records.map(r=>({...r,metrics:r.metrics.filter(m=>!replacements.some(x=>monthKey(x.period)===monthKey(r.period)&&x.metrics.some(n=>n.label===m.label&&n.unit===m.unit)))})).filter(r=>r.metrics.length);
 return [...replacements,...remaining].sort((a,b)=>b.period.localeCompare(a.period));
}
