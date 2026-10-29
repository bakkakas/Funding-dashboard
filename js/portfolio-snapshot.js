import { calculatePortfolioTotals } from './portfolio-totals.js';
import { cashValueKrw } from './cash-balances.js';

// Shared by the daily collector and browser: never persist incomplete valuations.
export async function valuePortfolio({ assets=[], cryptoEntries=[], cryptoTotalSource='assets', fx, quote }) {
  if (!Number.isFinite(fx) || fx <= 0) throw Error('환율 조회 실패');
  const values = new Map();
  for (const item of [...assets, ...cryptoEntries]) {
    let value;
    if (item.asset_class === 'cash') value = cashValueKrw(item, fx);
    else {
      const quantity=Number(item.quantity), price=Number(await quote(item));
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) throw Error('시세 조회 실패');
      value=quantity*price*(item.currency==='USD'?fx:1);
    }
    if (!Number.isFinite(value) || value < 0) throw Error('평가액 계산 실패');
    values.set(item.id,value);
  }
  const source=cryptoTotalSource==='details'&&cryptoEntries.length?'details':'assets';
  const totals=calculatePortfolioTotals({assets,cryptoEntries,cryptoTotalSource:source,assetValue:a=>values.get(a.id),cryptoValue:a=>values.get(a.id)});
  // Classification intentionally includes total-excluded assets, matching the allocation UI.
  const class_values=Object.fromEntries(['stock','crypto','commodity','cash'].map(k=>[k,k==='crypto'?totals.cryptoTotal:assets.filter(a=>a.asset_class===k).reduce((s,a)=>s+values.get(a.id),0)]));
  class_values.stable=assets.reduce((s,a)=>s+(Number(a.stable_amount_krw)||0)*(a.stable_currency==='USD'?fx:1),0);
  return {total_value_krw:totals.total,class_values};
}
export const snapshotDate = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
