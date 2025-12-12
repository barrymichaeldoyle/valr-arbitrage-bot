// src/valrStream.ts
import WebSocket from 'ws';

import {
  Pair,
  SubscriptionType,
  TradeSubscriptionEvent,
} from './types/valrEnums';
import type { SubscribeMessage, ValrWebSocketMessage } from './types/valrTypes';

export interface Ticker {
  pair: Pair;
  price: number;
}

type PriceMap = Record<Pair, number>;

/**
 * Safely converts WebSocket message data to a string.
 * Handles string, Buffer, ArrayBuffer, and Buffer[] types.
 */
function websocketDataToString(data: WebSocket.Data): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  // Handle ArrayBuffer or Buffer[]
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

export class ValrStream {
  private ws: WebSocket;
  private prices: PriceMap = {
    [Pair.BTCUSDT]: 0,
    [Pair.BTCUSDC]: 0,
    [Pair.USDCUSDT]: 0,
  };

  constructor() {
    this.ws = new WebSocket('wss://api.valr.com/ws/trade'); // confirm exact endpoint
    this.init();
  }

  private init() {
    this.ws.on('open', () => {
      console.log('Connected to VALR');
      const pairs: Pair[] = [Pair.BTCUSDT, Pair.BTCUSDC, Pair.USDCUSDT];
      const message: SubscribeMessage = {
        type: SubscriptionType.SUBSCRIBE,
        subscriptions: [
          {
            event: TradeSubscriptionEvent.MARKET_SUMMARY_UPDATE,
            pairs,
          },
        ],
      };
      console.log('Sending subscription:', JSON.stringify(message, null, 2));
      this.ws.send(JSON.stringify(message));
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('message', (data) => {
      try {
        const dataString = websocketDataToString(data);
        const msg = JSON.parse(dataString) as ValrWebSocketMessage;
        console.log('Received message:', JSON.stringify(msg, null, 2));

        this.handleMessage(msg);
      } catch (err) {
        console.error('Parse error:', err);
      }
    });
  }

  private handleMessage(msg: ValrWebSocketMessage): void {
    if (msg.type === 'ERROR') {
      const errorMsg = msg;
      console.error('VALR WebSocket error:', errorMsg.payload);
      return;
    }

    if (msg.type === TradeSubscriptionEvent.MARKET_SUMMARY_UPDATE) {
      const marketUpdate = msg;
      const pair = marketUpdate.data.currencyPairSymbol;
      const price = parseFloat(marketUpdate.data.lastTradedPrice);

      if (this.isValidPair(pair)) {
        this.prices[pair] = price;
        console.log(`Price update: ${pair} = ${price}`);
      }
      return;
    }
  }

  private isValidPair(pair: string): pair is Pair {
    return Object.values(Pair).includes(pair as Pair);
  }

  getLatestPrices(): PriceMap {
    return { ...this.prices };
  }
}
