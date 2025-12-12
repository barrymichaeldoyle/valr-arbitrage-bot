import { ArbitrageEngine } from './arb';
import { ARBITRAGE_CONFIG } from './constants';
import { setupKeyboardHandler } from './keyboardHandler';
import { displayMarketSummary } from './marketSummary';
import { displayPairConfig } from './pairConfig';
import { displayTopOpportunities } from './topOpportunities';
import { Pair } from './types/valrEnums';
import { filterSupportedPairs, getAvailablePairs } from './valrApi';
import { ValrStream } from './valrStream';

// Configure which pairs you want to monitor
// The system will automatically filter out unsupported pairs
const desiredPairs: Pair[] = [
  Pair.BTCUSDT,
  Pair.BTCUSDC,
  Pair.USDTUSDC,
  Pair.ETHUSDT,
  Pair.ETHUSDC,
  Pair.ETHBTC,
  Pair.AVAXUSDT,
  Pair.AVAXUSDC,
  Pair.SOLUSDT,
  Pair.SOLUSDC,
  Pair.XRPUSDT,
  Pair.XRPUSDC,
  Pair.DOGEUSDT,
  Pair.DOGEZAR,
  Pair.BNBUSDT,
  Pair.BNBZAR,
  Pair.LINKUSDT,
  Pair.LINKZAR,
  Pair.LTCUSDT,
  Pair.LTCZAR,
  Pair.PYUSDUSDT,
  Pair.PYUSDZAR,
  Pair.RLUSDUSDT,
  Pair.RLUSDZAR,
  Pair.SHIBUSDT,
  Pair.SHIBZAR,
  Pair.TRXUSDT,
  Pair.TRXZAR,
  Pair.XAUTUSDT,
  Pair.XAUTZAR,
];

async function startBot() {
  console.log('Fetching available pairs from VALR...');
  const allPairs = await getAvailablePairs();
  const supportedPairs = await filterSupportedPairs(desiredPairs);

  if (supportedPairs.length === 0) {
    console.error(
      '❌ None of the requested pairs are supported by VALR. Please check your pair configuration.'
    );
    process.exit(1);
  }

  const unsupportedPairs = desiredPairs.filter(
    (pair) => !supportedPairs.includes(pair)
  );
  if (unsupportedPairs.length > 0) {
    console.warn(
      `⚠️  The following pairs are not supported by VALR: ${unsupportedPairs.join(', ')}`
    );
  }

  // Get pair info for supported pairs only
  const pairInfo = allPairs.filter((pair) =>
    supportedPairs.includes(pair.symbol as Pair)
  );

  console.log(`✅ Monitoring pairs: ${supportedPairs.join(', ')}\n`);

  const stream = new ValrStream(supportedPairs, pairInfo);
  const arbEngine = new ArbitrageEngine(stream);

  // Set up keyboard input handler with callbacks
  setupKeyboardHandler(
    () => {
      displayMarketSummary(stream.getMarketData(), supportedPairs);
    },
    () => {
      displayPairConfig(stream.getMarketData(), supportedPairs);
    },
    () => {
      displayTopOpportunities(arbEngine.getPrices(), arbEngine.getMarketData());
    }
  );

  console.log('Starting arbitrage detection...\n');

  // Poll every 2 seconds to check prices
  setInterval(() => {
    arbEngine.checkCycle();
  }, ARBITRAGE_CONFIG.CHECK_INTERVAL_MS);
}

startBot().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
