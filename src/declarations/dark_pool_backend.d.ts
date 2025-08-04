import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface Order {
  'id': string;
  'trader': string;
  'tokenIn': string;
  'tokenOut': string;
  'amountIn': string;
  'amountOut': string;
  'isBuy': boolean;
  'nonce': bigint;
  'timestamp': bigint;
  'commitment': string;
  'isRevealed': boolean;
  'isExecuted': boolean;
  'isCancelled': boolean;
}

export interface EncryptedOrder {
  'encryptedData': string;
  'commitment': string;
  'timestamp': bigint;
  'nonce': bigint;
}

export interface StateChannel {
  'id': string;
  'participants': Array<string>;
  'balance': string;
  'nonce': bigint;
  'lastUpdate': bigint;
  'isActive': boolean;
  'emergencyWithdrawTime'?: bigint;
}

export interface TradingPair {
  'tokenIn': string;
  'tokenOut': string;
  'minOrderSize': string;
  'maxOrderSize': string;
  'tradingFee': number;
  'isActive': boolean;
}

export interface Balance {
  'token': string;
  'amount': string;
  'lastUpdate': bigint;
}

export interface Match {
  'id': string;
  'buyOrder': string;
  'sellOrder': string;
  'price': string;
  'amount': string;
  'timestamp': bigint;
  'executedAt': bigint;
}

export interface OrderBook {
  'buys': Array<Order>;
  'sells': Array<Order>;
}

export interface NetworkStats {
  'totalOrders': bigint;
  'totalMatches': bigint;
  'totalVolume': string;
  'activeChannels': bigint;
  'averagePrice': string;
}

export interface HealthStatus {
  'status': string;
  'timestamp': bigint;
  'epoch': bigint;
  'version': string;
  'network': string;
}

export interface SystemStatus {
  'isPaused': boolean;
  'totalOrders': bigint;
  'activeChannels': bigint;
}

export interface TradingPairRecord {
  'pair': string;
  'config': TradingPair;
}

export interface EpochInfo {
  'currentEpoch': bigint;
  'lastProcessed': bigint;
}

export interface _SERVICE {
  'health': ActorMethod<[], HealthStatus>;
  'getVersion': ActorMethod<[], string>;
  'getSystemStatus': ActorMethod<[], SystemStatus>;
  'commitOrder': ActorMethod<[string, bigint, string], string>;
  'revealOrder': ActorMethod<[EncryptedOrder], boolean>;
  'getOrderBook': ActorMethod<[string], OrderBook>;
  'getOrder': ActorMethod<[string], [] | [Order]>;
  'cancelOrder': ActorMethod<[string, string], boolean>;
  'openStateChannel': ActorMethod<[string, string, string], StateChannel>;
  'updateStateChannel': ActorMethod<[string, string, string], boolean>;
  'getStateChannel': ActorMethod<[string], [] | [StateChannel]>;
  'getUserStateChannels': ActorMethod<[string], Array<StateChannel>>;
  'emergencyWithdrawal': ActorMethod<[string], boolean>;
  'getTradingPairs': ActorMethod<[], Array<TradingPairRecord>>;
  'getUserBalances': ActorMethod<[string], Array<Balance>>;
  'updateBalance': ActorMethod<[string, string, string], boolean>;
  'getNetworkStats': ActorMethod<[], NetworkStats>;
  'getRecentMatches': ActorMethod<[bigint], Array<Match>>;
  'getEpochInfo': ActorMethod<[], EpochInfo>;
  'getEnginePublicKey': ActorMethod<[], string>;
  'verifyCommitment': ActorMethod<[string, EncryptedOrder], boolean>;
  'setTradingPair': ActorMethod<[string, TradingPair], boolean>;
  'pauseTrading': ActorMethod<[], boolean>;
  'resumeTrading': ActorMethod<[], boolean>;
}

export declare const idlFactory: any; 