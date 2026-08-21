import { PRICE_CANDLE_WINDOWS } from '../config.js';
import { fmtNumber, toKSTChartLabel } from '../formatters.js';
import { state } from '../state.js';

function applyChartRange(chart, start, end){
  chart.$zoomStart = Math.max(0, start);
  chart.$zoomEnd = Math.min(chart.$fullLabels.length - 1, end);
  chart.data.labels = chart.$fullLabels.slice(chart.$zoomStart, chart.$zoomEnd + 1);
  chart.data.datasets[0].data = chart.$fullData.slice(chart.$zoomStart, chart.$zoomEnd + 1);
  if(chart.$fullOhlcData) chart.$ohlcData = chart.$fullOhlcData.slice(chart.$zoomStart, chart.$zoomEnd + 1);
  chart.update('none');
}

function enableWheelZoom(chart, canvas){
  if(canvas.$wheelZoomHandler) canvas.removeEventListener('wheel', canvas.$wheelZoomHandler);
  if(canvas.$panHandlers){
    canvas.removeEventListener('pointerdown', canvas.$panHandlers.down);
    canvas.removeEventListener('pointermove', canvas.$panHandlers.move);
    canvas.removeEventListener('pointerup', canvas.$panHandlers.up);
    canvas.removeEventListener('pointercancel', canvas.$panHandlers.up);
  }
  canvas.$wheelZoomHandler = event => {
    const total = chart.$fullLabels.length;
    if(total <= 2) return;
    event.preventDefault();
    const visible = chart.$zoomEnd - chart.$zoomStart + 1;
    const scale = event.deltaY < 0 ? 0.78 : 1.28;
    const nextVisible = Math.max(8, Math.min(total, Math.round(visible * scale)));
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const center = chart.$zoomStart + Math.round((visible - 1) * ratio);
    let start = Math.round(center - (nextVisible - 1) * ratio);
    let end = start + nextVisible - 1;
    if(start < 0){ end -= start; start = 0; }
    if(end >= total){ start -= end - total + 1; end = total - 1; }
    applyChartRange(chart, Math.max(0, start), Math.min(total - 1, end));
  };
  canvas.addEventListener('wheel', canvas.$wheelZoomHandler, { passive:false });
  const panState = { active:false, pointerId:null, startX:0, startStart:0, startEnd:0 };
  const finishPan = event => {
    if(!panState.active) return;
    panState.active=false;
    canvas.style.cursor='grab';
    if(event && event.pointerId === panState.pointerId) {
      try { canvas.releasePointerCapture(event.pointerId); } catch(e) {}
    }
  };
  canvas.$panHandlers = {
    down: event => {
      if(event.button !== 0 || chart.$fullLabels.length <= 2) return;
      panState.active=true;
      panState.pointerId=event.pointerId;
      panState.startX=event.clientX;
      panState.startStart=chart.$zoomStart;
      panState.startEnd=chart.$zoomEnd;
      canvas.style.cursor='grabbing';
      canvas.setPointerCapture(event.pointerId);
    },
    move: event => {
      if(!panState.active || event.pointerId !== panState.pointerId) return;
      event.preventDefault();
      const total = chart.$fullLabels.length;
      const visible = panState.startEnd - panState.startStart + 1;
      if(visible >= total) return;
      const rect = canvas.getBoundingClientRect();
      const shift = Math.round((panState.startX - event.clientX) / rect.width * visible);
      let start = panState.startStart + shift;
      let end = panState.startEnd + shift;
      if(start < 0){ end -= start; start = 0; }
      if(end >= total){ start -= end - total + 1; end = total - 1; }
      applyChartRange(chart, Math.max(0, start), Math.min(total - 1, end));
    },
    up: finishPan,
  };
  canvas.addEventListener('pointerdown', canvas.$panHandlers.down);
  canvas.addEventListener('pointermove', canvas.$panHandlers.move);
  canvas.addEventListener('pointerup', canvas.$panHandlers.up);
  canvas.addEventListener('pointercancel', canvas.$panHandlers.up);
}

const candleOverlayPlugin = {
  id:'candleOverlay',
  afterDatasetsDraw(chart){
    if(!chart.$isCandleChart || !chart.$ohlcData) return;
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    const width = Math.max(3, Math.min(13, chartArea.width / Math.max(chart.$ohlcData.length, 1) * 0.56));
    ctx.save();
    chart.$ohlcData.forEach((candle, index)=>{
      const x = xScale.getPixelForValue(index);
      const openY = yScale.getPixelForValue(candle.open);
      const closeY = yScale.getPixelForValue(candle.close);
      const highY = yScale.getPixelForValue(candle.high);
      const lowY = yScale.getPixelForValue(candle.low);
      const up = candle.close >= candle.open;
      const color = up ? '#00c076' : '#f08a8a';
      ctx.strokeStyle = color;
      ctx.fillStyle = up ? 'rgba(0,192,118,0.82)' : 'rgba(240,138,138,0.82)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - width / 2, bodyTop, width, bodyHeight);
    });
    ctx.restore();
  }
};
Chart.register(candleOverlayPlugin);

function selectedPriceCandleWindow(){
  return PRICE_CANDLE_WINDOWS.find(item=>item.key===state.priceCandleWindow) || PRICE_CANDLE_WINDOWS[0];
}

function aggregatePriceCandles(rows){
  const bucketMs = selectedPriceCandleWindow().hours * 3600000;
  const grouped = new Map();
  rows.forEach(row=>{
    const price = Number(row.markPrice);
    const time = Number(row.fundingTime);
    if(!Number.isFinite(price) || !Number.isFinite(time)) return;
    const bucket = Math.floor(time / bucketMs) * bucketMs;
    if(!grouped.has(bucket)){
      grouped.set(bucket, { time:bucket, open:price, high:price, low:price, close:price });
      return;
    }
    const candle = grouped.get(bucket);
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
  });
  return Array.from(grouped.values()).sort((a,b)=>a.time-b.time).map(candle=>{
    const pad = Math.max(Math.abs(candle.close - candle.open) * 0.25, Math.abs(candle.close || candle.open || 1) * 0.00015);
    return {
      ...candle,
      high:Math.max(candle.high, candle.open, candle.close) + pad,
      low:Math.min(candle.low, candle.open, candle.close) - pad,
    };
  });
}

export function renderPriceChart(rows){
  const ctx=document.getElementById('priceChart');
  const candles=aggregatePriceCandles(rows);
  const labels=candles.map(candle=>toKSTChartLabel(candle.time));
  const values=candles.map(candle=>candle.close);
  if(state.priceChart) state.priceChart.destroy();
  state.priceChart=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'Mark Price', data:values, borderColor:'rgba(0,192,118,0)', backgroundColor:'rgba(0,192,118,0)', borderWidth:0, pointRadius:0, pointHoverRadius:0, tension:0 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ ticks:{ color:'#7d8a98' }, grid:{ color:'rgba(255,255,255,0.045)' } }, x:{ ticks:{ color:'#7d8a98', maxTicksLimit:8 }, grid:{ color:'rgba(255,255,255,0.025)' } } }, plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ label:context=>{ const candle=state.priceChart.$ohlcData && state.priceChart.$ohlcData[context.dataIndex]; return candle ? `O ${fmtNumber(candle.open)}  H ${fmtNumber(candle.high)}  L ${fmtNumber(candle.low)}  C ${fmtNumber(candle.close)}` : `Mark ${fmtNumber(context.parsed.y)}`; } } } }, interaction:{ mode:'index', intersect:false } } });
  state.priceChart.$isCandleChart=true;
  state.priceChart.$fullLabels=labels;
  state.priceChart.$fullData=values;
  state.priceChart.$fullOhlcData=candles;
  state.priceChart.$ohlcData=candles;
  state.priceChart.$zoomStart=0;
  state.priceChart.$zoomEnd=Math.max(0, labels.length - 1);
  enableWheelZoom(state.priceChart, ctx);
}

export function renderChart(rows){
  const ctx=document.getElementById('fundingChart');
  const labels=rows.map(r=>toKSTChartLabel(r.fundingTime));
  const values=rows.map(r=>r.fundingRate*100);
  if(state.chart) state.chart.destroy();
  state.chart=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'Funding Rate', data:values, borderColor:'#23e7a5', backgroundColor:{ target:'origin', above:'rgba(35,231,165,0.13)', below:'rgba(255,91,105,0.13)' }, segment:{ borderColor:context=>context.p1.parsed.y >= 0 ? '#23e7a5' : '#ff5b69' }, borderWidth:2, fill:true, pointRadius:0, pointHoverRadius:4, tension:0.25 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ ticks:{ color:'#7d8a98', callback:v=>`${v.toFixed(3)}%` }, grid:{ color:'rgba(255,255,255,0.045)' } }, x:{ ticks:{ color:'#7d8a98', maxTicksLimit:8 }, grid:{ color:'rgba(255,255,255,0.025)' } } }, plugins:{ legend:{ labels:{ color:'#dce3ea' } }, tooltip:{ mode:'index', intersect:false } }, interaction:{ mode:'index', intersect:false } } });
  state.chart.$fullLabels=labels;
  state.chart.$fullData=values;
  state.chart.$zoomStart=0;
  state.chart.$zoomEnd=Math.max(0, labels.length - 1);
  enableWheelZoom(state.chart, ctx);
}
