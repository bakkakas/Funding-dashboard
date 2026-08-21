export const state = {
  data:null,
  selectedPair:null,
  selectedAsset:null,
  selectedWindow:'7D',
  supportSortSide:'default',
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
  remoteAssetResults:[],
  remoteSearchLoading:false,
  remoteSearchToken:0,
  lang:localStorage.getItem('fundingDashboardLanguage') || 'ko',
};

export const variationalStatsCache = { time:0, promise:null };
export const orbsPerpsFundingCache = { time:0, promise:null };
