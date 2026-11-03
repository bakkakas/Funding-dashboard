const SOURCE='https://explorer.hiro.so/staking/bonds?chain=mainnet';
const POLICY='https://github.com/stacksgov/sips/blob/main/sips/sip-045/sip-045-pox-5-bitcoin-staking.md';
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const link=(href,text)=>{const node=el('a',text);node.href=href;node.target='_blank';node.rel='noopener noreferrer';return node;};
export function atomicAmount(value,decimals){
  if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('Invalid bond balance');
  const raw=BigInt(value),base=10n**BigInt(decimals);
  return Number(raw/base)+Number(raw%base)/Number(base);
}
export function bondFunding(bond){
  const btc=atomicAmount(bond.balances.locked.btc,8),stx=atomicAmount(bond.balances.locked.stx,6),capacity=atomicAmount(bond.parameters.btc_capacity,8);
  return {btc,stx,capacity,percent:capacity>0?Math.min(100,btc/capacity*100):null};
}
export function bondUsd(amount,quote,now=Date.now()){
  return Number.isFinite(amount)&&amount>=0&&Number.isFinite(quote?.price)&&quote.price>0&&Number.isFinite(quote?.time)&&now-quote.time<=3600000&&quote.time<=now+60000?amount*quote.price:null;
}
export function bondTiming(bond){
  const start=bond.schedule.activation,end=bond.schedule.unlock;
  // SIP-045 standard L1 minimum. Individual UTXOs may choose a later timelock.
  const btcHeight=end.bitcoin_height-1050;
  const projected=end.projected_time_iso;
  return {startDate:start.time_iso||start.projected_time_iso||null,startEstimated:!start.time_iso,
    stxDate:end.time_iso||projected||null,stxEstimated:!end.time_iso,
    btcHeight,btcDate:projected?new Date(Date.parse(projected)-1050*600000).toISOString():null};
}
export function activeBondTotals(bonds){
  return bonds.filter(b=>b.status==='active').reduce((sum,b)=>({btc:sum.btc+atomicAmount(b.balances.locked.btc,8),stx:sum.stx+atomicAmount(b.balances.locked.stx,6)}),{btc:0,stx:0});
}
export function validateStxBonds(data){
  if(data?.schemaVersion!==1||!Number.isFinite(Date.parse(data.updatedAt))||!Number.isFinite(Date.parse(data.sourceAsOf))||!Array.isArray(data.bonds)||!data.bonds.length)throw Error('Invalid bond snapshot');
  const ids=new Set();
  for(const b of data.bonds){
    if(!Number.isSafeInteger(b.index)||b.index<1||ids.has(b.index))throw Error('Invalid bond index');ids.add(b.index);
    atomicAmount(b.balances.locked.btc,8);atomicAmount(b.balances.locked.stx,6);atomicAmount(b.parameters.btc_capacity,8);
    if(!Number.isSafeInteger(b.schedule.activation.bitcoin_height)||!Number.isSafeInteger(b.schedule.unlock.bitcoin_height)||b.schedule.unlock.bitcoin_height<=b.schedule.activation.bitcoin_height)throw Error('Invalid bond heights');
    for(const event of [b.schedule.activation,b.schedule.unlock])for(const key of ['time_iso','projected_time_iso'])if(event[key]&&!Number.isFinite(Date.parse(event[key])))throw Error('Invalid bond date');
  }
  return data;
}
export class StxBondsPanel{
  constructor(host,fetchJson){this.host=host;this.fetchJson=fetchJson;this.request=0;}
  async setAsset(id,language,signal){
    const request=++this.request;this.language=language;this.data=null;this.quotes={};this.host.hidden=id!=='stx';
    if(this.host.hidden)return;
    this.loadBtc(request,signal);
    this.host.replaceChildren(el('p',language==='en'?'Loading Bitcoin bonds…':'Bitcoin Bond 불러오는 중…'));
    try{const data=validateStxBonds(await this.fetchJson('./data/stx-bonds.json',{signal}));if(request!==this.request)return;this.data=data;this.render();}
    catch(error){if(request!==this.request)return;this.host.replaceChildren(el('p',this.language==='en'?'Bond data unavailable. Check the source.':'본드 데이터 조회 실패 · 원문에서 확인해 주세요.'),link(SOURCE,'Hiro Explorer ↗'));}
  }
  async loadBtc(request,signal){
    try{
      const data=await this.fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true',{signal});
      if(request!==this.request)return;
      this.quotes.btc={price:data.bitcoin?.usd,time:data.bitcoin?.last_updated_at*1000};
      if(this.data)this.render();
    }catch{} // Unknown quotes remain unavailable, never zero-valued.
  }
  setStxQuote(price,time){
    if(this.host.hidden)return;
    this.quotes.stx={price,time:Number(time)};
    if(this.data)this.render();
  }
  setLanguage(language){this.language=language;if(this.data&&!this.host.hidden)this.render();}
  render(){
    const en=this.language==='en',d=this.data,totals=activeBondTotals(d.bonds);
    const number=(n,max=2)=>n.toLocaleString(en?'en-US':'ko-KR',{maximumFractionDigits:max});
    const date=(iso)=>iso?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso)):'—';
    const head=el('div','','stx-bonds-head');head.append(el('h3','Bitcoin Bonds'),link(SOURCE,en?'All bonds · Hiro ↗':'본드 전체 · Hiro ↗'));
    const summary=el('p',`${en?'Active bonds locked':'운영 중 본드 잠금 합계'} · ${number(totals.btc,4)} BTC / ${number(totals.stx,2)} STX`,'stx-bonds-summary');
    const grid=el('div','','stx-bonds-grid');
    for(const b of d.bonds){
      const funding=bondFunding(b);
      const timing=bondTiming(b),card=el('article','','stx-bond-card');
      const title=el('div','','stx-bond-title');
      title.append(el('strong',b.index===1?'Bond 1 · Genesis':`Bond ${b.index}`),el('span',b.status==='active'?(en?'Active':'운영 중'):b.status==='upcoming'?(en?'Upcoming':'개시 전'):(en?'Status: ':'상태: ')+b.status));card.append(title);
      const percent=funding.percent===null?'—':funding.percent===100?'100%':funding.percent>99.99?'>99.99%':`${number(funding.percent,2)}%`;
      const progress=el('div','','stx-bond-funding');
      progress.append(el('div',`${en?'Raised / capacity':'모집액 / 한도'} · ${number(funding.btc,8)} / ${number(funding.capacity,8)} BTC`),el('strong',percent));
      if(funding.percent!==null){const bar=el('progress');bar.max=100;bar.value=funding.percent;bar.setAttribute('aria-label',`Bond ${b.index} ${en?'BTC funding':'BTC 모집률'}`);progress.append(bar);}
      card.append(progress);
      const balances=el('div','','stx-bond-balances');
      const label=b.status==='active'?(en?'Locked':'잠금'):b.status==='upcoming'?(en?'Registered':'등록'):(en?'Reported balance':'보고 잔액');
      for(const [symbol,amount] of [['BTC',funding.btc],['STX',funding.stx]]){
        const value=bondUsd(amount,this.quotes[symbol.toLowerCase()]);
        const row=el('div');row.append(el('span',`${label} ${number(amount,symbol==='BTC'?8:6)} ${symbol}`),el('strong',value===null?'— USD':`$${number(value,2)}`));balances.append(row);
      }
      if(b.status==='upcoming')balances.append(el('small',en?'Provisional registrations, not activated locks':'개시 전 잠정 등록분 · 운영 중 잠금과 별도'));
      card.append(balances);
      const fields=el('dl');
      const field=(label,value,note)=>{const row=el('div'),dd=el('dd',value);if(note)dd.append(el('small',note));row.append(el('dt',label),dd);fields.append(row);};
      const height=n=>`BTC #${number(n,0)}`;
      field(en?'Start':'실행일',`${date(timing.startDate)}${timing.startEstimated?(en?' · est.':' · 예상'):''}`,height(b.schedule.activation.bitcoin_height));
      field(en?'BTC standard unlock':'BTC 표준 언락',timing.btcDate?`${date(timing.btcDate)} · ${en?'est.':'예상'}`:(en?'Check individual UTXO':'개별 UTXO 확인'),`${height(timing.btcHeight)} · ${en?'minimum / derived':'최소 기준·계산값'}`);
      field(en?'STX term end':'STX 만기',`${date(timing.stxDate)}${timing.stxEstimated?(en?' · est.':' · 예상'):''}`,height(b.schedule.unlock.bitcoin_height));
      card.append(fields,link(`https://explorer.hiro.so/staking/activity?bond=${b.index}&chain=mainnet`,en?'Bond activity ↗':'본드 활동 ↗'));grid.append(card);
    }
    const stale=Date.now()-Date.parse(d.sourceAsOf)>48*3600000;
    const asof=new Intl.DateTimeFormat(en?'en-GB':'ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(d.sourceAsOf));
    const note=el('p',`${stale?(en?'⚠ Old snapshot · ':'⚠ 오래된 스냅샷 · '):''}${en?'Source as of':'원본 기준'} ${asof} KST · ${en?'Scheduled refresh every 4h; last successful snapshot retained on failure.':'4시간마다 갱신 예정 · 실패 시 마지막 정상값 유지.'}`,'stx-bonds-note');
    const caveat=el('p',en?'Dates use KST. Future dates are estimates, not guaranteed deadlines. BTC standard minimum = STX term end − 1,050 Bitcoin blocks; estimate uses 10 min/block. Individual UTXO locks may be longer. STX extensions and pool withdrawal terms can differ. These are temporary locks, not burns or vesting unlocks.':'날짜는 KST. 미래 날짜는 블록 생성 속도에 따라 달라지는 예상치입니다. BTC 표준 최소 잠금 = STX 만기 − 1,050블록(날짜는 블록당 10분으로 계산). 개별 UTXO는 더 오래 잠길 수 있고, STX 연장·풀 출금 조건은 별도입니다. 소각이나 발행 물량의 베스팅 언락이 아닌 일시적 잠금입니다.','stx-bonds-note');
    caveat.append(document.createTextNode(' '),link(POLICY,'SIP-045 ↗'));
    const priceNote=el('p',en?'USD valuations use CoinGecko market quotes (not entry prices). Quotes older than 1h or unavailable show —. Refresh the page for a new quote.':'USD는 CoinGecko 시세 기준 평가액이며 가입 당시 금액이 아닙니다. 1시간 이상 지난 시세·조회 실패는 — 표시. 새로고침 시 시세를 다시 조회합니다.','stx-bonds-note');
    this.host.replaceChildren(head,summary,grid,priceNote,note,caveat);
  }
}
