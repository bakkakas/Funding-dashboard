import { allocationClass } from './portfolio-allocation.js?v=1';
export const balanceName = a => String(a.nickname || '').trim();
export const balanceMode = b => b?.mode || 'manual';
export function validBalance(b) {
  return b && typeof b.enabled === 'boolean' && typeof b.amount === 'number' && Number.isFinite(b.amount) && b.amount >= 0 && b.amount <= 1e15 && ['KRW','USD'].includes(b.currency) && ['stock','crypto','commodity','cash'].includes(b.asset_class) && typeof b.excluded_from_total === 'boolean' && ['manual','auto_cash'].includes(balanceMode(b));
}
export function activeBalances(assets, balances = {}) {
  const names = new Set(assets.map(balanceName));
  return Object.entries(balances).filter(([name,b]) => names.has(name) && b?.enabled === true).map(([name,b]) => {
    if (!validBalance(b)) throw Error('수동 잔액 설정이 올바르지 않습니다.');
    return [name,b];
  });
}
const stableQuotes = new Set(['FIXED:USD','CG:tether','CG:usd-coin','CG:ethena-usde','CG:dai']);
const isCash = a => allocationClass(a)==='cash' || stableQuotes.has(a.quote_symbol);
export function platformDetailInputs({assets=[],cryptoEntries=[],cryptoTotalSource='assets'},name) {
  return {
    assets:assets.filter(a=>balanceName(a)===name && !isCash(a) && !(cryptoTotalSource==='details'&&a.asset_class==='crypto')),
    cryptoEntries:cryptoTotalSource==='details'?cryptoEntries.filter(e=>String(e.location||'').trim()===name && !isCash(e)):[],
  };
}
// Only quotes that can affect the resulting valuation are required.
export function portfolioQuoteInputs({assets=[],cryptoEntries=[],platformBalances={},cryptoTotalSource='assets'}={}) {
  const active=activeBalances(assets,platformBalances),names=new Set(active.map(([n])=>n));
  const result={assets:assets.filter(a=>!names.has(balanceName(a))),cryptoEntries:cryptoEntries.filter(e=>!names.has(String(e.location||'').trim()))};
  for(const [name,b] of active)if(balanceMode(b)==='auto_cash'){
    const detail=platformDetailInputs({assets,cryptoEntries,cryptoTotalSource},name);
    result.assets.push(...detail.assets);result.cryptoEntries.push(...detail.cryptoEntries);
  }
  return result;
}
export function autoCashBreakdown({assets=[],cryptoEntries=[],cryptoTotalSource='assets',assetValue=()=>NaN,cryptoValue=()=>NaN,fx},name,b) {
  if(!Number.isFinite(fx)||fx<=0)throw Error('환율 조회 실패 — 자동 Cash 계산 보류');
  const total=b.amount*(b.currency==='USD'?fx:1),detail=platformDetailInputs({assets,cryptoEntries,cryptoTotalSource},name),parts=[];
  for(const [items,valueOf,isCrypto] of [[detail.assets,assetValue,false],[detail.cryptoEntries,cryptoValue,true]])for(const a of items){
    const raw=Number(valueOf(a));
    if(!Number.isFinite(raw)||raw<0)throw Error(`${name||'미지정'}: 세부 시세 조회 실패 — 자동 Cash 계산 보류`);
    const stable=isCrypto?0:Math.min(raw,Math.max(0,Number(a.stable_amount_krw)||0)*(a.stable_currency==='USD'?fx:1));
    parts.push({id:a.id,asset_class:isCrypto?'crypto':allocationClass(a),value:raw-stable});
  }
  const invested=parts.reduce((sum,p)=>sum+p.value,0),remaining=total-invested;
  if(remaining < -Math.max(0.01,total*1e-12))throw Error(`${name||'미지정'}: 세부 자산이 총잔액을 ${Math.ceil(-remaining).toLocaleString('ko-KR')}원 초과해. 총잔액 또는 세부 내역을 수정해.`);
  return {total,invested,cash:Math.max(0,remaining),parts};
}
export function effectivePortfolio({assets=[],cryptoEntries=[],platformBalances={},cryptoTotalSource='assets',assetValue,cryptoValue,fx}={}) {
  const active = activeBalances(assets, platformBalances), names = new Set(active.map(([name])=>name));
  const replacements=[];
  for(const [name,b] of active){
    const make=(id,asset_class,value,currency='KRW',stable=0)=>({id:`platform-balance:${name}:${id}`,nickname:name,manual_platform:true,asset_class:'cash',allocation_class:asset_class,currency,cash_amount_krw:currency==='KRW'?value:0,cash_amount_usd:currency==='USD'?value:0,stable_amount_krw:stable,stable_currency:'KRW',excluded_from_total:b.excluded_from_total});
    if(balanceMode(b)==='manual')replacements.push(make('manual',b.asset_class,b.amount,b.currency));
    else{
      const result=autoCashBreakdown({assets,cryptoEntries,cryptoTotalSource,assetValue,cryptoValue,fx},name,b);
      result.parts.forEach((p,i)=>replacements.push(make(`detail:${i}`,p.asset_class,p.value)));
      replacements.push(make('cash','cash',result.cash,'KRW',result.cash));
    }
  }
  return {assets:[...assets.filter(a=>!names.has(balanceName(a))),...replacements],cryptoEntries:cryptoEntries.filter(e=>!names.has(String(e.location||'').trim()))};
}
