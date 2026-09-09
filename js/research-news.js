import { safeUrl } from './research-data.js?v=1';

// 09:00 Asia/Seoul is midnight UTC. Editions expire even if the next job fails.
export const newsEdition = (now = new Date()) => new Date(now).toISOString().slice(0, 10);
export function selectDailyNews({batch,items=[],pins=[],favorite=false,now=new Date()}) {
  const edition=newsEdition(now);
  const byId=new Map(items.map(item=>[item.id,item]));
  const pinned=new Set(pins.map(pin=>pin.news_id));
  const held=items.filter(item=>pinned.has(item.id));
  const boundary=Date.parse(edition+'T00:00:00Z');
  const fresh=favorite && batch?.edition_date===edition && batch.status==='success'
    ? (batch.article_ids||[]).slice(0,3).map(id=>byId.get(id)).filter(item=>item && !pinned.has(item.id)
      && Date.parse(item.published_at)>=boundary-86400000 && Date.parse(item.published_at)<boundary) : [];
  return {held,fresh,edition,status:!favorite?'not-favorite':batch?.edition_date!==edition?'pending':batch.status};
}

export class ResearchNewsAccount {
  constructor(client,{onChange=()=>{},legacyFavorites=()=>[],shouldImportLegacy=()=>true,onLegacyImported=()=>{}}={}) {
    this.client=client;this.onChange=onChange;this.legacyFavorites=legacyFavorites;
    this.shouldImportLegacy=shouldImportLegacy;this.onLegacyImported=onLegacyImported;
    this.generation=0;this.userId=null;this.ready=false;this.busy=false;this.favorites=[];this.error='';
  }
  emit(){this.onChange(this);}
  reset(userId=null){this.generation++;this.userId=userId;this.ready=false;this.busy=false;this.favorites=[];this.error='';}
  async connect(userId) {
    if(this.userId===userId && (this.ready||this.busy))return;
    const generation=++this.generation;
    this.userId=userId;this.ready=false;this.busy=!!userId;this.favorites=[];this.error='';this.emit();
    if(!userId)return;
    try {
      // Ensure an account row exists first. Browser favorites are merged below
      // through the atomic RPC, so an existing empty row cannot block import.
      let result=await this.client.from('research_preferences').select('favorites').eq('user_id',userId).maybeSingle();
      if(result.error)throw result.error;
      if(generation!==this.generation)return;
      if(!result.data) {
        const inserted=await this.client.from('research_preferences').upsert({user_id:userId,favorites:[]},{onConflict:'user_id',ignoreDuplicates:true});
        if(inserted.error)throw inserted.error;
        result=await this.client.from('research_preferences').select('favorites').eq('user_id',userId).single();
        if(result.error)throw result.error;
      }
      if(generation!==this.generation)return;
      let favorites=result.data.favorites||[];
      if(this.shouldImportLegacy(userId)) {
        const legacy=[...new Set(this.legacyFavorites(userId))].filter(id=>/^[a-z0-9][a-z0-9-]*$/.test(id)).slice(0,200);
        for(const id of legacy) {
          if(favorites.includes(id))continue;
          const imported=await this.client.rpc('research_set_favorite',{p_asset_id:id,p_enabled:true,p_expected_user:userId});
          if(imported.error)throw imported.error;
          if(generation!==this.generation)return;
          favorites=imported.data||favorites;
        }
        this.onLegacyImported(userId);
      }
      this.favorites=favorites;this.ready=true;
    }catch(error){if(generation===this.generation)this.error='즐겨찾기 동기화 실패 · 다시 시도';}
    finally{if(generation===this.generation){this.busy=false;this.emit();}}
  }
  async toggle(id,enabled) {
    if(!this.userId||!this.ready||this.busy)return false;
    const generation=this.generation,userId=this.userId;
    this.busy=true;this.error='';this.emit();
    try {
      const {data,error}=await this.client.rpc('research_set_favorite',{p_asset_id:id,p_enabled:enabled,p_expected_user:userId});
      if(error)throw error;
      if(generation!==this.generation)return false;
      this.favorites=data;return true;
    }catch(error){if(generation===this.generation)this.error='즐겨찾기 저장 실패 · 변경 미반영';return false;}
    finally{if(generation===this.generation){this.busy=false;this.emit();}}
  }
}

export class ResearchNewsPanel {
  constructor(client,host,{getContext}) {
    this.client=client;this.host=host;this.getContext=getContext;this.version=0;this.state=null;this.loading=false;this.error='';this.saving=false;this.key='';
  }
  async refresh(force=false) {
    const context=this.getContext();
    const key=[context.userId,context.assetId,context.favorite,newsEdition()].join(':');
    if(!force&&key===this.key){this.render();return;}
    this.key=key;const version=++this.version;this.state=null;this.error='';this.loading=!!context.userId;this.render();
    if(!context.userId||!context.assetId)return;
    try {
      const [batchResult,pinsResult]=await Promise.all([
        this.client.from('research_news_batches').select('*').eq('asset_id',context.assetId).eq('edition_date',newsEdition()).maybeSingle(),
        this.client.from('research_news_pins').select('news_id,research_news_items(*)').eq('user_id',context.userId),
      ]);
      if(batchResult.error)throw batchResult.error;if(pinsResult.error)throw pinsResult.error;
      const pins=(pinsResult.data||[]).filter(p=>p.research_news_items?.asset_id===context.assetId);
      const ids=context.favorite?(batchResult.data?.article_ids||[]):[];
      const daily=ids.length?await this.client.from('research_news_items').select('*').in('id',ids):{data:[]};
      if(daily.error)throw daily.error;
      if(version!==this.version)return;
      this.state={batch:batchResult.data,pins,items:[...new Map([...pins.map(p=>p.research_news_items),...(daily.data||[])].map(n=>[n.id,n])).values()]};
    }catch(error){if(version===this.version)this.error='뉴스를 불러오지 못했어. 잠시 후 다시 시도해 줘.';}
    finally{if(version===this.version){this.loading=false;this.render();}}
  }
  async pin(id,enabled) {
    if(this.saving)return;
    const {userId,assetId}=this.getContext();
    const sameContext=()=>{const c=this.getContext();return c.userId===userId&&c.assetId===assetId;};
    if(!userId)return;
    this.saving=true;this.render();
    try {
      const result=enabled?await this.client.from('research_news_pins').upsert({user_id:userId,news_id:id},{onConflict:'user_id,news_id',ignoreDuplicates:true})
        :await this.client.from('research_news_pins').delete().eq('user_id',userId).eq('news_id',id);
      if(result.error)throw result.error;
      if(sameContext())await this.refresh(true);
    }catch(error){if(sameContext())this.error='고정 변경 저장 실패 · 다시 시도해 줘.';}
    finally{this.saving=false;this.render();}
  }
  render() {
    const {userId,favorite,language}=this.getContext(),en=language==='en';
    const text=(ko,english)=>en?english:ko;
    const node=(tag,content,cls='')=>{const e=document.createElement(tag);e.textContent=content;e.className=cls;return e;};
    this.host.replaceChildren();
    const header=node('div','','daily-news-heading');
    header.append(node('h3',text('오늘의 주요 뉴스','Daily news')));
    const retry=node('button',text('새로고침','Refresh'),'chip subtle');retry.type='button';retry.disabled=this.loading||this.saving;retry.onclick=()=>this.refresh(true);header.append(retry);this.host.append(header);
    this.host.append(node('p',text('매일 09:00 KST 스크리닝 · 발행 24시간 이내 최대 3개 · 고정 뉴스는 별도 유지','Daily screening at 09:00 KST · up to 3 articles published in the preceding 24 hours · pins retained separately'),'daily-news-note'));
    const keepHint=node('label','','daily-news-pin daily-news-pin-hint');
    const keepHintInput=document.createElement('input');keepHintInput.type='checkbox';keepHintInput.disabled=true;
    keepHint.append(keepHintInput,document.createTextNode(text("뉴스 카드의 '계속 보관'을 체크하면 다음 날에도 유지","Check 'Keep pinned' on a news card to retain it the next day")));
    this.host.append(keepHint);
    if(!userId){this.host.append(node('p',text('로그인하면 즐겨찾기 종목의 자동 뉴스와 고정 보관을 사용할 수 있어.','Sign in for favorite-asset screening and saved news.')));return;}
    if(this.loading){this.host.append(node('p',text('계정 뉴스 불러오는 중…','Loading account news…')));return;}
    if(this.error){this.host.append(node('p',text(this.error,'News sync failed. Please retry.'),'daily-news-error'));return;}
    const result=selectDailyNews({...this.state,favorite});
    const status={pending:text('오늘 스크리닝 대기 · 이전 미고정 뉴스는 만료','Awaiting today’s screening · previous unpinned news expired'),error:text('오늘 수집 실패 · 뉴스 없음과 구분','Today’s screening failed · not a no-news result'),success:text('오늘 선정 완료','Today’s screening complete'),'not-favorite':text('즐겨찾기에 추가하면 다음 오전 9시부터 스크리닝 대상','Favorite this asset to include it in the next 09:00 screening')};
    this.host.append(node('p',result.edition+' · '+status[result.status],'daily-news-status'));
    if(result.status==='success'&&this.state?.batch?.screened_at)this.host.append(node('small',text('확인: ','Checked: ')+new Date(this.state.batch.screened_at).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul'})+' KST'));
    const rows=(items,pinned)=>{
      if(!items.length)return;
      this.host.append(node('h4',pinned?text('계속 보관','Pinned'):text('오늘 선정','Today’s selections')));
      for(const item of items){
        const card=node('div','','daily-news-item');
        const title=node('a',item.title);title.href=safeUrl(item.source_url);title.target='_blank';title.rel='noopener noreferrer';
        const types={official_blog:text('공식 블로그','Official blog'),x:'X',media:text('미디어','Media'),governance:text('거버넌스','Governance'),docs:text('공식 문서','Docs')};
        const date=new Date(item.published_at).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul'});
        card.append(node('small',`${types[item.source_type]||''} · ${item.source_name} · ${date} KST`),title,node('p',item.summary));
        const label=node('label','','daily-news-pin');const input=document.createElement('input');input.type='checkbox';input.checked=pinned;input.disabled=this.saving;input.dataset.newsId=item.id;input.onchange=()=>this.pin(item.id,input.checked);
        label.append(input,document.createTextNode(text('계속 보관','Keep pinned')));card.append(label);this.host.append(card);
      }
    };
    rows(result.held,true);rows(result.fresh,false);
    if(result.status==='success'&&!result.fresh.length&&!result.held.length)this.host.append(node('p',text('조건에 맞는 주요 뉴스 없음. 오래된 기사로 채우지 않음.','No qualifying major news. Older articles are not substituted.')));
  }
}
