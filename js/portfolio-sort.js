export function sortAssetsByValue(assets,direction,getValue){
  const sorted=[...assets];
  if(direction!=='asc'&&direction!=='desc')return sorted;
  const multiplier=direction==='asc'?1:-1;
  return sorted.sort((a,b)=>(getValue(a)-getValue(b))*multiplier);
}
