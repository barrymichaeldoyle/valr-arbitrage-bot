// src/valrStream.ts
import WebSocket from 'ws';

import { config } from './config';
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

import type { MarketDataMap } from './marketData';
import type { ValrPairInfo } from './valrApi';

/**
 * Calculates the number of decimal places from a string representation of a number
 * e.g., "0.00000800" -> 8, "0.01" -> 2, "92358" -> 0
 */
function getDecimalPlaces(value: string): number {
  if (!value.includes('.')) {
    return 0;
  }
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[1]) {
    return 0;
  }
  // Remove trailing zeros to get actual precision
  return parts[1].replace(/0+$/, '').length;
}

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
  private prices: PriceMap = {} as PriceMap;
  private marketData: MarketDataMap = {} as MarketDataMap;
  private subscribedPairs: Pair[];
  private pairInfoMap: Map<Pair, ValrPairInfo>;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(pairs: Pair[], pairInfo: ValrPairInfo[]) {
    this.subscribedPairs = pairs;
    // Create a map of pair info for quick lookup
    this.pairInfoMap = new Map(
      pairInfo.map((info) => [info.symbol as Pair, info])
    );

    // Initialize prices map with zeros for all subscribed pairs
    pairs.forEach((pair) => {
      this.prices[pair] = 0;
      const info = this.pairInfoMap.get(pair);

      // Calculate decimal places from min amounts
      const baseDecimalPlaces = info ? getDecimalPlaces(info.minBaseAmount) : 8;
      const quoteDecimalPlaces = info
        ? getDecimalPlaces(info.minQuoteAmount)
        : 8;

      this.marketData[pair] = {
        pair,
        bidPrice: 0,
        askPrice: 0,
        lastTradedPrice: 0,
        baseVolume24h: 0,
        quoteVolume24h: 0,
        minBaseAmount: info ? parseFloat(info.minBaseAmount) : 0,
        minQuoteAmount: info ? parseFloat(info.minQuoteAmount) : 0,
        baseDecimalPlaces,
        quoteDecimalPlaces,
      };
    });
    this.ws = new WebSocket('wss://api.valr.com/ws/trade');
    this.init();
  }

  private init() {
    this.ws.on('open', () => {
      console.log('Connected to VALR');
      const message: SubscribeMessage = {
        type: SubscriptionType.SUBSCRIBE,
        subscriptions: [
          {
            event: TradeSubscriptionEvent.MARKET_SUMMARY_UPDATE,
            pairs: this.subscribedPairs,
          },
        ],
      };
      if (config.verbose) {
        console.log('Sending subscription:', JSON.stringify(message, null, 2));
      }
      this.ws.send(JSON.stringify(message));

      // Set up ping/pong keepalive (ping every 30 seconds)
      // The ws library handles pong responses automatically
      this.pingInterval = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
          if (config.verbose) {
            console.log('Sent ping to keep connection alive');
          }
        } else {
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
        }
      }, 30000); // 30 seconds
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.warn('WebSocket connection closed');
      // Clear ping interval if it exists
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });

    this.ws.on('pong', () => {
      if (config.verbose) {
        console.log('Received pong from server');
      }
    });

    this.ws.on('message', (data) => {
      try {
        const dataString = websocketDataToString(data);
        const msg = JSON.parse(dataString) as ValrWebSocketMessage;

        this.handleMessage(msg);
      } catch (err) {
        console.error('Parse error:', err);
      }
    });
  }

  private handleMessage(msg: ValrWebSocketMessage): void {
    if (msg.type === 'ERROR') {
      const errorMsg = msg;
      const errorMessage =
        errorMsg.message || errorMsg.payload || 'Unknown error';
      console.error('VALR WebSocket error:', errorMessage);

      // If it's an invalid pair error, log which pair is invalid
      if (errorMessage.includes('pair') && errorMessage.includes('invalid')) {
        console.warn(
          '⚠️  One or more pairs are not supported by VALR. Check your pair configuration.'
        );
      }
      return;
    }

    if (msg.type === TradeSubscriptionEvent.MARKET_SUMMARY_UPDATE) {
      const marketUpdate = msg;
      const pair = marketUpdate.data.currencyPairSymbol;

      if (this.isValidPair(pair)) {
        const price = parseFloat(marketUpdate.data.lastTradedPrice);
        const bidPrice = parseFloat(marketUpdate.data.bidPrice);
        const askPrice = parseFloat(marketUpdate.data.askPrice);
        const baseVolume24h = parseFloat(marketUpdate.data.baseVolume);
        const quoteVolume24h = parseFloat(marketUpdate.data.quoteVolume);

        const info = this.pairInfoMap.get(pair);
        this.prices[pair] = price;

        // Preserve decimal places from initialization
        const existingData = this.marketData[pair];
        this.marketData[pair] = {
          pair,
          bidPrice,
          askPrice,
          lastTradedPrice: price,
          baseVolume24h,
          quoteVolume24h,
          minBaseAmount: info ? parseFloat(info.minBaseAmount) : 0,
          minQuoteAmount: info ? parseFloat(info.minQuoteAmount) : 0,
          baseDecimalPlaces: existingData?.baseDecimalPlaces ?? 8,
          quoteDecimalPlaces: existingData?.quoteDecimalPlaces ?? 8,
        };

        if (config.verbose) {
          console.log(
            `Price update: ${pair} = ${price} (bid: ${bidPrice}, ask: ${askPrice})`
          );
        }
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

  getMarketData(): MarketDataMap {
    return { ...this.marketData };
  }
}
