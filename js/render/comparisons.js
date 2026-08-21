import { fmtAnnual, fmtSignedPct } from '../formatters.js';
import { t } from '../i18n.js';
import { state } from '../state.js';

export function renderExchangeTabs(deps){
  const tabs=document.getElementById('exchangeTabs');
  tabs.innerHTML='';
  deps.getPairsForAsset(state.selectedAsset).forEach(([pairKey, pair])=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='chip' + (pairKey===state.selectedPair ? ' active' : '');
    const label=document.createElement('span');
    label.className='exchange-label';
    const logo=document.createElement('img');
    logo.className='exchange-logo';
    logo.alt='';
    deps.setLogoImage(logo, deps.exchangeLogoUrl(pair.exchange), deps.exchangeLogoFallbackUrl(pair.exchange));
    const name=document.createElement('span');
    name.textContent=pair.exchange;
    label.append(logo, name);
    btn.appendChild(label);
    btn.onclick=()=>deps.selectPair(pairKey);
    tabs.appendChild(btn);
  });
}

export function renderComparisons(deps){
  const body=document.getElementById('comparisonBody');
  body.innerHTML='';
  const selected=state.data.pairs[state.selectedPair];
  document.getElementById('supportTitle').textContent=t('supportExchange');
  const sortButton=document.getElementById('supportSortFavored');
  if(sortButton){
    sortButton.textContent=state.supportSortSide === 'short' ? t('sortShortFavored') : t('sortLongFavored');
    sortButton.classList.toggle('active', state.supportSortSide !== 'default');
    sortButton.setAttribute('aria-pressed', String(state.supportSortSide !== 'default'));
  }
  const stats=deps.currentComparisonStats ? deps.currentComparisonStats() : [];
  const statsByPair=new Map(stats.map(item=>[item.pairKey, item]));
  const longFavored=stats.slice().sort((a,b)=>a.fee-b.fee)[0]?.pairKey;
  const shortFavored=stats.slice().sort((a,b)=>b.fee-a.fee)[0]?.pairKey;
  const sameSymbolPairs=deps.getPairsForAsset(deps.assetId(selected)).slice();
  if(state.supportSortSide !== 'default'){
    sameSymbolPairs.sort((a,b)=>{
      const av=statsByPair.get(a[0])?.fee;
      const bv=statsByPair.get(b[0])?.fee;
      const aMissing=av == null || Number.isNaN(av);
      const bMissing=bv == null || Number.isNaN(bv);
      if(aMissing || bMissing) return Number(aMissing) - Number(bMissing);
      const direction=state.supportSortSide === 'short' ? -1 : 1;
      return (av - bv) * direction
        || a[1].exchange.localeCompare(b[1].exchange)
        || deps.pairDisplayName(a[1]).localeCompare(deps.pairDisplayName(b[1]));
    });
  }
  sameSymbolPairs.forEach(([pairKey,pair])=>{
    const tr=document.createElement('tr');
    const isSelected=pairKey===state.selectedPair;
    tr.classList.toggle('favored-long-row', pairKey === longFavored);
    tr.classList.toggle('favored-short-row', pairKey === shortFavored);
    const exchangeCell=document.createElement('td');
    const exchangeBtn=document.createElement('button');
    exchangeBtn.type='button';
    exchangeBtn.className='chip' + (isSelected ? ' active' : '');
    const exchangeLabel=document.createElement('span');
    exchangeLabel.className='exchange-label';
    const exchangeLogo=document.createElement('img');
    exchangeLogo.className='exchange-logo';
    exchangeLogo.alt='';
    deps.setLogoImage(exchangeLogo, deps.exchangeLogoUrl(pair.exchange), deps.exchangeLogoFallbackUrl(pair.exchange));
    const exchangeName=document.createElement('span');
    exchangeName.textContent=pair.exchange;
    exchangeLabel.appendChild(exchangeLogo);
    exchangeLabel.appendChild(exchangeName);
    exchangeBtn.appendChild(exchangeLabel);
    exchangeBtn.onclick=()=>deps.selectPair(pairKey);
    exchangeCell.appendChild(exchangeBtn);

    const pairCell=document.createElement('td');
    const pairLink=document.createElement('a');
    pairLink.className='pair-link';
    pairLink.href=deps.pairTradeUrl(pair);
    pairLink.target='_blank';
    pairLink.rel='noopener noreferrer';
    pairLink.textContent=deps.pairDisplayName(pair);
    pairCell.appendChild(pairLink);

    const feeCell=document.createElement('td');
    const latest=deps.getLatestForPair(pairKey, pair);
    const fee=deps.fundingFeeValue(latest);
    const feeEl=document.createElement('span');
    feeEl.className='fee-value ' + deps.feeTone(fee);
    const intervalText=deps.fmtIntervalHours(deps.intervalHoursFor(pair, latest));
    feeEl.textContent=fee == null || Number.isNaN(fee) ? '-' : `${fmtSignedPct(fee)}(${intervalText})`;
    feeCell.appendChild(feeEl);

    const annualCell=document.createElement('td');
    const annualized=deps.comparisonAnnualized(pairKey, pair, latest);
    const annualEl=document.createElement('span');
    annualEl.className='fee-value ' + deps.feeTone(annualized == null ? null : annualized);
    annualEl.textContent=annualized == null || Number.isNaN(annualized) ? '-' : fmtAnnual(annualized);
    annualCell.appendChild(annualEl);

    tr.appendChild(exchangeCell);
    tr.appendChild(pairCell);
    tr.appendChild(feeCell);
    tr.appendChild(annualCell);
    body.appendChild(tr);
  });
}
