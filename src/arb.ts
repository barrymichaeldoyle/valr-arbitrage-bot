import {
  type ArbitrageBreakdown,
  calculateArbitrageBreakdown,
} from './arbBreakdown';
import {
  type ArbitrageOpportunity,
  findArbitrageOpportunities,
  findBestOpportunity,
} from './arbCycleDetector';
import { DEFAULT_FEE_TIER } from './fees';
import { formatCurrency, formatPrice } from './formatting';
import { logger } from './logger';
import type { MarketDataMap } from './marketData';
import { Pair } from './types/valrEnums';
import { ValrStream } from './valrStream';

const FEE_TIER = DEFAULT_FEE_TIER; // Tier 5: Maker 0.04%, Taker 0.06% for crypto pairs
const MIN_PROFIT_PERCENTAGE = 0.01; // Minimum 0.01% profit to report

/**
 * Formats a timestamp for logging
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

export class ArbitrageEngine {
  private lastLoggedPath: string | null = null;
  private lastLoggedProfit: number | null = null;
  private consecutiveNoOpportunities: number = 0;
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL_MS = 15000; // 15 seconds
  private lastLogLineCount: number = 0; // Track how many lines were printed last time

  constructor(private stream: ValrStream) {}

  /**
   * Gets current prices and market data for external use
   */
  getPrices(): Partial<Record<Pair, number>> {
    return this.stream.getLatestPrices();
  }

  getMarketData(): MarketDataMap {
    return this.stream.getMarketData();
  }

  /**
   * Moves cursor up and clears the specified number of lines
   */
  private overwriteLines(lineCount: number): void {
    if (lineCount === 0) return;
    // Move cursor up N lines
    process.stdout.write(`\x1b[${lineCount}A`);
    // Clear from cursor to end of screen
    process.stdout.write('\x1b[J');
  }

  checkCycle() {
    const prices = this.stream.getLatestPrices();
    const marketData = this.stream.getMarketData();

    // Check if we have valid prices
    const hasValidPrices = Object.values(prices).some((price) => price > 0);
    if (!hasValidPrices) {
      console.log(`[${getTimestamp()}] Waiting for price data...`);
      return;
    }

    const opportunities = findArbitrageOpportunities(
      prices,
      FEE_TIER,
      MIN_PROFIT_PERCENTAGE
    );

    // Validate opportunities using realistic bid/ask prices
    const validatedOpportunities: Array<{
      opportunity: ArbitrageOpportunity;
      breakdown: ArbitrageBreakdown;
    }> = [];

    for (const opp of opportunities) {
      const breakdown = calculateArbitrageBreakdown(
        opp.path,
        marketData,
        FEE_TIER
      );

      // Only include opportunities that are actually profitable with bid/ask prices
      if (
        breakdown &&
        breakdown.profit > 0 &&
        breakdown.profitPercentage >= MIN_PROFIT_PERCENTAGE
      ) {
        validatedOpportunities.push({ opportunity: opp, breakdown });
      }
    }

    if (validatedOpportunities.length > 0) {
      // Reset line count when showing profitable opportunity (different message type)
      this.lastLogLineCount = 0;
      console.log(
        `\n${logger.timestamp(getTimestamp())} ${logger.success(`✅ Found ${validatedOpportunities.length} arbitrage ${validatedOpportunities.length === 1 ? 'opportunity' : 'opportunities'}:`)}`
      );

      // Show detailed breakdown for the first (best) opportunity
      const best = validatedOpportunities[0];
      if (!best) return;

      const { breakdown } = best;

      console.log(
        `\n${logger.header('📊 Detailed Breakdown (Best Opportunity):')}`
      );
      console.log(
        `   ${logger.info('Path:')} ${logger.path(breakdown.path.join(' -> '))}`
      );
      console.log(
        `   ${logger.info('Starting Currency:')} ${logger.currency(breakdown.startingCurrency)} ${logger.dim('(required to execute)')}`
      );
      const firstPair = breakdown.path[0];
      if (firstPair) {
        console.log(
          `   ${logger.info('Trade Size:')} ${logger.amount(formatCurrency(breakdown.startingAmount, breakdown.startingCurrency, firstPair, marketData))} ${logger.currency(breakdown.startingCurrency)} ${logger.dim('(minimum needed, based on available liquidity)')}`
        );
      }
      console.log(`\n   ${logger.info('Step-by-step:')}`);
      breakdown.steps.forEach((step) => {
        const priceLabel = step.priceIsEstimate ? '~' : '';
        console.log(`   ${logger.step(step.step)}. ${step.action}`);
        console.log(
          `      ${logger.info('Price:')} ${priceLabel}${logger.price(formatPrice(step.price, step.pair, marketData))}${step.priceIsEstimate ? logger.warning(' (estimated)') : ''} | ${logger.info('Fee:')} ${(step.feeRate * 100).toFixed(4)}% (${logger.amount(formatCurrency(step.feeAmount, step.outputCurrency, step.pair, marketData))})`
        );
        if (
          step.minTradeableAmount !== undefined &&
          step.minTradeableAmount > 0
        ) {
          console.log(
            `      ${logger.info('Min tradeable:')} ${logger.amount(formatCurrency(step.minTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(VALR requirement)')}`
          );
        }
        if (
          step.maxTradeableAmount !== undefined &&
          step.maxTradeableAmount > 0
        ) {
          console.log(
            `      ${logger.info('Max tradeable at this step:')} ~${logger.amount(formatCurrency(step.maxTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(0.1% of 24h volume)')}`
          );
        }
        console.log(
          `      ${logger.info('Result:')} ${logger.amount(formatCurrency(step.outputAmount, step.outputCurrency, step.pair, marketData))} ${logger.currency(step.outputCurrency)}`
        );
      });
      const lastStep = breakdown.steps[breakdown.steps.length - 1];
      if (lastStep) {
        console.log(
          `\n   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, lastStep.outputCurrency, lastStep.pair, marketData))} ${logger.currency(lastStep.outputCurrency)}`
        );
      }
      if (firstPair) {
        const profitValue = formatCurrency(
          breakdown.profit,
          breakdown.startingCurrency,
          firstPair,
          marketData
        );
        const profitColor =
          breakdown.profit >= 0 ? logger.success : logger.error;
        console.log(
          `   ${logger.info('Profit:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)} ${logger.dim(`(${breakdown.profitPercentage.toFixed(4)}%)`)}`
        );
      }
      // Format total fees in the currency of the last step
      if (lastStep) {
        console.log(
          `   ${logger.info('Total Fees Paid:')} ${logger.amount(formatCurrency(breakdown.totalFees, lastStep.outputCurrency, lastStep.pair, marketData))}`
        );
      }

      // Show other opportunities briefly
      if (validatedOpportunities.length > 1) {
        console.log(`\n   ${logger.info('Other opportunities:')}`);
        validatedOpportunities.slice(1).forEach((item, index) => {
          const path = item.breakdown.path.join(' -> ');
          const currency = item.breakdown.startingCurrency;
          console.log(
            `   ${index + 2}. ${logger.path(path)}: ${logger.profit(item.breakdown.profitPercentage, '%')} ${logger.dim(`(${logger.currency(currency)} required)`)}`
          );
        });
      }
      return;
    }

    // No profitable opportunities found - check best opportunity with realistic prices
    const bestOpportunity = findBestOpportunity(prices, FEE_TIER);

    if (!bestOpportunity) {
      console.log(
        `${logger.timestamp(getTimestamp())} ${logger.warning('No arbitrage cycles found (insufficient price data)')}`
      );
      return;
    }

    // Check which pairs have market data
    const missingPairs = bestOpportunity.path.filter(
      (pair) =>
        !marketData[pair] || (marketData[pair]?.lastTradedPrice ?? 0) <= 0
    );

    const breakdown = calculateArbitrageBreakdown(
      bestOpportunity.path,
      marketData,
      FEE_TIER
      // No starting amount - will use realistic max trade size based on liquidity
    );

    // Use breakdown profit if available (realistic with bid/ask), otherwise fallback to theoretical
    const breakdownProfit =
      breakdown?.profitPercentage ?? bestOpportunity.profitPercentage;
    const currentProfit = breakdownProfit;
    const targetProfit = MIN_PROFIT_PERCENTAGE;
    const gap = targetProfit - currentProfit;
    const gapPercentage = (gap / targetProfit) * 100;

    // Check if the best opportunity is actually profitable with realistic prices
    // (It might not have been in the initial filtered list due to mid-price vs bid/ask difference)
    // Check breakdown exists, profit percentage meets threshold (profit can be small but percentage is what matters)
    if (breakdown && breakdown.profitPercentage >= MIN_PROFIT_PERCENTAGE) {
      // Reset line count when showing profitable opportunity (different message type)
      this.lastLogLineCount = 0;
      // This is actually a profitable opportunity! Show it as such
      console.log(
        `\n${logger.timestamp(getTimestamp())} ${logger.success(`✅ Found profitable arbitrage opportunity:`)}`
      );
      console.log(
        `\n${logger.header('📊 Detailed Breakdown (Best Opportunity):')}`
      );
      console.log(
        `   ${logger.info('Path:')} ${logger.path(breakdown.path.join(' -> '))}`
      );
      const firstPair = breakdown.path[0];
      if (firstPair) {
        console.log(
          `   ${logger.info('Trade Size:')} ${logger.amount(formatCurrency(breakdown.startingAmount, breakdown.startingCurrency, firstPair, marketData))} ${logger.currency(breakdown.startingCurrency)} ${logger.dim('(based on available liquidity)')}`
        );
      }
      console.log(`\n   ${logger.info('Step-by-step:')}`);
      breakdown.steps.forEach((step) => {
        const priceLabel = step.priceIsEstimate ? '~' : '';
        console.log(`   ${logger.step(step.step)}. ${step.action}`);
        console.log(
          `      ${logger.info('Price:')} ${priceLabel}${logger.price(formatPrice(step.price, step.pair, marketData))}${step.priceIsEstimate ? logger.warning(' (estimated)') : ''} | ${logger.info('Fee:')} ${(step.feeRate * 100).toFixed(4)}% (${logger.amount(formatCurrency(step.feeAmount, step.outputCurrency, step.pair, marketData))})`
        );
        if (
          step.minTradeableAmount !== undefined &&
          step.minTradeableAmount > 0
        ) {
          console.log(
            `      ${logger.info('Min tradeable:')} ${logger.amount(formatCurrency(step.minTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(VALR requirement)')}`
          );
        }
        if (
          step.maxTradeableAmount !== undefined &&
          step.maxTradeableAmount > 0
        ) {
          console.log(
            `      ${logger.info('Max tradeable at this step:')} ~${logger.amount(formatCurrency(step.maxTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(0.1% of 24h volume)')}`
          );
        }
        console.log(
          `      ${logger.info('Result:')} ${logger.amount(formatCurrency(step.outputAmount, step.outputCurrency, step.pair, marketData))} ${logger.currency(step.outputCurrency)}`
        );
      });
      const lastStep = breakdown.steps[breakdown.steps.length - 1];
      if (lastStep) {
        console.log(
          `\n   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, lastStep.outputCurrency, lastStep.pair, marketData))} ${logger.currency(lastStep.outputCurrency)}`
        );
      }
      if (firstPair) {
        const profitValue = formatCurrency(
          breakdown.profit,
          breakdown.startingCurrency,
          firstPair,
          marketData
        );
        const profitColor =
          breakdown.profit >= 0 ? logger.success : logger.error;
        console.log(
          `   ${logger.info('Profit:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)} ${logger.dim(`(${breakdown.profitPercentage.toFixed(4)}%)`)}`
        );
      }
      if (lastStep) {
        console.log(
          `   ${logger.info('Total Fees Paid:')} ${logger.amount(formatCurrency(breakdown.totalFees, lastStep.outputCurrency, lastStep.pair, marketData))}`
        );
      }
      return;
    }

    // If breakdown is null but theoretical profit is above threshold, log a warning
    if (!breakdown && currentProfit >= MIN_PROFIT_PERCENTAGE) {
      // Reset line count when showing warning (different message type)
      this.lastLogLineCount = 0;
      console.log(
        `\n${logger.timestamp(getTimestamp())} ${logger.warning('⚠️  Theoretical opportunity found but cannot validate with realistic prices:')}`
      );
      console.log(
        `   ${logger.info('Path:')} ${logger.path(bestOpportunity.path.join(' -> '))}`
      );
      console.log(
        `   ${logger.info('Theoretical profit:')} ${logger.success(`${currentProfit.toFixed(4)}%`)} ${logger.dim('(using mid-prices, may differ from realistic bid/ask)')}`
      );
      if (missingPairs.length > 0) {
        console.log(
          `   ${logger.warning('⚠️  Missing market data for:')} ${logger.error(missingPairs.join(', '))}`
        );
        console.log(
          `   ${logger.dim('These pairs may not be subscribed or have not received price updates yet.')}`
        );
      } else {
        console.log(
          `   ${logger.warning('⚠️  Invalid arbitrage path - currency flow does not match pair sequence')}`
        );
        console.log(
          `   ${logger.dim('The cycle detector found this using theoretical prices, but the path is not executable.')}`
        );
        console.log(
          `   ${logger.dim('This may indicate an issue with the cycle detection algorithm.')}`
        );
      }
      console.log('');
      return;
    }

    const currentPath = bestOpportunity.path.join(' -> ');
    const pathChanged = currentPath !== this.lastLoggedPath;
    const profitChanged =
      this.lastLoggedProfit === null ||
      Math.abs(currentProfit - this.lastLoggedProfit) > 0.01; // 0.01% threshold

    const now = Date.now();
    const timeSinceLastLog = now - this.lastLogTime;
    const shouldLogByTime = timeSinceLastLog >= this.LOG_INTERVAL_MS;

    // Only log if:
    // 1. Path or profit changed significantly (immediate log)
    // 2. It's been at least 15 seconds since last log (for same opportunity)
    const shouldLog = pathChanged || profitChanged || shouldLogByTime;

    if (!shouldLog) {
      // Skip logging this check - don't update tracking variables
      return;
    }

    // If path and profit haven't changed significantly, increment counter
    if (!pathChanged && !profitChanged) {
      this.consecutiveNoOpportunities++;
    } else {
      this.consecutiveNoOpportunities = 0;
    }

    // Show full details (including example trade) only if path changed
    const showFullDetails = pathChanged;

    // If path hasn't changed, overwrite previous condensed log (but not the initial full log)
    // Only overwrite if we're showing condensed version (not full details)
    if (!showFullDetails && this.lastLogLineCount > 0) {
      this.overwriteLines(this.lastLogLineCount);
    }

    // Update tracking variables only when we actually log
    this.lastLoggedPath = currentPath;
    this.lastLoggedProfit = currentProfit;
    this.lastLogTime = now;

    // Track lines printed for this log
    let linesPrinted = 0;

    const timestampLine = `${logger.timestamp(getTimestamp())} ${logger.warning('📊 No profitable arbitrage opportunities found')}`;
    console.log(timestampLine);
    linesPrinted += timestampLine.split('\n').length;

    const pathLine = `   ${logger.info('Best opportunity:')} ${logger.path(currentPath)}`;
    console.log(pathLine);
    linesPrinted += pathLine.split('\n').length;

    // If path hasn't changed, show condensed version without example trade
    if (!showFullDetails) {
      const secondsAgo = Math.floor(timeSinceLastLog / 1000);
      const sameOppLine = `   ${logger.dim(`(Same opportunity, ${this.consecutiveNoOpportunities} check${this.consecutiveNoOpportunities > 1 ? 's' : ''} ago, ${secondsAgo}s since last log)`)}`;
      console.log(sameOppLine);
      linesPrinted += sameOppLine.split('\n').length;

      const spreadLine = `   ${logger.info('Current spread:')} ${currentProfit >= 0 ? logger.success(`${currentProfit.toFixed(4)}%`) : logger.error(`${currentProfit.toFixed(4)}%`)} | ${logger.info('Target:')} ${logger.amount(targetProfit.toFixed(4))}% | ${logger.info('Gap:')} ${logger.warning(`${gap.toFixed(4)}%`)}`;
      console.log(spreadLine);
      linesPrinted += spreadLine.split('\n').length;

      // Use breakdown profit multiplier if available, otherwise theoretical
      const profitMultiplier = breakdown
        ? breakdown.finalAmount / breakdown.startingAmount
        : bestOpportunity.profit;
      const profitLine = `   ${logger.info('Profit after fees:')} ${logger.amount(profitMultiplier.toFixed(6))}x`;
      console.log(profitLine);
      linesPrinted += profitLine.split('\n').length;

      // Store line count for next overwrite
      this.lastLogLineCount = linesPrinted;
      return;
    }

    // Show example trade breakdown only when path changes
    if (breakdown) {
      const firstPair = breakdown.path[0];
      const exampleTradeLine = `\n   ${logger.info('Example trade')} ${logger.dim('(realistic size:')} ${firstPair ? logger.amount(formatCurrency(breakdown.startingAmount, breakdown.startingCurrency, firstPair, marketData)) : breakdown.startingAmount.toString()} ${logger.currency(breakdown.startingCurrency)}${logger.dim('):')}`;
      console.log(exampleTradeLine);
      linesPrinted += exampleTradeLine.split('\n').length;

      breakdown.steps.forEach((step) => {
        const priceLabel = step.priceIsEstimate ? '~' : '';
        const stepLine = `   ${logger.step(step.step)}. ${step.action} @ ${priceLabel}${logger.price(formatPrice(step.price, step.pair, marketData))}${step.priceIsEstimate ? logger.warning(' (estimated)') : ''}`;
        console.log(stepLine);
        linesPrinted += stepLine.split('\n').length;

        const feeLine = `      ${logger.info('Fee:')} ${(step.feeRate * 100).toFixed(4)}% → ${logger.amount(formatCurrency(step.outputAmount, step.outputCurrency, step.pair, marketData))} ${logger.currency(step.outputCurrency)}`;
        console.log(feeLine);
        linesPrinted += feeLine.split('\n').length;

        if (
          step.minTradeableAmount !== undefined &&
          step.minTradeableAmount > 0
        ) {
          const minLine = `      ${logger.info('Min tradeable:')} ${logger.amount(formatCurrency(step.minTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(VALR requirement)')}`;
          console.log(minLine);
          linesPrinted += minLine.split('\n').length;
        }
        if (
          step.maxTradeableAmount !== undefined &&
          step.maxTradeableAmount > 0
        ) {
          const maxLine = `      ${logger.info('Max tradeable at this step:')} ~${logger.amount(formatCurrency(step.maxTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)}`;
          console.log(maxLine);
          linesPrinted += maxLine.split('\n').length;
        }
      });
      const lastStep = breakdown.steps[breakdown.steps.length - 1];
      if (lastStep) {
        const finalLine = `   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, lastStep.outputCurrency, lastStep.pair, marketData))} ${logger.currency(lastStep.outputCurrency)}`;
        console.log(finalLine);
        linesPrinted += finalLine.split('\n').length;
      } else if (firstPair) {
        const finalLine = `   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, breakdown.startingCurrency, firstPair, marketData))}`;
        console.log(finalLine);
        linesPrinted += finalLine.split('\n').length;
      }
      if (firstPair) {
        const profitValue = formatCurrency(
          breakdown.profit,
          breakdown.startingCurrency,
          firstPair,
          marketData
        );
        const profitColor =
          breakdown.profit >= 0 ? logger.success : logger.error;
        const profitLine = `   ${logger.info('Profit:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)} ${logger.dim(`(${breakdown.profitPercentage.toFixed(4)}%)`)}`;
        console.log(profitLine);
        linesPrinted += profitLine.split('\n').length;
      }
    }

    const spreadColor = currentProfit >= 0 ? logger.success : logger.error;
    const spreadLine = `\n   ${logger.info('Current spread:')} ${spreadColor(`${currentProfit >= 0 ? '+' : ''}${currentProfit.toFixed(4)}%`)}`;
    console.log(spreadLine);
    linesPrinted += spreadLine.split('\n').length;

    const targetLine = `   ${logger.info('Target spread:')} ${logger.amount(targetProfit.toFixed(4))}%`;
    console.log(targetLine);
    linesPrinted += targetLine.split('\n').length;

    // gap > 0 means we're below target (need more profit)
    // gap < 0 means we're above target (profitable enough)
    // currentProfit < 0 means we're losing money (below break-even)
    let gapLine = '';
    if (currentProfit < 0) {
      // Losing money - below break-even
      gapLine = `   ${logger.warning('⚠️  Negative spread:')} ${logger.error(`${Math.abs(currentProfit).toFixed(4)}%`)} ${logger.dim('below break-even')}`;
    } else if (gap > 0) {
      // Profitable but below target threshold
      gapLine = `   ${logger.info('Gap:')} ${logger.warning(`${gap.toFixed(4)}%`)} ${logger.dim(`(${gapPercentage.toFixed(2)}% away from target)`)}`;
    } else {
      // Above target threshold - profitable enough!
      const aboveTarget = Math.abs(gap);
      gapLine = `   ${logger.success('✅ Above target:')} ${logger.success(`${aboveTarget.toFixed(4)}%`)} ${logger.dim('above minimum threshold')}`;
    }
    console.log(gapLine);
    linesPrinted += gapLine.split('\n').length;

    // Use breakdown profit multiplier if available, otherwise theoretical
    const profitMultiplier = breakdown
      ? breakdown.finalAmount / breakdown.startingAmount
      : bestOpportunity.profit;
    const profitLine = `   ${logger.info('Profit after fees:')} ${logger.amount(profitMultiplier.toFixed(6))}x`;
    console.log(profitLine);
    linesPrinted += profitLine.split('\n').length;

    // Don't store line count for full details - we want to keep them visible
    // Only store for condensed logs (handled in the early return above)
    // Reset line count so next condensed log doesn't try to overwrite full details
    this.lastLogLineCount = 0;
  }
}
