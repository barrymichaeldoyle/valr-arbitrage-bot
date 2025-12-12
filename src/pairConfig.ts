import { formatCurrency } from './formatting';
import { logger } from './logger';
import type { MarketDataMap } from './marketData';
import { Pair } from './types/valrEnums';

/**
 * Formats a timestamp for logging
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Parses a pair to extract base and quote currencies
 */
function parsePair(pair: Pair): { base: string; quote: string } | null {
  const pairStr = pair.toString();
  const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'ZAR', 'USD', 'EUR'];
  for (const quote of quotes) {
    if (pairStr.endsWith(quote)) {
      const base = pairStr.slice(0, -quote.length);
      return { base, quote };
    }
  }
  return null;
}

/**
 * Displays pair configuration information including decimal places, min/max trade amounts
 */
export function displayPairConfig(
  marketData: MarketDataMap,
  pairs: Pair[]
): void {
  console.log(
    `\n${logger.timestamp(getTimestamp())} ${logger.header('⚙️  Pair Configuration')}\n`
  );

  // Filter pairs to only show those with valid data
  const validPairs = pairs.filter((pair) => {
    const data = marketData[pair];
    return data && data.lastTradedPrice > 0;
  });

  if (validPairs.length === 0) {
    console.log(`   ${logger.warning('No pair data available yet...')}\n`);
    return;
  }

  // Display each pair's configuration
  validPairs.forEach((pair) => {
    const data = marketData[pair];
    if (!data) return;

    const parsed = parsePair(pair);
    const baseCurrency = parsed?.base ?? '';
    const quoteCurrency = parsed?.quote ?? '';

    console.log(`   ${logger.path(pair)}`);
    console.log(
      `      ${logger.info('Base Currency:')} ${logger.currency(baseCurrency)} | ${logger.info('Quote Currency:')} ${logger.currency(quoteCurrency)}`
    );
    console.log(
      `      ${logger.info('Decimal Places:')} Base: ${logger.amount(data.baseDecimalPlaces.toString())} | Quote: ${logger.amount(data.quoteDecimalPlaces.toString())}`
    );
    console.log(
      `      ${logger.info('Min Trade:')} ${logger.amount(formatCurrency(data.minBaseAmount, baseCurrency, pair, marketData))} ${logger.currency(baseCurrency)} | ${logger.amount(formatCurrency(data.minQuoteAmount, quoteCurrency, pair, marketData))} ${logger.currency(quoteCurrency)}`
    );
    if (data.baseVolume24h > 0 || data.quoteVolume24h > 0) {
      console.log(
        `      ${logger.info('24h Volume:')} ${logger.amount(formatCurrency(data.baseVolume24h, baseCurrency, pair, marketData))} ${logger.currency(baseCurrency)} | ${logger.amount(formatCurrency(data.quoteVolume24h, quoteCurrency, pair, marketData))} ${logger.currency(quoteCurrency)}`
      );
    }
    console.log(''); // Empty line between pairs
  });
}
