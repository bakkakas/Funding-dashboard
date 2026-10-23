export const IMPACTS = [[-3,'매우 부정'],[-2,'부정'],[-1,'약간 부정적'],[1,'약간 긍정적'],[2,'긍정적'],[3,'매우 긍정적']];
export const CATEGORIES = {macro:'매크로',geopolitics:'지정학',industry:'산업군',asset:'자산·종목',personal:'개인 자금 계획',other:'기타'};
export const SCOPES = {all:'전체',asset_class:'자산군',industry:'산업군',asset:'특정 종목'};
export function seoulDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=t=>parts.find(p=>p.type===t).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2199-12-31';
}
export function isDue(item,today=seoulDate()) {return item.state==='active'&&!!item.expires_on&&item.expires_on<=today;}
export function normalizePlan(input) {
 const title=String(input.title||'').trim(), category=input.category, kind=input.kind, impact=Number(input.impact), scope=input.scope||'all';
 const target=scope==='all'?'':String(input.target||'').trim(), notes=String(input.notes||'').trim();
 if(!title||title.length>300)throw Error('내용은 1~300자로 입력해 주세요.');
 if(!Object.hasOwn(CATEGORIES,category)||!['fact','forecast'].includes(kind))throw Error('카테고리와 사실/예상을 선택해 주세요.');
 if(!IMPACTS.some(([v])=>v===impact))throw Error('매수 영향 6단계 중 하나를 선택해 주세요.');
 if(!Object.hasOwn(SCOPES,scope)||(scope!=='all'&&!target)||target.length>120)throw Error('적용 대상의 이름을 입력해 주세요.');
 if(notes.length>4000)throw Error('근거·메모는 4,000자 이내로 입력해 주세요.');
 const expires_on=input.expires_on||null, cash_date=category==='personal'?(input.cash_date||null):null;
 if([expires_on,cash_date].some(d=>d&&!validDate(d)))throw Error('유효한 날짜를 선택해 주세요.');
 const cash_amount=category==='personal'&&input.cash_amount!==''&&input.cash_amount!=null?Number(input.cash_amount):null;
 if(cash_amount!==null&&(!Number.isFinite(cash_amount)||cash_amount<0||cash_amount>1e14))throw Error('예정 필요 금액은 0~100조 원으로 입력해 주세요.');
 const liquidity=category==='personal'?(input.liquidity||'unsure'):'unsure';
 if(!['room','balanced','tight','unsure'].includes(liquidity))throw Error('자금 상황을 선택해 주세요.');
 const state=input.state||'active';if(!['active','resolved'].includes(state))throw Error('항목 상태를 확인해 주세요.');
 return {title,category,kind,impact,scope,target,notes,expires_on,cash_date,cash_amount,liquidity,state};
}
export function filterPlans(items,{category='',target='',scope='',state='active'}={},today=seoulDate()) {
 return items.filter(i=>(!category||i.category===category)&&(!target||i.scope==='all'||(i.target===target&&(!scope||i.scope===scope)))&&(state==='all'||(state==='due'?isDue(i,today):i.state===state)))
 .sort((a,b)=>Number(isDue(b,today))-Number(isDue(a,today))||String(b.created_at).localeCompare(String(a.created_at)));
}

// Preserve existing signed impact storage while exposing a 1–6 point scale.
export function impactScore(impact) {const index=IMPACTS.findIndex(([value])=>value===impact);return index<0?null:index+1;}
export function planScores(items,today=seoulDate()) {
 const fresh=items.filter(i=>i.state==='active'&&!isDue(i,today)&&impactScore(i.impact)!==null);
 const global=fresh.filter(i=>i.scope==='all');
 const summarize=(scope,target,specific)=>{
  const rows=scope==='all'?global:[...global,...specific];
  const total=rows.reduce((sum,i)=>sum+impactScore(i.impact),0),count=rows.length;
  return {scope,target,count,total,max:count*6,average:count?total/count:null,globalCount:global.length,specificCount:specific.length};
 };
 const groups=new Map();
 // Keep scopes with expired/resolved records visible, without scoring those records.
 for(const i of items){if(i.scope==='all')continue;const key=JSON.stringify([i.scope,i.target]);if(!groups.has(key))groups.set(key,{scope:i.scope,target:i.target});}
 return [summarize('all','전체 공통',[]),...[...groups.values()].sort((a,b)=>a.scope.localeCompare(b.scope)||a.target.localeCompare(b.target,'ko')).map(g=>summarize(g.scope,g.target,fresh.filter(i=>i.scope===g.scope&&i.target===g.target)))];
}
