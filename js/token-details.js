const finite = x => typeof x === 'number' && Number.isFinite(x);
export function unlockMetrics(amount, market = {}) {
  const usd = finite(amount) && amount >= 0 && finite(market?.price) && market.price > 0 ? amount * market.price : null;
  const percent = denominator => usd !== null && finite(denominator) && denominator > 0 ? usd / denominator * 100 : null;
  return {usd, circPercent:percent(market?.marketCap), fdvPercent:percent(market?.fdv)};
}
export function unlockedPercent(asset, today) {
  if(asset.unlock.status==='complete') return 100;
  if(asset.unlock.completeSchedule!==true || !(asset.market.maxSupply>0)) return null;
  const remaining=asset.unlock.events.filter(e=>e.date>=today).reduce((sum,e)=>sum+e.amount,0);
  const result=100-remaining/asset.market.maxSupply*100;
  return result>=0 && result<=100 ? result : null;
}
const compact=x=>!finite(x)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(x);
const money=x=>x===null?'—':'$'+compact(x);
const pct=x=>x===null?'—':x.toFixed(2)+'%';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function table(host, headings, rows) {
  host.replaceChildren(); const t=node('table');t.className='token-table';
  const head=node('thead'),tr=node('tr');for(const h of headings)tr.append(node('th',h));head.append(tr);t.append(head);
  const body=node('tbody');for(const row of rows){const r=node('tr');for(const cell of row){const td=node('td');td.append(cell instanceof Node?cell:document.createTextNode(String(cell)));r.append(td);}body.append(r);}t.append(body);host.append(t);
}
const link=(text,url)=>{const n=node('a',text);n.href=url;n.target='_blank';n.rel='noopener noreferrer';return n;};
let burnPromise=null, selectedId=null;
export function renderTokenDetails(asset, market, today, language='ko') {
  selectedId=asset.id;
  const en=language==='en',events=asset.unlock.events.filter(e=>e.date>=today);
  const next=events[0],complete=asset.unlock.status==='complete',partial=asset.unlock.completeSchedule!==true;
  const unknown=en?'Schedule not confirmed':'일정 확인 필요';
  const inline=document.getElementById('nextUnlockInline');
  if(next){const m=unlockMetrics(next.amount,market);const days=Math.round((Date.parse(next.date)-Date.parse(today))/86400000);
    inline.textContent=`${days===0?'D-DAY':'D-'+days} ${next.date.replaceAll('-','.')} ${compact(next.amount)} ${asset.symbol} (${money(m.usd)} / ${pct(m.circPercent)} of Circ / ${pct(m.fdvPercent)} of FDV)${partial?(en?' · partial schedule':' · 일부 일정'):''}`;
  }else inline.textContent=complete?(en?'Vesting complete · no next unlock':'베스팅 완료 · 다음 언락 없음'):unknown;
  const percent=unlockedPercent(asset,today);
  document.getElementById('unlockedSummary').textContent=(en?'Unlocked: ':'언락 완료: ')+pct(percent)+(en?' · not circulation':' · 유통률과 별도');
  const host=document.getElementById('unlockScheduleRows');
  if(events.length){table(host,en?['Date','Unlock','Value now','% Circ','% FDV']:['예정일','언락 수량','현재가 환산','% Circ','% FDV'],events.map(e=>{const m=unlockMetrics(e.amount,market);return[e.date,`${compact(e.amount)} ${asset.symbol}`,money(m.usd),pct(m.circPercent),pct(m.fdvPercent)];}));}
  else host.replaceChildren(node('p',complete?(en?'No further vesting events.':'추가 베스팅 일정 없음.'):unknown));
  host.append(node('p',en?'Calendar dates, not guaranteed execution times. Current-price value ÷ current market cap / FDV; not future selling proceeds. Partial schedules cannot determine total unlocked supply.':'일정 날짜 기준이며 실제 실행 시각·매도를 보장하지 않음. 현재가 환산액 ÷ 현재 시가총액 / FDV 기준. 일부 일정만으로 전체 언락 비율은 계산하지 않음.'));
  const panel=document.getElementById('bnbBurnBoard');panel.hidden=asset.id!=='bnb';
  if(asset.id!=='bnb')return;
  panel.replaceChildren(node('h3',en?'BNB quarterly burns':'BNB 분기별 소각'),node('p',en?'Loading…':'불러오는 중…'));
  burnPromise??=fetch('./data/bnb-burns.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('burn data');return r.json();}).catch(e=>{burnPromise=null;throw e;});
  burnPromise.then(data=>{
    if(selectedId!=='bnb')return;
    panel.replaceChildren(node('h3',en?'BNB quarterly Auto-Burn':'BNB 분기별 Auto-Burn'));
    panel.append(node('p',en?'Auto-Burn is formula-based destruction, not verified open-market purchases. USD amounts are valuations at the burn, not cash spent. BEP-95 gas burns are separate. #34 includes 100.1 BNB Pioneer burn.':'Auto-Burn은 공식 산식에 따른 소각이며 공개시장 매수 실적이 아닙니다. 달러 금액은 소각 당시 평가액으로 매입 지출액이 아닙니다. BEP-95 실시간 가스 소각은 별도입니다. 34회 총량에는 Pioneer 100.1 BNB가 포함됩니다.'));
    const wrap=node('div');wrap.className='token-table-wrap';panel.append(wrap);
    table(wrap,en?['Burn','Published','BNB burned','USD at burn','Source']:['회차','발표일','소각 BNB','당시 평가액(약)','공식 원문'],data.events.map(e=>[String(e.number),e.date,e.amount.toLocaleString('en-US',{maximumFractionDigits:3}),money(e.usd),link(en?'Official':'공식 발표',e.source)]));
    panel.append(node('p',(en?'Last check: ':'최종 확인: ')+data.checkedAt+' · '+(en?'Next burn date/amount: not confirmed':'다음 소각 날짜·수량: 미확정')),link('BNB Burn tracker · BEP-95','https://www.bnbburn.info/'));
  }).catch(()=>{if(selectedId==='bnb')panel.replaceChildren(node('p',en?'Burn data unavailable':'소각 자료 조회 실패'));});
}
