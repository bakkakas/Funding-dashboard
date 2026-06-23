import { fmtNumber, fmtPct, toUTC } from '../formatters.js';

export function renderPaymentCounts(rows){
  const longToShort = rows.filter(row=>Number(row.fundingRate) >= 0).length;
  const shortToLong = rows.filter(row=>Number(row.fundingRate) < 0).length;
  document.getElementById('longToShortCount').textContent=longToShort.toLocaleString('en-US');
  document.getElementById('shortToLongCount').textContent=shortToLong.toLocaleString('en-US');
}

export function renderHistoryRows(rows){
  const body=document.getElementById('historyBody');
  body.innerHTML='';
  rows.slice().reverse().forEach((row,idx)=>{
    const positive=row.fundingRate>=0;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${rows.length-idx}</td><td>${toUTC(row.fundingTime)}</td><td style="color:${positive?'var(--bad)':'var(--good)'}; font-weight:700;">${fmtPct(row.fundingRate)}</td><td>${row.markPrice == null ? '-' : fmtNumber(row.markPrice)}</td><td>${positive?'<span class="pill bad">Long → Short</span>':'<span class="pill good">Short → Long</span>'}</td>`;
    body.appendChild(tr);
  });
}
