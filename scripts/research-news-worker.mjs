import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const project='xdsuepwoncvomljvjtmx';
const sqlUrl=`https://supabase.com/dashboard/project/${project}/sql/42d643d1-ac8f-47c2-9195-fc4d1002072b`;
const browser=(...args)=>JSON.parse(execFileSync('openclaw',['browser',...args,'--json'],{encoding:'utf8',timeout:45000,maxBuffer:2000000}));
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";

// Uses the existing administrator browser session. Never reads or exports tokens.
// The scheduled worker exposes only targets, validate and publish commands.
export async function sqlResult(expression) {
  const tabs=browser('tabs').tabs;
  let tab=tabs.find(t=>t.url===sqlUrl);
  if(!tab)tab=browser('open',sqlUrl);
  const target=tab.targetId;
  browser('wait','--target-id',target,'--fn','!!window.monaco?.editor.getModels().length','--timeout-ms','20000');
  const request=randomUUID();
  const sql=`select json_build_object('request',${quote(request)},'result',(${expression}))::text as research_worker_result;`;
  browser('evaluate','--target-id',target,'--fn',`()=>{window.monaco.editor.getModels()[0].setValue(${JSON.stringify(sql)});return true;}`);
  // Separate call lets the editor's React state settle before pressing Run.
  browser('evaluate','--target-id',target,'--fn',`()=>{const b=[...document.querySelectorAll('button')].find(b=>/^Run/.test(b.textContent.trim()));if(!b)throw Error('SQL Run unavailable');b.click();return true;}`);
  const resultFn=`()=>{for(const cell of document.querySelectorAll('[role="gridcell"],td')){try{const value=JSON.parse(cell.textContent);if(value.request===${JSON.stringify(request)})return value;}catch{}}return null;}`;
  browser('wait','--target-id',target,'--fn',`!!(${resultFn})()`,'--timeout-ms','20000');
  const response=browser('evaluate','--target-id',target,'--fn',resultFn);
  return (response.result??response).result;
}

export function validatePublication(input,now=new Date()) {
  const edition=new Date(now).toISOString().slice(0,10);
  if(input?.edition!==edition||!Array.isArray(input.batches))throw Error('Expected current edition and batches');
  const boundary=Date.parse(edition+'T00:00:00Z');
  const catalog=JSON.parse(readFileSync(path.join(root,'data/research/index.json'),'utf8'));
  const known=new Set(catalog.assets.map(a=>a.id));
  const seenAssets=new Set();
  for(const batch of input.batches) {
    if(!known.has(batch.asset_id)||seenAssets.has(batch.asset_id))throw Error('Unknown/duplicate asset');
    seenAssets.add(batch.asset_id);
    if(!['success','error'].includes(batch.status)||!Array.isArray(batch.items)||batch.items.length>3||(batch.status==='error'&&batch.items.length))throw Error('Invalid batch');
    const urls=new Set();
    for(const item of batch.items) {
      const date=Date.parse(item.published_at);
      if(!/(Z|[+-]\d{2}:\d{2})$/.test(item.published_at)||!Number.isFinite(date)||date<boundary-86400000||date>=boundary)throw Error('Article outside anchored 24h window or missing timezone');
      const url=new URL(item.source_url);
      if(url.protocol!=='https:'||url.username||url.password||urls.has(url.href))throw Error('Invalid/duplicate source URL');
      urls.add(url.href);item.source_url=url.href;
      for(const [key,max] of [['title',300],['summary',1500],['source_name',150]])if(typeof item[key]!=='string'||!item[key].trim()||item[key].length>max)throw Error('Invalid '+key);
      if(!['official_blog','x','media','governance','docs'].includes(item.source_type))throw Error('Invalid source type');
    }
  }
  return input;
}

export async function targets() {
  const ids=await sqlResult("select coalesce(json_agg(asset_id order by asset_id),'[]'::json) from (select distinct unnest(favorites) as asset_id from public.research_preferences) f");
  const catalog=JSON.parse(readFileSync(path.join(root,'data/research/index.json'),'utf8'));
  const allowed=new Set(catalog.assets.map(a=>a.id));
  return {edition:new Date().toISOString().slice(0,10),assets:(ids||[]).filter(id=>allowed.has(id)).map(id=>JSON.parse(readFileSync(path.join(root,'data/research',id+'.json'),'utf8')))};
}

async function main() {
  const [command,file]=process.argv.slice(2);
  if(command==='targets')return targets();
  if(command==='validate'||command==='publish') {
    if(!file)throw Error('Input JSON path required');
    const input=validatePublication(JSON.parse(readFileSync(file,'utf8')));
    if(command==='validate')return {valid:true,batches:input.batches.length};
    const active=await targets();const favorites=new Set(active.assets.map(a=>a.id));
    // A removed favorite is not screened/published just because it was in a prior snapshot.
    const batches=input.batches.filter(b=>favorites.has(b.asset_id));
    const written=await sqlResult(`public.research_publish_news(${quote(input.edition)}::date,${quote(JSON.stringify(batches))}::jsonb)`);
    return {edition:input.edition,written,skipped:input.batches.length-batches.length};
  }
  throw Error('Usage: node scripts/research-news-worker.mjs targets | validate FILE | publish FILE');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n')).catch(()=>{process.stderr.write('Research news worker failed. Check input validation or the authenticated Supabase SQL browser session; never export credentials.\n');process.exitCode=1;});
}
