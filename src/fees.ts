import { Pair } from './types/valrEnums';

export enum PairType {
  FIAT_QUOTE = 'FIAT_QUOTE', // e.g., BTCZAR, USDTZAR
  CRYPTO_QUOTE = 'CRYPTO_QUOTE', // e.g., BTCUSDT, ETHUSDC
  STABLE_TO_STABLE = 'STABLE_TO_STABLE', // e.g., USDTUSDC
}

export enum OrderType {
  MAKER = 'MAKER',
  TAKER = 'TAKER',
}

export interface FeeTier {
  tier: number;
  minVolumeUsdt: number;
  fiatQuote: {
    maker: number;
    taker: number;
  };
  cryptoQuote: {
    maker: number;
    taker: number;
  };
  stableToStable: {
    maker: number;
    taker: number;
  };
}

/**
 * VALR Spot Fee Tiers
 * Source: https://support.valr.com/hc/en-us/articles/360015777451-What-are-VALR-s-charges
 */
export const FEE_TIERS: FeeTier[] = [
  {
    tier: 1,
    minVolumeUsdt: 0,
    fiatQuote: { maker: 0.0018, taker: 0.0035 },
    cryptoQuote: { maker: 0.0008, taker: 0.001 },
    stableToStable: { maker: 0.0005, taker: 0.001 },
  },
  {
    tier: 2,
    minVolumeUsdt: 50_000,
    fiatQuote: { maker: 0.001, taker: 0.0025 },
    cryptoQuote: { maker: 0.0007, taker: 0.0009 },
    stableToStable: { maker: 0.0003, taker: 0.0005 },
  },
  {
    tier: 3,
    minVolumeUsdt: 250_000,
    fiatQuote: { maker: 0.0004, taker: 0.0013 },
    cryptoQuote: { maker: 0.0006, taker: 0.0008 },
    stableToStable: { maker: 0.0001, taker: 0.0003 },
  },
  {
    tier: 4,
    minVolumeUsdt: 1_000_000,
    fiatQuote: { maker: 0.0003, taker: 0.0009 },
    cryptoQuote: { maker: 0.0005, taker: 0.0007 },
    stableToStable: { maker: 0.0, taker: 0.0002 },
  },
  {
    tier: 5,
    minVolumeUsdt: 5_000_000,
    fiatQuote: { maker: 0.0002, taker: 0.0009 },
    cryptoQuote: { maker: 0.0004, taker: 0.0006 },
    stableToStable: { maker: 0.0, taker: 0.0001 },
  },
  {
    tier: 6,
    minVolumeUsdt: 10_000_000,
    fiatQuote: { maker: 0.0001, taker: 0.0008 },
    cryptoQuote: { maker: 0.0003, taker: 0.0005 },
    stableToStable: { maker: 0.0, taker: 0.0001 },
  },
  {
    tier: 7,
    minVolumeUsdt: 20_000_000,
    fiatQuote: { maker: -0.0001, taker: 0.0008 },
    cryptoQuote: { maker: 0.0002, taker: 0.00045 },
    stableToStable: { maker: 0.0, taker: 0.0001 },
  },
  {
    tier: 8,
    minVolumeUsdt: 75_000_000,
    fiatQuote: { maker: -0.0001, taker: 0.0007 },
    cryptoQuote: { maker: 0.0001, taker: 0.0004 },
    stableToStable: { maker: 0.0, taker: 0.0001 },
  },
  {
    tier: 9,
    minVolumeUsdt: 250_000_000,
    fiatQuote: { maker: -0.0001, taker: 0.0005 },
    cryptoQuote: { maker: 0.0, taker: 0.00035 },
    stableToStable: { maker: 0.0, taker: 0.0 },
  },
];

/**
 * Default fee tier (Tier 5)
 */
export const DEFAULT_FEE_TIER = 5;

/**
 * Stablecoin currencies
 */
const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);

/**
 * Fiat currencies
 */
const FIAT_CURRENCIES = new Set(['ZAR', 'USD', 'EUR', 'GBP']);

/**
 * Determines the pair type for a given trading pair
 */
export function getPairType(pair: Pair): PairType {
  const pairStr = pair.toString();

  // Check for stable-to-stable pairs
  for (const stablecoin of Array.from(STABLECOINS)) {
    if (pairStr.endsWith(stablecoin)) {
      const base = pairStr.slice(0, -stablecoin.length);
      if (STABLECOINS.has(base)) {
        return PairType.STABLE_TO_STABLE;
      }
    }
  }

  // Check for fiat quote pairs
  for (const fiat of Array.from(FIAT_CURRENCIES)) {
    if (pairStr.endsWith(fiat)) {
      return PairType.FIAT_QUOTE;
    }
  }

  // Default to crypto quote
  return PairType.CRYPTO_QUOTE;
}

/**
 * Gets the fee rate for a specific pair, tier, and order type
 */
export function getFeeRate(
  pair: Pair,
  tier: number = DEFAULT_FEE_TIER,
  orderType: OrderType = OrderType.TAKER
): number {
  const feeTier = FEE_TIERS.find((ft) => ft.tier === tier);
  if (!feeTier) {
    throw new Error(`Invalid fee tier: ${tier}`);
  }

  const pairType = getPairType(pair);
  const fees =
    pairType === PairType.FIAT_QUOTE
      ? feeTier.fiatQuote
      : pairType === PairType.STABLE_TO_STABLE
        ? feeTier.stableToStable
        : feeTier.cryptoQuote;

  return orderType === OrderType.MAKER ? fees.maker : fees.taker;
}

/**
 * Gets fees for all pairs in a path
 * Returns an array of fee rates for each trade in the path
 */
export function getPathFees(
  path: Pair[],
  tier: number = DEFAULT_FEE_TIER,
  orderType: OrderType = OrderType.TAKER
): number[] {
  return path.map((pair) => getFeeRate(pair, tier, orderType));
}

/**
 * Calculates the total fee multiplier for a path
 * Returns the multiplier to apply to the final result (e.g., 0.998 for 0.2% total fees)
 */
export function calculateFeeMultiplier(
  path: Pair[],
  tier: number = DEFAULT_FEE_TIER,
  orderType: OrderType = OrderType.TAKER
): number {
  const fees = getPathFees(path, tier, orderType);
  // Each trade reduces the amount by (1 - fee_rate)
  return fees.reduce((multiplier, fee) => multiplier * (1 - fee), 1);
}
