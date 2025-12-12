# VALR Trader Bot

A real-time cryptocurrency arbitrage opportunity detector for the VALR exchange. This bot monitors multiple trading pairs, detects arbitrage cycles, and calculates realistic profit opportunities using bid/ask spreads and trading fees.

## Features

- **Real-time Price Monitoring**: Connects to VALR's WebSocket API to receive live market data
- **Arbitrage Detection**: Finds profitable trading cycles across multiple currency pairs
- **Realistic Profit Calculation**: Uses bid/ask prices and trading fees to calculate actual profit potential
- **Liquidity Analysis**: Considers 24h volume and minimum trade sizes when calculating opportunities
- **Interactive Commands**: Keyboard shortcuts for viewing market summaries, pair configurations, and top opportunities
- **Detailed Breakdowns**: Shows step-by-step trade execution with fees and profit calculations

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd valr-trader-bot
```

2. Install dependencies:

```bash
pnpm install
```

## Usage

Start the bot:

```bash
pnpm start
```

Or with verbose logging:

```bash
pnpm start --verbose
```

### Keyboard Commands

While the bot is running, you can use these keyboard shortcuts:

- `v` - Toggle verbose mode
- `m` - Show market summary
- `p` - Show pair configuration
- `t` - Show top 10 arbitrage opportunities
- `q` - Quit the bot

## Configuration

### Trading Pairs

Edit `src/main.ts` to configure which pairs you want to monitor. The bot will automatically filter out pairs that aren't supported by VALR.

### Arbitrage Settings

Configuration constants are defined in `src/constants.ts`:

- `FEE_TIER`: Fee tier to use for calculations (default: Tier 5)
- `MIN_PROFIT_PERCENTAGE`: Minimum profit percentage to report (default: 0.01%)
- `CHECK_INTERVAL_MS`: How often to check for opportunities (default: 2000ms)
- `LOG_INTERVAL_MS`: How often to log status updates (default: 15000ms)

## How It Works

1. **Price Collection**: The bot subscribes to VALR's WebSocket feed for real-time price updates
2. **Cycle Detection**: Uses graph algorithms to find trading cycles that return to the starting currency
3. **Profit Calculation**: Calculates profit after fees using realistic bid/ask prices
4. **Validation**: Validates opportunities against minimum trade sizes and liquidity constraints
5. **Display**: Shows detailed breakdowns of profitable opportunities

## Project Structure

```
src/
├── arb.ts                 # Main arbitrage engine
├── arbBreakdown.ts        # Detailed trade breakdown calculations
├── arbCycleDetector.ts    # Graph-based cycle detection
├── constants.ts           # Configuration constants
├── config.ts               # Runtime configuration
├── fees.ts                # Fee calculation utilities
├── formatting.ts          # Currency and price formatting
├── keyboardHandler.ts     # Interactive keyboard input
├── logger.ts              # Colored logging utilities
├── main.ts                # Application entry point
├── marketData.ts          # Market data types
├── marketSummary.ts       # Market summary display
├── pairConfig.ts           # Pair configuration display
├── topOpportunities.ts    # Top opportunities display
├── types/                 # Type definitions
│   ├── valrEnums.ts
│   └── valrTypes.ts
├── utils/                 # Shared utilities
│   ├── breakdownDisplay.ts
│   ├── pairParsing.ts
│   └── timestamp.ts
├── valrApi.ts             # VALR REST API client
└── valrStream.ts          # VALR WebSocket client
```

## Development

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Formatting

```bash
pnpm format
pnpm format:check
```

## License

ISC

## Author

Barry Michaely Doyle - [barry@barrymichaeldoyle.com](mailto:barry@barrymichaeldoyle.com)
