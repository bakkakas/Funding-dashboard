import {MarketEvents} from './market-events.js?v=1';
import {IMPACTS,CATEGORIES,SCOPES,seoulDate,isDue,normalizePlan,filterPlans,impactScore,planScores,overallScore} from './investment-plan-model.js?v=3';
const signed=n=>n>0?`+${n}`:String(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices=(name,options,selected='',required=false)=>`<div class="plan-options">${(Array.isArray(options)?options:Object.entries(options)).map(([value,label])=>`<label class="plan-choice"><input type="radio" name="${esc(name)}" value="${esc(value)}" ${value===selected?'checked':''} ${required?'required':''}><span>${esc(label)}</span></label>`).join('')}</div>`;
const group=(label,name,options,selected='',required=false)=>`<div class="plan-choice-group plan-full" role="radiogroup" aria-label="${esc(label)}"><span class="plan-choice-title">${label}</span>${choices(name,options,selected,required)}</div>`;
const liquidityNames={room:'자금 여유 있음',balanced:'보통',tight:'자금 확보 우선',unsure:'아직 판단 전'};
export class InvestmentPlan {
 constructor(db,host){
 this.db=db;this.host=host;this.user=null;this.version=0;this.items=[];this.ready=false;this.busy=false;this.dirty=false;this.editing=null;this.today=seoulDate();this.filters={category:'',target:'',state:'active'};
 host.innerHTML=`<section class="market-events" data-market-events aria-label="주요 시장 이벤트"></section><div class="plan-heading"><div><div class="eyebrow">INVESTMENT CONTEXT</div><h2>투자 판단 보드</h2><p>시장의 기회와 위험, 내 자금 여유를 함께 보고 판단해요.</p></div><button class="chip active" data-new disabled>+ 판단 추가</button></div>
 <div class="plan-status" role="status" data-status>계정 확인 중…</div><button class="chip subtle" data-retry hidden>다시 불러오기</button>
 <section class="plan-overall" data-overall aria-label="현재 종합 점수"></section><div class="plan-summary" data-summary></div><section class="plan-score-section"><h3>매수 영향 점수</h3><div class="plan-scores" data-scores></div><p class="plan-note">매우 부정 −3 · 부정 −2 · 약간 부정 −1 · 약간 긍정 +1 · 긍정 +2 · 매우 긍정 +3점. 각 항목을 같은 비중으로 합산해요. 항목 수가 다르므로 평균도 함께 보세요.</p><p class="plan-note">전체 공통은 ‘전체 적용’ 항목만, 대상별 점수는 전체 공통 + 해당 대상 항목이에요. 개인 자금 판단도 포함하며, 만료·해소 항목은 제외해요. 자산군·산업군·종목 간 소속 관계는 자동 추정하지 않아요. 점수는 아래 목록 필터와 무관해요.</p></section><div class="plan-due" data-due role="status" hidden></div>
 <section class="plan-editor" data-editor hidden><h3 data-editor-title>판단 추가</h3><form data-form><fieldset>
 <label class="plan-full">내용<textarea name="title" rows="2" maxlength="300" required placeholder="예: 미국 10년물 금리 상승 / 당분간 큰 지출 예정 없음"></textarea></label>
 ${group('카테고리','category',CATEGORIES,'macro')}
 ${group('사실 / 예상','kind',{fact:'사실',forecast:'예상'},'',true)}
 <div class="plan-choice-group plan-full" role="radiogroup" aria-label="매수에 미치는 영향"><span class="plan-choice-title" data-impact-label>매수에 미치는 영향</span>${choices('impact',IMPACTS.map(([v,n])=>[String(v),`${signed(impactScore(v))}점 · ${n}`]),'',true)}</div>
 ${group('적용 대상','scope',SCOPES,'all')}
 <div class="plan-full" data-target-wrap hidden><label>대상 이름<input name="target" maxlength="120" placeholder="예: 반도체, 크립토, 삼성전자"></label><div class="plan-options plan-target-suggestions" aria-label="대상 빠른 선택">${['주식','크립토','채권','반도체','에너지'].map(t=>`<button class="chip subtle" type="button" data-target-choice="${t}">${t}</button>`).join('')}</div></div>
 <div class="plan-full plan-personal" data-personal hidden><p>큰 지출이 없는 기간도 기록할 수 있어요. 긍정은 투자 여력 확대, 부정은 자금 확보 필요를 뜻해요.</p><div class="plan-grid">${group('현재 자금 상황','liquidity',liquidityNames,'unsure')}<label>예정 필요 금액 (원 · 선택)<input name="cash_amount" type="number" min="0" max="100000000000000" step="any" inputmode="decimal" placeholder="필요할 때만 입력"></label><label>자금 필요일 (선택)<input name="cash_date" type="date" min="1900-01-01" max="2199-12-31"></label></div></div>
 <label class="plan-full">근거·메모 (선택)<textarea name="notes" maxlength="4000" rows="3" placeholder="판단 근거, 출처 링크, 돈을 묶어둘 수 있는 기간 등을 적어 주세요."></textarea></label>
 <div class="plan-full"><button class="chip subtle" type="button" data-expiry aria-expanded="false">만료일 설정</button><label data-expiry-wrap hidden>만료일<input name="expires_on" type="date" min="1900-01-01" max="2199-12-31"><small>한국시간 해당 날짜부터 ‘재검토 필요’로 표시해요. 자동 삭제되지 않아요.</small></label></div>
 ${group('항목 상태','state',{active:'유효',resolved:'해소'},'active')}
 <div class="plan-full plan-actions"><button class="chip active" type="submit">저장</button><button class="chip subtle" type="button" data-cancel>취소</button></div>
 </fieldset><p data-form-status role="status"></p></form></section>
 <div class="plan-filters"><div data-filter="category" role="radiogroup" aria-label="카테고리 필터"><span class="plan-choice-title">카테고리</span>${choices('plan-filter-category',{'':'모두',...CATEGORIES})}</div><div data-filter="target" role="radiogroup" aria-label="적용 대상 필터"><span class="plan-choice-title">적용 대상</span><div data-target-options></div></div><div data-filter="state" role="radiogroup" aria-label="상태 필터"><span class="plan-choice-title">상태</span>${choices('plan-filter-state',{active:'유효 · 재검토 포함',due:'재검토 필요',resolved:'해소',all:'모두'},'active')}</div></div>
 <p class="plan-note">대상 필터에는 ‘전체’에 적용되는 판단도 함께 표시돼요. 점수는 입력한 판단의 요약이며 매수 확률이나 자동 매매 신호가 아니에요.</p>
 <div class="plan-columns"><section><h3>시장·산업 상황 <span data-market-count></span></h3><div data-market></div></section><section><h3>개인 자금 계획 <span data-personal-count></span></h3><div data-cash></div></section></div>
 <p class="plan-note">만료 안내는 이 페이지와 ‘투자 계획’ 탭에 표시돼요. 앱 밖 푸시·텔레그램 알림은 보내지 않아요.</p>`;
 this.marketEvents=new MarketEvents(host.querySelector('[data-market-events]'));
 this.form=host.querySelector('[data-form]');this.fieldset=this.form.querySelector('fieldset');
 this.q('[data-new]').onclick=()=>this.open();this.q('[data-retry]').onclick=()=>{if(!this.dirty||confirm('작성 중인 내용을 버리고 다시 불러올까요?'))void this.connect(this.user,true);};
 this.q('[data-cancel]').onclick=()=>this.cancel();
 this.q('[data-expiry]').onclick=()=>this.setExpiry(this.q('[data-expiry-wrap]').hidden,true);
 this.form.oninput=()=>{this.dirty=true;};this.form.onchange=()=>{this.dirty=true;this.adjust();};
 this.form.onsubmit=e=>{e.preventDefault();void this.save();};
 this.q('.plan-filters').onchange=e=>{const key=e.target.closest('[data-filter]')?.dataset.filter;if(key){this.filters[key]=e.target.value;this.render();}};
 host.addEventListener('click',e=>{const suggestion=e.target.closest('[data-target-choice]');if(suggestion){this.form.elements.target.value=suggestion.dataset.targetChoice;this.dirty=true;}const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)this.open(this.items.find(i=>i.id===edit.dataset.edit));if(del)void this.remove(this.items.find(i=>i.id===del.dataset.delete));});
 window.addEventListener('beforeunload',e=>{if(this.dirty||this.busy){e.preventDefault();e.returnValue='';}});
 const tick=()=>{const today=seoulDate();if(today!==this.today){this.today=today;this.render();}};
 this.timer=setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});this.render();
 }
 q(s){return this.host.querySelector(s);}
 reset(user){this.version++;this.user=user;this.ready=false;this.busy=false;this.dirty=false;this.editing=null;this.items=[];this.filters={category:'',target:'',state:'active'};this.form.reset();this.q('[data-editor]').hidden=true;this.q('[data-retry]').hidden=true;this.q('[data-status]').textContent=user?'판단 불러오는 중…':'로그인하면 내 계정에 비공개로 저장하고 다른 기기에서도 볼 수 있어요.';this.render();}
 async connect(user,force=false){if(this.user===user&&this.ready&&!force)return;this.reset(user);if(!user)return;const version=this.version;
 try{const all=[];for(let start=0;;start+=500){const {data,error}=await this.db.from('investment_plan_items').select('*').eq('user_id',user).order('created_at',{ascending:false}).order('id').range(start,start+499);if(version!==this.version)return;if(error)throw error;all.push(...data);if(data.length<500)break;}
 this.items=all;this.ready=true;this.q('[data-status]').textContent='내 계정 비공개 저장 · 만료일은 한국시간 기준';
 }catch{if(version!==this.version)return;this.q('[data-status]').textContent='불러오지 못했어요. 기존 항목 보호를 위해 편집을 잠갔어요.';this.q('[data-retry]').hidden=false;}
 if(version===this.version)this.render();
 }
 setExpiry(on,dirty=false){this.q('[data-expiry-wrap]').hidden=!on;this.form.elements.expires_on.required=on;this.q('[data-expiry]').textContent=on?'만료일 해제':'만료일 설정';this.q('[data-expiry]').setAttribute('aria-expanded',String(on));if(!on)this.form.elements.expires_on.value='';if(dirty)this.dirty=true;}
 adjust(){const personal=this.form.elements.category.value==='personal',target=this.form.elements.scope.value!=='all';this.q('[data-personal]').hidden=!personal;this.q('[data-target-wrap]').hidden=!target;this.form.elements.target.required=target;for(const name of ['cash_amount','cash_date'])this.form.elements[name].disabled=!personal;this.q('[data-impact-label]').textContent=personal?'투자 여력에 미치는 영향':'매수에 미치는 영향';this.q('[data-impact-label]').parentElement.setAttribute('aria-label',this.q('[data-impact-label]').textContent);}
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
 const overall=overallScore(this.items,this.today),avg=overall.average;
 const direction=avg===null?'판단 없음':avg<0?'부정 우세':avg>0?'긍정 우세':'균형';
 const tint=avg===null||avg===0?'hsl(210 12% 24%)':`hsl(${avg<0?0:145} ${35+overall.intensity*50}% ${26+overall.intensity*12}%)`;
 this.q('[data-overall]').innerHTML=`<div class="plan-overall-heading"><div><h3>현재 종합 점수</h3><strong>${overall.count?`${signed(overall.total)}점`:'—'}</strong></div><span>${direction}</span></div><p>${overall.count?`평균 ${signed(Number(avg.toFixed(2)))}점 · ${overall.count}건`:'유효한 판단을 추가하면 점수가 표시돼요.'}</p><div class="plan-meter" ${overall.count?`role="meter" aria-label="종합 매수 영향 평균" aria-valuemin="-3" aria-valuemax="3" aria-valuenow="${avg}" aria-valuetext="${direction}, 평균 ${avg.toFixed(2)}점"`:'role="img" aria-label="점수 없음"'} style="--score-tint:${tint}"><div class="plan-meter-fill" style="left:${Math.min(50,overall.position)}%;width:${Math.abs(overall.position-50)}%"></div><span class="plan-meter-zero"></span>${overall.count?`<span class="plan-meter-marker" style="left:clamp(8px, ${overall.position}%, calc(100% - 8px))"></span>`:''}</div><div class="plan-meter-labels"><span>−3 매우 부정</span><span>0</span><span>+3 매우 긍정</span></div><p class="plan-note">모든 적용 대상의 유효 판단을 한 번씩 합산한 요약이에요. 만료·해소 항목은 제외해요. 막대 위치와 색의 진하기는 평균(−3~+3)을 기준으로 해요.</p>`;
 this.q('[data-summary]').innerHTML=[['유효 항목',active.length],['재검토 필요',due.length],['시장·산업 상황',`${market.length}건`],['개인 자금 상황',`${personal.length}건`]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');
 this.q('[data-scores]').innerHTML=planScores(this.items,this.today).map(g=>`<article class="plan-score"><h4>${g.scope==='all'?'전체 공통':`${esc(SCOPES[g.scope])} · ${esc(g.target)}`}</h4><strong>${g.count?`${signed(g.total)}점`:'—'}</strong><p>${g.count?`평균 ${signed(Number(g.average.toFixed(2)))}점 · ${g.count}건`:'계산할 유효 항목 없음'}</p><small>${g.scope==='all'?`전체 적용 ${g.globalCount}건`:`전체 공통 ${g.globalCount}건 + 대상 전용 ${g.specificCount}건`}</small></article>`).join('');
 this.q('[data-due]').hidden=!due.length;this.q('[data-due]').textContent=`⏰ 재검토 필요 ${due.length}건 · 만료된 판단은 점수 계산에서 제외돼요. 수정에서 내용을 검토하고 만료일을 바꾸거나 ‘해소’로 전환해 주세요.`;
 const tab=document.getElementById('planTab');if(tab){let badge=tab.querySelector('.plan-tab-badge');if(!badge){badge=document.createElement('span');badge.className='plan-tab-badge';tab.append(badge);}badge.hidden=!due.length;badge.textContent=` · 재검토 ${due.length}`;}
 const targets=Object.fromEntries(this.items.filter(i=>i.scope!=='all').map(i=>[JSON.stringify([i.scope,i.target]),`${SCOPES[i.scope]} · ${i.target}`]));
 if(this.filters.target&&!Object.hasOwn(targets,this.filters.target))this.filters.target='';
 const signature=JSON.stringify(targets);if(signature!==this.targetSignature){this.q('[data-target-options]').innerHTML=choices('plan-filter-target',{'':'모두',...targets},this.filters.target);this.targetSignature=signature;}
 for(const input of this.host.querySelectorAll('.plan-filters input'))input.checked=input.value===this.filters[input.closest('[data-filter]').dataset.filter];
 const [scope,target]=this.filters.target?JSON.parse(this.filters.target):['',''];
 const items=filterPlans(this.items,{category:this.filters.category,target,scope,state:this.filters.state},this.today);
 for(const [selector,list]of [['market',items.filter(i=>i.category!=='personal')],['cash',items.filter(i=>i.category==='personal')]]){
 this.q(`[data-${selector}]`).innerHTML=list.map(i=>this.card(i)).join('')||`<p class="plan-empty">${!this.user?'로그인 후 판단을 기록해 보세요.':!this.ready?'목록을 불러오면 표시돼요.':'해당하는 항목이 없어요.'}</p>`;
 this.q(selector==='market'?'[data-market-count]':'[data-personal-count]').textContent=`${list.length}건`;
 }
 this.q('[data-new]').disabled=!this.ready||this.busy;this.fieldset.disabled=!this.ready||this.busy;this.q('[data-retry]').disabled=this.busy;for(const b of this.host.querySelectorAll('[data-edit],[data-delete]'))b.disabled=this.busy;
 }
 card(i){const due=isDue(i,this.today),personal=i.category==='personal';return `<article class="plan-item ${due?'is-due':''}"><div class="plan-badges"><span>${esc(CATEGORIES[i.category])}</span><span>${i.kind==='fact'?'사실':'예상'}</span>${i.state==='resolved'?'<span>해소</span>':due?'<span class="plan-warning">⏰ 재검토 필요</span>':''}</div><h4>${esc(i.title)}</h4><div class="plan-impact ${i.impact<0?'negative':'positive'}">${personal?'투자 여력':'매수 영향'} · ${esc(IMPACTS.find(([v])=>v===i.impact)?.[1])} · ${signed(impactScore(i.impact))}점</div><p class="plan-target">적용: ${i.scope==='all'?'전체':`${esc(SCOPES[i.scope])} · ${esc(i.target)}`}</p>${personal?`<p>${liquidityNames[i.liquidity]}${i.cash_amount!==null?` · 필요 금액 ${Number(i.cash_amount).toLocaleString('ko-KR')}원`:''}${i.cash_date?` · 필요일 ${esc(i.cash_date)}`:''}</p>`:''}${i.notes?`<p class="plan-item-notes">${esc(i.notes)}</p>`:''}<div class="plan-item-footer"><small>${i.expires_on?`만료 ${esc(i.expires_on)} · KST`:'만료일 없음'}</small><div><button class="chip subtle" data-edit="${esc(i.id)}">${due?'재검토':'수정'}</button><button class="chip subtle" data-delete="${esc(i.id)}">삭제</button></div></div></article>`;}
}
