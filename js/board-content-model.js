export const WIDTHS=['auto','full','half','third','quarter'];
export const emptyContent=()=>({texts:{},blocks:{},custom:[]});
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)!==null;
export function normalizeContent(raw){
 if(!object(raw)||!object(raw.texts)||!object(raw.blocks)||!Array.isArray(raw.custom))throw Error('편집 형식을 확인해 주세요.');
 if(Object.keys(raw).some(k=>!['texts','blocks','custom'].includes(k)))throw Error('알 수 없는 편집 항목');
 const out=emptyContent();
 if(Object.keys(raw.texts).length>500||Object.keys(raw.blocks).length>200||raw.custom.length>40)throw Error('편집 항목이 너무 많아요.');
 for(const [id,text] of Object.entries(raw.texts)){if(!key(id)||typeof text!=='string'||text.length>6000)throw Error('문구는 6,000자 이내로 입력해 주세요.');out.texts[id]=text;}
 for(const [id,b] of Object.entries(raw.blocks)){
  if(!key(id)||!object(b)||Object.keys(b).some(k=>!['width','height','hidden','order'].includes(k)))throw Error('박스 설정 형식 오류');
  if(!WIDTHS.includes(b.width)||!Number.isInteger(b.height)||b.height<0||b.height>1200||typeof b.hidden!=='boolean'||!Number.isInteger(b.order)||b.order<0||b.order>1000)throw Error('박스 크기 또는 순서를 확인해 주세요.');
  out.blocks[id]={width:b.width,height:b.height,hidden:b.hidden,order:b.order};
 }
 const ids=new Set();
 for(const c of raw.custom){
  if(!object(c)||!/^custom-[a-f0-9-]{36}$/.test(c.id)||ids.has(c.id)||!key(c.group)||typeof c.title!=='string'||c.title.length>160||typeof c.body!=='string'||c.body.length>6000||(!c.title.trim()&&!c.body.trim()))throw Error('추가 문구를 확인해 주세요.');
  ids.add(c.id);out.custom.push({id:c.id,group:c.group,title:c.title,body:c.body});
 }
 if(new TextEncoder().encode(JSON.stringify(out)).length>100000)throw Error('편집 내용이 저장 한도를 넘었어요.');
 return out;
}
export function pageKey(path,search,plan=false,language='ko'){
 const file=path.split('/').pop()||'index.html',lang=language==='en'?'en':'ko';
 if(file==='investment-setup.html'){
  const asset=new URLSearchParams(search).get('asset')||'ethfi';
  return `investment:${plan?'plan':/^[a-zA-Z0-9-]{1,80}$/.test(asset)?asset:'other'}:${lang}`;
 }
 return ({'index.html':'funding','foreign-flow.html':'foreign','my-assets.html':'portfolio'}[file]||'funding')+':'+lang;
}
