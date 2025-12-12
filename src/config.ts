/**
 * Parses command-line arguments and provides configuration
 */
function parseArgs(): { verbose: boolean } {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  return { verbose };
}

/**
 * Mutable configuration object
 */
export const config = {
  verbose: parseArgs().verbose,
};

/**
 * Toggles verbose mode on/off
 */
export function toggleVerbose(): void {
  config.verbose = !config.verbose;
  console.log(
    `\n${config.verbose ? '✅' : '🔇'} Verbose mode ${config.verbose ? 'enabled' : 'disabled'}\n`
  );
}
