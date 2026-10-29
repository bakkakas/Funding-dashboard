import {THESIS_KINDS,normalizeThesisItem,seoulDate,activeIssues,issueState,issueDays} from './research-thesis-model.js?v=1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=d=>`${Number(d.slice(5,7))}월${Number(d.slice(8,10))}일`;
const icons={edit:'<path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z"/>',delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'};
export class ResearchThesis {
 constructor(db,host){
  Object.assign(this,{db,host,version:0,user:null,key:null,dirty:false,busy:false,ready:false,items:[],editing:null,today:seoulDate()});
  host.innerHTML=`<section class="thesis-issues" aria-label="종목별 이슈"><div class="thesis-section-heading"><h3>종목 이슈</h3><button type="button" class="chip" data-add="issue">+ 이슈</button></div><div class="thesis-issue-badges" data-live-issues></div><div data-form-slot="issue"></div><details class="thesis-issue-manager"><summary>전체 이슈 관리 <span data-issue-count></span></summary><div data-items="issue"></div></details></section><div class="thesis-section-heading"><h3>나의 투자 원칙</h3><small data-asset-label></small></div><div class="thesis-columns">${['reason','conditions'].map(kind=>`<section><div class="thesis-section-heading"><h4>${THESIS_KINDS[kind]}</h4><button type="button" class="chip" data-add="${kind}">+ 추가</button></div><div data-items="${kind}"></div><div data-form-slot="${kind}"></div></section>`).join('')}</div><div class="thesis-editor" data-editor hidden><form><fieldset><h4 data-editor-title></h4><label>내용<textarea name="body" rows="2" maxlength="6000" required></textarea></label><div class="thesis-dates" data-dates hidden><label>표시 시작일<input type="date" name="starts_on" min="1900-01-01" max="2199-12-31"></label><label>표시 종료일<input type="date" name="ends_on" min="1900-01-01" max="2199-12-31"></label><small>한국시간 기준 · 종료일 다음 날 상단에서 숨겨져요.</small></div><div class="thesis-actions"><button type="submit" class="chip active">저장</button><button type="button" class="chip" data-cancel>취소</button></div></fieldset></form></div><div class="thesis-actions thesis-status"><span role="status"></span><button type="button" class="chip" data-retry hidden>다시 불러오기</button></div>`;
  this.form=this.q('form');this.editor=this.q('[data-editor]');this.status=this.q('[role=status]');this.retry=this.q('[data-retry]');
  this.form.oninput=()=>{this.dirty=true;this.status.textContent='저장하지 않은 변경사항';};
  this.form.onsubmit=e=>{e.preventDefault();void this.save();};
  this.retry.onclick=()=>{if(this.canLeave())void this.connect(this.user,this.key,this.label,true);};
  host.addEventListener('click',e=>{const add=e.target.closest('[data-add]'),edit=e.target.closest('[data-thesis-edit]'),del=e.target.closest('[data-thesis-delete]');if(add)this.open(add.dataset.add);if(edit){const item=this.items.find(i=>i.id===edit.dataset.thesisEdit);if(item)this.open(item.kind,item);}if(del)void this.remove(this.items.find(i=>i.id===del.dataset.thesisDelete));});
  this.q('[data-cancel]').onclick=()=>{if(this.canLeave())this.close();};
  window.addEventListener('beforeunload',e=>{if(this.dirty||this.busy){e.preventDefault();e.returnValue='';}});
  const tick=()=>{const today=seoulDate();if(today!==this.today){this.today=today;this.render();}};
  this.timer=setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});this.render();
 }
 q(s){return this.host.querySelector(s);}
 canLeave(){return !this.busy&&(!this.dirty||window.confirm('저장하지 않은 투자 메모를 버리고 이동할까요?'));}
 close(){this.dirty=false;this.editing=null;this.editor.hidden=true;this.form.reset();}
 async connect(user,key,label,force=false){
  if(!force&&this.user===user&&this.key===key)return;
  const version=++this.version;Object.assign(this,{user,key,label,ready:false,busy:false,items:[]});this.close();this.q('[data-asset-label]').textContent=label||'';this.retry.hidden=true;this.render();
  if(!user||!key){this.status.textContent='로그인하면 내 계정에 비공개로 저장돼요.';return;}
  this.status.textContent='저장된 항목 불러오는 중…';
  try{const items=[];for(let start=0;;start+=500){const {data,error}=await this.db.from('research_thesis_items').select('*').eq('user_id',user).eq('asset_key',key).order('created_at').order('id').range(start,start+499);if(version!==this.version)return;if(error)throw error;items.push(...data);if(data.length<500)break;}
   this.items=items;this.ready=true;this.status.textContent='내 계정 비공개 저장';
  }catch{if(version!==this.version)return;this.status.textContent='불러오기 실패. 기존 항목 보호를 위해 편집을 잠갔어요.';this.retry.hidden=false;}
  if(version===this.version)this.render();
 }
 controls(){for(const b of this.host.querySelectorAll('[data-add],[data-thesis-edit],[data-thesis-delete]'))b.disabled=!this.ready||this.busy;this.form.querySelector('fieldset').disabled=!this.ready||this.busy;this.retry.disabled=this.busy;}
 tools(i){return `<span class="thesis-item-tools">${['edit','delete'].map(action=>`<button type="button" data-thesis-${action}="${esc(i.id)}" title="${action==='edit'?'수정':'삭제'}" aria-label="${esc(i.body)} ${action==='edit'?'수정':'삭제'}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[action]}</svg></button>`).join('')}</span>`;}
 render(){
  for(const kind of Object.keys(THESIS_KINDS)){
   const items=this.items.filter(i=>i.kind===kind);
   this.q(`[data-items="${kind}"]`).innerHTML=items.map(i=>`<div class="thesis-item"><button type="button" class="thesis-item-text" data-thesis-edit="${esc(i.id)}" title="${esc(i.body)}">${kind==='issue'?`<small>${issueState(i,this.today)} · ${esc(i.starts_on)}~${esc(i.ends_on)}</small>`:''}<span>${esc(i.body)}</span></button>${this.tools(i)}</div>`).join('')||'<p class="thesis-empty">등록된 항목이 없어요.</p>';
  }
  const issues=activeIssues(this.items,this.today);
  this.q('[data-live-issues]').innerHTML=issues.map(i=>`<div class="thesis-issue-badge"><button type="button" class="thesis-issue-text" data-thesis-edit="${esc(i.id)}" title="${esc(i.body)} · 표시 ${esc(i.starts_on)}~${esc(i.ends_on)} · 종료일까지 D-${issueDays(i,this.today)}">D-${issueDays(i,this.today)} ${esc(i.body)} (${shortDate(i.ends_on)})</button>${this.tools(i)}</div>`).join('')||'<p class="thesis-empty">표시 기간에 해당하는 이슈가 없어요.</p>';
  this.q('[data-issue-count]').textContent=`(${this.items.filter(i=>i.kind==='issue').length})`;this.controls();
 }
 open(kind,item=null){
  if(!this.ready||this.busy||!this.canLeave())return;
  this.close();this.kind=kind;this.editing=item?{...item}:null;this.draftId=item?.id||crypto.randomUUID();this.q(`[data-form-slot="${kind}"]`).append(this.editor);
  this.q('[data-editor-title]').textContent=`${THESIS_KINDS[kind]} ${item?'수정':'추가'}`;
  this.form.elements.body.value=item?.body||'';this.form.elements.body.maxLength=kind==='issue'?300:6000;
  this.q('[data-dates]').hidden=kind!=='issue';
  for(const field of ['starts_on','ends_on']){this.form.elements[field].required=kind==='issue';this.form.elements[field].disabled=kind!=='issue';this.form.elements[field].value=item?.[field]||(kind==='issue'?this.today:'');}
  this.editor.hidden=false;this.form.elements.body.focus();
 }
 async save(){
  if(!this.ready||this.busy||!this.user||!this.key)return;
  let value;try{value=normalizeThesisItem({kind:this.kind,...Object.fromEntries(new FormData(this.form))});}catch(error){this.status.textContent=error.message;return;}
  const version=this.version;this.busy=true;this.controls();this.status.textContent='저장 중…';
  try{let query=this.db.from('research_thesis_items');query=this.editing?query.update(value).eq('id',this.editing.id).eq('user_id',this.user).eq('asset_key',this.key).eq('updated_at',this.editing.updated_at):query.insert({...value,id:this.draftId,user_id:this.user,asset_key:this.key});
   const {data,error}=await query.select().single();if(version!==this.version)return;if(error||!data)throw Error();
   this.items=this.editing?this.items.map(i=>i.id===data.id?data:i):[...this.items,data];this.close();this.status.textContent='저장 완료 · 계정 동기화';
  }catch{if(version===this.version){this.status.textContent='저장 실패 또는 다른 기기에서 변경됐어요. 입력은 유지돼요. 다시 저장하거나 다시 불러와 주세요.';this.retry.hidden=false;}}
  finally{if(version===this.version){this.busy=false;this.render();}}
 }
 async remove(item){
  if(!item||!this.ready||this.busy||!confirm(`‘${item.body}’ 항목을 삭제할까요?`))return;
  const version=this.version;this.busy=true;this.controls();
  try{const {data,error}=await this.db.from('research_thesis_items').delete().eq('id',item.id).eq('user_id',this.user).eq('asset_key',this.key).eq('updated_at',item.updated_at).select('id').single();if(version!==this.version)return;if(error||!data)throw Error();this.items=this.items.filter(i=>i.id!==item.id);if(this.editing?.id===item.id)this.close();this.status.textContent='삭제 완료';}
  catch{if(version===this.version){this.status.textContent='삭제 실패 또는 다른 기기에서 변경됐어요. 다시 불러와 확인해 주세요.';this.retry.hidden=false;}}
  finally{if(version===this.version){this.busy=false;this.render();}}
 }
}
