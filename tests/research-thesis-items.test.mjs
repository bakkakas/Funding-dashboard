import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeThesisItem,activeIssues,issueDays,issueState,seoulDate} from '../js/research-thesis-model.js';
test('thesis items keep multiline legacy content while new items validate independently',()=>{
 const body='첫 번째 근거\n두 번째 근거';
 assert.deepEqual(normalizeThesisItem({kind:'reason',body,starts_on:'2026-10-01'}),{kind:'reason',body,starts_on:null,ends_on:null,sentiment:null});
 assert.equal(normalizeThesisItem({kind:'conditions',body:' a '}).body,'a');
 assert.throws(()=>normalizeThesisItem({kind:'other',body:'a'}));
 assert.throws(()=>normalizeThesisItem({kind:'reason',body:' '}));
 assert.throws(()=>normalizeThesisItem({kind:'reason',body:'a'.repeat(6001)}));
});
test('issue range is mandatory, inclusive and calendar-valid',()=>{
 const item={kind:'issue',body:'실적 발표',starts_on:'2026-10-29',ends_on:'2026-11-02'};
 assert.deepEqual(normalizeThesisItem(item),{...item,sentiment:null});
 for(const patch of [{starts_on:''},{ends_on:''},{ends_on:'2026-02-30'},{ends_on:'2026-10-28'},{body:'a'.repeat(301)}])assert.throws(()=>normalizeThesisItem({...item,...patch}));
 assert.equal(normalizeThesisItem({...item,ends_on:item.starts_on}).ends_on,item.starts_on);
});
test('scheduled issues enter at start and hide the day after end, including KST midnight',()=>{
 const item={id:'a',kind:'issue',created_at:'2026-10-01',starts_on:'2026-10-29',ends_on:'2026-10-30'};
 assert.equal(activeIssues([item],seoulDate(new Date('2026-10-28T14:59:59Z'))).length,0);
 assert.equal(activeIssues([item],seoulDate(new Date('2026-10-28T15:00:00Z'))).length,1);
 assert.equal(activeIssues([item],'2026-10-30').length,1);
 assert.equal(activeIssues([item],'2026-10-31').length,0);
 assert.equal(issueDays(item,'2026-10-29'),1);assert.equal(issueDays(item,'2026-10-30'),0);
 assert.equal(issueState(item,'2026-10-28'),'예정');assert.equal(issueState(item,'2026-10-31'),'종료');
});
test('only issues are pinned, sorted by end date without changing source collection',()=>{
 const row={id:'a',kind:'issue',created_at:'2026-10-01',starts_on:'2026-10-01',ends_on:'2026-11-02'};
 const rows=[row,{...row,id:'b',ends_on:'2026-10-30'},{...row,id:'c',kind:'reason'}];
 assert.deepEqual(activeIssues(rows,'2026-10-29').map(x=>x.id),['b','a']);
 assert.equal(rows.length,3);assert.equal(rows[0].id,'a');
});

test('sentiment is validated, legacy issues remain unclassified and non-issues cannot carry it',()=>{
 const issue={kind:'issue',body:'첫 줄\n둘째 줄',starts_on:'2026-10-29',ends_on:'2026-10-30'};
 for(const sentiment of ['positive','negative'])assert.equal(normalizeThesisItem({...issue,sentiment}).sentiment,sentiment);
 assert.equal(normalizeThesisItem(issue).sentiment,null);
 assert.throws(()=>normalizeThesisItem({...issue,sentiment:'invalid'}));
 assert.equal(normalizeThesisItem({kind:'reason',body:'이유',sentiment:'negative'}).sentiment,null);
 assert.equal(normalizeThesisItem(issue).body,issue.body);
});
