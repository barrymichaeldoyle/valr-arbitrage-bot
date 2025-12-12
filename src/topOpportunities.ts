import {
  type ArbitrageBreakdown,
  calculateArbitrageBreakdown,
} from './arbBreakdown';
import {
  type ArbitrageOpportunity,
  findArbitrageOpportunities,
} from './arbCycleDetector';
import { ARBITRAGE_CONFIG } from './constants';
import { formatCurrency } from './formatting';
import { logger } from './logger';
import type { MarketDataMap } from './marketData';
import { Pair } from './types/valrEnums';
import { getTimestamp } from './utils/timestamp';

type PriceMap = Record<Pair, number>;

const MIN_PROFIT_PERCENTAGE = -Infinity; // Show all opportunities, even unprofitable ones

/**
 * Displays the top 10 arbitrage opportunities
 */
export function displayTopOpportunities(
  prices: Partial<Record<Pair, number>>,
  marketData: MarketDataMap
): void {
  console.log(
    `\n${logger.timestamp(getTimestamp())} ${logger.header('🔝 Top 10 Arbitrage Opportunities')}\n`
  );

  // Check if we have valid prices
  const hasValidPrices = Object.values(prices).some(
    (price) => price && price > 0
  );
  if (!hasValidPrices) {
    console.log(`   ${logger.warning('No price data available yet...')}\n`);
    return;
  }

  // Convert partial record to full PriceMap (fill missing pairs with 0)
  const fullPrices: PriceMap = {} as PriceMap;
  for (const pair of Object.values(Pair)) {
    fullPrices[pair] = prices[pair] ?? 0;
  }

  // Find all opportunities (including unprofitable ones for comparison)
  const opportunities = findArbitrageOpportunities(
    fullPrices,
    ARBITRAGE_CONFIG.FEE_TIER,
    MIN_PROFIT_PERCENTAGE
  );

  if (opportunities.length === 0) {
    console.log(`   ${logger.warning('No arbitrage opportunities found.')}\n`);
    return;
  }

  // Calculate breakdowns for all opportunities
  const opportunitiesWithBreakdowns: Array<{
    opportunity: ArbitrageOpportunity;
    breakdown: ArbitrageBreakdown | null;
  }> = [];

  for (const opp of opportunities.slice(0, 20)) {
    // Get top 20 to ensure we have enough after filtering
    const breakdown = calculateArbitrageBreakdown(
      opp.path,
      marketData,
      ARBITRAGE_CONFIG.FEE_TIER
    );
    opportunitiesWithBreakdowns.push({ opportunity: opp, breakdown });
  }

  // Sort by realistic profit percentage if breakdown exists, otherwise theoretical
  opportunitiesWithBreakdowns.sort((a, b) => {
    const aProfit =
      a.breakdown?.profitPercentage ?? a.opportunity.profitPercentage;
    const bProfit =
      b.breakdown?.profitPercentage ?? b.opportunity.profitPercentage;
    return bProfit - aProfit;
  });

  // Take top 10
  const top10 = opportunitiesWithBreakdowns.slice(0, 10);

  if (top10.length === 0) {
    console.log(`   ${logger.warning('No valid opportunities found.')}\n`);
    return;
  }

  // Display each opportunity
  top10.forEach((item, index) => {
    const { opportunity, breakdown } = item;
    const path = opportunity.path.join(' -> ');

    // Use breakdown profit if available, otherwise theoretical
    const profitPercentage =
      breakdown?.profitPercentage ?? opportunity.profitPercentage;

    const profitColor =
      profitPercentage >= 0.01
        ? logger.success
        : profitPercentage >= 0
          ? logger.warning
          : logger.error;

    // Determine starting currency
    let startingCurrency = 'Unknown';
    if (breakdown) {
      startingCurrency = breakdown.startingCurrency;
    } else if (opportunity.path.length > 0) {
      // Parse first pair to get starting currency
      const firstPair = opportunity.path[0];
      if (firstPair) {
        const pairStr = firstPair.toString();
        const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'ZAR', 'USD', 'EUR'];
        for (const quote of quotes) {
          if (pairStr.endsWith(quote)) {
            startingCurrency = pairStr.slice(0, -quote.length);
            break;
          }
        }
      }
    }

    console.log(`   ${logger.step(index + 1)}. ${logger.path(path)}`);
    console.log(
      `      ${logger.info('Starting Currency:')} ${logger.currency(startingCurrency)} ${logger.dim('(required to execute)')}`
    );
    console.log(
      `      ${logger.info('Profit:')} ${profitColor(`${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(4)}%`)}`
    );

    if (breakdown) {
      const firstPair = breakdown.path[0];
      if (firstPair && breakdown.startingCurrency) {
        const profitValue = formatCurrency(
          breakdown.profit,
          breakdown.startingCurrency,
          firstPair,
          marketData
        );
        console.log(
          `      ${logger.info('Profit Amount:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)}`
        );
        console.log(
          `      ${logger.info('Trade Size:')} ${logger.amount(formatCurrency(breakdown.startingAmount, breakdown.startingCurrency, firstPair, marketData))} ${logger.currency(breakdown.startingCurrency)} ${logger.dim('(minimum needed)')}`
        );
      }
      console.log(
        `      ${logger.info('Steps:')} ${logger.amount(breakdown.steps.length.toString())}`
      );
    } else {
      console.log(
        `      ${logger.warning('⚠️  Cannot calculate realistic breakdown (missing market data)')}`
      );
    }

    console.log(''); // Empty line between opportunities
  });
}
