import { calculateFeeMultiplier } from './fees';
import { Pair } from './types/valrEnums';

type PriceMap = Record<Pair, number>;

export interface ArbitrageOpportunity {
  path: Pair[];
  profit: number;
  profitPercentage: number;
}

/**
 * Represents a trading pair as an edge in a graph
 */
interface TradingPair {
  from: string; // Base currency (e.g., 'BTC')
  to: string; // Quote currency (e.g., 'USDT')
  pair: Pair;
  price: number; // Price of 1 unit of 'from' in terms of 'to'
}

/**
 * Extracts base and quote currencies from a pair string
 * e.g., 'BTCUSDT' -> { base: 'BTC', quote: 'USDT' }
 */
function parsePair(pair: Pair): { base: string; quote: string } | null {
  const pairStr = pair.toString();
  // Common quote currencies
  const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'ZAR'];
  for (const quote of quotes) {
    if (pairStr.endsWith(quote)) {
      const base = pairStr.slice(0, -quote.length);
      return { base, quote };
    }
  }
  return null;
}

/**
 * Builds a graph of trading pairs from available prices
 */
function buildGraph(prices: PriceMap): TradingPair[] {
  const pairs: TradingPair[] = [];
  for (const [pairEnum, price] of Object.entries(prices)) {
    if (price <= 0) continue; // Skip invalid prices

    const parsed = parsePair(pairEnum as Pair);
    if (!parsed) continue;

    pairs.push({
      from: parsed.base,
      to: parsed.quote,
      pair: pairEnum as Pair,
      price,
    });

    // Also add reverse edge (inverse price)
    pairs.push({
      from: parsed.quote,
      to: parsed.base,
      pair: pairEnum as Pair,
      price: 1 / price,
    });
  }
  return pairs;
}

/**
 * Finds all cycles starting from a given currency using DFS
 */
function findCycles(
  graph: TradingPair[],
  startCurrency: string,
  maxDepth: number = 4
): Array<{ path: TradingPair[]; result: number }> {
  const cycles: Array<{ path: TradingPair[]; result: number }> = [];

  function dfs(
    current: string,
    path: TradingPair[],
    visited: Set<string>,
    result: number
  ) {
    // If we've reached max depth, stop
    if (path.length >= maxDepth) return;

    // Find all edges from current currency
    const edges = graph.filter((edge) => edge.from === current);

    for (const edge of edges) {
      const edgeKey = `${edge.from}-${edge.to}`;
      // Don't revisit the same edge
      if (visited.has(edgeKey)) continue;

      const newResult = result * edge.price;
      const newPath = [...path, edge];
      const newVisited = new Set(visited);
      newVisited.add(edgeKey);

      // If we've returned to start, we found a cycle
      if (edge.to === startCurrency && path.length >= 2) {
        cycles.push({ path: newPath, result: newResult });
        continue;
      }

      // Continue DFS
      dfs(edge.to, newPath, newVisited, newResult);
    }
  }

  dfs(startCurrency, [], new Set(), 1);
  return cycles;
}

/**
 * Validates that a cycle path is actually executable
 * Checks that each step's output currency matches the next step's input currency
 * AND that the path can be executed when converted to pair names (simulates breakdown)
 */
function isValidCycle(cycle: { path: TradingPair[] }): boolean {
  if (cycle.path.length === 0) return false;

  // First check: currency flow in the graph
  for (let i = 0; i < cycle.path.length - 1; i++) {
    const currentEdge = cycle.path[i];
    const nextEdge = cycle.path[i + 1];
    if (!currentEdge || !nextEdge) return false;

    if (currentEdge.to !== nextEdge.from) {
      return false;
    }
  }

  // Check that the last edge's 'to' matches the first edge's 'from' (completes the cycle)
  const firstEdge = cycle.path[0];
  const lastEdge = cycle.path[cycle.path.length - 1];
  if (!firstEdge || !lastEdge) return false;

  if (lastEdge.to !== firstEdge.from) {
    return false;
  }

  // Second check: simulate executing the path as the breakdown calculator would
  // Start with the base currency of the first pair
  const firstPairParsed = parsePair(firstEdge.pair);
  if (!firstPairParsed) return false;

  let currentCurrency = firstPairParsed.base;

  for (const edge of cycle.path) {
    const pairParsed = parsePair(edge.pair);
    if (!pairParsed) return false;

    // Check if current currency matches the pair's base or quote
    // If it matches base, we go forward (sell base for quote)
    // If it matches quote, we go reverse (buy base with quote)
    if (currentCurrency === pairParsed.base) {
      // Forward: selling base for quote
      currentCurrency = pairParsed.quote;
    } else if (currentCurrency === pairParsed.quote) {
      // Reverse: buying base with quote
      currentCurrency = pairParsed.base;
    } else {
      // Current currency doesn't match either base or quote - invalid path
      return false;
    }
  }

  // After executing the path, we should be back to the starting currency
  return currentCurrency === firstPairParsed.base;
}

/**
 * Calculates profit after fees for a given cycle
 */
function calculateProfit(
  cycle: { path: TradingPair[]; result: number },
  feeTier: number,
  includeUnprofitable: boolean = false
): ArbitrageOpportunity | null {
  // Validate that the cycle is actually executable
  if (!isValidCycle(cycle)) {
    return null;
  }

  const pairPath = cycle.path.map((edge) => edge.pair);
  const feeMultiplier = calculateFeeMultiplier(pairPath, feeTier);
  const profit = cycle.result * feeMultiplier;
  const profitPercentage = (profit - 1) * 100;

  // Return all opportunities if includeUnprofitable is true, otherwise only profitable ones
  if (!includeUnprofitable && profit <= 1) return null;

  return {
    path: pairPath,
    profit,
    profitPercentage,
  };
}

/**
 * Finds all arbitrage opportunities across all currencies
 */
export function findArbitrageOpportunities(
  prices: PriceMap,
  feeTier: number,
  minProfitPercentage: number = 0.01
): ArbitrageOpportunity[] {
  const graph = buildGraph(prices);

  // Get unique currencies
  const currencies = new Set<string>();
  graph.forEach((edge) => {
    currencies.add(edge.from);
    currencies.add(edge.to);
  });

  const opportunities: ArbitrageOpportunity[] = [];

  // Find cycles starting from each currency
  for (const currency of currencies) {
    const cycles = findCycles(graph, currency);
    for (const cycle of cycles) {
      const opportunity = calculateProfit(cycle, feeTier);
      if (opportunity && opportunity.profitPercentage >= minProfitPercentage) {
        opportunities.push(opportunity);
      }
    }
  }

  // Sort by profit (highest first)
  return opportunities.sort((a, b) => b.profit - a.profit);
}

/**
 * Finds the best arbitrage opportunity (even if unprofitable)
 * Useful for showing how close we are to profitable opportunities
 */
export function findBestOpportunity(
  prices: PriceMap,
  feeTier: number
): ArbitrageOpportunity | null {
  const graph = buildGraph(prices);

  // Get unique currencies
  const currencies = new Set<string>();
  graph.forEach((edge) => {
    currencies.add(edge.from);
    currencies.add(edge.to);
  });

  let bestOpportunity: ArbitrageOpportunity | null = null;
  let bestProfit = -Infinity;

  // Find cycles starting from each currency
  for (const currency of currencies) {
    const cycles = findCycles(graph, currency);
    for (const cycle of cycles) {
      const opportunity = calculateProfit(cycle, feeTier, true);
      if (opportunity && opportunity.profit > bestProfit) {
        bestProfit = opportunity.profit;
        bestOpportunity = opportunity;
      }
    }
  }

  return bestOpportunity;
}
