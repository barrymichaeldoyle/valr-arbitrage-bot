// src/arb.ts
import { Pair } from './types/valrEnums';
import { ValrStream } from './valrStream';

const FEE_RATE = 0.001; // 0.1%, adjust down for Tier 5 if applicable

export class ArbitrageEngine {
  constructor(private stream: ValrStream) {}

  checkCycle() {
    const prices = this.stream.getLatestPrices();

    const btcUsdt = prices[Pair.BTCUSDT];
    const btcUsdc = prices[Pair.BTCUSDC];
    const usdcUsdt = prices[Pair.USDCUSDT];

    if (!btcUsdt || !btcUsdc || !usdcUsdt) return;

    // 1. BTC -> USDT -> USDC -> BTC
    const result1 = (1 / btcUsdt) * usdcUsdt * btcUsdc * (1 - FEE_RATE) ** 3;

    // 2. BTC -> USDC -> USDT -> BTC
    const result2 =
      (1 / btcUsdc) * (1 / usdcUsdt) * btcUsdt * (1 - FEE_RATE) ** 3;

    if (result1 > 1.0001) {
      console.log('Arb opportunity: path1 yields', result1);
    }

    if (result2 > 1.0001) {
      console.log('Arb opportunity: path2 yields', result2);
    }
  }
}
