import { fmtAnnual, fmtPct, fmtSignedPct } from '../formatters.js';
import { t } from '../i18n.js';
import { renderFundingBars } from './funding-bars.js';
import { renderPeriodBestWorst } from './period-summary.js';
import { renderSpreadInsights } from './spread-insights.js';

function renderFavoredExchange({ box, el, label, item, side, deps }){
  if(!item){
    box.removeAttribute('href');
    box.classList.add('disabled');
    el.textContent='-';
    return;
  }
  box.href=deps.pairTradeUrl(item.pair);
  box.classList.remove('disabled');
  const value = side === 'short' ? item.shortFee : item.fee;
  const annualizedValue = side === 'short' ? item.shortAnnualized : item.annualized;
  const annualized = annualizedValue == null || Number.isNaN(annualizedValue) ? '-' : fmtAnnual(annualizedValue);
  el.innerHTML = '';
  const main=document.createElement('span');
  main.className='detail-main';
  const labelEl=document.createElement('span');
  labelEl.className='label';
  labelEl.textContent=label;
  const logo=document.createElement('img');
  logo.className='exchange-logo';
  logo.alt='';
  deps.setLogoImage(logo, deps.exchangeLogoUrl(item.pair.exchange), deps.exchangeLogoFallbackUrl(item.pair.exchange));
  const name=document.createElement('span');
  name.className='favored-exchange-name';
  name.textContent=item.pair.exchange;
  const sub=document.createElement('span');
  sub.className='detail-sub';
  sub.textContent=`${fmtSignedPct(value)} / ${annualized} Annualized`;
  main.append(labelEl, logo, name);
  el.append(main, sub);
}

export function renderCurrentFundingInsights({ stats, latest, feeTone, periodComparisonStats, deps }){
  const longSorted=stats.slice().sort((a,b)=>b.fee-a.fee);
  const shortSorted=stats.slice().sort((a,b)=>b.shortFee-a.shortFee);
  const mark=Number(latest.markPrice);
  const index=Number(latest.indexPrice);
  const gap = Number.isFinite(mark) && Number.isFinite(index) && index !== 0 ? (mark - index) / index : null;
  const gapEl=document.getElementById('markIndexGap');
  gapEl.textContent=gap == null ? '-' : fmtSignedPct(gap);
  gapEl.className='detail-value ' + feeTone(gap);

  renderFavoredExchange({
    box:document.getElementById('longFavoredBox'),
    el:document.getElementById('longFavoredExchange'),
    label:t('longFavored'),
    item:longSorted[0],
    side:'long',
    deps,
  });
  renderFavoredExchange({
    box:document.getElementById('shortFavoredBox'),
    el:document.getElementById('shortFavoredExchange'),
    label:t('shortFavored'),
    item:shortSorted[0],
    side:'short',
    deps,
  });

  renderSpreadInsights(stats);
  renderPeriodBestWorst({ periodComparisonStats, feeTone });
  renderFundingBars('fundingBars', longSorted, feeTone);
}

export function renderPeriodFundingInsights({ stats, windowLabel, lang, feeTone }){
  const periodBarsTitle=document.getElementById('periodFundingBarsTitle');
  periodBarsTitle.textContent=lang === 'ko'
    ? `${windowLabel} Funding Fee 비교 (8H 환산)`
    : `${windowLabel} funding fee comparison (8H eq.)`;
  renderSpreadInsights(stats, {
    spreadValue:'periodFundingSpreadValue',
    spreadMeta:'periodFundingSpreadMeta',
    alertValue:'periodSpreadAlertValue',
    alertMeta:'periodSpreadAlertMeta',
  });
  renderFundingBars('periodFundingBars', stats, feeTone);
}

export function renderSelectedPairFundingMetrics({ windowSummary, periodFee, periodFeeTone, directionTitle }){
  document.getElementById('avgFunding').textContent=periodFee == null ? '-' : fmtSignedPct(periodFee);
  document.getElementById('avgFunding').className='asset-metric-value '+periodFeeTone;

  const displayedAnnualized = windowSummary.annualizedPct;
  const annual=document.getElementById('annualized');
  annual.textContent=fmtAnnual(displayedAnnualized);
  annual.className='value '+(displayedAnnualized>=0?'good':'bad');

  const sumFundingTone = windowSummary.sumFundingRate < 0 ? 'good' : 'bad';
  document.getElementById('sumFunding').textContent=fmtPct(windowSummary.sumFundingRate);
  document.getElementById('sumFunding').className='asset-metric-value '+sumFundingTone;
  document.getElementById('sumFundingMeta').textContent='';
  document.getElementById('interpretation').innerHTML=windowSummary.sumFundingRate < 0
    ? '<span class="pill good asset-direction-pill">Short → Long</span>'
    : '<span class="pill bad asset-direction-pill">Long → Short</span>';
  document.getElementById('interpretation').className='asset-metric-value';

  const coreTitle = document.getElementById('coreTitle');
  coreTitle.innerHTML = directionTitle;
  coreTitle.className = 'section-title';
  if (periodFee == null || Number.isNaN(periodFee)) {
    document.getElementById('latestFunding').textContent='-';
    document.getElementById('latestFunding').className='value warn';
  } else {
    document.getElementById('latestFunding').textContent=fmtSignedPct(periodFee);
    document.getElementById('latestFunding').className='value '+periodFeeTone;
  }
}
