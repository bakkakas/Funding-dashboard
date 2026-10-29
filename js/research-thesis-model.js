import {seoulDate,validDate} from './investment-plan-model.js?v=3';
export {seoulDate};
export const THESIS_KINDS={reason:'매수 이유',conditions:'투자 재고려 요건',issue:'종목 이슈'};
export function normalizeThesisItem(input){
 const kind=input.kind,body=String(input.body||'').trim();
 if(!Object.hasOwn(THESIS_KINDS,kind))throw Error('항목 종류를 확인해 주세요.');
 if(!body||body.length>(kind==='issue'?300:6000))throw Error(kind==='issue'?'이슈는 1~300자로 입력해 주세요.':'내용은 1~6,000자로 입력해 주세요.');
 const starts_on=kind==='issue'?input.starts_on:null,ends_on=kind==='issue'?input.ends_on:null;
 if(kind==='issue'&&(!validDate(starts_on||'')||!validDate(ends_on||'')||ends_on<starts_on))throw Error('표시 시작일과 종료일을 확인해 주세요. 종료일은 시작일 이후여야 해요.');
 const sentiment=kind==='issue'?(input.sentiment||null):null;
 if(sentiment!==null&&!['positive','negative'].includes(sentiment))throw Error('긍정 또는 부정을 선택해 주세요.');
 return {kind,body,starts_on,ends_on,sentiment};
}
export function issueState(item,today=seoulDate()){
 return today<item.starts_on?'예정':today>item.ends_on?'종료':'표시 중';
}
export function activeIssues(items,today=seoulDate()){
 return items.filter(i=>i.kind==='issue'&&issueState(i,today)==='표시 중').sort((a,b)=>a.ends_on.localeCompare(b.ends_on)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
export function issueDays(item,today=seoulDate()){
 return Math.round((Date.parse(item.ends_on+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
}
