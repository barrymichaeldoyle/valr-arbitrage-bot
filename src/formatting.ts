import type { MarketDataMap } from './marketData';
import { Pair } from './types/valrEnums';

/**
 * Gets the decimal precision for a currency based on market data
 */
export function getCurrencyPrecision(
  currency: string,
  pair: Pair,
  marketData: MarketDataMap
): number {
  const data = marketData[pair];
  if (!data) {
    return 8; // Default to 8 decimal places
  }

  // Parse the pair to determine if currency is base or quote
  const pairStr = pair.toString();
  const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'ZAR', 'USD', 'EUR'];

  for (const quote of quotes) {
    if (pairStr.endsWith(quote)) {
      const base = pairStr.slice(0, -quote.length);

      if (currency === base) {
        return data.baseDecimalPlaces;
      } else if (currency === quote) {
        return data.quoteDecimalPlaces;
      }
      break;
    }
  }

  return 8; // Default fallback
}

/**
 * Formats a number with appropriate decimal places for a currency
 * For very small values, uses additional precision to ensure they're visible
 */
export function formatCurrency(
  value: number,
  currency: string,
  pair: Pair,
  marketData: MarketDataMap
): string {
  // Handle zero
  if (value === 0 || Math.abs(value) < Number.EPSILON) {
    return '0';
  }

  const precision = getCurrencyPrecision(currency, pair, marketData);

  // For very small values, use more precision to ensure they're visible
  // If the value would round to 0 with the normal precision, use up to 8 decimal places
  const minVisibleValue = Math.pow(10, -precision);
  const effectivePrecision =
    value < minVisibleValue ? Math.max(8, precision) : precision;

  const formatted = value.toFixed(effectivePrecision);

  // Remove trailing zeros after decimal point, but ensure we don't remove everything
  const cleaned = formatted.replace(/\.?0+$/, '');

  // If cleaned is empty or just a dot, return '0'
  if (!cleaned || cleaned === '.') {
    return '0';
  }

  return cleaned;
}

/**
 * Formats a price with appropriate decimal places
 * For prices, we typically want fewer decimal places than amounts
 */
export function formatPrice(
  value: number,
  pair: Pair,
  marketData: MarketDataMap
): string {
  const data = marketData[pair];
  if (!data) {
    return value.toFixed(2);
  }

  // For prices, infer precision from the price itself
  // Large prices (like BTC/USDC ~92358) should have 0-2 decimal places
  // Small prices (like ETH/BTC ~0.035) should have more decimal places
  if (value >= 1000) {
    return value.toFixed(0);
  } else if (value >= 1) {
    return value.toFixed(2);
  } else if (value >= 0.1) {
    return value.toFixed(4);
  } else if (value >= 0.01) {
    return value.toFixed(6);
  } else {
    return value.toFixed(8);
  }
}
