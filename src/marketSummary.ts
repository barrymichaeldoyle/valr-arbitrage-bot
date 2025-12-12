import { formatCurrency, formatPrice } from './formatting';
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
 * Displays a market summary for all subscribed pairs
 */
export function displayMarketSummary(
  marketData: MarketDataMap,
  pairs: Pair[]
): void {
  console.log(
    `\n${logger.timestamp(getTimestamp())} ${logger.header('📊 Market Summary')}\n`
  );

  // Filter pairs to only show those with valid data
  const validPairs = pairs.filter((pair) => {
    const data = marketData[pair];
    return data && data.lastTradedPrice > 0;
  });

  if (validPairs.length === 0) {
    console.log(`   ${logger.warning('No market data available yet...')}\n`);
    return;
  }

  // Display each pair's market data
  validPairs.forEach((pair) => {
    const data = marketData[pair];
    if (!data) return;

    const spread =
      data.askPrice > 0 && data.bidPrice > 0
        ? ((data.askPrice - data.bidPrice) / data.bidPrice) * 100
        : 0;

    console.log(`   ${logger.path(pair)}`);
    console.log(
      `      ${logger.info('Last Price:')} ${logger.price(formatPrice(data.lastTradedPrice, pair, marketData))}`
    );

    if (data.bidPrice > 0 && data.askPrice > 0) {
      console.log(
        `      ${logger.info('Bid:')} ${logger.price(formatPrice(data.bidPrice, pair, marketData))} | ${logger.info('Ask:')} ${logger.price(formatPrice(data.askPrice, pair, marketData))}`
      );
      console.log(
        `      ${logger.info('Spread:')} ${spread >= 0 ? logger.success(`${spread.toFixed(4)}%`) : logger.error(`${spread.toFixed(4)}%`)}`
      );
    } else {
      console.log(
        `      ${logger.warning('Bid/Ask prices not available (using last traded price)')}`
      );
    }

    const parsed = parsePair(pair);
    const baseCurrency = parsed?.base ?? '';
    const quoteCurrency = parsed?.quote ?? '';

    if (data.baseVolume24h > 0 || data.quoteVolume24h > 0) {
      console.log(
        `      ${logger.info('24h Volume:')} ${logger.amount(formatCurrency(data.baseVolume24h, baseCurrency, pair, marketData))} ${logger.currency(baseCurrency)} | ${logger.amount(formatCurrency(data.quoteVolume24h, quoteCurrency, pair, marketData))} ${logger.currency(quoteCurrency)}`
      );
    }

    console.log(
      `      ${logger.info('Min Trade:')} ${logger.amount(formatCurrency(data.minBaseAmount, baseCurrency, pair, marketData))} ${logger.currency(baseCurrency)} | ${logger.amount(formatCurrency(data.minQuoteAmount, quoteCurrency, pair, marketData))} ${logger.currency(quoteCurrency)}`
    );

    console.log(''); // Empty line between pairs
  });
}
