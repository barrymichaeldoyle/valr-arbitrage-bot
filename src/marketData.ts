import { Pair } from './types/valrEnums';

export interface MarketData {
  pair: Pair;
  bidPrice: number; // Best bid (price you can sell at)
  askPrice: number; // Best ask (price you can buy at)
  lastTradedPrice: number;
  baseVolume24h: number; // 24h volume in base currency
  quoteVolume24h: number; // 24h volume in quote currency
  minBaseAmount: number; // Minimum trade size in base currency
  minQuoteAmount: number; // Minimum trade size in quote currency
  baseDecimalPlaces: number; // Decimal precision for base currency
  quoteDecimalPlaces: number; // Decimal precision for quote currency
}

export type MarketDataMap = Record<Pair, MarketData>;

/**
 * Calculates a conservative maximum trade size based on 24h volume
 * Uses a small percentage of 24h volume to estimate available liquidity
 */
export function calculateMaxTradeSize(
  marketData: MarketData,
  direction: 'buy' | 'sell',
  maxVolumePercentage: number = 0.001 // 0.1% of 24h volume
): number {
  // Use base volume for buying base currency, quote volume for selling base currency
  const volume24h =
    direction === 'buy' ? marketData.baseVolume24h : marketData.quoteVolume24h;
  return volume24h * maxVolumePercentage;
}
