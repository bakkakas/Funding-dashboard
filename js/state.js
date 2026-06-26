export const state = {
  data:null,
  selectedPair:null,
  selectedAsset:null,
  selectedWindow:'7D',
  supportSortFavored:false,
  priceCandleWindow:'4H',
  chart:null,
  priceChart:null,
  countdownTimer:null,
  liveRefreshTimer:null,
  sortMode:'symbol',
  favorites:[],
  liveLatestByPair:{},
  auth:null,
  authMode:'login',
  draggedFavorite:null,
  lang:localStorage.getItem('fundingDashboardLanguage') || 'ko',
};

export const variationalStatsCache = { time:0, promise:null };
export const orbsPerpsFundingCache = { time:0, promise:null };
