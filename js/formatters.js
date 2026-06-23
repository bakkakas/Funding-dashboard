import { state } from './state.js';

export const fmtPct = v => `${(v * 100).toFixed(4)}%`;
export const fmtSignedPct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(4)}%`;
export const fmtAbsPct = v => `${Math.abs(v * 100).toFixed(4)}%`;
export const fmtAnnual = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
export const fmtAbsAnnual = v => `${Math.abs(v).toFixed(2)}%`;
export const fmtNumber = v => Number(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
export const fmtFx = v => Number(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

export function toKST(ms){
  if(state.lang === 'en'){
    return new Date(ms).toLocaleString('en-US', { timeZone:'Asia/Seoul', year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  }
  return new Date(ms).toLocaleString('ko-KR', { timeZone:'Asia/Seoul', hour12:false });
}

export function toKSTCompact(ms){
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hour12:false }).formatToParts(new Date(ms)).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  if(state.lang === 'en') return `${parts.month}/${parts.day} ${parts.hour}:${String(parts.minute).padStart(2,'0')}`;
  return `${Number(parts.month)}. ${Number(parts.day)}. ${Number(parts.hour)}시 ${Number(parts.minute)}분`;
}

export function toKSTChartLabel(ms){
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Seoul', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date(ms)).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export const toUTC = ms => new Date(ms).toISOString().replace('T',' ').slice(0,19) + ' UTC';
