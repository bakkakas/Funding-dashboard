import {authClient} from './auth.js?v=1';
import {emptyContent,normalizeContent,pageKey,WIDTHS} from './board-content-model.js?v=1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=v=>JSON.parse(JSON.stringify(v));
const widthLabels={auto:'기본',full:'전체',half:'1/2',third:'1/3',quarter:'1/4'};
const groupNames={'funding-main':'Funding 전체 구성','funding-top':'펀딩 요약','funding-charts':'펀딩 차트','foreign-summary':'수급 요약','foreign-charts':'수급 차트','portfolio-summary':'자산 요약','portfolio-main':'내 자산','research-main':'종목 분석 구성','stock-sections':'주식 상세','crypto-sections':'크립토 상세','plan-sections':'투자 계획'};
export class BoardEditor {
 constructor(db,root=document){
  Object.assign(this,{db,root,content:emptyContent(),published:emptyContent(),version:0,allowed:false,editing:false,preview:false,dirty:false,busy:false,generation:0,authGeneration:0,originals:new WeakMap(),blocks:new Map(),texts:new Map(),groups:new Map(),selected:null,key:'',loaded:false});
  this.mount();this.observer=new MutationObserver(()=>this.schedule());this.observe();
  this.timer=setInterval(()=>this.schedule(),1000);
  this.unload=e=>{if(this.dirty||this.busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',this.unload);
  this.capture=e=>{
   if(e.target.closest('[data-board-ui]'))return;
   if((this.dirty||this.busy)&&e.target.closest('a[href], [data-panel], [data-asset-id], [data-select-asset], .report-list-row, #langKoButton, #langEnButton')){
    if(this.busy||!confirm('게시하지 않은 편집 내용이 있어요. 저장하지 않고 이동할까요?')){e.preventDefault();e.stopImmediatePropagation();return;}
    this.dirty=false;
   }
   if(!this.editing||this.preview)return;
   const text=e.target.closest('[data-board-text]'),block=e.target.closest('[data-board-block]');
   if(text||block){e.preventDefault();e.stopImmediatePropagation();this.select(text?'text':'block',text?.dataset.boardText||block.dataset.boardBlock);}
  };document.addEventListener('click',this.capture,true);
  this.schedule();
 }
 observe(){this.observer.observe(this.root.body||this.root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});}
 q(s){return this.ui.querySelector(s);}
 status(text){this.q('[data-status]').textContent=text;}
 currentKey(){return pageKey(location.pathname,location.search,document.querySelector('#planPanel')?.hidden===false,localStorage.getItem('fundingDashboardLanguage'));}
 mount(){
  this.toggle=document.createElement('button');this.toggle.type='button';this.toggle.className='board-edit-toggle';this.toggle.dataset.boardUi='';this.toggle.hidden=true;this.toggle.textContent='✎ 화면 편집';this.toggle.onclick=()=>void this.open();document.body.append(this.toggle);
  this.ui=document.createElement('aside');this.ui.className='board-editor-panel';this.ui.dataset.boardUi='';this.ui.hidden=true;
  this.ui.setAttribute('aria-label','관리자 화면 편집');
  this.ui.innerHTML=`<header><strong>관리자 화면 편집</strong><button data-close type="button">닫기</button></header><p data-context></p><p class="board-help">공개 문구·배치를 편집해요. 실적 숫자와 개인 기록은 바꾸지 않아요. 화면의 문구나 박스를 누르거나 아래에서 선택하세요.</p><div class="board-actions"><button data-preview>미리보기</button><button data-save>초안 저장</button><button data-publish>게시</button></div><p data-status role="status"></p><label>편집 대상<select data-target></select></label><div data-fields></div><details><summary>안내 박스 추가</summary><form data-add><label>영역<select name="group"></select></label><label>제목<input name="title" maxlength="160"></label><label>내용<textarea name="body" rows="3" maxlength="6000"></textarea></label><button type="submit">+ 추가</button></form></details><details><summary>복원·다시 불러오기</summary><div class="board-actions"><button data-reload>저장본 다시 불러오기</button><button data-reset>이 화면 기본값</button></div><label>이전 게시본<select data-history><option value="">이전 게시본 선택</option></select></label><button data-restore>선택한 게시본 복원</button><small>복원 후 미리 보고 ‘게시’를 눌러야 공개 화면에 적용돼요.</small></details>`;
  document.body.append(this.ui);
  this.q('[data-close]').onclick=()=>this.close();this.q('[data-preview]').onclick=()=>{this.preview=!this.preview;this.q('[data-preview]').textContent=this.preview?'편집으로 돌아가기':'미리보기';this.apply();};
  this.q('[data-target]').onchange=e=>{const [type,...id]=e.target.value.split('|');this.select(type,id.join('|'));};
  this.q('[data-save]').onclick=()=>void this.save(false);this.q('[data-publish]').onclick=()=>void this.save(true);
  this.q('[data-reload]').onclick=()=>{if(!this.busy&&(!this.dirty||confirm('저장하지 않은 편집을 버리고 다시 불러올까요?')))void this.loadAdmin();};
  this.q('[data-reset]').onclick=()=>{if(!this.busy&&confirm('이 화면의 문구·배치를 기본값으로 되돌릴까요? 게시 전까지 공개 화면은 유지돼요.')){this.content=emptyContent();this.change();this.fields();}};
  this.q('[data-add]').onsubmit=e=>{e.preventDefault();if(this.busy)return;const f=new FormData(e.target),c={id:'custom-'+crypto.randomUUID(),group:f.get('group'),title:f.get('title'),body:f.get('body')};try{const next=normalizeContent({...this.content,custom:[...this.content.custom,c]});this.content=next;this.change();e.target.reset();this.select('block',c.id);}catch(err){this.status(err.message);}};
  this.q('[data-restore]').onclick=()=>{const item=this.history?.find(x=>String(x.id)===this.q('[data-history]').value);if(item&&!this.busy){this.content=normalizeContent(item.content);this.change();this.fields();this.status('이전 게시본을 편집 화면에 불러왔어요. 확인 후 게시하세요.');}};
 }
 async auth(user){
  if(this.authUser===(user?.id||null))return;this.authUser=user?.id||null;
  const n=++this.authGeneration;this.content=emptyContent();this.history=[];this.q('[data-fields]').replaceChildren();this.allowed=false;this.toggle.hidden=true;this.editing=false;this.ui.hidden=true;this.dirty=false;this.selected=null;this.apply();
  if(!user)return;
  const {data,error}=await Promise.resolve(this.db.rpc('board_is_editor')).catch(()=>({error:true}));if(n!==this.authGeneration)return;
  this.allowed=!error&&data===true;this.toggle.hidden=!this.allowed;
  if(this.allowed&&new URLSearchParams(location.search).get('edit')==='1')void this.open();
 }
 schedule(){if(this.scheduled)return;this.scheduled=setTimeout(()=>{this.scheduled=null;const key=this.currentKey();if(key!==this.key)void this.context(key);else this.apply();},80);}
 async context(key){
  if(this.busy)return;
  const n=++this.generation;this.key=key;this.loaded=false;this.editing=false;this.ui.hidden=true;this.selected=null;this.dirty=false;this.content=emptyContent();this.published=emptyContent();this.apply();
  const {data,error}=await Promise.resolve(this.db.rpc('board_public_content',{p_page:key})).catch(()=>({error:true}));if(n!==this.generation)return;
  if(!error){try{this.published=normalizeContent(data.content);if(!this.editing)this.version=data.version;this.loaded=true;}catch{/* invalid content never replaces base UI */}}
  this.apply();
 }
 register(){
  this.groups=new Map([...this.root.querySelectorAll('[data-board-group]')].map(el=>[el.dataset.boardGroup,el]));
  this.blocks=new Map([...this.root.querySelectorAll('[data-board-block]')].filter(el=>!el.closest('[data-board-ui]')).map(el=>[el.dataset.boardBlock,el]));
  this.texts=new Map([...this.root.querySelectorAll('[data-board-text]')].filter(el=>!el.closest('[data-board-ui]')).map(el=>[el.dataset.boardText,el]));
 }
 apply(){
  this.observer?.disconnect();
  try{
   const content=this.editing?this.content:this.published;this.register();
   for(const node of this.root.querySelectorAll('[data-board-custom]'))if(!content.custom.some(c=>c.id===node.dataset.boardBlock))node.remove();
   for(const c of content.custom){const group=this.groups.get(c.group);if(!group)continue;let el=this.blocks.get(c.id);if(!el){el=document.createElement('section');el.className='card board-custom';el.dataset.boardCustom='';el.dataset.boardBlock=c.id;el.innerHTML='<h3></h3><p></p>';group.append(el);}el.dataset.boardLabel=c.title||'추가 안내';for(const [sel,text] of [['h3',c.title],['p',c.body]])if(el.querySelector(sel).textContent!==text)el.querySelector(sel).textContent=text;}
   this.register();
   for(const [id,el] of this.texts){
    let state=this.originals.get(el);if(!state){state={original:el.textContent,applied:null};this.originals.set(el,state);}else if(state.applied!==null&&el.textContent!==state.applied)state.original=el.textContent;
    const text=Object.hasOwn(content.texts,id)?content.texts[id]:state.original;
    if(el.textContent!==text)el.textContent=text;state.applied=text;
    el.classList.toggle('board-editable-text',this.editing&&!this.preview);el.classList.toggle('board-text-overridden',Object.hasOwn(content.texts,id));
   }
   for(const [gid,group] of this.groups){
    const children=[...group.children].filter(el=>el.hasAttribute('data-board-block'));
    const layout=children.some(el=>content.blocks[el.dataset.boardBlock])||content.custom.some(c=>c.group===gid);
    group.classList.toggle('board-layout',layout);
    for(let i=0;i<children.length;i++){
     const el=children[i],id=el.dataset.boardBlock,b=content.blocks[id];
     const width=b?.width==='auto'||!b?el.dataset.boardWidth||'full':b.width;
     const span=(!b||b.width==='auto')&&el.dataset.boardSpan?Number(el.dataset.boardSpan):({full:12,half:6,third:4,quarter:3}[width]||12);
     el.style.setProperty('--board-span',String(span));
     el.style.setProperty('--board-height',`${b?.height||0}px`);el.style.setProperty('--board-order',String(b?.order??i*10));
     el.dataset.boardHidden=String(!!b?.hidden);el.classList.toggle('board-editable-block',this.editing&&!this.preview);
     el.classList.toggle('board-show-hidden',!!b?.hidden&&this.editing&&!this.preview);
    }
   }
   this.toggle.hidden=!this.allowed||this.editing;document.body.classList.toggle('board-is-editing',this.editing&&!this.preview);
   if(this.editing)this.options();
  }finally{if(this.observer)this.observe();}
 }
 options(){
  const groups=[...this.groups].filter(([,e])=>e.getClientRects().length||[...e.children].some(c=>c.getClientRects().length));
  const groupHtml=groups.map(([id])=>`<option value="${esc(id)}">${esc(groupNames[id]||id)}</option>`).join('');const groupSelect=this.q('[name=group]');if(groupSelect.innerHTML!==groupHtml)groupSelect.innerHTML=groupHtml;
  const options=[...this.blocks].filter(([,el])=>el.getClientRects().length||el.dataset.boardHidden==='true').map(([id,el])=>`<option value="block|${esc(id)}">박스 · ${esc(el.dataset.boardLabel||id)}${el.dataset.boardHidden==='true'?' (숨김)':''}</option>`).concat([...this.texts].filter(([,el])=>el.getClientRects().length).map(([id,el])=>`<option value="text|${esc(id)}">문구 · ${esc((this.originals.get(el)?.original||id).slice(0,45))}</option>`));
  const html='<option value="">화면에서 클릭하거나 선택</option>'+options.join(''),select=this.q('[data-target]');
  if(select.innerHTML!==html){select.innerHTML=html;select.value=this.selected?this.selected.type+'|'+this.selected.id:'';}
 }
 select(type,id){if(!['text','block'].includes(type)||!id)return;this.selected={type,id};this.q('[data-target]').value=type+'|'+id;this.fields();}
 fields(){
  const host=this.q('[data-fields]');host.replaceChildren();if(!this.selected)return;
  const {type,id}=this.selected;
  if(type==='text'){
   const el=this.texts.get(id);if(!el)return;host.innerHTML='<label>문구<textarea rows="4" maxlength="6000" data-text></textarea></label><div class="board-actions"><button data-clear>문구 삭제</button><button data-default>기본 문구</button></div>';
   const input=host.querySelector('[data-text]');input.value=this.content.texts[id]??this.originals.get(el)?.original??el.textContent;
   input.oninput=()=>{this.content.texts[id]=input.value;this.change();};host.querySelector('[data-clear]').onclick=()=>{this.content.texts[id]='';this.change();this.fields();};host.querySelector('[data-default]').onclick=()=>{delete this.content.texts[id];this.change();this.fields();};
  }else{
   const el=this.blocks.get(id);if(!el)return;const custom=this.content.custom.find(c=>c.id===id),b=this.blockValue(id);
   host.innerHTML=`${custom?'<label>제목<input data-custom-title maxlength="160"></label><label>내용<textarea data-custom-body rows="4" maxlength="6000"></textarea></label>':''}<label>박스 너비<select data-width>${WIDTHS.map(w=>`<option value="${w}">${widthLabels[w]}</option>`).join('')}</select></label><label>최소 높이 (px · 0은 자동)<input data-height type="number" min="0" max="1200" step="10"></label><small>같은 영역 안에서 위아래로 이동해요. 모바일 너비는 한 칸으로 맞추며 내용은 잘리지 않아요.</small><div class="board-actions"><button data-up>↑ 위로</button><button data-down>↓ 아래로</button><button data-hide>${b.hidden?'박스 복원':'박스 삭제(숨김)'}</button><button data-default>크기·위치 초기화</button></div>`;
   if(custom){for(const field of ['title','body']){const input=host.querySelector('[data-custom-'+field+']');input.value=custom[field];input.oninput=()=>{custom[field]=input.value;this.change();};}}
   host.querySelector('[data-width]').value=b.width;host.querySelector('[data-height]').value=b.height;
   host.querySelector('[data-width]').onchange=e=>{this.content.blocks[id]={...this.blockValue(id),width:e.target.value};this.change();};
   host.querySelector('[data-height]').onchange=e=>{const height=Number(e.target.value);if(!Number.isInteger(height)||height<0||height>1200){this.status('높이는 0~1200px 범위로 입력해 주세요.');return;}this.content.blocks[id]={...this.blockValue(id),height};this.change();};
   host.querySelector('[data-up]').onclick=()=>this.move(id,-1);host.querySelector('[data-down]').onclick=()=>this.move(id,1);
   host.querySelector('[data-hide]').onclick=()=>{this.content.blocks[id]={...this.blockValue(id),hidden:!this.blockValue(id).hidden};this.change();this.fields();};
   host.querySelector('[data-default]').onclick=()=>{delete this.content.blocks[id];this.change();this.fields();};
  }
 }
 blockValue(id){const el=this.blocks.get(id),siblings=[...(el?.parentElement?.children||[])].filter(e=>e.hasAttribute('data-board-block'));return this.content.blocks[id]||{width:'auto',height:0,hidden:false,order:Math.max(0,siblings.indexOf(el))*10};}
 move(id,delta){const el=this.blocks.get(id);if(!el)return;const siblings=[...el.parentElement.children].filter(e=>e.hasAttribute('data-board-block')).sort((a,b)=>this.blockValue(a.dataset.boardBlock).order-this.blockValue(b.dataset.boardBlock).order);const index=siblings.indexOf(el),next=index+delta;if(next<0||next>=siblings.length)return;[siblings[index],siblings[next]]=[siblings[next],siblings[index]];siblings.forEach((node,i)=>{const key=node.dataset.boardBlock;this.content.blocks[key]={...this.blockValue(key),order:i*10};});this.change();}
 change(){this.dirty=true;this.status('게시 전 편집 중 · 공개 화면에는 아직 적용되지 않았어요.');this.apply();}
 async open(){if(!this.allowed||this.busy)return;if(!this.key)await this.context(this.currentKey());this.ui.hidden=false;this.status('편집 내용 불러오는 중…');await this.loadAdmin();}
 async loadAdmin(){
  const n=this.generation,a=this.authGeneration,key=this.key;this.busy=true;this.lock();
  try{const {data,error}=await this.db.from('board_content').select('draft,published,version').eq('page_key',key).maybeSingle();if(n!==this.generation||a!==this.authGeneration||!this.allowed)return;if(error)throw error;
   this.content=normalizeContent(data?.draft||emptyContent());this.published=normalizeContent(data?.published||emptyContent());this.version=data?.version||0;this.editing=true;this.preview=false;this.dirty=false;this.selected=null;this.q('[data-fields]').replaceChildren();this.q('[data-context]').textContent=(key.includes(':plan:')?'투자 계획':document.title)+' · '+(key.endsWith(':en')?'영문':'한글')+' 화면 · 게시하면 모든 방문자에게 적용';this.status('초안 편집 · 게시 전까지 공개 화면 유지');this.apply();
   const result=await this.db.from('board_content_versions').select('id,version,content,created_at').eq('page_key',key).order('version',{ascending:false}).limit(20);
   if(n!==this.generation||a!==this.authGeneration)return;
   this.history=result.error?[]:result.data||[];this.q('[data-history]').innerHTML='<option value="">이전 게시본 선택</option>'+this.history.map(r=>`<option value="${r.id}">버전 ${r.version} · ${esc(r.created_at.slice(0,16))}</option>`).join('');
  }catch{this.status('불러오지 못했어요. 닫은 뒤 다시 시도해 주세요.');}
  finally{this.busy=false;this.lock();}
 }
 lock(){for(const el of this.ui.querySelectorAll('button,input,textarea,select'))el.disabled=this.busy;}
 async save(publish){
  if(this.busy||!this.allowed||!this.editing)return;let content;try{content=normalizeContent(this.content);}catch(e){this.status(e.message);return;}
  if(publish&&!confirm('이 화면의 편집 내용을 모든 방문자에게 게시할까요?'))return;
  const n=this.generation,a=this.authGeneration,key=this.key;this.busy=true;this.lock();this.status(publish?'게시 중…':'초안 저장 중…');
  try{const {data,error}=await this.db.rpc('board_save_content',{p_page:key,p_content:content,p_version:this.version,p_publish:publish});if(n!==this.generation||a!==this.authGeneration||!this.allowed)return;if(error)throw error;this.version=data.version;this.content=normalizeContent(data.draft);this.published=normalizeContent(data.published);this.dirty=false;this.fields();this.status(publish?'게시 완료 · 다른 방문자는 새로고침하면 적용돼요.':'초안 저장 완료 · 공개 화면은 그대로예요.');this.apply();}
  catch(error){if(n===this.generation&&a===this.authGeneration)this.status(error.code==='40001'?'다른 창에서 변경됐어요. 입력은 유지돼요. 저장본을 다시 불러와 확인하세요.':'저장 실패 · 편집 내용은 유지돼요. 로그인·연결을 확인하고 다시 시도하세요.');}
  finally{this.busy=false;this.lock();}
 }
 close(){if(this.busy||(this.dirty&&!confirm('저장하지 않은 편집을 버리고 닫을까요?')))return;this.editing=false;this.ui.hidden=true;this.preview=false;this.dirty=false;this.apply();}
 destroy(){clearInterval(this.timer);clearTimeout(this.scheduled);this.observer.disconnect();document.removeEventListener('click',this.capture,true);window.removeEventListener('beforeunload',this.unload);this.ui.remove();this.toggle.remove();}
}
export const editor=new BoardEditor(authClient);
const {data}=await authClient.auth.getSession();void editor.auth(data?.session?.user);
authClient.auth.onAuthStateChange((_event,session)=>setTimeout(()=>void editor.auth(session?.user),0));
