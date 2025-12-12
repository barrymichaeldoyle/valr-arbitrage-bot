export enum Pair {
  // BTC pairs
  BTCUSDT = 'BTCUSDT',
  BTCUSDC = 'BTCUSDC',
  // ETH pairs
  ETHUSDT = 'ETHUSDT',
  ETHUSDC = 'ETHUSDC',
  ETHBTC = 'ETHBTC',
  // AVAX pairs
  AVAXUSDT = 'AVAXUSDT',
  AVAXUSDC = 'AVAXUSDC',
  // SOL pairs
  SOLUSDT = 'SOLUSDT',
  SOLUSDC = 'SOLUSDC',
  // XRP pairs
  XRPUSDT = 'XRPUSDT',
  XRPUSDC = 'XRPUSDC',
  // DOGE pairs
  DOGEUSDT = 'DOGEUSDT',
  DOGEZAR = 'DOGEZAR',
  // BNB pairs
  BNBUSDT = 'BNBUSDT',
  BNBZAR = 'BNBZAR',
  // LINK pairs
  LINKUSDT = 'LINKUSDT',
  LINKZAR = 'LINKZAR',
  // LTC pairs
  LTCUSDT = 'LTCUSDT',
  LTCZAR = 'LTCZAR',
  // PYUSD pairs
  PYUSDUSDT = 'PYUSDUSDT',
  PYUSDZAR = 'PYUSDZAR',
  // RLUSD pairs
  RLUSDUSDT = 'RLUSDUSDT',
  RLUSDZAR = 'RLUSDZAR',
  // SHIB pairs
  SHIBUSDT = 'SHIBUSDT',
  SHIBZAR = 'SHIBZAR',
  // TRX pairs
  TRXUSDT = 'TRXUSDT',
  TRXZAR = 'TRXZAR',
  // XAuT pairs
  XAUTUSDT = 'XAUTUSDT',
  XAUTZAR = 'XAUTZAR',
  // Stablecoin pairs
  USDTUSDC = 'USDTUSDC',
}

export enum SubscriptionType {
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
}

export enum AccountSubscriptionEvent {
  MARGIN_INFO = 'MARGIN_INFO',
  BALANCE_UPDATE = 'BALANCE_UPDATE',
}

export enum TradeSubscriptionEvent {
  MARKET_SUMMARY_UPDATE = 'MARKET_SUMMARY_UPDATE',
}
