import { DEFAULT_FEE_TIER } from './fees';

/**
 * Configuration constants for arbitrage detection
 */
export const ARBITRAGE_CONFIG = {
  /** Fee tier to use for calculations (Tier 5: Maker 0.04%, Taker 0.06% for crypto pairs) */
  FEE_TIER: DEFAULT_FEE_TIER,
  /** Minimum profit percentage (0.01%) to report an opportunity */
  MIN_PROFIT_PERCENTAGE: 0.01,
  /** Interval between cycle checks in milliseconds */
  CHECK_INTERVAL_MS: 2000,
  /** Interval between log updates when showing same opportunity (15 seconds) */
  LOG_INTERVAL_MS: 15000,
  /** Profit change threshold for logging (0.01%) */
  PROFIT_CHANGE_THRESHOLD: 0.01,
  /** Percentage of 24h volume to use for max tradeable amount (0.1%) */
  MAX_TRADEABLE_VOLUME_PERCENTAGE: 0.001,
  /** Fallback starting amount when realistic size cannot be determined */
  FALLBACK_STARTING_AMOUNT: 0.001,
} as const;
