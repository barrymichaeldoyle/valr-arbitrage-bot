import { toggleVerbose } from './config';

type MarketSummaryCallback = () => void;
type PairConfigCallback = () => void;
type TopOpportunitiesCallback = () => void;

/**
 * Sets up keyboard input handling for interactive commands
 */
export function setupKeyboardHandler(
  showMarketSummary?: MarketSummaryCallback,
  showPairConfig?: PairConfigCallback,
  showTopOpportunities?: TopOpportunitiesCallback
): void {
  // Check if stdin is a TTY (terminal)
  if (!process.stdin.isTTY) {
    return; // Don't set up keyboard handler if not in a terminal
  }

  // Set stdin to raw mode to capture individual key presses
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Build instructions dynamically
  const instructions: string[] = ['💡 Press'];
  const shortcuts: string[] = [];

  shortcuts.push('"v" to toggle verbose');
  if (showMarketSummary) shortcuts.push('"m" for market summary');
  if (showPairConfig) shortcuts.push('"p" for pair config');
  if (showTopOpportunities) shortcuts.push('"t" for top opportunities');
  shortcuts.push('"q" to quit');

  instructions.push(shortcuts.join(', '));
  console.log(`${instructions.join(' ')}\n`);

  process.stdin.on('data', (key: string) => {
    // Handle Ctrl+C
    if (key === '\u0003') {
      console.log('\n\n👋 Shutting down...');
      process.exit(0);
    }

    // Handle 'q' to quit
    if (key === 'q' || key === 'Q') {
      console.log('\n\n👋 Shutting down...');
      process.exit(0);
    }

    // Handle 'v' to toggle verbose
    if (key === 'v' || key === 'V') {
      toggleVerbose();
    }

    // Handle 'm' to show market summary
    if ((key === 'm' || key === 'M') && showMarketSummary) {
      showMarketSummary();
    }

    // Handle 'p' to show pair config
    if ((key === 'p' || key === 'P') && showPairConfig) {
      showPairConfig();
    }

    // Handle 't' to show top opportunities
    if ((key === 't' || key === 'T') && showTopOpportunities) {
      showTopOpportunities();
    }
  });
}
