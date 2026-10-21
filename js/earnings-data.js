import { numeric } from './stock-data.js';

// Keep actual/consensus on the same source, accounting basis, currency and period.
export function earningsDelta(actual, estimate) {
  if (actual == null || estimate == null) return { amount: null, percent: null };
  return { amount: actual - estimate, percent: estimate === 0 ? null : (actual - estimate) / Math.abs(estimate) * 100 };
}
export function wiseEarnings(payloads) {
  const periods = new Map();
  for (const { label, data } of payloads) {
    const table = data?.tableData;
    const rows = table?.tableData || [], headers = table?.tableHeaderData?.[0] || {};
    const actual = rows.find(r => r.QTR === '분기실적(A)');
    const estimate = rows.find(r => r.QTR === '발표직전(E)');
    for (const field of ['FY_2', 'FY_1', 'FY0', 'FY1']) {
      const raw = headers['CNS_' + field];
      if (!/^\d{4}\/\d{2}$/.test(raw || '')) continue;
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
];
export function fourQuarterTrend(quarters, metric) {
  const all = [...(quarters || [])].sort((a,b)=>a.key.localeCompare(b.key));
  const names = TREND_METRICS.find(m=>m.id===metric)?.names || [];
  return all.slice(-4).map(q => {
    const index = all.indexOf(q), value = q.metrics.find(m=>names.includes(m.label))?.value ?? null;
    const prior = index ? all[index-1].metrics.find(m=>names.includes(m.label))?.value ?? null : null;
    // A gap is not quarter-on-quarter. Quarter keys can be YYYYMM or YYYY.MM.DD.
    const month = key => {const s=key.replace(/\D/g,'');return Number(s.slice(0,4))*12+Number(s.slice(4,6));};
    const consecutive = index && month(q.key)-month(all[index-1].key)===3;
    const delta = consecutive ? earningsDelta(value,prior) : {amount:null,percent:null};
    return {period:q.period,key:q.key,value,previous:consecutive?prior:null,delta:delta.amount,percent:prior>0?delta.percent:null};
  });
}
