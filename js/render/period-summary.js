import { fmtAnnual, fmtSignedPct } from '../formatters.js';
import { t } from '../i18n.js';
import { state } from '../state.js';

export function renderPeriodBestWorst({ periodComparisonStats, feeTone }){
  const wrap=document.getElementById('periodBestWorst');
  wrap.innerHTML='';
  Object.keys(state.data.meta.windows).forEach(windowKey=>{
    const stats=periodComparisonStats(windowKey);
    const box=document.createElement('div');
    box.className='period-summary-box';
    const title=document.createElement('div');
    title.className='period-summary-title';
    title.textContent=state.lang === 'ko' ? `${state.data.meta.windows[windowKey]}일 Best / Worst` : `${windowKey} Best / Worst`;
    box.appendChild(title);
    if(!stats.length){
      const empty=document.createElement('div');
      empty.className='mini';
      empty.textContent=t('noData');
      box.appendChild(empty);
      wrap.appendChild(box);
      return;
    }
    const longBest=stats.slice().sort((a,b)=>a.fee-b.fee)[0];
    const shortBest=stats.slice().sort((a,b)=>b.fee-a.fee)[0];
    const makeRow=(label, item, side)=>{
      const row=document.createElement('div');
      row.className='period-summary-row';
      const labelEl=document.createElement('span');
      labelEl.textContent=label;
      const valueEl=document.createElement('span');
      const fee=item.fee;
      const annual=item.annualized;
      valueEl.className='period-summary-value';
      const exchangeEl=document.createElement('span');
      exchangeEl.className='period-summary-exchange';
      exchangeEl.textContent=item.pair.exchange;
      const metricEl=document.createElement('span');
      metricEl.className='period-summary-metric ' + feeTone(fee);
      metricEl.textContent=`${fmtSignedPct(fee)} / ${annual == null || Number.isNaN(annual) ? '-' : fmtAnnual(annual)}`;
      valueEl.append(exchangeEl, metricEl);
      row.append(labelEl, valueEl);
      return row;
    };
    box.appendChild(makeRow(t('bestLong'), longBest, 'long'));
    box.appendChild(makeRow(t('bestShort'), shortBest, 'short'));
    wrap.appendChild(box);
  });
}
