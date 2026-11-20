import {seoulDate,validDate,isDue} from './investment-plan-model.js?v=4';
export const RULE_NUMBERS={capital:'배분 기준 총자산 (원)',protected_cash:'보호할 생활·운영자금 (원)',min_cash:'최소 현금 (원)',max_risk_pct:'위험자산 최대 비중 (%)',max_asset_pct:'한 종목 최대 비중 (%)',max_sector_pct:'한 산업 최대 비중 (%)',loss_limit:'추가 손실 재검토 기준 (원)',current_cash:'현재 확보 현금 (원)',current_risk:'현재 위험자산 총노출 (원)'};
export const PLAN_TEXT={target:'종목·ETF 이름',sector:'산업·분산자산 분류',thesis:'투자 이유',horizon:'예상 보유 기간',add_rule:'추가 매수 조건',invalidation:'판단 무효화 조건과 대응',exit_rule:'이익 실현·비중 축소 조건',review_notes:'종료·복기 메모'};
export const STATES={draft:'작성 중',watch:'관찰',holding:'보유',closed:'종료·복기'};
export const CHECKS={unknown:'미확인',met:'충족',unmet:'미충족'};
const str=(v,max=4000)=>{const s=String(v??'').trim();if(s.length>max)throw Error(`입력은 ${max}자 이내로 적어 주세요.`);return s;};
const number=(v,max=1e14)=>{if(v===''||v==null)return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw Error('금액은 0 이상, 비중은 0~100으로 입력해 주세요.');return n;};
const date=v=>{if(!v)return '';if(!validDate(v))throw Error('유효한 날짜를 입력해 주세요.');return v;};
const option=(v,values,fallback)=>{const s=v||fallback;if(!values.includes(s))throw Error('선택 값을 확인해 주세요.');return s;};
export function normalizeRules(v={}){
 const r={};for(const k of Object.keys(RULE_NUMBERS))r[k]=number(v[k],k.endsWith('_pct')?100:1e14);
 r.leverage=option(v.leverage,['none','review'],'none');r.loss_action=str(v.loss_action);r.notes=str(v.notes);r.checked_on=date(v.checked_on);
 if(r.capital===0)throw Error('총자산은 0보다 커야 해요.');
 if(r.capital!=null&&['protected_cash','min_cash','current_cash'].some(k=>r[k]!=null&&r[k]>r.capital))throw Error('현금·보호자금이 총자산을 초과해요. 배분 기준을 확인해 주세요.');
 return r;
}
export function normalizeExecution(v={}){
 const p={};for(const k of Object.keys(PLAN_TEXT))p[k]=str(v[k],k==='target'||k==='sector'?120:4000);
 if(!p.target)throw Error('종목·ETF 이름을 입력해 주세요.');
 p.mode=option(v.mode,['active','scheduled'],'active');p.instrument=option(v.instrument,['spot','leveraged'],'spot');p.state=option(v.state,Object.keys(STATES),'draft');p.logic=option(v.logic,['all','any'],'all');
 for(const k of ['initial_pct','max_pct'])p[k]=number(v[k],100);
 for(const k of ['current_value','sector_value'])p[k]=number(v[k]);
 if(p.initial_pct!=null&&p.max_pct!=null&&p.initial_pct>p.max_pct)throw Error('최초 매수 비중은 최대 보유 비중 이하여야 해요.');
 if(p.current_value!=null&&p.sector_value!=null&&p.current_value>p.sector_value)throw Error('산업 총노출은 해당 종목 노출 이상이어야 해요.');
 p.checked_on=date(v.checked_on);p.review_on=date(v.review_on);
 if(!Array.isArray(v.conditions)||v.conditions.length>12)throw Error('진입 조건은 최대 12개예요.');
 p.conditions=v.conditions.map(c=>({text:str(c.text,600),status:option(c.status,Object.keys(CHECKS),'unknown'),evidence:str(c.evidence,1000),checked_on:date(c.checked_on)})).filter(c=>c.text);
 if(!Array.isArray(v.context_ids)||v.context_ids.length>100)throw Error('연결할 시장 판단을 확인해 주세요.');
 p.context_ids=[...new Set(v.context_ids.map(x=>str(x,60)))];
 return p;
}
export function assessPlan(r,p,contexts=[],today=seoulDate()){
 const reasons=[];let room=null,amount=null;
 if(!r)reasons.push('공통 투자 규칙 미저장');
 else{
  if(Object.keys(RULE_NUMBERS).some(k=>r[k]==null)||!r.loss_action?.trim())reasons.push('공통 규칙·현황에 미정 항목 있음');
  if(r.loss_limit===0)reasons.push('추가 손실 허용 기준 0원 · 위험 투자 재검토 필요');
  if(r.checked_on!==today)reasons.push('공통 자금 현황을 오늘 기준으로 확인 필요');
  if(r.capital>0&&['current_cash','current_risk','protected_cash','min_cash','max_risk_pct'].every(k=>r[k]!=null)){
   // Protected funds and minimum cash are floors, not additive obligations.
   room=Math.max(0,Math.min(r.current_cash-Math.max(r.protected_cash,r.min_cash),r.capital*r.max_risk_pct/100-r.current_risk));
   if(r.current_cash<Math.max(r.protected_cash,r.min_cash))reasons.push('보호자금·최소 현금 미확보');
   if(r.current_risk>r.capital*r.max_risk_pct/100)reasons.push('현재 위험자산 상한 초과');
  }
 }
 for(const [k,label]of Object.entries({thesis:'투자 이유',horizon:'보유 기간',sector:'산업 분류',add_rule:'추가 매수 조건',invalidation:'판단 무효화·대응',exit_rule:'축소 조건'}))if(!p[k]?.trim())reasons.push(`${label} 미정`);
 if(p.initial_pct==null||p.max_pct==null||p.current_value==null||p.sector_value==null)reasons.push('계획 비중·현재 노출 미정');
 if(p.initial_pct===0)reasons.push('최초 매수 비중 0%');
 if(p.checked_on!==today)reasons.push('종목·산업 노출을 오늘 기준으로 확인 필요');
 if(!p.review_on||p.review_on<=today)reasons.push('다음 검토일 설정·갱신 필요');
 if(p.instrument==='leveraged')reasons.push(r?.leverage==='none'?'레버리지 사용 안 함 규칙':'레버리지 청산·담보 위험 별도 검토 필요');
 if(r?.current_risk!=null&&p.sector_value!=null&&p.sector_value>r.current_risk)reasons.push('산업 노출이 전체 위험자산 노출을 초과함 · 현황 확인 필요');
 if(r?.capital>0&&p.initial_pct!=null){
  amount=r.capital*p.initial_pct/100;
  if(room!=null&&amount>room+0.01)reasons.push('최초 매수액이 남은 투자 여력 초과');
  if(p.max_pct!=null&&r.max_asset_pct!=null&&p.max_pct>r.max_asset_pct)reasons.push('종목 최대 비중이 공통 상한 초과');
  if(p.current_value!=null&&p.max_pct!=null&&p.current_value+amount>r.capital*p.max_pct/100+0.01)reasons.push('기존 보유 + 최초 매수액이 종목 상한 초과');
  if(p.sector_value!=null&&r.max_sector_pct!=null&&p.sector_value+amount>r.capital*r.max_sector_pct/100+0.01)reasons.push('기존 산업 노출 + 최초 매수액이 산업 상한 초과');
 }
 const conditions=p.conditions||[],freshMet=c=>c.status==='met'&&c.checked_on===today&&!!c.evidence?.trim()&&(!p.review_on||p.review_on>today);
 const met=conditions.filter(freshMet).length;
 if(!conditions.length)reasons.push(p.mode==='scheduled'?'적립 일정·실행 조건 미작성':'진입 조건 미작성');
 else if(p.logic==='any'?met===0:met!==conditions.length)reasons.push(p.logic==='any'?'진입 조건 중 1개 이상 확인 필요':'진입 조건 모두 확인 필요');
 const linked=(p.context_ids||[]).map(id=>contexts.find(c=>c.id===id));
 if(linked.some(c=>!c||c.state!=='active'||isDue(c,today)))reasons.push('연결한 시장 판단이 삭제·해소·만료됨');
 const ready=reasons.length===0&&p.state==='watch';
 return {ready,reasons,room,amount,met,total:conditions.length,label:ready?'조건 충족 · 검토 가능':STATES[p.state]||'작성 중'};
}
