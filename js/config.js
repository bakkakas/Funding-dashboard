export const BINANCE_PREMIUM_INDEX_URL = 'https://fapi.binance.com/fapi/v1/premiumIndex';
export const BYBIT_TICKERS_URL = 'https://api.bybit.com/v5/market/tickers';
export const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
export const ASTER_PREMIUM_INDEX_URL = 'https://fapi.asterdex.com/fapi/v3/premiumIndex';
export const OKX_FUNDING_RATE_URL = 'https://www.okx.com/api/v5/public/funding-rate';
export const OKX_MARK_PRICE_URL = 'https://www.okx.com/api/v5/public/mark-price';
export const OKX_INDEX_TICKER_URL = 'https://www.okx.com/api/v5/market/index-tickers';
export const VARIATIONAL_STATS_URL = 'https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats';
export const ORBS_PERPS_PREMIUM_INDEX_URL = 'https://perps.thena.fi/api/proxy/fapi/premiumIndex';
export const ORBS_PERPS_AGGREGATED_FUNDING_URL = 'https://perps.thena.fi/api/solver/aggregatedFundingData?chainId=0';

export const ASSET_LOGO_DOMAINS = {
  AAPL:'apple.com',
  AMZN:'amazon.com',
  BABA:'alibaba.com',
  BNB:'bnbchain.org',
  BTC:'bitcoin.org',
  COIN:'coinbase.com',
  CRCL:'circle.com',
  ETH:'ethereum.org',
  GOLD:'gold.org',
  GOOGL:'google.com',
  HYPE:'hyperliquid.xyz',
  META:'meta.com',
  MSFT:'microsoft.com',
  MSTR:'microstrategy.com',
  MU:'micron.com',
  NVDA:'nvidia.com',
  PLTR:'palantir.com',
  QQQ:'invesco.com',
  SAMSUNG:'samsung.com',
  SKHYNIX:'skhynix.com',
  SNDK:'sandisk.com',
  SOL:'solana.com',
  SPY:'ssga.com',
  TSLA:'tesla.com',
  TSM:'tsmc.com',
};

export const LIVE_REFRESH_MS = 30000;
export const PRICE_CANDLE_WINDOWS = [
  { key:'1H', hours:1 },
  { key:'4H', hours:4 },
  { key:'1D', hours:24 },
];
export const FX_LATEST_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_REFERENCE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
export const AUTH_BACKEND_CONFIGURED = false;
export const SUPABASE_CONFIG = window.FUNDING_SUPABASE || {};
export const SUPABASE_URL = SUPABASE_CONFIG.url || '';
export const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || '';
export const SUPABASE_FUNCTIONS_BASE_URL = (SUPABASE_CONFIG.functionsBaseUrl || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '')).replace(/\/$/, '');
export const ANALYTICS_BACKEND_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_FUNCTIONS_BASE_URL);
export const COMPARISON_INTERVAL_HOURS = 8;
export const STANDARD_USDT_DISPLAY_ASSETS = new Set(['BTC','ETH','SOL','BNB']);
export const ASSET_NAME_OVERRIDES = {
  SAMSUNG: { ko:'삼성전자', en:'Samsung Electronics' },
  SKHYNIX: { ko:'SK하이닉스', en:'SK hynix' },
};
