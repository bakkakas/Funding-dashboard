import { fmtAbsAnnual, fmtAbsPct } from '../formatters.js';
import { t } from '../i18n.js';
import { state } from '../state.js';

function spreadAlertLevel(annualSpread){
  const absSpread=Math.abs(Number(annualSpread));
  if(!Number.isFinite(absSpread)) return { label:'-', tone:'warn' };
  if(absSpread >= 20) return { label:t('alertWide'), tone:'bad' };
  if(absSpread >= 5) return { label:t('alertNarrow'), tone:'warn' };
  return { label:t('noAlert'), tone:'info' };
}

export function renderSpreadInsights(stats, ids={
  spreadValue:'fundingSpreadValue',
  spreadMeta:'fundingSpreadMeta',
  alertValue:'spreadAlertValue',
  alertMeta:'spreadAlertMeta',
}){
  const spreadValue=document.getElementById(ids.spreadValue);
  const spreadMeta=document.getElementById(ids.spreadMeta);
  const alertValue=document.getElementById(ids.alertValue);
  const alertMeta=document.getElementById(ids.alertMeta);
  if(!stats.length){
    spreadValue.textContent='-';
    spreadValue.className='value warn';
    spreadMeta.textContent='-';
    alertValue.textContent='-';
    alertValue.className='value warn';
    alertMeta.textContent='-';
    alertMeta.className='mini warn';
    return;
  }
  const sorted=stats.slice().sort((a,b)=>b.fee-a.fee);
  const high=sorted[0];
  const low=sorted[sorted.length-1];
  const spread=high.fee-low.fee;
  const annualSpread = high.annualized != null && low.annualized != null
    ? high.annualized - low.annualized
    : null;
  spreadValue.textContent=annualSpread == null || Number.isNaN(annualSpread)
    ? fmtAbsPct(spread)
    : `${fmtAbsPct(spread)} / ${fmtAbsAnnual(annualSpread)}`;
  spreadValue.className='value warn';
  spreadMeta.textContent=`${high.pair.exchange} - ${low.pair.exchange}`;
  const alert=spreadAlertLevel(annualSpread);
  alertValue.innerHTML='';
  alertValue.className='value with-alert ' + alert.tone;
  const alertNumber=document.createElement('span');
  alertNumber.textContent=annualSpread == null || Number.isNaN(annualSpread) ? '-' : fmtAbsAnnual(annualSpread);
  const alertLabel=document.createElement('span');
  alertLabel.className='alert-inline';
  alertLabel.textContent=alert.label;
  alertValue.append(alertNumber, alertLabel);
  alertMeta.textContent=stats.length ? `${stats.length}${state.lang === 'ko' ? '개 거래소 비교' : ' exchanges compared'}` : '-';
  alertMeta.className='mini ' + alert.tone;
}
