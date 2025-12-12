import chalk from 'chalk';

/**
 * Logger utility with colors for better readability
 */
export const logger = {
  /**
   * Formats a timestamp with dim color
   */
  timestamp: (ts: string): string => {
    return chalk.dim(`[${ts}]`);
  },

  /**
   * Success messages (green)
   */
  success: (message: string): string => {
    return chalk.green(message);
  },

  /**
   * Warning messages (yellow)
   */
  warning: (message: string): string => {
    return chalk.yellow(message);
  },

  /**
   * Error messages (red)
   */
  error: (message: string): string => {
    return chalk.red(message);
  },

  /**
   * Info/header messages (cyan)
   */
  info: (message: string): string => {
    return chalk.cyan(message);
  },

  /**
   * Section headers (bold cyan)
   */
  header: (message: string): string => {
    return chalk.bold.cyan(message);
  },

  /**
   * Important values like profit (bold green for positive, bold red for negative)
   */
  profit: (value: number, currency: string = ''): string => {
    const formatted =
      value >= 0 ? chalk.bold.green(`+${value}`) : chalk.bold.red(`${value}`);
    return currency ? `${formatted} ${chalk.dim(currency)}` : formatted;
  },

  /**
   * Price values (bright cyan)
   */
  price: (value: string | number): string => {
    return chalk.cyanBright(value.toString());
  },

  /**
   * Amount values (white/bright)
   */
  amount: (value: string | number): string => {
    return chalk.whiteBright(value.toString());
  },

  /**
   * Currency labels (dim)
   */
  currency: (value: string): string => {
    return chalk.dim(value);
  },

  /**
   * Path/route information (magenta)
   */
  path: (value: string): string => {
    return chalk.magenta(value);
  },

  /**
   * Step numbers (yellow)
   */
  step: (value: number): string => {
    return chalk.yellow(value.toString());
  },

  /**
   * Dim text for secondary information
   */
  dim: (value: string): string => {
    return chalk.dim(value);
  },
};
