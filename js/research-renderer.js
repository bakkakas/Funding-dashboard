import { localize, safeUrl } from './research-data.js?v=1';
const $ = id => document.getElementById(id);
const node = (tag, text = '', className = '') => {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
};
function icon(url) {
  const img = document.createElement('img');
  if (safeUrl(url)) img.src = safeUrl(url);
  else img.hidden = true;
  img.alt = '';
  img.onerror = () => { img.hidden = true; };
  return img;
}
function link(source, language, className = 'source-link') {
  const url = safeUrl(source?.url);
  const element = node(url ? 'a' : 'span', '', className);
  if (url) { element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer'; }
  if (source?.logo) element.append(icon(source.logo));
  element.append(node('span', localize(source?.label, language).replace(/\s*↗$/, '')));
  if (url) element.append(node('i', '↗'));
  return element;
}
export function renderCatalog(catalog, selectedId, favorites, language) {
  $('researchReportList').replaceChildren(...catalog.map(asset => {
    const row = node('div', '', `report-list-row${asset.id === selectedId ? ' active' : ''}`);
    row.dataset.assetId = asset.id;
    const button = node('button', '', 'report-list-item');
    button.type = 'button'; button.dataset.selectAsset = asset.id;
    button.setAttribute('aria-current', String(asset.id === selectedId));
    const mark = node('span', '', 'report-token-mark');mark.append(icon(asset.logo));
    const title = node('span');title.append(node('strong', asset.name), node('small', `${asset.symbol} · ${asset.category ?? ''}`));
    button.append(mark, title);
    const favorite = node('button', favorites.includes(asset.id) ? '★' : '☆', 'report-favorite');
    favorite.type = 'button';favorite.dataset.favoriteAsset = asset.id;
    favorite.setAttribute('aria-pressed', String(favorites.includes(asset.id)));
    favorite.setAttribute('aria-label', `${asset.symbol} ${language === 'en' ? 'Favorite' : '즐겨찾기'}`);
    row.append(button, favorite);return row;
  }));
  document.querySelector('.report-count').textContent = String(catalog.length);
  $('researchSearch').placeholder = language === 'en' ? 'Search name or ticker' : '종목명·티커 검색';
}
export function renderAssetContent(asset, language, profile) {
  const missing = language === 'en' ? 'Not registered' : '미등록';
  document.querySelectorAll('[data-asset-copy]').forEach(element => {
    element.textContent = localize(asset.copy[element.dataset.assetCopy], language) || missing;
  });
  $('assetName').replaceChildren(document.createTextNode(asset.name + ' '), node('span', `(${asset.symbol})`));
  $('assetLogo').replaceChildren(icon(asset.logo));
  $('assetUpdatedAt').textContent = asset.updatedAt?.replaceAll('-', '.') || missing;
  $('assetLinks').replaceChildren(...asset.links.map(source => link(source, language)));
  $('overviewSources').replaceChildren(...(asset.overviewSource ? [link(asset.overviewSource, language)] : []));
  $('assetDrivers').replaceChildren(...asset.drivers.map((driver, index) => {
    const card = node('div', '', 'driver-card');
    const sources = node('div', '', 'source-badge-row');
    sources.append(...(driver.sources ?? []).map(source => link(source, language, 'source-badge')));
    card.append(node('b', String(index + 1).padStart(2,'0')),node('strong',localize(driver.title,language)),node('p',localize(driver.body,language)),sources);
    return card;
  }));
  if (!asset.drivers.length) $('assetDrivers').append(node('p',missing,'data-note'));
  $('assetNews').replaceChildren(...asset.news.map(news => {
    const url = safeUrl(news.source?.url);
    const item = node(url ? 'a' : 'div');
    if (url) {item.href=url;item.target='_blank';item.rel='noopener noreferrer';}
    const copy=node('span','','news-copy');
    const source=node('span','','news-source');
    if(news.source?.logo) source.append(icon(news.source.logo));
    source.append(node('span',localize(news.source?.label,language)));
    copy.append(source,node('strong',localize(news.title,language)),node('small',localize(news.body,language)));
    item.append(node('time',news.date?.replaceAll('-','.') || ''),copy,node('i',url?'↗':''));return item;
  }));
  if (!asset.news.length) $('assetNews').append(node('p',missing,'data-note'));
  $('unlockSources').replaceChildren(...asset.unlock.sources.map(source=>link(source,language)));
  $('vestingEndDate').textContent=asset.unlock.vestingEnd?.replaceAll('-','.') || missing;
  $('assetChartSymbol').textContent=asset.chart?.symbol || missing;
  const chartLink=$('assetChartLink');
  chartLink.hidden=!safeUrl(asset.chart?.url);
  if(!chartLink.hidden) chartLink.href=safeUrl(asset.chart.url);
  else chartLink.removeAttribute('href');
  document.querySelector('.price-chart-card').hidden=!asset.chart?.symbol;
  $('scoreProfileLabel').textContent=profile?.label || (language==='en'?'Evaluation rules not configured':'평가 기준 미설정');
  $('decisionScenario').disabled=!profile;
  document.title=`${asset.symbol} · ${language==='en'?'Investment Setup':'투자 셋업'}`;
}
