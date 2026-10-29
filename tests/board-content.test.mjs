import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContent,emptyContent,pageKey} from '../js/board-content-model.js';
test('plain multiline content is preserved without HTML interpretation or unknown keys',()=>{
 const input={...emptyContent(),texts:{intro:'첫 줄\n<script>alert(1)</script>',deleted:''}};
 assert.deepEqual(normalizeContent(input),input);
 assert.throws(()=>normalizeContent({...input,html:'<iframe>'}));
 assert.throws(()=>normalizeContent(JSON.parse('{"texts":{"__proto__":"x"},"blocks":{},"custom":[]}')));
 assert.throws(()=>normalizeContent({...input,texts:{intro:'x'.repeat(6001)}}));
});
test('block sizes and order are bounded and no arbitrary CSS is accepted',()=>{
 const base={width:'half',height:240,order:10,hidden:false};
 assert.deepEqual(normalizeContent({...emptyContent(),blocks:{chart:base}}).blocks.chart,base);
 for(const patch of [{width:'100vw'},{height:-1},{height:1201},{height:1.5},{hidden:'false'},{order:1001},{css:'position:fixed'}])assert.throws(()=>normalizeContent({...emptyContent(),blocks:{chart:{...base,...patch}}}));
});
test('custom blocks have stable unique identities and bounded text',()=>{
 const row={id:'custom-12345678-1234-1234-1234-123456789012',group:'stock-sections',title:'안내',body:'두 줄\n내용'};
 assert.deepEqual(normalizeContent({...emptyContent(),custom:[row]}).custom,[row]);
 assert.throws(()=>normalizeContent({...emptyContent(),custom:[row,row]}));
 assert.throws(()=>normalizeContent({...emptyContent(),custom:[{...row,title:'',body:' '}]}));
 assert.throws(()=>normalizeContent({...emptyContent(),custom:[{...row,group:'body > script'}]}));
});
test('presentation scopes separate pages, selected assets, plan and language, not user identity',()=>{
 assert.equal(pageKey('/Funding-dashboard/',''), 'funding:ko');
 assert.equal(pageKey('/investment-setup.html','?asset=stock-005930'), 'investment:stock-005930:ko');
 assert.equal(pageKey('/investment-setup.html','?asset=stock-000660',true,'en'), 'investment:plan:en');
 assert.equal(pageKey('/investment-setup.html','?asset=../invalid'), 'investment:other:ko');
 assert.notEqual(pageKey('/investment-setup.html','?asset=stock-005930'),pageKey('/investment-setup.html','?asset=stock-000660'));
});
