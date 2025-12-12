import axios from 'axios';

import { Pair } from './types/valrEnums';

const VALR_API_BASE = 'https://api.valr.com/v1/public';

export interface ValrPairInfo {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  shortName: string;
  active: boolean;
  minBaseAmount: string;
  maxBaseAmount: string;
  minQuoteAmount: string;
  maxQuoteAmount: string;
}

/**
 * Fetches all available trading pairs from VALR's public API
 */
export async function getAvailablePairs(): Promise<ValrPairInfo[]> {
  try {
    const response = await axios.get<ValrPairInfo[]>(`${VALR_API_BASE}/pairs`);
    return response.data.filter((pair) => pair.active);
  } catch (error) {
    console.error('Failed to fetch available pairs from VALR:', error);
    throw error;
  }
}

/**
 * Gets the list of pair symbols (e.g., ['BTCUSDT', 'BTCUSDC'])
 * that are available on VALR
 */
export async function getAvailablePairSymbols(): Promise<string[]> {
  const pairs = await getAvailablePairs();
  return pairs.map((pair) => pair.symbol);
}

/**
 * Filters the provided pairs to only include those supported by VALR
 */
export async function filterSupportedPairs(pairs: Pair[]): Promise<Pair[]> {
  const availableSymbols = await getAvailablePairSymbols();
  return pairs.filter((pair) => availableSymbols.includes(pair));
}

/**
 * Validates if a specific pair is supported by VALR
 */
export async function isPairSupported(pair: Pair): Promise<boolean> {
  const availableSymbols = await getAvailablePairSymbols();
  return availableSymbols.includes(pair);
}
