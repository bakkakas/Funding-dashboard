import { fmtSignedPct } from '../formatters.js';
import { t } from '../i18n.js';

export function renderFundingBars(containerId, stats, feeTone){
  const bars=document.getElementById(containerId);
  bars.innerHTML='';
  const sorted=stats.slice().sort((a,b)=>b.fee-a.fee);
  if(!sorted.length){
    const empty=document.createElement('div');
    empty.className='mini';
    empty.textContent=t('noData');
    bars.appendChild(empty);
    return;
  }
  const maxAbs=Math.max(...sorted.map(item=>Math.abs(item.fee)), 0.000001);
  sorted.forEach(item=>{
    const row=document.createElement('div');
    row.className='funding-bar-row';
    const name=document.createElement('div');
    name.className='funding-bar-name';
    name.textContent=item.pair.exchange;
    const track=document.createElement('div');
    track.className='funding-bar-track';
    const fill=document.createElement('div');
    fill.className='funding-bar-fill ' + feeTone(item.fee);
    fill.style.width=`${Math.max(3, Math.min(50, Math.abs(item.fee) / maxAbs * 50))}%`;
    track.appendChild(fill);
    const value=document.createElement('div');
    value.className='funding-bar-value ' + feeTone(item.fee);
    value.textContent=fmtSignedPct(item.fee);
    row.append(name, track, value);
    bars.appendChild(row);
  });
}
