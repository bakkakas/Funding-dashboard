import json, time, urllib.error, urllib.parse, urllib.request, datetime
from pathlib import Path

BINANCE_BASE = "https://fapi.binance.com/fapi/v1/fundingRate"
BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
BYBIT_TICKERS = "https://api.bybit.com/v5/market/tickers"
BYBIT_FUNDING = "https://api.bybit.com/v5/market/funding/history"
BYBIT_MARK_KLINE = "https://api.bybit.com/v5/market/mark-price-kline"
HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info"
ASTER_FUNDING = "https://fapi.asterdex.com/fapi/v1/fundingRate"
ASTER_MARK_KLINE = "https://fapi.asterdex.com/fapi/v1/markPriceKlines"
ASTER_PREMIUM = "https://fapi.asterdex.com/fapi/v3/premiumIndex"
OKX_FUNDING = "https://www.okx.com/api/v5/public/funding-rate"
OKX_FUNDING_HISTORY = "https://www.okx.com/api/v5/public/funding-rate-history"
OKX_MARK_PRICE = "https://www.okx.com/api/v5/public/mark-price"
OKX_MARK_CANDLES = "https://www.okx.com/api/v5/market/mark-price-candles"
OKX_INDEX_TICKER = "https://www.okx.com/api/v5/market/index-tickers"
VARIATIONAL_STATS = "https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats"
ORBS_PERPS_FUNDING = "https://perps.thena.fi/api/proxy/fapi/fundingRate"
ORBS_PERPS_PREMIUM = "https://perps.thena.fi/api/proxy/fapi/premiumIndex"
ORBS_PERPS_AGGREGATED_FUNDING = "https://perps.thena.fi/api/solver/aggregatedFundingData?chainId=0"
orbs_perps_funding_cache = None
PAIRS = [
    {"symbol": "xyz:GOOGL", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Binance", "enabled": True},
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:SMSN", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Binance", "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:SKHX", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Binance", "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:SNDK", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "SNDKUSDT", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Binance", "enabled": True},
    {"symbol": "SNDKUSDT", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:MU", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "MUUSDT", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Binance", "enabled": True},
    {"symbol": "MUUSDT", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:GOLD", "displaySymbol": "GOLD", "assetId": "GOLD", "assetName": "Gold", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "XAUUSDT", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "Binance", "enabled": True},
    {"symbol": "XAUTUSDT", "displaySymbol": "XAUT", "assetId": "GOLD", "assetName": "Gold", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:AMZN", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Binance", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:AAPL", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Binance", "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:TSLA", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Binance", "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:NVDA", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Binance", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:META", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Binance", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:MSFT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Binance", "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:MSTR", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Binance", "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:COIN", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Binance", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:TSM", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Binance", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:PLTR", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Binance", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Bybit", "enabled": True},
    {"symbol": "xyz:BABA", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Hyperliquid", "dex": "xyz", "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Binance", "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Bybit", "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Binance", "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Bybit", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Binance", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Bybit", "enabled": True},
    {"symbol": "BTC", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Hyperliquid", "enabled": True},
    {"symbol": "BTCUSDT", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Binance", "enabled": True},
    {"symbol": "BTCUSDT", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Bybit", "enabled": True},
    {"symbol": "ETH", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Hyperliquid", "enabled": True},
    {"symbol": "ETHUSDT", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Binance", "enabled": True},
    {"symbol": "ETHUSDT", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Bybit", "enabled": True},
    {"symbol": "SOL", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Hyperliquid", "enabled": True},
    {"symbol": "SOLUSDT", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Binance", "enabled": True},
    {"symbol": "SOLUSDT", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Bybit", "enabled": True},
    {"symbol": "BNB", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Hyperliquid", "enabled": True},
    {"symbol": "BNBUSDT", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Binance", "enabled": True},
    {"symbol": "BNBUSDT", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Bybit", "enabled": True},
    {"symbol": "HYPE", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Hyperliquid", "enabled": True},
    {"symbol": "HYPEUSDT", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Binance", "enabled": True},
    {"symbol": "HYPEUSDT", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Bybit", "enabled": True}
]
PAIRS.extend([
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "GOOGL-USDT-SWAP", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "SAMSUNG-USDT-SWAP", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "SKHYNIX-USDT-SWAP", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "SNDKUSDT", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "SNDK-USDT-SWAP", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "SNDK", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Variational", "enabled": True},
    {"symbol": "MUUSDT", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "MU-USDT-SWAP", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "MU", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Variational", "enabled": True},
    {"symbol": "XAUUSDT", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "XAU-USDT-SWAP", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "XAU", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "Variational", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "AMZN-USDT-SWAP", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "AAPL-USDT-SWAP", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "TSLA-USDT-SWAP", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "TSLA", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Variational", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "NVDA-USDT-SWAP", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "NVDA", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Variational", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "META-USDT-SWAP", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "MSFT-USDT-SWAP", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "MSTR-USDT-SWAP", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "MSTR", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Variational", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "COIN-USDT-SWAP", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "COIN", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Variational", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "TSM-USDT-SWAP", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "TSM", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Variational", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "PLTR-USDT-SWAP", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "QQQ-USDT-SWAP", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "QQQ", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Variational", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "SPY-USDT-SWAP", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "BTCUSDT", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "BTC-USDT-SWAP", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "BTC", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Variational", "enabled": True},
    {"symbol": "ETHUSDT", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "ETH-USDT-SWAP", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "ETH", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Variational", "enabled": True},
    {"symbol": "SOLUSDT", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "SOL-USDT-SWAP", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "SOL", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Variational", "enabled": True},
    {"symbol": "BNBUSDT", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "BNB-USDT-SWAP", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "BNB", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Variational", "enabled": True},
    {"symbol": "HYPEUSDT", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Aster", "fundingIntervalHours": 4, "enabled": True},
    {"symbol": "HYPE-USDT-SWAP", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "OKX", "fundingIntervalHours": 8, "enabled": True},
    {"symbol": "HYPE", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Variational", "enabled": True},
])
PAIRS.extend([
    {"symbol": "GOOGLUSDT", "displaySymbol": "GOOGL", "assetId": "GOOGL", "assetName": "Google", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "SAMSUNGUSDT", "displaySymbol": "SAMSUNG", "assetId": "SAMSUNG", "assetName": "삼성전자", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "SKHYNIXUSDT", "displaySymbol": "SKHYNIX", "assetId": "SKHYNIX", "assetName": "SK하이닉스", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "SNDKUSDT", "displaySymbol": "SNDK", "assetId": "SNDK", "assetName": "SanDisk", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "MUUSDT", "displaySymbol": "MU", "assetId": "MU", "assetName": "Micron", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "XAUUSDT", "displaySymbol": "XAU", "assetId": "GOLD", "assetName": "Gold", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "AMZNUSDT", "displaySymbol": "AMZN", "assetId": "AMZN", "assetName": "Amazon", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "AAPLUSDT", "displaySymbol": "AAPL", "assetId": "AAPL", "assetName": "Apple", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "TSLAUSDT", "displaySymbol": "TSLA", "assetId": "TSLA", "assetName": "Tesla", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "NVDAUSDT", "displaySymbol": "NVDA", "assetId": "NVDA", "assetName": "NVIDIA", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "METAUSDT", "displaySymbol": "META", "assetId": "META", "assetName": "Meta", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "MSFTUSDT", "displaySymbol": "MSFT", "assetId": "MSFT", "assetName": "Microsoft", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "MSTRUSDT", "displaySymbol": "MSTR", "assetId": "MSTR", "assetName": "MicroStrategy", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "COINUSDT", "displaySymbol": "COIN", "assetId": "COIN", "assetName": "Coinbase", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "TSMUSDT", "displaySymbol": "TSM", "assetId": "TSM", "assetName": "TSMC", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "PLTRUSDT", "displaySymbol": "PLTR", "assetId": "PLTR", "assetName": "Palantir", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "BABAUSDT", "displaySymbol": "BABA", "assetId": "BABA", "assetName": "Alibaba", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "QQQUSDT", "displaySymbol": "QQQ", "assetId": "QQQ", "assetName": "QQQ", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "SPYUSDT", "displaySymbol": "SPY", "assetId": "SPY", "assetName": "SPY", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "BTCUSDT", "displaySymbol": "BTC", "assetId": "BTC", "assetName": "Bitcoin", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "ETHUSDT", "displaySymbol": "ETH", "assetId": "ETH", "assetName": "Ethereum", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "SOLUSDT", "displaySymbol": "SOL", "assetId": "SOL", "assetName": "Solana", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "BNBUSDT", "displaySymbol": "BNB", "assetId": "BNB", "assetName": "BNB", "exchange": "Orbs Perps Hub", "enabled": True},
    {"symbol": "HYPEUSDT", "displaySymbol": "HYPE", "assetId": "HYPE", "assetName": "Hyperliquid", "exchange": "Orbs Perps Hub", "enabled": True},
])
WINDOWS = {"1D": 1, "7D": 7, "30D": 30, "90D": 90}
COMPARISON_INTERVAL_HOURS = 8
DATA_PATH = Path("funding_data.json")
ALERTS_PATH = Path("alerts.json")
MAX_RETRIES = 4
RETRY_BASE_DELAY = 1.5
_variational_stats_cache = None

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_error = e
            if attempt == MAX_RETRIES:
                break
            time.sleep(RETRY_BASE_DELAY * attempt)
    raise RuntimeError(f"failed to fetch after {MAX_RETRIES} attempts: {url}: {last_error}")


def post_json(url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_error = e
            if attempt == MAX_RETRIES:
                break
            time.sleep(RETRY_BASE_DELAY * attempt)
    raise RuntimeError(f"failed to post after {MAX_RETRIES} attempts: {url}: {last_error}")


def pair_key(pair):
    return f"{pair['exchange']}:{pair['symbol']}"


def funding_interval_hours(pair):
    if pair.get("fundingIntervalHours"):
        return float(pair["fundingIntervalHours"])
    if pair["exchange"] == "Hyperliquid":
        return 1
    if pair["exchange"] == "Aster":
        return 4
    return 8


def payments_per_day(pair):
    return 24 / funding_interval_hours(pair)


def infer_funding_interval_hours(pair, rows):
    if pair.get("fundingIntervalHours"):
        return float(pair["fundingIntervalHours"])
    if len(rows) < 2:
        return funding_interval_hours(pair)
    diffs = []
    prev = None
    for row in rows:
        ts = int(row["fundingTime"])
        if prev is not None:
            gap_hours = (ts - prev) / 3600000
            if 0.5 <= gap_hours <= 24:
                diffs.append(gap_hours)
        prev = ts
    if not diffs:
        return funding_interval_hours(pair)
    diffs.sort()
    return round(diffs[len(diffs) // 2], 4)


def nearest_mark_price(mark_rows, ts):
    eligible = [row for row in mark_rows if row["time"] <= ts]
    if eligible:
        return eligible[-1]["markPrice"]
    return mark_rows[0]["markPrice"] if mark_rows else None


def merge_rows(existing_rows, new_rows, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    merged = {}
    for row in (existing_rows or []) + (new_rows or []):
        ts = int(row["fundingTime"])
        if ts >= start_ms:
            merged[ts] = row
    return [merged[ts] for ts in sorted(merged)]


def parse_iso_ms(value):
    if not value:
        return int(time.time() * 1000)
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    if "." in value:
        head, tail = value.split(".", 1)
        digits = ""
        suffix = ""
        for ch in tail:
            if ch.isdigit() and not suffix:
                digits += ch
            else:
                suffix += ch
        value = f"{head}.{digits[:6].ljust(6, '0')}{suffix}"
    return int(datetime.datetime.fromisoformat(value).timestamp() * 1000)

def fetch_binance_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{BINANCE_BASE}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = batch[-1]["fundingTime"] + 1
    seen = set()
    ded = []
    for row in rows:
        t = row["fundingTime"]
        if t not in seen:
            seen.add(t)
            ded.append({
                "fundingTime": row["fundingTime"],
                "fundingRate": float(row["fundingRate"]),
                "markPrice": float(row["markPrice"]),
            })
    return ded


def fetch_binance_latest(symbol):
    url = f"{BINANCE_PREMIUM}?symbol={symbol}"
    try:
        row = fetch_json(url)
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "time": int(row["time"]),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_bybit_mark_prices(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    out = []
    cur_end = end_ms
    seen = set()
    while True:
        url = f"{BYBIT_MARK_KLINE}?category=linear&symbol={symbol}&interval=240&end={cur_end}&limit=1000"
        data = fetch_json(url)
        batch = data.get("result", {}).get("list", [])
        if not batch:
            break
        progressed = False
        for row in batch:
            ts = int(row[0])
            if ts < start_ms:
                continue
            if ts in seen:
                continue
            seen.add(ts)
            progressed = True
            out.append({"time": ts, "markPrice": float(row[4])})
        oldest = min(int(row[0]) for row in batch)
        if oldest <= start_ms or not progressed:
            break
        cur_end = oldest - 1
    out.sort(key=lambda x: x["time"])
    return out


def fetch_bybit_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    funding_rows = []
    cur_end = end_ms
    seen = set()
    while True:
        url = f"{BYBIT_FUNDING}?category=linear&symbol={symbol}&startTime={start_ms}&endTime={cur_end}&limit=200"
        data = fetch_json(url)
        batch = data.get("result", {}).get("list", [])
        if not batch:
            break
        for row in batch:
            ts = int(row["fundingRateTimestamp"])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                funding_rows.append(row)
        oldest = min(int(row["fundingRateTimestamp"]) for row in batch)
        if oldest <= start_ms or len(batch) < 200:
            break
        cur_end = oldest - 1
    mark_rows = fetch_bybit_mark_prices(symbol, days)

    rows = []
    for row in funding_rows:
        ts = int(row["fundingRateTimestamp"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    rows.sort(key=lambda x: x["fundingTime"])
    return rows


def fetch_bybit_latest(symbol):
    url = f"{BYBIT_TICKERS}?category=linear&symbol={symbol}"
    try:
        data = fetch_json(url)
        row = data["result"]["list"][0]
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["fundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "time": int(data["time"]),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_hyperliquid_candles(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    out = []
    cur = start_ms
    seen = set()
    while cur < end_ms:
        rows = post_json(HYPERLIQUID_INFO, {
            "type": "candleSnapshot",
            "req": {
                "coin": symbol,
                "interval": "1h",
                "startTime": cur,
                "endTime": end_ms,
            },
        })
        if not rows:
            break
        for row in rows:
            ts = int(row["t"])
            if ts in seen:
                continue
            seen.add(ts)
            out.append({
                "time": ts,
                "markPrice": float(row["c"]),
            })
        newest = max(int(row["t"]) for row in rows)
        if newest < cur:
            break
        cur = newest + 3600000
        if len(rows) < 500:
            break
    out.sort(key=lambda x: x["time"])
    return out


def fetch_hyperliquid_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    funding_rows = []
    cur = start_ms
    seen = set()
    while cur < end_ms:
        batch = post_json(HYPERLIQUID_INFO, {
            "type": "fundingHistory",
            "coin": symbol,
            "startTime": cur,
            "endTime": end_ms,
        })
        if not batch:
            break
        for row in batch:
            ts = int(row["time"])
            if ts in seen:
                continue
            seen.add(ts)
            funding_rows.append(row)
        newest = max(int(row["time"]) for row in batch)
        if newest < cur:
            break
        cur = newest + 1
        if len(batch) < 500:
            break
    mark_rows = fetch_hyperliquid_candles(symbol, days)

    rows = []
    for row in funding_rows:
        ts = int(row["time"])
        rows.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "premium": float(row["premium"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    rows.sort(key=lambda x: x["fundingTime"])
    return rows


def fetch_hyperliquid_latest(symbol, dex=None):
    try:
        payload = {"type": "metaAndAssetCtxs"}
        if dex:
            payload["dex"] = dex
        meta, ctxs = post_json(HYPERLIQUID_INFO, payload)
        for asset, ctx in zip(meta.get("universe", []), ctxs):
            if asset.get("name") != symbol:
                continue
            now_ms = int(time.time() * 1000)
            next_hour_ms = ((now_ms // 3600000) + 1) * 3600000
            mark_price = float(ctx["markPx"])
            return {
                "markPrice": mark_price,
                "indexPrice": float(ctx["oraclePx"]),
                "lastFundingRate": float(ctx["funding"]),
                "premium": float(ctx["premium"]),
                "nextFundingTime": next_hour_ms,
                "time": now_ms,
                "openInterest": float(ctx["openInterest"]),
                "dayNtlVlm": float(ctx["dayNtlVlm"]),
                "available": True,
            }
        raise RuntimeError(f"{symbol} not found in Hyperliquid dex {dex}")
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "premium": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_aster_mark_prices(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    url = f"{ASTER_MARK_KLINE}?symbol={symbol}&interval=4h&startTime={start_ms}&endTime={end_ms}&limit=1000"
    rows = fetch_json(url)
    out = []
    for row in rows:
        ts = int(row[0])
        if ts >= start_ms:
            out.append({"time": ts, "markPrice": float(row[4])})
    out.sort(key=lambda x: x["time"])
    return out


def fetch_aster_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{ASTER_FUNDING}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = int(batch[-1]["fundingTime"]) + 1
    mark_rows = fetch_aster_mark_prices(symbol, days)
    seen = set()
    out = []
    for row in rows:
        ts = int(row["fundingTime"])
        if ts in seen or ts < start_ms:
            continue
        seen.add(ts)
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_aster_latest(symbol):
    url = f"{ASTER_PREMIUM}?symbol={symbol}"
    try:
        row = fetch_json(url)
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "nextFundingTime": int(row["nextFundingTime"]),
            "fundingIntervalHours": 4,
            "time": int(row.get("time") or time.time() * 1000),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": 4,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_okx_mark_prices(symbol, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    out = []
    seen = set()
    after = None
    while True:
        params = {"instId": symbol, "bar": "4H", "limit": "100"}
        if after:
            params["after"] = str(after)
        url = f"{OKX_MARK_CANDLES}?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        batch = data.get("data", [])
        if not batch:
            break
        for row in batch:
            ts = int(row[0])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                out.append({"time": ts, "markPrice": float(row[4])})
        oldest = min(int(row[0]) for row in batch)
        if oldest <= start_ms or len(batch) < 100:
            break
        after = oldest
    out.sort(key=lambda x: x["time"])
    return out


def fetch_okx_history(symbol, days):
    start_ms = int(time.time() * 1000) - days * 24 * 3600 * 1000
    funding_rows = []
    seen = set()
    after = None
    while True:
        params = {"instId": symbol, "limit": "100"}
        if after:
            params["after"] = str(after)
        url = f"{OKX_FUNDING_HISTORY}?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        batch = data.get("data", [])
        if not batch:
            break
        for row in batch:
            ts = int(row["fundingTime"])
            if ts >= start_ms and ts not in seen:
                seen.add(ts)
                funding_rows.append(row)
        oldest = min(int(row["fundingTime"]) for row in batch)
        if oldest <= start_ms or len(batch) < 100:
            break
        after = oldest
    mark_rows = fetch_okx_mark_prices(symbol, days)
    out = []
    for row in funding_rows:
        ts = int(row["fundingTime"])
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["realizedRate"] or row["fundingRate"]),
            "markPrice": nearest_mark_price(mark_rows, ts),
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_okx_latest(symbol):
    try:
        funding = fetch_json(f"{OKX_FUNDING}?instId={urllib.parse.quote(symbol)}")
        mark = fetch_json(f"{OKX_MARK_PRICE}?instType=SWAP&instId={urllib.parse.quote(symbol)}")
        index = fetch_json(f"{OKX_INDEX_TICKER}?instId={urllib.parse.quote(symbol.replace('-SWAP', ''))}")
        funding_row = funding.get("data", [{}])[0]
        mark_row = mark.get("data", [{}])[0]
        index_row = index.get("data", [{}])[0]
        return {
            "markPrice": float(mark_row.get("markPx") or funding_row.get("markPx")),
            "indexPrice": float(index_row["idxPx"]),
            "lastFundingRate": float(funding_row["fundingRate"]),
            "nextFundingTime": int(funding_row.get("nextFundingTime") or funding_row.get("nextFundingTimeMs")),
            "fundingIntervalHours": 8,
            "time": int(funding_row.get("ts") or time.time() * 1000),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": 8,
            "time": None,
            "available": False,
            "error": str(e)
        }


def get_variational_listing(symbol):
    global _variational_stats_cache
    if _variational_stats_cache is None:
        _variational_stats_cache = fetch_json(VARIATIONAL_STATS)
    data = _variational_stats_cache
    for row in data.get("listings", []):
        if str(row.get("ticker", "")).upper() == symbol.upper():
            return row
    raise RuntimeError(f"variational listing not found: {symbol}")


def fetch_variational_latest(symbol):
    try:
        row = get_variational_listing(symbol)
        interval_hours = float(row.get("funding_interval_s") or 28800) / 3600
        payments_per_year = (24 / interval_hours) * 365
        updated_ms = parse_iso_ms(row.get("quotes", {}).get("updated_at"))
        return {
            "markPrice": float(row["mark_price"]),
            "indexPrice": float(row["mark_price"]),
            "lastFundingRate": float(row["funding_rate"]) / payments_per_year,
            "nextFundingTime": updated_ms + int(interval_hours * 3600000),
            "fundingIntervalHours": interval_hours,
            "time": updated_ms,
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "fundingIntervalHours": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_variational_history(pair, days, previous_rows):
    latest = fetch_variational_latest(pair["symbol"])
    rows = []
    if latest.get("available") and latest.get("lastFundingRate") is not None:
        rows.append({
            "fundingTime": int(latest["time"]),
            "fundingRate": float(latest["lastFundingRate"]),
            "markPrice": latest["markPrice"],
            "source": "snapshot",
        })
        pair["_latest"] = latest
        pair["_fundingIntervalHours"] = latest.get("fundingIntervalHours")
    return merge_rows(previous_rows, rows, days)


def fetch_orbs_perps_history(symbol, days):
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    rows = []
    cur = start_ms
    while True:
        url = f"{ORBS_PERPS_FUNDING}?symbol={symbol}&startTime={cur}&endTime={end_ms}&limit=1000"
        batch = fetch_json(url)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        cur = int(batch[-1]["fundingTime"]) + 1
    seen = set()
    out = []
    for row in rows:
        ts = int(row["fundingTime"])
        if ts in seen or ts < start_ms:
            continue
        seen.add(ts)
        out.append({
            "fundingTime": ts,
            "fundingRate": float(row["fundingRate"]),
            "markPrice": float(row["markPrice"]) if row.get("markPrice") is not None else None,
        })
    out.sort(key=lambda x: x["fundingTime"])
    return out


def fetch_orbs_perps_funding_data():
    global orbs_perps_funding_cache
    if orbs_perps_funding_cache is None:
        data = fetch_json(ORBS_PERPS_AGGREGATED_FUNDING)
        orbs_perps_funding_cache = data.get("PERPS_HUB", {})
    return orbs_perps_funding_cache


def fetch_orbs_perps_latest(symbol):
    url = f"{ORBS_PERPS_PREMIUM}?symbol={symbol}"
    try:
        row = fetch_json(url)
        funding = fetch_orbs_perps_funding_data().get(symbol, {})
        return {
            "markPrice": float(row["markPrice"]),
            "indexPrice": float(row["indexPrice"]),
            "rawFundingRate": float(row["lastFundingRate"]),
            "lastFundingRate": float(row["lastFundingRate"]),
            "longFundingFee": float(funding.get("next_funding_rate_long", -float(row["lastFundingRate"]))),
            "shortFundingFee": float(funding.get("next_funding_rate_short", float(row["lastFundingRate"]))),
            "nextFundingTime": int(funding.get("next_funding_time") or row["nextFundingTime"]),
            "time": int(row.get("time") or time.time() * 1000),
            "available": True
        }
    except Exception as e:
        return {
            "markPrice": None,
            "indexPrice": None,
            "lastFundingRate": None,
            "nextFundingTime": None,
            "time": None,
            "available": False,
            "error": str(e)
        }


def fetch_history(pair, days, previous_rows=None):
    if pair["exchange"] == "Binance":
        return fetch_binance_history(pair["symbol"], days)
    if pair["exchange"] == "Bybit":
        return fetch_bybit_history(pair["symbol"], days)
    if pair["exchange"] == "Hyperliquid":
        if previous_rows:
            return merge_rows(previous_rows, fetch_hyperliquid_history(pair["symbol"], min(days, 2)), days)
        return fetch_hyperliquid_history(pair["symbol"], days)
    if pair["exchange"] == "Aster":
        return fetch_aster_history(pair["symbol"], days)
    if pair["exchange"] == "OKX":
        return fetch_okx_history(pair["symbol"], days)
    if pair["exchange"] == "Variational":
        return fetch_variational_history(pair, days, previous_rows or [])
    if pair["exchange"] == "Orbs Perps Hub":
        return fetch_orbs_perps_history(pair["symbol"], days)
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")


def fetch_latest(pair):
    if pair["exchange"] == "Binance":
        return fetch_binance_latest(pair["symbol"])
    if pair["exchange"] == "Bybit":
        return fetch_bybit_latest(pair["symbol"])
    if pair["exchange"] == "Hyperliquid":
        return fetch_hyperliquid_latest(pair["symbol"], pair.get("dex"))
    if pair["exchange"] == "Aster":
        return fetch_aster_latest(pair["symbol"])
    if pair["exchange"] == "OKX":
        return fetch_okx_latest(pair["symbol"])
    if pair["exchange"] == "Variational":
        return pair.pop("_latest", None) or fetch_variational_latest(pair["symbol"])
    if pair["exchange"] == "Orbs Perps Hub":
        return fetch_orbs_perps_latest(pair["symbol"])
    raise ValueError(f"Unsupported exchange: {pair['exchange']}")

def summarize(rows, periods_per_day):
    if not rows:
        return {
            "count": 0, "avgFundingRate": 0, "annualizedPct": 0,
            "sumFundingRate": 0, "firstFundingTime": None, "lastFundingTime": None
        }
    rates = [r["fundingRate"] for r in rows]
    avg = sum(rates) / len(rates)
    return {
        "count": len(rows),
        "avgFundingRate": avg,
        "annualizedPct": -avg * periods_per_day * 365 * 100,
        "sumFundingRate": sum(rates),
        "firstFundingTime": rows[0]["fundingTime"],
        "lastFundingTime": rows[-1]["fundingTime"],
    }

def latest_long_fee(latest):
    if latest.get("longFundingFee") is not None:
        return float(latest["longFundingFee"])
    if latest.get("lastFundingRate") is None:
        return None
    return -float(latest["lastFundingRate"])


def latest_short_fee(latest):
    if latest.get("shortFundingFee") is not None:
        return float(latest["shortFundingFee"])
    if latest.get("lastFundingRate") is None:
        return None
    return float(latest["lastFundingRate"])


def annualized_from_fee(fee, interval_hours):
    if fee is None:
        return None
    return fee * (24 / interval_hours) * 365 * 100


def comparable_fee_from_annualized(annualized_pct):
    if annualized_pct is None:
        return None
    return annualized_pct / 100 / (24 / COMPARISON_INTERVAL_HOURS * 365)


def spread_alert_level(annualized_spread):
    if annualized_spread is None:
        return "unknown"
    abs_spread = abs(annualized_spread)
    if abs_spread >= 20:
        return "wide"
    if abs_spread >= 5:
        return "narrow"
    return "normal"


def asset_reliability(pair, now_ms):
    rows = pair.get("rows") or []
    latest = pair.get("latest") or {}
    interval = float(pair.get("fundingIntervalHours") or 8)
    expected_90d = max(1, int(WINDOWS["90D"] * 24 / interval))
    last_funding_time = rows[-1]["fundingTime"] if rows else None
    freshness_time = latest.get("time") or latest.get("nextFundingTime") or last_funding_time
    latest_age_hours = None
    if freshness_time:
        latest_age_hours = max(0, (now_ms - int(freshness_time)) / 3600000)
    coverage = min(1, len(rows) / expected_90d)
    latest_available = bool(latest.get("available", True)) and latest_long_fee(latest) is not None
    if not pair.get("available") or not latest_available:
        status = "unavailable"
    elif coverage < 0.5:
        status = "limited"
    elif latest_age_hours is not None and latest_age_hours > max(24, interval * 4):
        status = "stale"
    else:
        status = "ok"
    return {
        "status": status,
        "historyRows": len(rows),
        "historyCoveragePct": round(coverage * 100, 2),
        "latestAgeHours": None if latest_age_hours is None else round(latest_age_hours, 2),
    }


def summarize_metric_entries(entries):
    if not entries:
        return {
            "exchanges": [],
            "spread": None,
            "alertLevel": "unknown",
            "longFavored": None,
            "shortFavored": None,
        }
    long_sorted = sorted(entries, key=lambda item: item["longFundingFee8h"], reverse=True)
    short_sorted = sorted(entries, key=lambda item: item["shortFundingFee8h"], reverse=True)
    high = long_sorted[0]
    low = long_sorted[-1]
    annualized_spread = None
    if high.get("annualizedPct") is not None and low.get("annualizedPct") is not None:
        annualized_spread = high["annualizedPct"] - low["annualizedPct"]
    spread_8h = high["longFundingFee8h"] - low["longFundingFee8h"]
    return {
        "exchanges": entries,
        "spread": {
            "highPairKey": high["pairKey"],
            "lowPairKey": low["pairKey"],
            "longFundingFee8h": spread_8h,
            "annualizedPct": annualized_spread,
        },
        "alertLevel": spread_alert_level(annualized_spread),
        "longFavored": long_sorted[0]["pairKey"],
        "shortFavored": short_sorted[0]["pairKey"],
    }


def build_asset_metrics(data):
    now_ms = data["updatedAt"]
    grouped = {}
    for key, pair in data["pairs"].items():
        grouped.setdefault(pair.get("assetId", pair.get("displaySymbol", pair["symbol"])), []).append((key, pair))

    metrics = {}
    for asset_id, pairs in grouped.items():
        current_entries = []
        windows = {label: [] for label in WINDOWS}
        reliability = {}
        for key, pair in pairs:
            interval = float(pair.get("fundingIntervalHours") or 8)
            latest = pair.get("latest") or {}
            long_fee = latest_long_fee(latest)
            short_fee = latest_short_fee(latest)
            long_annualized = annualized_from_fee(long_fee, interval)
            short_annualized = annualized_from_fee(short_fee, interval)
            reliability[key] = asset_reliability(pair, now_ms)
            if long_annualized is not None and short_annualized is not None:
                current_entries.append({
                    "pairKey": key,
                    "exchange": pair["exchange"],
                    "symbol": pair["symbol"],
                    "intervalHours": interval,
                    "rawLongFundingFee": long_fee,
                    "rawShortFundingFee": short_fee,
                    "longFundingFee8h": comparable_fee_from_annualized(long_annualized),
                    "shortFundingFee8h": comparable_fee_from_annualized(short_annualized),
                    "annualizedPct": long_annualized,
                    "shortAnnualizedPct": short_annualized,
                    "reliabilityStatus": reliability[key]["status"],
                })
            for label, summary in (pair.get("windows") or {}).items():
                if not summary or not summary.get("count"):
                    continue
                long_annualized = summary.get("annualizedPct")
                if long_annualized is None:
                    continue
                windows[label].append({
                    "pairKey": key,
                    "exchange": pair["exchange"],
                    "symbol": pair["symbol"],
                    "intervalHours": interval,
                    "rawLongFundingFee": -float(summary.get("avgFundingRate", 0)),
                    "rawShortFundingFee": float(summary.get("avgFundingRate", 0)),
                    "longFundingFee8h": comparable_fee_from_annualized(long_annualized),
                    "shortFundingFee8h": comparable_fee_from_annualized(-long_annualized),
                    "annualizedPct": long_annualized,
                    "shortAnnualizedPct": -long_annualized,
                    "count": summary.get("count", 0),
                    "reliabilityStatus": reliability[key]["status"],
                })
        metrics[asset_id] = {
            "comparisonIntervalHours": COMPARISON_INTERVAL_HOURS,
            "current": summarize_metric_entries(current_entries),
            "windows": {label: summarize_metric_entries(entries) for label, entries in windows.items()},
            "reliability": reliability,
        }
    return metrics


def alert_severity(level):
    if level == "wide":
        return "high"
    if level == "narrow":
        return "medium"
    return "info"


def build_alerts(data):
    alerts = []
    pairs = data.get("pairs", {})
    for asset_id, metrics in (data.get("assetMetrics") or {}).items():
        scopes = [("current", metrics.get("current"))]
        scopes.extend((window, window_metrics) for window, window_metrics in (metrics.get("windows") or {}).items())
        for scope, scope_metrics in scopes:
            if not scope_metrics or not scope_metrics.get("spread"):
                continue
            level = scope_metrics.get("alertLevel")
            if level not in {"narrow", "wide"}:
                continue
            spread = scope_metrics["spread"]
            high_pair = pairs.get(spread.get("highPairKey"), {})
            low_pair = pairs.get(spread.get("lowPairKey"), {})
            alerts.append({
                "id": f"{asset_id}:{scope}:funding-spread:{level}",
                "type": "funding_spread",
                "severity": alert_severity(level),
                "assetId": asset_id,
                "scope": scope,
                "level": level,
                "annualizedSpreadPct": spread.get("annualizedPct"),
                "fundingSpread8h": spread.get("longFundingFee8h"),
                "highPairKey": spread.get("highPairKey"),
                "lowPairKey": spread.get("lowPairKey"),
                "highExchange": high_pair.get("exchange"),
                "lowExchange": low_pair.get("exchange"),
            })
        for pair_key, reliability in (metrics.get("reliability") or {}).items():
            status = reliability.get("status")
            if status in {None, "ok"}:
                continue
            pair = pairs.get(pair_key, {})
            alerts.append({
                "id": f"{asset_id}:{pair_key}:reliability:{status}",
                "type": "data_reliability",
                "severity": "medium" if status in {"limited", "stale"} else "high",
                "assetId": asset_id,
                "pairKey": pair_key,
                "exchange": pair.get("exchange"),
                "status": status,
                "historyRows": reliability.get("historyRows"),
                "historyCoveragePct": reliability.get("historyCoveragePct"),
                "latestAgeHours": reliability.get("latestAgeHours"),
            })
    alerts.sort(key=lambda item: ({"high": 0, "medium": 1, "info": 2}.get(item["severity"], 3), item["assetId"], item["type"]))
    return {
        "updatedAt": data["updatedAt"],
        "alerts": alerts,
        "summary": {
            "total": len(alerts),
            "high": sum(1 for alert in alerts if alert["severity"] == "high"),
            "medium": sum(1 for alert in alerts if alert["severity"] == "medium"),
            "info": sum(1 for alert in alerts if alert["severity"] == "info"),
        }
    }

def main():
    previous = {}
    if DATA_PATH.exists():
        try:
            previous = json.loads(DATA_PATH.read_text())
        except json.JSONDecodeError:
            previous = {}

    data = {
        "updatedAt": int(time.time() * 1000),
        "meta": {
            "windows": WINDOWS,
            "comparisonIntervalHours": COMPARISON_INTERVAL_HOURS,
            "partialFailure": False,
            "errors": [],
            "notes": {
                "Hyperliquid xyz:GOOGL": "HIP-3 builder-deployed perp on dex xyz; hourly funding history available via public info API",
                "SAMSUNG": "Binance symbol is SAMSUNGUSDT; Hyperliquid API symbol is xyz:SMSN",
                "SKHYNIX": "Binance symbol is SKHYNIXUSDT; Hyperliquid API symbol is xyz:SKHX",
                "GOLD": "Binance symbol is XAUUSDT; Bybit symbol is XAUTUSDT; Hyperliquid API symbol is xyz:GOLD",
                "Bybit GOOGLUSDT": "Funding history and current snapshot available via public linear market API",
                "Binance XAUUSDT": "Funding history and current snapshot available via public futures API",
                "Bybit XAUTUSDT": "Funding history and current snapshot available via public linear market API"
            }
        },
        "pairs": {},
        "comparisons": {
            "Binance": {"supported": True, "notes": "Funding history available via public futures API"},
            "Bybit": {"supported": True, "notes": "Funding history + current snapshot available via public linear market API"},
            "Hyperliquid": {"supported": True, "notes": "HIP-3 xyz perp funding history + current snapshot available via public info API"},
            "Aster": {"supported": True, "notes": "Funding history + current snapshot available via public futures API"},
            "OKX": {"supported": True, "notes": "Funding history + current snapshot available via public API"},
            "Variational": {"supported": True, "notes": "Public API is current snapshot oriented; dashboard accumulates snapshots over time"},
            "Orbs Perps Hub": {"supported": True, "notes": "Current Long/Short funding uses THENA Perps aggregatedFundingData; history uses raw public proxy funding API"}
        }
    }

    for pair in PAIRS:
        symbol = pair["symbol"]
        key = pair_key(pair)
        pair_out = {
            "key": key,
            "symbol": symbol,
            "displaySymbol": pair.get("displaySymbol", symbol),
            "assetId": pair.get("assetId", symbol),
            "assetName": pair.get("assetName", pair.get("displaySymbol", symbol)),
            "exchange": pair["exchange"],
            "dex": pair.get("dex"),
            "fundingPeriodsPerDay": payments_per_day(pair),
            "fundingIntervalHours": funding_interval_hours(pair),
            "windows": {},
            "latest": {},
            "rows": []
        }

        try:
            old_pair = previous.get("pairs", {}).get(key, {})
            full_rows = fetch_history(pair, WINDOWS["90D"], old_pair.get("rows", []))
            if pair.get("_fundingIntervalHours"):
                pair_out["fundingIntervalHours"] = float(pair["_fundingIntervalHours"])
                pair_out["fundingPeriodsPerDay"] = 24 / pair_out["fundingIntervalHours"]
            elif full_rows:
                pair_out["fundingIntervalHours"] = infer_funding_interval_hours(pair, full_rows)
                pair_out["fundingPeriodsPerDay"] = 24 / pair_out["fundingIntervalHours"]
            pair_out["latest"] = fetch_latest(pair)
            pair_out["rows"] = full_rows
            for label, days in WINDOWS.items():
                min_ts = int(time.time() * 1000) - days * 24 * 3600 * 1000
                filtered = [r for r in full_rows if r["fundingTime"] >= min_ts]
                pair_out["windows"][label] = summarize(filtered, pair_out["fundingPeriodsPerDay"])
            pair_out["available"] = True
            data["pairs"][key] = pair_out
        except Exception as e:
            old_pair = previous.get("pairs", {}).get(key)
            data["meta"]["partialFailure"] = True
            data["meta"]["errors"].append({
                "key": key,
                "error": str(e),
                "time": int(time.time() * 1000)
            })
            if old_pair:
                old_pair["available"] = False
                old_pair["lastError"] = str(e)
                old_pair["lastErrorAt"] = int(time.time() * 1000)
                data["pairs"][key] = old_pair
            else:
                pair_out["available"] = False
                pair_out["lastError"] = str(e)
                pair_out["lastErrorAt"] = int(time.time() * 1000)
                data["pairs"][key] = pair_out

    data["assetMetrics"] = build_asset_metrics(data)
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    ALERTS_PATH.write_text(json.dumps(build_alerts(data), ensure_ascii=False, indent=2) + "\n")

if __name__ == '__main__':
    main()
