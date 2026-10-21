export const numeric=value=>value==null||value===''||value==='-'||value==='N/A'?null:Number.isFinite(Number(String(value).replaceAll(',','')))?Number(String(value).replaceAll(',','')):null;
export function priceChanges(rows,price,asOf) {
 const date=String(asOf||'').slice(0,10),end=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(end))return {d7:null,d30:null,y1:null};
 const clean=(Array.isArray(rows)?rows:[]).map(r=>({date:String(r.localDate||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),price:numeric(r.closePrice)})).filter(r=>r.price>0&&r.date<=date).sort((a,b)=>a.date.localeCompare(b.date));
 const out={};
 for(const [key,days] of [['d7',7],['d30',30],['y1',365]]){
  const target=new Date(end-days*86400000).toISOString().slice(0,10),base=clean.filter(r=>r.date<=target).at(-1);
  out[key]=base&&end-days*86400000-Date.parse(base.date)<=7*86400000&&numeric(price)>0?{value:(price/base.price-1)*100,baseDate:base.date,basePrice:base.price}:null;
 }
 return out;
}
export function financialQuarters(data) {
 const f=data?.financeInfo||data||{};
 return (f.trTitleList||[]).filter(t=>t.isConsensus==='N').map(t=>({period:t.title.replace(/\.$/,''),key:t.key,metrics:(f.rowList||[]).map(r=>({label:r.title,value:numeric(r.columns?.[t.key]?.value)})).filter(r=>r.value!==null)})).sort((a,b)=>b.key.localeCompare(a.key));
}
