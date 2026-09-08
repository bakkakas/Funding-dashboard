import test from 'node:test';
import assert from 'node:assert/strict';
import {newsEdition,selectDailyNews,ResearchNewsAccount} from '../js/research-news.js';
import {validatePublication} from '../scripts/research-news-worker.mjs';
const now=new Date('2026-09-08T04:00:00Z');
const make=(id,date='2026-09-07T23:00:00Z')=>({id,published_at:date});
test('09:00 KST changes the daily edition even without a new worker result',()=>{
  assert.equal(newsEdition('2026-09-07T23:59:59Z'),'2026-09-07');
  assert.equal(newsEdition('2026-09-08T00:00:00Z'),'2026-09-08');
  const result=selectDailyNews({now,favorite:true,batch:{edition_date:'2026-09-07',status:'success',article_ids:['old']},items:[make('old')],pins:[]});
  assert.equal(result.status,'pending');assert.equal(result.fresh.length,0);
});
test('only the preceding 24h and at most three items can appear; pins exempt and deduplicated',()=>{
  const items=[make('a'),make('b'),make('c'),make('d'),make('old','2026-08-01T00:00:00Z')];
  const state={now,favorite:true,batch:{edition_date:'2026-09-08',status:'success',article_ids:['a','b','c','d']},items,pins:[{news_id:'a'},{news_id:'old'}]};
  const result=selectDailyNews(state);
  assert.deepEqual(result.fresh.map(n=>n.id),['b','c']);assert.deepEqual(result.held.map(n=>n.id),['a','old']);
  assert.equal(selectDailyNews({...state,favorite:false}).fresh.length,0);
  assert.equal(selectDailyNews({...state,favorite:false}).held.length,2);
});
test('no qualifying news, failed screening and waiting are different states',()=>{
  for(const status of ['success','error'])assert.equal(selectDailyNews({now,favorite:true,batch:{edition_date:'2026-09-08',status,article_ids:[]}}).status,status);
  assert.equal(selectDailyNews({now,favorite:true}).status,'pending');
});
test('rejects future and over-24-hour unpinned articles at the edition boundary',()=>{
  const items=[make('early','2026-09-06T23:59:59Z'),make('boundary','2026-09-07T00:00:00Z'),make('future','2026-09-08T00:00:00Z')];
  const result=selectDailyNews({now,favorite:true,items,batch:{edition_date:'2026-09-08',status:'success',article_ids:items.map(i=>i.id)}});
  assert.deepEqual(result.fresh.map(n=>n.id),['boundary']);
});
test('late account reads cannot repopulate favorites after logout',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>pending})})})};
  const state=new ResearchNewsAccount(client);
  const first=state.connect('account-a');await state.connect(null);
  resolve({data:{favorites:['ena']}});await first;
  assert.equal(state.userId,null);assert.deepEqual(state.favorites,[]);assert.equal(state.ready,false);
});
test('account mismatch or RPC failure never reports a saved favorite',async()=>{
  const state=new ResearchNewsAccount({rpc:async()=>({error:{message:'rejected'}})});
  state.userId='account-a';state.ready=true;state.favorites=['ethfi'];
  assert.equal(await state.toggle('ena',true),false);
  assert.deepEqual(state.favorites,['ethfi']);assert.ok(state.error);
});
test('worker validates known assets, caps, source dates, URLs and duplicate batches',()=>{
  const item={title:'Test',summary:'Summary',source_name:'Official',source_url:'https://example.com/news',source_type:'official_blog',published_at:'2026-09-07T23:00:00Z'};
  const valid={edition:'2026-09-08',batches:[{asset_id:'ena',status:'success',items:[item]}]};
  assert.equal(validatePublication(structuredClone(valid),now).batches.length,1);
  for(const mutate of [
    x=>x.edition='2026-09-07',x=>x.batches[0].asset_id='fake',
    x=>x.batches.push(structuredClone(x.batches[0])),x=>x.batches[0].status='error',
    x=>x.batches[0].items[0].published_at='2026-09-07',
    x=>x.batches[0].items[0].published_at='2026-09-08T00:00:00Z',
    x=>x.batches[0].items[0].source_url='javascript:alert(1)',
    x=>x.batches[0].items.push(item),x=>x.batches[0].items=Array(4).fill(item)
  ]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validatePublication(bad,now));}
});
test('stale no-record response cannot start legacy import after account switch',async()=>{
  let resolve;let writes=0;const pending=new Promise(r=>resolve=r);
  const state=new ResearchNewsAccount({from:()=>({select:()=>({eq:()=>({maybeSingle:()=>pending})}),upsert:()=>{writes++;return {};}})});
  const first=state.connect('a');state.reset('b');resolve({data:null});await first;
  assert.equal(writes,0);assert.equal(state.userId,'b');assert.deepEqual(state.favorites,[]);
});
