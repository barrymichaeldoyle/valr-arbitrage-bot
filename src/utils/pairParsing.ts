import { Pair } from '../types/valrEnums';

/**
 * Common quote currencies used in VALR pairs
 */
const COMMON_QUOTES = [
  'USDT',
  'USDC',
  'BTC',
  'ETH',
  'ZAR',
  'USD',
  'EUR',
] as const;

/**
 * Parses a pair to extract base and quote currencies
 * e.g., 'BTCUSDT' -> { base: 'BTC', quote: 'USDT' }
 */
export function parsePair(pair: Pair): { base: string; quote: string } | null {
  const pairStr = pair.toString();
  for (const quote of COMMON_QUOTES) {
    if (pairStr.endsWith(quote)) {
      const base = pairStr.slice(0, -quote.length);
      return { base, quote };
    }
  }
  return null;
}
