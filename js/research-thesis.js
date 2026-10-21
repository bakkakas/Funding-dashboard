// Account-scoped notes. No shared localStorage fallback and no writes while loading.
export class ResearchThesis {
 constructor(db,host){this.db=db;this.host=host;this.version=0;this.user=null;this.key=null;this.dirty=false;this.busy=false;this.ready=false;
 host.innerHTML='<h3>나의 투자 원칙</h3><p class="data-note" id="thesisAssetLabel"></p><form><label>매수 이유<textarea name="reason" maxlength="6000" rows="4" placeholder="이 종목에 투자하는 이유와 확인할 근거"></textarea></label><label>투자 재고려 요건<textarea name="conditions" maxlength="6000" rows="4" placeholder="어떤 상황이 되면 투자 논리를 다시 검토할지 구체적으로 기록"></textarea></label><div class="thesis-actions"><button type="submit" class="chip">저장</button><span role="status"></span><button type="button" class="chip" data-retry hidden>다시 불러오기</button></div></form>';
 this.form=host.querySelector('form');this.status=host.querySelector('[role=status]');this.retry=host.querySelector('[data-retry]');this.form.oninput=()=>{this.dirty=true;this.status.textContent='저장하지 않은 변경사항';};this.form.onsubmit=e=>{e.preventDefault();void this.save();};this.retry.onclick=()=>this.connect(this.user,this.key,this.label,true);
 window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});
 }
 canLeave(){if(this.busy)return false;return !this.dirty||window.confirm('저장하지 않은 투자 메모를 버리고 이동할까요?');}
 async connect(user,key,label,force=false){
 if(!force&&this.user===user&&this.key===key)return;
 const version=++this.version;this.user=user;this.key=key;this.label=label;this.ready=false;this.dirty=false;this.busy=false;
 this.host.querySelector('#thesisAssetLabel').textContent=label||'';this.form.reset();this.retry.hidden=true;this.enable(false);
 if(!user||!key){this.status.textContent='로그인하면 계정별로 저장하고 다른 기기에서도 볼 수 있어요.';return;}
 this.status.textContent='저장된 투자 원칙 불러오는 중…';
 try{const {data,error}=await this.db.from('research_theses').select('buy_reason,reconsider_conditions,updated_at').eq('user_id',user).eq('asset_key',key).maybeSingle();if(version!==this.version)return;if(error)throw error;
 this.form.elements.reason.value=data?.buy_reason||'';this.form.elements.conditions.value=data?.reconsider_conditions||'';this.ready=true;this.enable(true);this.status.textContent=data?'계정에 저장된 투자 원칙':'작성 후 저장을 눌러주세요.';
 }catch{if(version!==this.version)return;this.status.textContent='불러오기 실패. 기존 메모 보호를 위해 편집을 잠갔어요.';this.retry.hidden=false;}
 }
 enable(on){for(const el of this.form.elements)if(el!==this.retry)el.disabled=!on;}
 async save(){if(!this.user||!this.key||!this.ready||this.busy)return;const version=this.version,user=this.user,key=this.key;this.busy=true;this.enable(false);this.status.textContent='저장 중…';
 try{const {error}=await this.db.from('research_theses').upsert({user_id:user,asset_key:key,buy_reason:this.form.elements.reason.value,reconsider_conditions:this.form.elements.conditions.value},{onConflict:'user_id,asset_key'});if(version!==this.version)return;if(error)throw error;this.dirty=false;this.status.textContent='저장 완료 · 계정 동기화';}
 catch{if(version===this.version)this.status.textContent='저장 실패. 입력은 유지돼요. 다시 저장해 주세요.';}
 finally{if(version===this.version){this.busy=false;this.enable(true);}}
 }
}
