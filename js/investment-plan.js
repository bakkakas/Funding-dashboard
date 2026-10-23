import {IMPACTS,CATEGORIES,SCOPES,seoulDate,isDue,normalizePlan,filterPlans} from './investment-plan-model.js?v=1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=o=>Object.entries(o).map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
const liquidityNames={room:'자금 여유 있음',balanced:'보통',tight:'자금 확보 우선',unsure:'아직 판단 전'};
export class InvestmentPlan {
 constructor(db,host){
 this.db=db;this.host=host;this.user=null;this.version=0;this.items=[];this.ready=false;this.busy=false;this.dirty=false;this.editing=null;this.today=seoulDate();
 host.innerHTML=`<div class="plan-heading"><div><div class="eyebrow">INVESTMENT CONTEXT</div><h2>투자 판단 보드</h2><p>시장의 기회와 위험, 내 자금 여유를 함께 보고 판단해요.</p></div><button class="chip active" data-new disabled>+ 판단 추가</button></div>
 <div class="plan-status" role="status" data-status>계정 확인 중…</div><button class="chip subtle" data-retry hidden>다시 불러오기</button>
 <div class="plan-summary" data-summary></div><div class="plan-due" data-due role="status" hidden></div>
 <section class="plan-editor" data-editor hidden><h3 data-editor-title>판단 추가</h3><form data-form><fieldset>
 <label class="plan-full">내용<textarea name="title" rows="2" maxlength="300" required placeholder="예: 미국 10년물 금리 상승 / 당분간 큰 지출 예정 없음"></textarea></label>
 <label>카테고리<select name="category">${opts(CATEGORIES)}</select></label><label>사실 / 예상<select name="kind" required><option value="">선택해 주세요</option><option value="fact">사실</option><option value="forecast">예상</option></select></label>
 <label><span data-impact-label>매수에 미치는 영향</span><select name="impact" required><option value="">선택해 주세요</option>${IMPACTS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
 <label>중요도<select name="importance">${[1,2,3,4,5].map(v=>`<option value="${v}" ${v===3?'selected':''}>${v} · ${['낮음','조금 낮음','보통','중요함','매우 중요함'][v-1]}</option>`).join('')}</select></label>
 <label>적용 대상<select name="scope">${opts(SCOPES)}</select></label><label data-target-wrap hidden>대상 이름<input name="target" maxlength="120" list="planTargetSuggestions" placeholder="예: 반도체, 크립토, 삼성전자"><datalist id="planTargetSuggestions"><option value="주식"><option value="크립토"><option value="채권"><option value="반도체"><option value="에너지"></datalist></label>
 <div class="plan-full plan-personal" data-personal hidden><p>큰 지출이 없는 기간도 기록할 수 있어요. 긍정은 투자 여력 확대, 부정은 자금 확보 필요를 뜻해요.</p><div class="plan-grid"><label>현재 자금 상황<select name="liquidity">${opts(liquidityNames)}</select></label><label>예정 필요 금액 (원 · 선택)<input name="cash_amount" type="number" min="0" max="100000000000000" step="any" inputmode="decimal" placeholder="필요할 때만 입력"></label><label>자금 필요일 (선택)<input name="cash_date" type="date" min="1900-01-01" max="2199-12-31"></label></div></div>
 <label class="plan-full">근거·메모 (선택)<textarea name="notes" maxlength="4000" rows="3" placeholder="판단 근거, 출처 링크, 돈을 묶어둘 수 있는 기간 등을 적어 주세요."></textarea></label>
 <div class="plan-full"><button class="chip subtle" type="button" data-expiry aria-expanded="false">만료일 설정</button><label data-expiry-wrap hidden>만료일<input name="expires_on" type="date" min="1900-01-01" max="2199-12-31"><small>한국시간 해당 날짜부터 ‘재검토 필요’로 표시해요. 자동 삭제되지 않아요.</small></label></div>
 <label>항목 상태<select name="state"><option value="active">유효</option><option value="resolved">해소</option></select></label>
 <div class="plan-full plan-actions"><button class="chip active" type="submit">저장</button><button class="chip subtle" type="button" data-cancel>취소</button></div>
 </fieldset><p data-form-status role="status"></p></form></section>
 <div class="plan-filters"><label>카테고리<select data-filter-category><option value="">모두</option>${opts(CATEGORIES)}</select></label><label>적용 대상<select data-filter-target><option value="">모두</option></select></label><label>상태<select data-filter-state><option value="active">유효 · 재검토 포함</option><option value="due">재검토 필요</option><option value="resolved">해소</option><option value="all">모두</option></select></label></div>
 <p class="plan-note">대상 필터에는 ‘전체’에 적용되는 판단도 함께 표시돼요. 영향·중요도는 내 판단 기록이며 자동 매매 신호나 합산 점수가 아니에요.</p>
 <div class="plan-columns"><section><h3>시장·산업 상황 <span data-market-count></span></h3><div data-market></div></section><section><h3>개인 자금 계획 <span data-personal-count></span></h3><div data-cash></div></section></div>
 <p class="plan-note">만료 안내는 이 페이지와 ‘투자 계획’ 탭에 표시돼요. 앱 밖 푸시·텔레그램 알림은 보내지 않아요.</p>`;
 this.form=host.querySelector('[data-form]');this.fieldset=this.form.querySelector('fieldset');
 this.q('[data-new]').onclick=()=>this.open();this.q('[data-retry]').onclick=()=>{if(!this.dirty||confirm('작성 중인 내용을 버리고 다시 불러올까요?'))void this.connect(this.user,true);};
 this.q('[data-cancel]').onclick=()=>this.cancel();
 this.q('[data-expiry]').onclick=()=>this.setExpiry(this.q('[data-expiry-wrap]').hidden,true);
 this.form.oninput=()=>{this.dirty=true;};this.form.onchange=()=>{this.dirty=true;this.adjust();};
 this.form.onsubmit=e=>{e.preventDefault();void this.save();};
 for(const el of host.querySelectorAll('.plan-filters select'))el.onchange=()=>this.render();
 host.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)this.open(this.items.find(i=>i.id===edit.dataset.edit));if(del)void this.remove(this.items.find(i=>i.id===del.dataset.delete));});
 window.addEventListener('beforeunload',e=>{if(this.dirty||this.busy){e.preventDefault();e.returnValue='';}});
 const tick=()=>{const today=seoulDate();if(today!==this.today){this.today=today;this.render();}};
 this.timer=setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});this.render();
 }
 q(s){return this.host.querySelector(s);}
 reset(user){this.version++;this.user=user;this.ready=false;this.busy=false;this.dirty=false;this.editing=null;this.items=[];this.form.reset();this.q('[data-editor]').hidden=true;this.q('[data-retry]').hidden=true;this.q('[data-status]').textContent=user?'판단 불러오는 중…':'로그인하면 내 계정에 비공개로 저장하고 다른 기기에서도 볼 수 있어요.';this.render();}
 async connect(user,force=false){if(this.user===user&&this.ready&&!force)return;this.reset(user);if(!user)return;const version=this.version;
 try{const all=[];for(let start=0;;start+=500){const {data,error}=await this.db.from('investment_plan_items').select('*').eq('user_id',user).order('created_at',{ascending:false}).order('id').range(start,start+499);if(version!==this.version)return;if(error)throw error;all.push(...data);if(data.length<500)break;}
 this.items=all;this.ready=true;this.q('[data-status]').textContent='내 계정 비공개 저장 · 만료일은 한국시간 기준';
 }catch{if(version!==this.version)return;this.q('[data-status]').textContent='불러오지 못했어요. 기존 항목 보호를 위해 편집을 잠갔어요.';this.q('[data-retry]').hidden=false;}
 if(version===this.version)this.render();
 }
 setExpiry(on,dirty=false){this.q('[data-expiry-wrap]').hidden=!on;this.form.elements.expires_on.required=on;this.q('[data-expiry]').textContent=on?'만료일 해제':'만료일 설정';this.q('[data-expiry]').setAttribute('aria-expanded',String(on));if(!on)this.form.elements.expires_on.value='';if(dirty)this.dirty=true;}
 adjust(){const personal=this.form.elements.category.value==='personal',target=this.form.elements.scope.value!=='all';this.q('[data-personal]').hidden=!personal;this.q('[data-target-wrap]').hidden=!target;this.form.elements.target.required=target;this.q('[data-impact-label]').textContent=personal?'투자 여력에 미치는 영향':'매수에 미치는 영향';}
 open(item=null){if(!this.ready||this.busy)return;if(this.dirty&&!confirm('저장하지 않은 내용을 버리고 열까요?'))return;this.form.reset();this.editing=item?{...item}:null;
 if(item)for(const [key,value]of Object.entries(item)){const el=this.form.elements.namedItem(key);if(el)el.value=value??'';}
 else this.form.elements.liquidity.value='unsure';
 this.setExpiry(!!item?.expires_on);this.adjust();this.dirty=false;this.q('[data-editor-title]').textContent=item?'판단 수정 · 재검토':'판단 추가';this.q('[data-form-status]').textContent='';this.q('[data-editor]').hidden=false;this.form.elements.title.focus();}
 cancel(){if(this.busy)return;if(this.dirty&&!confirm('작성 중인 내용을 취소할까요?'))return;this.dirty=false;this.editing=null;this.q('[data-editor]').hidden=true;}
 async save(){if(!this.ready||this.busy||!this.user)return;let value;try{value=normalizePlan(Object.fromEntries(new FormData(this.form)));}catch(e){this.q('[data-form-status]').textContent=e.message;return;}
 const version=this.version,user=this.user;this.busy=true;this.render();this.q('[data-form-status]').textContent='저장 중…';
 try{let query=this.db.from('investment_plan_items');query=this.editing?query.update(value).eq('id',this.editing.id).eq('user_id',user).eq('updated_at',this.editing.updated_at):query.insert({...value,user_id:user});const {data,error}=await query.select().single();if(version!==this.version)return;if(error)throw error;
 this.items=[data,...this.items.filter(i=>i.id!==data.id)];this.dirty=false;this.editing=null;this.q('[data-editor]').hidden=true;this.q('[data-status]').textContent='저장 완료 · 계정에 동기화했어요.';
 }catch{if(version===this.version){this.q('[data-form-status]').textContent='저장하지 못했어요. 입력은 유지돼요. 네트워크를 확인해 다시 저장하거나, 다른 기기에서 수정했다면 다시 불러와 주세요.';this.q('[data-retry]').hidden=false;}}
 finally{if(version===this.version){this.busy=false;this.render();}}
 }
 async remove(item){if(!item||!this.ready||this.busy||!confirm(`‘${item.title}’ 항목을 삭제할까요?`))return;const version=this.version;this.busy=true;this.render();try{const {data,error}=await this.db.from('investment_plan_items').delete().eq('id',item.id).eq('user_id',this.user).eq('updated_at',item.updated_at).select('id').single();if(version!==this.version)return;if(error||!data)throw Error();this.items=this.items.filter(i=>i.id!==item.id);if(this.editing?.id===item.id){this.dirty=false;this.editing=null;this.q('[data-editor]').hidden=true;}this.q('[data-status]').textContent='삭제 완료';}catch{if(version===this.version){this.q('[data-status]').textContent='삭제 실패 또는 다른 기기에서 변경됐어요. 다시 불러온 뒤 확인해 주세요.';this.q('[data-retry]').hidden=false;}}finally{if(version===this.version){this.busy=false;this.render();}}}
 render(){
 const active=this.items.filter(i=>i.state==='active'),due=active.filter(i=>isDue(i,this.today)),market=active.filter(i=>i.category!=='personal'),personal=active.filter(i=>i.category==='personal');
 const fresh=market.filter(i=>!isDue(i,this.today));this.q('[data-summary]').innerHTML=[['유효 항목',active.length],['재검토 필요',due.length],['시장 긍정 / 부정',`${fresh.filter(i=>i.impact>0).length} / ${fresh.filter(i=>i.impact<0).length}`],['개인 자금 상황',`${personal.length}건`]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');
 this.q('[data-due]').hidden=!due.length;this.q('[data-due]').textContent=`⏰ 재검토 필요 ${due.length}건 · 만료된 판단은 시장 긍정/부정 집계에서 제외돼요. 수정에서 내용을 검토하고 만료일을 바꾸거나 ‘해소’로 전환해 주세요.`;
 const tab=document.getElementById('planTab');if(tab){let badge=tab.querySelector('.plan-tab-badge');if(!badge){badge=document.createElement('span');badge.className='plan-tab-badge';tab.append(badge);}badge.hidden=!due.length;badge.textContent=` · 재검토 ${due.length}`;}
 const filter=this.q('[data-filter-target]'),selected=filter.value;filter.innerHTML='<option value="">모두</option>'+[...new Set(this.items.filter(i=>i.scope!=='all').map(i=>i.target))].sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');filter.value=[...filter.options].some(o=>o.value===selected)?selected:'';
 const items=filterPlans(this.items,{category:this.q('[data-filter-category]').value,target:filter.value,state:this.q('[data-filter-state]').value},this.today);
 for(const [selector,list]of [['market',items.filter(i=>i.category!=='personal')],['cash',items.filter(i=>i.category==='personal')]]){
 this.q(`[data-${selector}]`).innerHTML=list.map(i=>this.card(i)).join('')||`<p class="plan-empty">${!this.user?'로그인 후 판단을 기록해 보세요.':!this.ready?'목록을 불러오면 표시돼요.':'해당하는 항목이 없어요.'}</p>`;
 this.q(selector==='market'?'[data-market-count]':'[data-personal-count]').textContent=`${list.length}건`;
 }
 this.q('[data-new]').disabled=!this.ready||this.busy;this.fieldset.disabled=!this.ready||this.busy;this.q('[data-retry]').disabled=this.busy;for(const b of this.host.querySelectorAll('[data-edit],[data-delete]'))b.disabled=this.busy;
 }
 card(i){const due=isDue(i,this.today),personal=i.category==='personal';return `<article class="plan-item ${due?'is-due':''}"><div class="plan-badges"><span>${esc(CATEGORIES[i.category])}</span><span>${i.kind==='fact'?'사실':'예상'}</span><span>중요도 ${i.importance}/5</span>${i.state==='resolved'?'<span>해소</span>':due?'<span class="plan-warning">⏰ 재검토 필요</span>':''}</div><h4>${esc(i.title)}</h4><div class="plan-impact ${i.impact<0?'negative':'positive'}">${personal?'투자 여력':'매수 영향'} · ${esc(IMPACTS.find(([v])=>v===i.impact)?.[1])}</div><p class="plan-target">적용: ${i.scope==='all'?'전체':`${esc(SCOPES[i.scope])} · ${esc(i.target)}`}</p>${personal?`<p>${liquidityNames[i.liquidity]}${i.cash_amount!==null?` · 필요 금액 ${Number(i.cash_amount).toLocaleString('ko-KR')}원`:''}${i.cash_date?` · 필요일 ${esc(i.cash_date)}`:''}</p>`:''}${i.notes?`<p class="plan-item-notes">${esc(i.notes)}</p>`:''}<div class="plan-item-footer"><small>${i.expires_on?`만료 ${esc(i.expires_on)} · KST`:'만료일 없음'}</small><div><button class="chip subtle" data-edit="${esc(i.id)}">${due?'재검토':'수정'}</button><button class="chip subtle" data-delete="${esc(i.id)}">삭제</button></div></div></article>`;}
}
