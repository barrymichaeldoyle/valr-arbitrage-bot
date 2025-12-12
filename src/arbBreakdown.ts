import { ARBITRAGE_CONFIG } from './constants';
import { getFeeRate, OrderType } from './fees';
import { formatCurrency } from './formatting';
import type { MarketDataMap } from './marketData';
import { Pair } from './types/valrEnums';
import { parsePair } from './utils/pairParsing';

export interface TradeStep {
  step: number;
  pair: Pair;
  action: string; // e.g., "Sell 1 BTC for USDT"
  inputAmount: number;
  inputCurrency: string;
  price: number;
  priceIsEstimate: boolean; // True if using lastTradedPrice instead of bid/ask
  feeRate: number;
  feeAmount: number;
  outputAmount: number;
  outputCurrency: string;
  maxTradeableAmount: number | undefined; // Maximum amount that can be traded based on liquidity
  minTradeableAmount: number | undefined; // Minimum trade size required by VALR
}

export interface ArbitrageBreakdown {
  path: Pair[];
  startingAmount: number;
  startingCurrency: string;
  steps: TradeStep[];
  finalAmount: number;
  profit: number;
  profitPercentage: number;
  totalFees: number;
  maxRealisticTradeSize: number | undefined; // Maximum realistic trade size based on liquidity
  realisticProfit: number | undefined; // Profit at max realistic trade size
}

/**
 * Gets the execution price for a pair based on trade direction
 * Uses bid price when selling (forward), ask price when buying (reverse)
 * Also calculates max tradeable amount based on liquidity
 */
function getPairPrice(
  pair: Pair,
  marketData: MarketDataMap,
  direction: 'forward' | 'reverse'
): {
  price: number;
  isEstimate: boolean;
  maxTradeableAmount: number | undefined;
  minTradeableAmount: number | undefined;
} {
  const data = marketData[pair];
  if (!data) {
    return {
      price: 0,
      isEstimate: true,
      maxTradeableAmount: undefined,
      minTradeableAmount: undefined,
    };
  }

  let price: number;
  let isEstimate: boolean;
  let maxTradeableAmount: number | undefined;
  let minTradeableAmount: number | undefined;

  if (direction === 'forward') {
    // Selling base for quote - use bid price (what buyers are willing to pay)
    price = data.bidPrice > 0 ? data.bidPrice : data.lastTradedPrice;
    isEstimate = data.bidPrice <= 0;
    // When selling base, max tradeable is based on quote volume (how much quote currency buyers have)
    // Convert quote volume to base currency: quoteVolume / bidPrice
    maxTradeableAmount =
      data.quoteVolume24h > 0 && price > 0
        ? (data.quoteVolume24h *
            ARBITRAGE_CONFIG.MAX_TRADEABLE_VOLUME_PERCENTAGE) /
          price
        : undefined;
    // Minimum trade size is in base currency
    minTradeableAmount =
      data.minBaseAmount > 0 ? data.minBaseAmount : undefined;
  } else {
    // Buying base with quote - use ask price (what sellers are asking)
    const askPrice = data.askPrice > 0 ? data.askPrice : data.lastTradedPrice;
    price = askPrice > 0 ? 1 / askPrice : 0; // Inverted for reverse direction
    isEstimate = data.askPrice <= 0;
    // When buying base, max tradeable is based on base volume (how much base currency sellers have)
    maxTradeableAmount =
      data.baseVolume24h > 0
        ? data.baseVolume24h * ARBITRAGE_CONFIG.MAX_TRADEABLE_VOLUME_PERCENTAGE
        : undefined;
    // Minimum trade size: when buying base, we need at least minBaseAmount of base currency
    // But we're spending quote currency, so convert: minBaseAmount * askPrice
    minTradeableAmount =
      data.minBaseAmount > 0 && askPrice > 0
        ? data.minBaseAmount * askPrice // Minimum quote amount needed
        : data.minQuoteAmount > 0
          ? data.minQuoteAmount // Fallback to minQuoteAmount
          : undefined;
  }

  if (price <= 0) {
    return {
      price: 0,
      isEstimate: true,
      maxTradeableAmount: undefined,
      minTradeableAmount: undefined,
    };
  }

  return { price, isEstimate, maxTradeableAmount, minTradeableAmount };
}

/**
 * Determines the direction of trade needed based on the path
 * Returns null if the current currency cannot be traded with this pair
 */
function getTradeDirection(
  pair: Pair,
  currentCurrency: string
): 'forward' | 'reverse' | null {
  const parsed = parsePair(pair);
  if (!parsed) return null;

  // If current currency is the base, we're selling (forward)
  // If current currency is the quote, we're buying (reverse)
  if (currentCurrency === parsed.base) {
    return 'forward';
  } else if (currentCurrency === parsed.quote) {
    return 'reverse';
  }

  // Currency doesn't match this pair - invalid path
  return null;
}

/**
 * Converts an amount from one currency to another by simulating backwards through the path
 * This is used to convert min/max trade amounts from intermediate steps back to the starting currency
 */
function convertToStartingCurrency(
  amount: number,
  amountCurrency: string,
  path: Pair[],
  marketData: MarketDataMap,
  upToStep: number
): number {
  if (upToStep === 0) return amount;

  const firstPairEnum = path[0];
  if (!firstPairEnum) return amount;
  const firstPair = parsePair(firstPairEnum);
  if (!firstPair) return amount;

  // Simulate forward to determine what currency we have at each step
  let simCurrency = firstPair.base;
  const currencyAtStep: string[] = [simCurrency];

  for (let j = 0; j < upToStep; j++) {
    const simPair = path[j];
    if (!simPair) break;
    const simParsed = parsePair(simPair);
    if (!simParsed) break;

    const simDirection = getTradeDirection(simPair, simCurrency);
    simCurrency = simDirection === 'forward' ? simParsed.quote : simParsed.base;
    currencyAtStep.push(simCurrency);
  }

  // Now work backwards to convert the amount
  let currentAmount = amount;

  for (let j = upToStep; j > 0; j--) {
    const prevPair = path[j - 1];
    if (!prevPair) break;
    const prevParsed = parsePair(prevPair);
    if (!prevParsed) break;

    // The currency we had before step j-1
    const prevCurrency = currencyAtStep[j - 1];
    if (!prevCurrency) break;

    const prevDirection = getTradeDirection(prevPair, prevCurrency);
    if (prevDirection === null) break;
    const prevPriceInfo = getPairPrice(prevPair, marketData, prevDirection);

    // Reverse the conversion
    if (prevDirection === 'forward') {
      // Previous step sold base for quote, so to reverse: divide by price
      currentAmount = currentAmount / prevPriceInfo.price;
    } else {
      // Previous step bought base with quote, so to reverse: multiply by price (price is already inverted)
      currentAmount = currentAmount * prevPriceInfo.price;
    }
  }

  return currentAmount;
}

/**
 * Calculates the maximum realistic trade size for a path based on liquidity constraints
 * Returns the maximum amount in the starting currency that can be safely traded
 * Also ensures the trade size meets minimum requirements
 */
function calculateMaxRealisticTradeSize(
  path: Pair[],
  marketData: MarketDataMap
): number | null {
  if (path.length === 0) return null;

  const firstPairEnum = path[0];
  if (!firstPairEnum) return null;
  const firstPair = parsePair(firstPairEnum);
  if (!firstPair) return null;

  let currentCurrency = firstPair.base;
  const maxTradeableInStartingCurrency: number[] = [];
  const minTradeableInStartingCurrency: number[] = [];

  // First pass: collect max and min tradeable amounts for each step
  for (let i = 0; i < path.length; i++) {
    const pair = path[i];
    if (!pair) return null;
    const parsed = parsePair(pair);
    if (!parsed) return null;

    const direction = getTradeDirection(pair, currentCurrency);
    if (direction === null) {
      // Invalid path - currency doesn't match pair
      return null;
    }
    const priceInfo = getPairPrice(pair, marketData, direction);

    if (priceInfo.price <= 0) return null;

    // Convert max tradeable amount to starting currency
    if (
      priceInfo.maxTradeableAmount !== undefined &&
      priceInfo.maxTradeableAmount > 0
    ) {
      const amountInStartingCurrency = convertToStartingCurrency(
        priceInfo.maxTradeableAmount,
        currentCurrency,
        path,
        marketData,
        i
      );
      maxTradeableInStartingCurrency.push(amountInStartingCurrency);
    }

    // Convert min tradeable amount to starting currency
    if (
      priceInfo.minTradeableAmount !== undefined &&
      priceInfo.minTradeableAmount > 0
    ) {
      const amountInStartingCurrency = convertToStartingCurrency(
        priceInfo.minTradeableAmount,
        currentCurrency,
        path,
        marketData,
        i
      );
      minTradeableInStartingCurrency.push(amountInStartingCurrency);
    }

    // Update currency for next iteration
    currentCurrency = direction === 'forward' ? parsed.quote : parsed.base;
  }

  // Find the maximum we can trade (bottleneck from liquidity)
  const maxFromLiquidity =
    maxTradeableInStartingCurrency.length > 0
      ? Math.min(...maxTradeableInStartingCurrency)
      : null;

  // Find the minimum we must trade (highest minimum requirement)
  const minFromRequirements =
    minTradeableInStartingCurrency.length > 0
      ? Math.max(...minTradeableInStartingCurrency)
      : null;

  // If we have both constraints, ensure we meet minimum and don't exceed maximum
  if (minFromRequirements !== null && maxFromLiquidity !== null) {
    if (minFromRequirements > maxFromLiquidity) {
      // Minimum requirement exceeds available liquidity - not tradeable
      return null;
    }
    // Use the maximum available, but ensure it's at least the minimum
    return Math.max(minFromRequirements, maxFromLiquidity);
  }

  // If we only have minimum requirements, use that
  if (minFromRequirements !== null) {
    return minFromRequirements;
  }

  // If we only have liquidity constraints, use that
  if (maxFromLiquidity !== null) {
    return maxFromLiquidity;
  }

  return null;
}

/**
 * Calculates a detailed breakdown of an arbitrage opportunity
 * Uses realistic trade sizes based on available liquidity by default
 */
export function calculateArbitrageBreakdown(
  path: Pair[],
  marketData: MarketDataMap,
  feeTier: number,
  startingAmount?: number // If not provided, will use realistic max trade size
): ArbitrageBreakdown | null {
  if (path.length === 0) return null;

  // Determine starting currency from first pair
  const firstPairEnum = path[0];
  if (!firstPairEnum) return null;
  const firstPair = parsePair(firstPairEnum);
  if (!firstPair) return null;

  // Calculate realistic max trade size if not provided
  let actualStartingAmount = startingAmount;
  if (actualStartingAmount === undefined) {
    const maxRealistic = calculateMaxRealisticTradeSize(path, marketData);
    if (maxRealistic === null || maxRealistic <= 0) {
      // Fallback to a small amount if we can't determine realistic size
      actualStartingAmount = ARBITRAGE_CONFIG.FALLBACK_STARTING_AMOUNT;
    } else {
      actualStartingAmount = maxRealistic;
    }
  }

  let currentCurrency = firstPair.base;
  let currentAmount = actualStartingAmount;
  const steps: TradeStep[] = [];

  // Process each trade in the path
  for (let i = 0; i < path.length; i++) {
    const pair = path[i];
    if (!pair) return null;
    const parsed = parsePair(pair);
    if (!parsed) return null;

    const direction = getTradeDirection(pair, currentCurrency);
    if (direction === null) {
      // Invalid path - currency doesn't match pair
      return null;
    }
    const priceInfo = getPairPrice(pair, marketData, direction);

    // If price is 0 or invalid, try to use lastTradedPrice as fallback
    // (getPairPrice already tries this, but might fail if lastTradedPrice is also 0)
    if (priceInfo.price <= 0) {
      const data = marketData[pair];
      if (!data || data.lastTradedPrice <= 0) {
        // No price data available at all - cannot calculate
        return null;
      }
      // Use lastTradedPrice as fallback (will be marked as estimate)
      // Note: getPairPrice already tries this, but we're adding an extra safety check
      if (direction === 'forward') {
        // Selling base for quote - use lastTradedPrice directly
        priceInfo.price = data.lastTradedPrice;
        priceInfo.isEstimate = true;
      } else {
        // Buying base with quote - need to invert: if lastTradedPrice is LINK/USDT,
        // to buy LINK with USDT we need 1/lastTradedPrice USDT per LINK
        // But getPairPrice already inverts askPrice, so we need to invert lastTradedPrice too
        priceInfo.price = 1 / data.lastTradedPrice;
        priceInfo.isEstimate = true;
      }
    }

    const feeRate = getFeeRate(pair, feeTier, OrderType.TAKER);

    // Calculate trade
    const inputAmount = currentAmount;
    let outputAmount: number;
    let action: string;

    if (direction === 'forward') {
      // Selling base for quote (e.g., selling BTC for USDT)
      outputAmount = inputAmount * priceInfo.price;
      action = `Sell ${formatCurrency(inputAmount, currentCurrency, pair, marketData)} ${currentCurrency} for ${parsed.quote}`;
    } else {
      // Buying base with quote (e.g., buying BTC with USDT)
      outputAmount = inputAmount * priceInfo.price;
      action = `Buy ${parsed.base} with ${formatCurrency(inputAmount, currentCurrency, pair, marketData)} ${currentCurrency}`;
    }

    const feeAmount = outputAmount * feeRate;
    const outputAfterFee = outputAmount - feeAmount;

    steps.push({
      step: i + 1,
      pair,
      action,
      inputAmount,
      inputCurrency: currentCurrency,
      price: priceInfo.price,
      priceIsEstimate: priceInfo.isEstimate,
      feeRate,
      feeAmount,
      outputAmount: outputAfterFee,
      outputCurrency: direction === 'forward' ? parsed.quote : parsed.base,
      maxTradeableAmount: priceInfo.maxTradeableAmount,
      minTradeableAmount: priceInfo.minTradeableAmount,
    });

    // Update for next iteration
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return null;
    currentCurrency = lastStep.outputCurrency;
    currentAmount = outputAfterFee;
  }

  const finalAmount = currentAmount;
  const finalCurrency = currentCurrency;

  // Convert final amount back to starting currency for profit calculation
  // Since we're doing a cycle, the final currency should match the starting currency
  // But if it doesn't (due to path issues), we need to convert it
  let finalAmountInStartingCurrency = finalAmount;

  if (finalCurrency !== firstPair.base) {
    // The path didn't complete a proper cycle - this shouldn't happen but handle it
    // Try to convert final amount to starting currency by working backwards
    let tempAmount = finalAmount;
    let tempCurrency = finalCurrency;

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (!step) break;

      // Reverse the conversion from this step
      if (step.outputCurrency === tempCurrency) {
        // We need to reverse this step's conversion
        if (step.inputCurrency === firstPair.base) {
          // We've reached the starting currency
          // Reverse: if we had outputAmount in outputCurrency, what was inputAmount?
          // For forward: output = input * price, so input = output / price
          // For reverse: output = input * price (already inverted), so input = output / price
          tempAmount = tempAmount / step.price;
          finalAmountInStartingCurrency = tempAmount;
          break;
        } else {
          // Continue backwards
          tempAmount = tempAmount / step.price;
          tempCurrency = step.inputCurrency;
        }
      }
    }
  }

  const profit = finalAmountInStartingCurrency - actualStartingAmount;
  const profitPercentage = (profit / actualStartingAmount) * 100;
  const totalFees = steps.reduce((sum, step) => sum + step.feeAmount, 0);

  // Calculate realistic maximum trade size (if not already using it)
  let maxRealisticTradeSize: number | undefined = undefined;
  let realisticProfit: number | undefined = undefined;

  if (startingAmount === undefined) {
    // We're already using the realistic size
    maxRealisticTradeSize = actualStartingAmount;
    realisticProfit = profit;
  } else {
    // Calculate what the realistic size would be
    const maxRealistic = calculateMaxRealisticTradeSize(path, marketData);
    if (maxRealistic !== null && maxRealistic > 0) {
      maxRealisticTradeSize = maxRealistic;
      realisticProfit = (profit / actualStartingAmount) * maxRealistic;
    }
  }

  return {
    path,
    startingAmount: actualStartingAmount,
    startingCurrency: firstPair.base,
    steps,
    finalAmount,
    profit,
    profitPercentage,
    totalFees,
    maxRealisticTradeSize,
    realisticProfit,
  };
}
