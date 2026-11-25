export const GOLD_ENTRY={id:'gold',name:'금 · Gold',symbol:'XAU',kind:'gold',category:'원자재',logo:new URL('../assets/gold.svg',import.meta.url).href};
export const GOLD_LABELS={gold:'금',sp500:'S&P 500',NASDAQCOM:'나스닥 종합',DGS10:'미국 10년 국채금리',DFF:'연방기금 실효금리',DFII10:'미국 10년 실질금리'};
export function validateGold(data){
 if(data?.schemaVersion!==1)throw Error('지원하지 않는 금 자료');
 for(const key of Object.keys(GOLD_LABELS)){
  const values=data.series?.[key]?.values;
  if(!Array.isArray(values)||!values.length)throw Error('금 비교 자료 누락');
  let prev='';for(const row of values){if(!Array.isArray(row)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row[0])||row[0]<=prev||!Number.isFinite(row[1])||(['gold','sp500','NASDAQCOM'].includes(key)&&row[1]<=0))throw Error('금 비교 자료 오류');prev=row[0];}
 }
 return data;
}
export function performance(values){
 const points=values.filter(Number.isFinite);if(points.length<2)return {change:null,mdd:null};
 let peak=points[0],mdd=0;for(const value of points){peak=Math.max(peak,value);mdd=Math.min(mdd,(value/peak-1)*100);}
 return {change:(points.at(-1)/points[0]-1)*100,mdd};
}
export function goldWindow(data,{rate='DGS10',visible={rate:true,sp500:true,NASDAQCOM:true},period='all',from='',to=''}={}){
 const keys=['gold',...(visible.sp500?['sp500']:[]),...(visible.NASDAQCOM?['NASDAQCOM']:[]),...(visible.rate?[rate]:[])];
 const maps=Object.fromEntries(keys.map(k=>[k,new Map(data.series[k].values)]));
 const common=data.series.gold.values.map(r=>r[0]).filter(m=>keys.every(k=>maps[k].has(m)));
 if(!common.length)return {months:[],keys,rows:{},reason:'공통 자료가 없습니다.'};
 let start=common[0],end=common.at(-1);
 if(period==='custom'){if(from)start=from;if(to)end=to;if(start>end)return {months:[],keys,rows:{},reason:'시작월이 종료월보다 늦습니다.'};}
 else if(period!=='all'){const year=Number(end.slice(0,4))-Number(period);start=String(year)+end.slice(4);}
 const chosen=common.filter(m=>m>=start&&m<=end);
 if(chosen.length<2)return {months:[],keys,rows:{},reason:'선택 구간의 공통 관측값이 2개 이상 필요합니다.'};
 start=chosen[0];end=chosen.at(-1);
 const months=[];let [y,m]=start.split('-').map(Number);while(`${y}-${String(m).padStart(2,'0')}`<=end){months.push(`${y}-${String(m).padStart(2,'0')}`);if(++m===13){m=1;y++;}}
 const rows=Object.fromEntries(keys.map(k=>{const raw=months.map(m=>maps[k].get(m)??null),base=raw[0];return [k,{raw,indexed:k===rate?null:raw.map(v=>v===null?null:v/base*100),...(k===rate?{change:null,mdd:null}:performance(raw)),rateChange:raw.at(-1)-base}];}));
 return {months,keys,rows,start,end};
}

// Correlate consecutive, paired changes, never levels or bridged missing periods.
export function goldCorrelations(window, rate='DGS10'){
 const gold=window.rows.gold?.raw||[];
 return Object.fromEntries(window.keys.filter(k=>k!=='gold').map(k=>{
  const other=window.rows[k].raw,pairs=[];
  for(let i=1;i<gold.length;i++){
   if(![gold[i-1],gold[i],other[i-1],other[i]].every(Number.isFinite))continue;
   pairs.push([gold[i]/gold[i-1]-1,k===rate?other[i]-other[i-1]:other[i]/other[i-1]-1]);
  }
  const n=pairs.length;
  if(n<3)return [k,{value:null,n,reason:'관측쌍 3개 이상 필요'}];
  const mx=pairs.reduce((s,p)=>s+p[0],0)/n,my=pairs.reduce((s,p)=>s+p[1],0)/n;
  let xx=0,yy=0,xy=0;
  for(const [x,y] of pairs){xx+=(x-mx)**2;yy+=(y-my)**2;xy+=(x-mx)*(y-my);}
  return [k,{value:xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null,n,reason:xx>0&&yy>0?'':'변동이 없어 계산 불가'}];
 }));
}
