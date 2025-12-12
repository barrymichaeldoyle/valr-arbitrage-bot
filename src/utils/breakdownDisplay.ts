import type { ArbitrageBreakdown } from '../arbBreakdown';
import { formatCurrency, formatPrice } from '../formatting';
import { logger } from '../logger';
import type { MarketDataMap } from '../marketData';

/**
 * Displays a detailed breakdown of an arbitrage opportunity
 */
export function displayBreakdown(
  breakdown: ArbitrageBreakdown,
  marketData: MarketDataMap,
  showHeader: boolean = true
): void {
  if (showHeader) {
    console.log(
      `\n${logger.header('📊 Detailed Breakdown (Best Opportunity):')}`
    );
  }

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

    if (step.minTradeableAmount !== undefined && step.minTradeableAmount > 0) {
      console.log(
        `      ${logger.info('Min tradeable:')} ${logger.amount(formatCurrency(step.minTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(VALR requirement)')}`
      );
    }

    if (step.maxTradeableAmount !== undefined && step.maxTradeableAmount > 0) {
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
    const profitColor = breakdown.profit >= 0 ? logger.success : logger.error;
    console.log(
      `   ${logger.info('Profit:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)} ${logger.dim(`(${breakdown.profitPercentage.toFixed(4)}%)`)}`
    );
  }

  if (lastStep) {
    console.log(
      `   ${logger.info('Total Fees Paid:')} ${logger.amount(formatCurrency(breakdown.totalFees, lastStep.outputCurrency, lastStep.pair, marketData))}`
    );
  }
}

/**
 * Displays a condensed breakdown for example trades (without full details)
 */
export function displayCondensedBreakdown(
  breakdown: ArbitrageBreakdown,
  marketData: MarketDataMap
): void {
  const firstPair = breakdown.path[0];
  if (firstPair) {
    const exampleTradeLine = `\n   ${logger.info('Example trade')} ${logger.dim('(realistic size:')} ${logger.amount(formatCurrency(breakdown.startingAmount, breakdown.startingCurrency, firstPair, marketData))} ${logger.currency(breakdown.startingCurrency)}${logger.dim('):')}`;
    console.log(exampleTradeLine);
  }

  breakdown.steps.forEach((step) => {
    const priceLabel = step.priceIsEstimate ? '~' : '';
    const stepLine = `   ${logger.step(step.step)}. ${step.action} @ ${priceLabel}${logger.price(formatPrice(step.price, step.pair, marketData))}${step.priceIsEstimate ? logger.warning(' (estimated)') : ''}`;
    console.log(stepLine);

    const feeLine = `      ${logger.info('Fee:')} ${(step.feeRate * 100).toFixed(4)}% → ${logger.amount(formatCurrency(step.outputAmount, step.outputCurrency, step.pair, marketData))} ${logger.currency(step.outputCurrency)}`;
    console.log(feeLine);

    if (step.minTradeableAmount !== undefined && step.minTradeableAmount > 0) {
      const minLine = `      ${logger.info('Min tradeable:')} ${logger.amount(formatCurrency(step.minTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)} ${logger.dim('(VALR requirement)')}`;
      console.log(minLine);
    }

    if (step.maxTradeableAmount !== undefined && step.maxTradeableAmount > 0) {
      const maxLine = `      ${logger.info('Max tradeable at this step:')} ~${logger.amount(formatCurrency(step.maxTradeableAmount, step.inputCurrency, step.pair, marketData))} ${logger.currency(step.inputCurrency)}`;
      console.log(maxLine);
    }
  });

  const lastStep = breakdown.steps[breakdown.steps.length - 1];
  if (lastStep) {
    const finalLine = `   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, lastStep.outputCurrency, lastStep.pair, marketData))} ${logger.currency(lastStep.outputCurrency)}`;
    console.log(finalLine);
  } else if (firstPair) {
    const finalLine = `   ${logger.info('Final:')} ${logger.amount(formatCurrency(breakdown.finalAmount, breakdown.startingCurrency, firstPair, marketData))}`;
    console.log(finalLine);
  }

  if (firstPair) {
    const profitValue = formatCurrency(
      breakdown.profit,
      breakdown.startingCurrency,
      firstPair,
      marketData
    );
    const profitColor = breakdown.profit >= 0 ? logger.success : logger.error;
    const profitLine = `   ${logger.info('Profit:')} ${profitColor(profitValue)} ${logger.currency(breakdown.startingCurrency)} ${logger.dim(`(${breakdown.profitPercentage.toFixed(4)}%)`)}`;
    console.log(profitLine);
  }
}
