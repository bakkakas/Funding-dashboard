import {attachChartHover,dateTickRows} from './chart-hover.js?v=1';
export function movingSpend(rows, days) {
  const byDate=new Map(rows.map(r=>[r.date,r]));
  return rows.map(row=>{
    const end=Date.parse(row.date+'T00:00:00Z');let sum=0;
    for(let i=0;i<days;i++) {const r=byDate.get(new Date(end-i*86400000).toISOString().slice(0,10));if(!r||r.usd===null||r.partial)return null;sum+=r.usd;}
    return sum/days;
  });
}
export function overviewChart(rows, allRows, en=false) {
  const host=document.createElement('div');host.className='hype-overview';
  if(!rows.length)return host;
  const fmt=n=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
  const ma7=movingSpend(allRows,7),ma30=movingSpend(allRows,30),indices=new Map(allRows.map((r,i)=>[r.date,i]));
  const start=Date.parse(rows[0].date),span=Math.max(86400000,Date.parse(rows.at(-1).date)-start);
  const x=r=>70+(Date.parse(r.date)-start)/span*760;
  const maxUsd=Math.max(1,...rows.map(r=>r.usd??0))*1.08,maxPrice=Math.max(1,...rows.map(r=>r.closePrice??0))*1.08;
  const y=(v,max)=>240-v/max*210;
  const path=get=>{let pen=false,previous=null;return rows.map(r=>{if(previous!==null&&Date.parse(r.date)-previous>86400000)pen=false;previous=Date.parse(r.date);const v=get(r);if(v===null||v===undefined){pen=false;return '';}const d=`${pen?'L':'M'}${x(r).toFixed(2)},${y(v,maxUsd).toFixed(2)}`;pen=true;return d;}).join(' ');};
  let pricePen=false,previousPriceDate=null;
  const pricePath=rows.map(r=>{if(previousPriceDate!==null&&Date.parse(r.date)-previousPriceDate>86400000)pricePen=false;previousPriceDate=Date.parse(r.date);if(r.closePrice===null){pricePen=false;return '';}const d=`${pricePen?'L':'M'}${x(r).toFixed(2)},${y(r.closePrice,maxPrice).toFixed(2)}`;pricePen=true;return d;}).join(' ');
  host.innerHTML=`<h4>${en?'Buyback USD & HYPE price':'바이백 USD · HYPE 가격'}</h4><p>${en?'Left: daily USD / moving averages · Right: HYPE closing price (current day provisional); swipe chart on mobile':'왼쪽: 일별 매수액·이동평균 (USD) · 오른쪽: HYPE 종가 (당일 잠정) · 모바일 좌우 스크롤'}</p><div class="hype-overview-plot"><svg viewBox="0 0 900 280" role="img" aria-label="HYPE buyback USD and price">
  ${[0,.25,.5,.75,1].map(t=>`<line x1="70" x2="830" y1="${30+t*210}" y2="${30+t*210}" stroke="#ffffff12"/><text x="62" y="${34+t*210}" text-anchor="end">${fmt(maxUsd*(1-t))}</text><text x="840" y="${34+t*210}">${fmt(maxPrice*(1-t))}</text>`).join('')}
  ${rows.filter(r=>r.usd!==null).map(r=>`<rect x="${x(r)-1}" y="${y(r.usd,maxUsd)}" width="${Math.max(1,Math.min(10,760/(span/86400000+1)*.7))}" height="${r.usd/maxUsd*210}" fill="#9fe3d5"/>`).join('')}
  <path d="${path(r=>ma30[indices.get(r.date)])}" fill="none" stroke="#c7a7df" stroke-width="1.8"/><path d="${path(r=>ma7[indices.get(r.date)])}" fill="none" stroke="#e9db8b" stroke-width="1.8"/><path d="${pricePath}" fill="none" stroke="#fff" stroke-width="2"/>
  ${dateTickRows(rows).map(r=>`<text x="${x(r)}" y="268" text-anchor="middle">${r.date.slice(2)}</text>`).join('')}</svg></div><div class="hype-chart-legend"><span style="color:#fff">━ HYPE ${en?'close':'종가'}</span><span style="color:#c7a7df">━ 30${en?'d average':'일 평균'}</span><span style="color:#e9db8b">━ 7${en?'d average':'일 평균'}</span><span style="color:#9fe3d5">▮ Buyback USD</span></div>`;
  attachChartHover(host.querySelector('svg'),rows.map(r=>({x:x(r),text:`${r.date} UTC${r.partial?' · '+(en?'partial':'잠정'):''}\nBuyback: ${fmt(r.usd)}\nHYPE: ${r.hype.toLocaleString('en-US')}\n${en?'Close':'종가'}: ${fmt(r.closePrice)}\n7d: ${fmt(ma7[indices.get(r.date)])}\n30d: ${fmt(ma30[indices.get(r.date)])}`})),{top:30,bottom:240});
  return host;
}
