// Long-only moving-average ledger. Currency pools never silently convert.
export const currencies=['KRW','USD'];
export const emptyBook=()=>({initial:{KRW:0,USD:0},trades:[]});
const fail=m=>{throw Error(m);};
const n=(v,positive=false)=>{if(v==null||v===''||typeof v==='boolean')fail('금액·수량을 입력해 주세요.');const x=Number(v);if(!Number.isFinite(x)||x<0||(positive&&x===0)||x>1e14)fail('금액·수량 범위를 확인해 주세요.');return x;};
const text=(v,max=1000)=>{if(typeof v!=='string'||v.length>max)fail('텍스트 입력을 확인해 주세요.');return v.trim();};
export const assetKey=a=>`${a.quote_symbol}|${a.currency}`;
export const dayKst=at=>new Date(new Date(at).getTime()+9*3600000).toISOString().slice(0,10);
export function validateBook(input,mode='real',now=Date.now()){
 if(!['real','paper'].includes(mode)||!input||!Array.isArray(input.trades)||input.trades.length>2000)fail('거래 기록 형식을 확인해 주세요.');
 const book={initial:{KRW:n(input.initial?.KRW),USD:n(input.initial?.USD)},trades:[]},ids=new Set();
 for(const raw of input.trades){
  const a=raw.asset||{},id=text(raw.id,80),at=new Date(raw.at).getTime();
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(id)||ids.has(id))fail('중복 거래 ID');ids.add(id);
  if(!Number.isFinite(at)||at<Date.UTC(1900,0,1)||at>now+60000)fail('거래 일시를 확인해 주세요. 미래 거래는 기록할 수 없어요.');
  if(!['buy','sell'].includes(raw.side)||!currencies.includes(a.currency)||!['stock','crypto','commodity'].includes(a.asset_class))fail('거래 종류·통화를 확인해 주세요.');
  const asset={name:text(a.name,120),symbol:text(a.symbol,80),quote_symbol:text(a.quote_symbol,160),currency:a.currency,asset_class:a.asset_class};
  if(!asset.name||!asset.symbol||!asset.quote_symbol)fail('종목을 선택해 주세요.');
  const price=n(raw.price,true),qty=n(raw.qty,true),fee=n(raw.fee);
  if(qty<1e-12||qty*price>1e14||!Number.isFinite(qty*price)||fee>qty*price)fail('거래대금·비용 범위를 확인해 주세요.');
  const sl=raw.sl==null||raw.sl===''?null:n(raw.sl,true);
  if(raw.side==='buy'&&sl!=null&&sl>=price)fail('매수 SL은 진입 가격보다 낮아야 해요.');
  const quote=raw.quote?{source:text(raw.quote.source,120),as_of:text(raw.quote.as_of,120),fetched_at:text(raw.quote.fetched_at,60)}:null;
  if(mode==='paper'&&(!quote||!Number.isFinite(Date.parse(quote.fetched_at))))fail('모의 거래에는 조회 시세가 필요해요.');
  book.trades.push({id,at:new Date(at).toISOString(),asset,side:raw.side,qty,price,fee,sl,reason:text(raw.reason||'',2000),note:text(raw.note||'',2000),quote});
 }
 return book;
}
export function ledger(input,mode='real',now=Date.now()){
 const book=validateBook(input,mode,now),positions=new Map(),cash={...book.initial},realized={KRW:0,USD:0},rows=[];
 const trades=book.trades.map((t,i)=>({...t,index:i})).sort((a,b)=>a.at.localeCompare(b.at)||a.index-b.index);
 for(const t of trades){
  const key=assetKey(t.asset),c=t.asset.currency;
  let p=positions.get(key);if(!p){p={asset:t.asset,qty:0,cost:0,realized:0,cycleProfit:0,cycleCost:0};positions.set(key,p);}
  if(p.asset.asset_class!==t.asset.asset_class)fail('같은 종목의 자산 분류가 달라요.');
  const gross=t.qty*t.price;let profit=null,basis=null;
  if(t.side==='buy'){
   if(p.qty===0){p.cycleProfit=0;p.cycleCost=0;}
   if(mode==='paper'&&gross+t.fee>cash[c]+1e-8)fail(`${c} 모의 현금이 부족해요.`);
   cash[c]-=gross+t.fee;p.qty+=t.qty;p.cost+=gross+t.fee;
  }else{
   if(t.qty>p.qty+Math.max(1e-12,p.qty*1e-12)||!p.qty)fail(`${t.asset.name}: 보유 수량보다 많이 매도할 수 없어요.`);
   const remaining=p.qty-t.qty;
   basis=p.cost*(t.qty/p.qty);profit=gross-t.fee-basis;p.qty=remaining;p.cost-=basis;
   if(Math.abs(remaining)<Math.max(1e-12,t.qty*1e-12)){p.qty=0;p.cost=0;}
   cash[c]+=gross-t.fee;p.realized+=profit;realized[c]+=profit;p.cycleProfit+=profit;p.cycleCost+=basis;
  }
  rows.push({...t,basis,profit,return_pct:basis>0?profit/basis*100:null,closed:t.side==='sell'&&p.qty===0,closed_profit:t.side==='sell'&&p.qty===0?p.cycleProfit:null,closed_return:t.side==='sell'&&p.qty===0&&p.cycleCost>0?p.cycleProfit/p.cycleCost*100:null});
 }
 return {book,positions:[...positions.values()],cash,realized,rows};
}
export function periodKey(at,unit){const d=dayKst(at);if(unit==='month')return d.slice(0,7);if(unit==='week'){const date=new Date(d+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);}return d;}
export function periodSummary(rows,unit,currency,from='',to=''){
 const groups=new Map();for(const t of rows){const d=dayKst(t.at);if(t.profit==null||t.asset.currency!==currency||(from&&d<from)||(to&&d>to))continue;
 const key=periodKey(t.at,unit),g=groups.get(key)||{key,profit:0,basis:0,count:0};g.profit+=t.profit;g.basis+=t.basis;g.count++;groups.set(key,g);}
 return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
export function valuation(result,quotes,currency){
 let value=0,cost=0,missing=0;for(const p of result.positions.filter(p=>p.qty>0&&p.asset.currency===currency)){
  cost+=p.cost;const q=quotes[assetKey(p.asset)];if(!q||!Number.isFinite(q.price)||q.price<=0){missing++;continue;}value+=p.qty*q.price;
 }return {value:missing?null:value,cost,unrealized:missing?null:value-cost,missing};
}
