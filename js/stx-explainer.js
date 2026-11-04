// Educational scenarios only. These are not live PoX reward estimates.
export function bondWaterfall(minerBtc, bondDueBtc) {
  if (![minerBtc, bondDueBtc].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid BTC amount');
  const bonds = Math.min(minerBtc, bondDueBtc);
  const excess = Math.max(0, minerBtc - bondDueBtc);
  return { bonds, stxOnly: excess * .85, reserve: excess * .15, shortfall: Math.max(0, bondDueBtc - minerBtc) };
}
const el = (tag, text = '', className = '') => {
  const n = document.createElement(tag); n.textContent = text; n.className = className; return n;
};
export function renderStxExplainer(host, assetId, language) {
  host.replaceChildren(); host.hidden = assetId !== 'stx';
  if (host.hidden) return;
  const en = language === 'en';
  const t = (ko, english) => en ? english : ko;
  const block = (title, className = '') => { const n = el('section', '', `stx-explain-block ${className}`); n.append(el('h4', title)); host.append(n); return n; };
  const cards = (parent, rows, className = '') => {
    const grid = el('div', '', `stx-explain-grid ${className}`);
    rows.forEach(([title, body]) => { const card = el('div', '', 'stx-explain-card'); card.append(el('strong', title), el('p', body)); grid.append(card); }); parent.append(grid);
  };
  const roles = block(t('1. 세 참여자는 서로 다른 역할', '1. Three different roles'));
  cards(roles, [
    [t('Stacks 채굴자', 'Stacks miner'), t('내 BTC를 비용으로 지불 → 블록 생성 권한 경쟁 → 당첨·유효 블록 생산 시 STX 획득. Bitcoin 채굴자와 다르다.', 'Spends its own BTC to compete for block production; earns STX if selected and producing valid blocks. Not a Bitcoin miner.')],
    [t('BTC Bond 참여자', 'BTC bond participant'), t('BTC + 짝지은 STX를 잠금 → BTC 기준 보상을 우선 배분받음. 원금을 채굴자에게 빌려주는 것이 아니다.', 'Locks BTC plus paired STX for priority BTC-denominated rewards. Does not lend the principal to miners.')],
    [t('STX-only 참여자', 'STX-only staker'), t('BTC 없이 STX만 잠금 → Bond 지급 후 남는 보상에 참여. Bond와 별도 경로지만 같은 재원을 공유한다.', 'Locks STX without BTC and shares rewards left after bonds. A separate route drawing on the same reward source.')]
  ]);
  const flow = block(t('2. 이자 재원과 원금은 별개', '2. Rewards and principal are separate'));
  const row = (label, parts, kind) => {
    const line = el('div', '', `stx-money-flow ${kind}`);line.append(el('strong',label));
    parts.forEach((part,i) => {if(i){const arrow=el('span','→','stx-flow-arrow');arrow.setAttribute('aria-hidden','true');line.append(arrow);}line.append(el('span',part,'stx-flow-node'));});flow.append(line);
  };
  row('BTC', [t('채굴자의 기존 BTC', 'Miner’s existing BTC'), t('PoX 보상 경로', 'PoX reward routing'), t('Bond → 잔여분 배분', 'Bonds → excess allocation')], 'btc-flow');
  row('STX', [t('프로토콜 신규 발행 + 이용자 수수료', 'New issuance + user fees'), t('선정된 Stacks 채굴자', 'Selected Stacks miner')], 'stx-flow');
  flow.append(el('p', t('PoX-5는 보상을 sBTC로 자동 연결한 뒤 경로·선택에 따라 BTC 또는 sBTC로 지급한다. “직접 Bond의 BTC 원금은 Bitcoin에 있다”와 “보상 경로에 브리지 위험이 없다”는 다른 말이다.', 'PoX-5 auto-bridges rewards into sBTC; payouts can settle as BTC or sBTC depending on the route/preference. Self-custodial L1 principal does not mean the reward path has no bridge risk.'), 'stx-explain-note'));
  flow.append(el('div', t('잠근 BTC 원금 ≠ 이자 재원\n직접 Bond: 내 키의 Bitcoin 타임락에 보관. 풀: sBTC·풀 계약을 통해 운용. 어느 쪽도 STX를 BTC로 새로 만들어 주는 구조는 아니다.', 'Locked BTC principal ≠ reward source\nDirect bond: a Bitcoin timelock under your keys. Pool: sBTC and pool contracts. Neither creates BTC out of STX.'), 'stx-principal-note'));
  const waterfall = block(t('3. 남는 BTC는 누가 받나? 직접 바꿔보기', '3. Who receives the excess? Try a scenario'), 'stx-waterfall');
  waterfall.append(el('p',t('설명용 가정 · 한 보상 구간의 Bond 목표 지급액을 2 BTC로 고정. 실제 보상·이율 예측이 아니며, 준비금 인출·추가 지원·별도 거래 비용은 제외한다.', 'Illustration only: bond target payouts fixed at 2 BTC for one reward interval. Not a live reward/rate forecast; excludes reserve draws, extra support and separate transaction costs.'),'stx-explain-note'));
  const presets = el('div','','stx-scenario-buttons');
  const label = el('label',t('이번 구간에 들어온 채굴자 BTC', 'Miner BTC received this interval')); label.htmlFor='stxMinerBtc';
  const input = document.createElement('input'); input.type='range';input.id='stxMinerBtc';input.min='0';input.max='10';input.step='.5';input.value='10';
  const output = el('output');output.htmlFor=input.id;
  const control=el('div','','stx-scenario-control');control.append(label,output,input);
  const bar=el('div','','stx-waterfall-bar');bar.setAttribute('aria-hidden','true');
  const totals=el('div','','stx-waterfall-results');totals.setAttribute('aria-live','polite');
  const note=el('p','','stx-explain-note stx-shortfall');
  const fmt=n=>n.toLocaleString(en?'en-US':'ko-KR',{maximumFractionDigits:3});
  const update=()=>{
    const amount=Number(input.value),p=bondWaterfall(amount,2);output.textContent=`${fmt(amount)} BTC`;
    totals.replaceChildren();bar.replaceChildren();
    [[t('① Bond 우선 지급','① Bonds first'),p.bonds,'bond'],[t('② 잔여분 85% · STX-only','② 85% of excess · STX-only'),p.stxOnly,'only'],[t('③ 잔여분 15% · 준비금','③ 15% of excess · reserve'),p.reserve,'reserve']].forEach(([title,value,kind])=>{
      const card=el('div','',`stx-waterfall-result ${kind}`);card.append(el('small',title),el('strong',`${fmt(value)} BTC`));totals.append(card);
      const slice=el('i','',kind);slice.style.width=`${amount?value/amount*100:0}%`;bar.append(slice);
    });
    note.textContent=p.shortfall>0?t(`Bond 목표보다 ${fmt(p.shortfall)} BTC 부족 → 이 예시에서는 STX-only·준비금 몫이 0. 목표 수익률을 보장하지 않는다.`,`Bond target shortfall: ${fmt(p.shortfall)} BTC. STX-only and reserve receive zero in this example; target yield is not guaranteed.`):t(`Bond 2 BTC 지급 후 ${fmt(amount-2)} BTC가 남음 → 그 잔여분만 85:15로 분배. 전체 금액의 85:15가 아니다.`,`After 2 BTC for bonds, ${fmt(amount-2)} BTC remains. Only that excess is split 85:15—not the full inflow.`);
    presets.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.amount)===amount)));
  };
  [[10,t('여유 있음','Surplus')],[2,t('딱 충당','Exactly covered')],[1,t('부족','Shortfall')]].forEach(([value,title])=>{const b=el('button',title,'chip subtle');b.type='button';b.dataset.amount=value;b.addEventListener('click',()=>{input.value=value;update();});presets.append(b);});
  input.addEventListener('input',update);waterfall.append(presets,control,bar,totals,note);
  waterfall.append(el('div',t('준비금 ≠ 운영사의 자유로운 차익\n현재 PoX-5에서는 적립 전용. 사용하려면 SIP·합의 규칙 변경(하드포크)이 필요하므로 부족분을 자동으로 보전하는 예금보험이 아니다. 채굴자의 STX 보상 가치 − BTC 지출 차익은 이 준비금과 별개다.', 'Reserve ≠ operator profit\nPoX-5 reserves are accrual-only. Spending requires a SIP and consensus change (hard fork), not an automatic payout guarantee. Miners’ STX reward value minus BTC costs is a different profit/loss calculation.'),'stx-principal-note'));update();
  const routes=block(t('4. 어떤 자산을 넣는지부터 구분', '4. Compare what you contribute'));
  cards(routes,[
    [t('직접 BTC Bond','Direct BTC bond'),t('BTC + 가입 당시 BTC 가치 약 5%의 STX. 목표 연율 3%, 6개월 수익률이 3%라는 뜻은 아님. 가입 기수의 목표율은 유지되지만 실현 수익은 보장하지 않음.', 'BTC plus STX worth roughly 5% of BTC at entry. Target annual yield 3%; not a 3% return over six months. The cohort target is held constant, but realised returns are not guaranteed.')],
    [t('풀 · Stacking DAO stBTC','Pool · Stacking DAO stBTC'),t('BTC/sBTC 예치 → stBTC 수령. 풀은 기존 STX 상품의 자산에서 짝지을 STX를 공급. sBTC 보상이 stBTC 교환가치에 누적되며 순수익률·출금 조건은 변동.', 'Deposit BTC/sBTC → receive stBTC. The pool supplies paired STX from assets backing its STX products. sBTC yield accrues in stBTC’s redemption value; net yield and withdrawal terms vary.')],
    [t('STX-only · 기존 Stacking','STX-only · Stacking'),t('STX만 잠금. 공식 개요는 연 1~5% 범위를 안내하지만 실시간 확정 이율이 아님. 채굴자 BTC·Bond 지급액·참여 STX에 따라 변하며, STX 원금 가격 위험이 남음.', 'Locks STX only. Official overview quotes a 1–5% annual range, not a current guaranteed rate. Varies with miner BTC, bond payouts and staked STX; STX price risk remains.')]
  ]);
  const timeline=block(t('5. 만기: BTC와 STX가 같은 날 풀리지는 않음','5. Maturity: BTC and STX unlock separately'));
  const list=el('ol','','stx-lock-timeline');
  [[t('시작 · BTC와 STX 잠금','Start · pair BTC and STX'),t('25,200 Bitcoin 블록 ≈ 6개월. 1,050블록마다 약 1주 간격, 총 24회 보상 구간. 달력 날짜는 블록 속도에 따라 변한다.', '25,200 Bitcoin blocks ≈ six months. 24 reward intervals of 1,050 blocks, roughly weekly. Calendar dates depend on block production.')],[t('종료 1,050블록 전 · BTC 표준 최소 언락','1,050 blocks before term end · standard BTC minimum unlock'),t('약 1주 전부터 BTC를 쓸 수 있는 조건 충족. 개별 UTXO는 더 오래 잠길 수 있다. 재가입은 새 Bitcoin 거래가 필요하며 자동 재등록이 아니다.', 'Roughly a week before term end, the standard BTC timelock becomes spendable. Individual UTXOs may lock longer. Renewal needs a new Bitcoin transaction; no automatic L1 re-enrollment.')],[t('종료 · STX 잠금 해제 또는 사전 연장','Term end · STX unlock or prior extension'),t('연장하지 않은 STX는 다시 유통 가능. 잠금 해제는 자동 송금이나 소각이 아니다. 풀 이용자의 즉시 출금·대기 기간은 풀 약관과 유동성에 따라 별도다.', 'Unextended STX becomes liquid again. Unlocking is not an automatic transfer or burn. Pool instant redemption/cooldowns follow separate terms and available liquidity.')]].forEach(([title,body])=>{const item=el('li');item.append(el('strong',title),el('p',body));list.append(item);});timeline.append(list);
  const link=el('a',t('본드별 실제 수량·예상 언락은 위 현황에서 확인 ↑','See current bond amounts and estimated unlocks above ↑'),'source-link');link.href='#stxBondsSummary';link.addEventListener('click',event=>{event.preventDefault();document.getElementById('stxBondsSummary').scrollIntoView({behavior:'instant',block:'start'});});timeline.append(link);
  host.append(el('p',t('구조 확인: 2026-11-04 · PoX-5 기준. 준비금·보상 경로는 SIP-045, 상품 조건은 공식 안내·Stacking DAO 문서 기준. 아래 원문 링크에서 변경 여부를 확인할 수 있습니다.', 'Reviewed 2026-11-04 · PoX-5. Reserve/reward routing follows SIP-045; product terms follow official guides and Stacking DAO docs. Sources are linked below.'),'stx-explain-note'));
}
