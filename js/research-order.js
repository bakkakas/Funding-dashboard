export const ORDER_KEY='fundingResearchOrderV1';
export function orderedIds(ids,saved=[]){const valid=new Set(ids);return [...new Set([...saved.filter(id=>valid.has(id)),...ids])];}
export function moveId(ids,source,target,after=false){if(source===target||!ids.includes(source)||!ids.includes(target))return [...ids];const next=ids.filter(id=>id!==source);next.splice(next.indexOf(target)+(after?1:0),0,source);return next;}
export function loadOrder(ids){try{const value=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');return orderedIds(ids,Array.isArray(value)?value:[]);}catch{return [...ids];}}
export function sortCatalog(catalog){const byId=new Map(catalog.map(a=>[a.id,a]));return loadOrder([...byId.keys()]).map(id=>byId.get(id));}
export function bindResearchOrder(root,getIds,rerender){
 let dragging=null;
 const clear=()=>{dragging=null;root.querySelectorAll('.drop-before,.drop-after').forEach(r=>r.classList.remove('drop-before','drop-after'));};
 const save=(source,target,after)=>{const ids=moveId(loadOrder(getIds()),source,target,after);try{localStorage.setItem(ORDER_KEY,JSON.stringify(ids));}catch{root.setAttribute('aria-label','정렬 저장 실패: 브라우저 저장소를 확인해 주세요.');return;}rerender();};
 root.addEventListener('dragstart',e=>{const handle=e.target.closest('[data-drag-asset]');if(!handle)return;dragging=handle.dataset.dragAsset;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';});
 root.addEventListener('dragover',e=>{const row=e.target.closest('[data-asset-id]');if(!dragging||!row||row.hidden)return;e.preventDefault();e.dataTransfer.dropEffect='move';root.querySelectorAll('.drop-before,.drop-after').forEach(r=>r.classList.remove('drop-before','drop-after'));row.classList.add(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2?'drop-after':'drop-before');});
 root.addEventListener('drop',e=>{const row=e.target.closest('[data-asset-id]');if(!dragging||!row)return;e.preventDefault();save(dragging,row.dataset.assetId,e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);clear();});
 root.addEventListener('dragend',clear);
 root.addEventListener('keydown',e=>{const handle=e.target.closest('[data-drag-asset]');if(!handle||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const visible=[...root.querySelectorAll('[data-asset-id]')].filter(r=>!r.hidden).map(r=>r.dataset.assetId),source=handle.dataset.dragAsset,target=visible[visible.indexOf(source)+(e.key==='ArrowDown'?1:-1)];if(target){save(source,target,e.key==='ArrowDown');[...root.querySelectorAll('[data-drag-asset]')].find(b=>b.dataset.dragAsset===source)?.focus();}});
}
