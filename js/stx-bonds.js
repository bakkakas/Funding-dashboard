const SOURCE='https://explorer.hiro.so/staking/bonds?chain=mainnet';
const POLICY='https://github.com/stacksgov/sips/blob/main/sips/sip-045/sip-045-pox-5-bitcoin-staking.md';
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const link=(href,text)=>{const node=el('a',text);node.href=href;node.target='_blank';node.rel='noopener noreferrer';return node;};
export function atomicAmount(value,decimals){
  if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('Invalid bond balance');
  const raw=BigInt(value),base=10n**BigInt(decimals);
  return Number(raw/base)+Number(raw%base)/Number(base);
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
    const request=++this.request;this.language=language;this.data=null;this.host.hidden=id!=='stx';
    if(this.host.hidden)return;
    this.host.replaceChildren(el('p',language==='en'?'Loading Bitcoin bonds…':'Bitcoin Bond 불러오는 중…'));
    try{const data=validateStxBonds(await this.fetchJson('./data/stx-bonds.json',{signal}));if(request!==this.request)return;this.data=data;this.render();}
    catch(error){if(request!==this.request)return;this.host.replaceChildren(el('p',this.language==='en'?'Bond data unavailable. Check the source.':'본드 데이터 조회 실패 · 원문에서 확인해 주세요.'),link(SOURCE,'Hiro Explorer ↗'));}
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
      const timing=bondTiming(b),card=el('article','','stx-bond-card');
      const title=el('div','','stx-bond-title');
      title.append(el('strong',b.index===1?'Bond 1 · Genesis':`Bond ${b.index}`),el('span',b.status==='active'?(en?'Active':'운영 중'):b.status==='upcoming'?(en?'Upcoming':'개시 전'):(en?'Status: ':'상태: ')+b.status));card.append(title);
      const fields=el('dl');
      const field=(label,value,note)=>{const row=el('div'),dd=el('dd',value);if(note)dd.append(el('small',note));row.append(el('dt',label),dd);fields.append(row);};
      const height=n=>`BTC #${number(n,0)}`;
      field(en?'Start':'실행일',`${date(timing.startDate)}${timing.startEstimated?(en?' · est.':' · 예상'):''}`,height(b.schedule.activation.bitcoin_height));
      field(b.status==='upcoming'?(en?'Registered BTC / STX':'등록 BTC / STX'):(en?'Locked BTC / STX':'잠금 BTC / STX'),`${number(atomicAmount(b.balances.locked.btc,8),4)} BTC / ${number(atomicAmount(b.balances.locked.stx,6),2)} STX`,b.status==='upcoming'?(en?'Provisional, not final activated principal':'잠정 등록분 · 최종 실행액 아님'):null);
      if(b.status==='upcoming')field(en?'BTC capacity':'BTC 모집 한도',`${number(atomicAmount(b.parameters.btc_capacity,8),4)} BTC`,en?'Capacity ≠ deposits':'한도 ≠ 실제 예치량');
      field(en?'BTC standard unlock':'BTC 표준 언락',timing.btcDate?`${date(timing.btcDate)} · ${en?'est.':'예상'}`:(en?'Check individual UTXO':'개별 UTXO 확인'),`${height(timing.btcHeight)} · ${en?'minimum / derived':'최소 기준·계산값'}`);
      field(en?'STX term end':'STX 만기',`${date(timing.stxDate)}${timing.stxEstimated?(en?' · est.':' · 예상'):''}`,height(b.schedule.unlock.bitcoin_height));
      card.append(fields,link(`https://explorer.hiro.so/staking/activity?bond=${b.index}&chain=mainnet`,en?'Bond activity ↗':'본드 활동 ↗'));grid.append(card);
    }
    const stale=Date.now()-Date.parse(d.sourceAsOf)>48*3600000;
    const asof=new Intl.DateTimeFormat(en?'en-GB':'ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(d.sourceAsOf));
    const note=el('p',`${stale?(en?'⚠ Old snapshot · ':'⚠ 오래된 스냅샷 · '):''}${en?'Source as of':'원본 기준'} ${asof} KST · ${en?'Scheduled refresh every 4h; last successful snapshot retained on failure.':'4시간마다 갱신 예정 · 실패 시 마지막 정상값 유지.'}`,'stx-bonds-note');
    const caveat=el('p',en?'Dates use KST. Future dates are estimates, not guaranteed deadlines. BTC standard minimum = STX term end − 1,050 Bitcoin blocks; estimate uses 10 min/block. Individual UTXO locks may be longer. STX extensions and pool withdrawal terms can differ. These are temporary locks, not burns or vesting unlocks.':'날짜는 KST. 미래 날짜는 블록 생성 속도에 따라 달라지는 예상치입니다. BTC 표준 최소 잠금 = STX 만기 − 1,050블록(날짜는 블록당 10분으로 계산). 개별 UTXO는 더 오래 잠길 수 있고, STX 연장·풀 출금 조건은 별도입니다. 소각이나 발행 물량의 베스팅 언락이 아닌 일시적 잠금입니다.','stx-bonds-note');
    caveat.append(document.createTextNode(' '),link(POLICY,'SIP-045 ↗'));
    this.host.replaceChildren(head,summary,grid,note,caveat);
  }
}
