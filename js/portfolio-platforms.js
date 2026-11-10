// Presentation grouping only: never merge or rewrite persisted holdings.
export function platformName(asset){return String(asset.nickname||'').trim();}
export function groupPlatformAssets(assets){
  const groups=new Map();
  for(const asset of assets){const name=platformName(asset);if(!groups.has(name))groups.set(name,{name,assets:[]});groups.get(name).assets.push(asset);}
  return [...groups.values()];
}
export function platformTotals(assets,valueOf,cryptoTotalSource='assets'){
  return assets.reduce((totals,asset)=>{const value=Number(valueOf(asset))||0;totals.value+=value;if(!asset.excluded_from_total&&!(cryptoTotalSource==='details'&&asset.asset_class==='crypto'))totals.included+=value;return totals;},{value:0,included:0});
}
