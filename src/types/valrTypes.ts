import type { AccountSubscriptionEvent, Pair, SubscriptionType, TradeSubscriptionEvent } from './valrEnums';

export interface Subscription {
  event: TradeSubscriptionEvent | AccountSubscriptionEvent;
  pairs: Pair[];
}

export interface SubscribeMessage {
  type: SubscriptionType.SUBSCRIBE;
  subscriptions: Subscription[];
}

// WebSocket message types
export interface MarketSummaryUpdate {
  type: TradeSubscriptionEvent.MARKET_SUMMARY_UPDATE;
  data: {
    currencyPairSymbol: Pair;
    askPrice: string;
    bidPrice: string;
    lastTradedPrice: string;
    previousClosePrice: string;
    baseVolume: string;
    quoteVolume: string;
    highPrice: string;
    lowPrice: string;
    created: string;
    changeFromPrevious: string;
    markPrice?: string;
  };
}

export interface ErrorMessage {
  type: 'ERROR';
  payload: string;
}

export type ValrWebSocketMessage = MarketSummaryUpdate | ErrorMessage;

