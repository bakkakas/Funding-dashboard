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
  const sameSymbolPairs=deps.getPairsForAsset(deps.assetId(selected));
  sameSymbolPairs.forEach(([pairKey,pair])=>{
    const tr=document.createElement('tr');
    const isSelected=pairKey===state.selectedPair;
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
