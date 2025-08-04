import { Web3Service } from './Web3Service';
import { icpService, ICPService } from './ICPService';

export type BackendType = 'web3' | 'icp';

export interface BackendConfig {
  type: BackendType;
  contractAddress?: string;
  canisterId?: string;
  useLocal?: boolean;
}

export interface UnifiedOrder {
  id: string;
  trader: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  isBuy: boolean;
  nonce: number;
  timestamp: number;
  commitment: string;
  isRevealed: boolean;
  isExecuted: boolean;
  isCancelled: boolean;
}

export interface UnifiedOrderBook {
  buys: UnifiedOrder[];
  sells: UnifiedOrder[];
}

export interface UnifiedStateChannel {
  id: string;
  participants: string[];
  balance: string;
  nonce: number;
  lastUpdate: number;
  isActive: boolean;
  emergencyWithdrawTime?: number;
}

export interface UnifiedNetworkStats {
  totalOrders: number;
  totalMatches: number;
  totalVolume: string;
  activeChannels: number;
  averagePrice: string;
}

export interface UnifiedHealthStatus {
  status: string;
  timestamp: number;
  epoch: number;
  version: string;
  network: string;
}

export class BackendService {
  private web3Service: Web3Service;
  private icpService: ICPService;
  private currentBackend: BackendType = 'web3';
  private config: BackendConfig;

  constructor(config: BackendConfig) {
    this.config = config;
    this.web3Service = new Web3Service();
    this.icpService = icpService;
    this.currentBackend = config.type;
  }

  // Connection Management
  async connect(): Promise<boolean> {
    try {
      if (this.currentBackend === 'web3') {
        const connected = await this.web3Service.connect();
        if (connected && this.config.contractAddress) {
          return await this.web3Service.connectToContract(this.config.contractAddress);
        }
        return connected;
      } else {
        if (this.config.useLocal) {
          return await this.icpService.connectLocal();
        } else {
          return await this.icpService.connect(this.config.canisterId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to connect to backend:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentBackend === 'web3') {
      this.web3Service.disconnect();
    } else {
      await this.icpService.disconnect();
    }
  }

  isConnected(): boolean {
    if (this.currentBackend === 'web3') {
      return this.web3Service.isContractConnected();
    } else {
      return this.icpService.isBackendConnected();
    }
  }

  // Health and Status
  async getHealth(): Promise<UnifiedHealthStatus> {
    if (this.currentBackend === 'web3') {
      // Web3 doesn't have a health endpoint, so we'll create a mock one
      return {
        status: 'healthy',
        timestamp: Date.now(),
        epoch: 0,
        version: '1.0.0',
        network: 'ethereum'
      };
    } else {
      const health = await this.icpService.getHealth();
      return {
        status: health.status,
        timestamp: Number(health.timestamp),
        epoch: Number(health.epoch),
        version: health.version,
        network: health.network
      };
    }
  }

  async getVersion(): Promise<string> {
    if (this.currentBackend === 'web3') {
      return '1.0.0'; // Web3 version
    } else {
      return await this.icpService.getVersion();
    }
  }

  // Order Management
  async commitOrder(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOut: string,
    isBuy: boolean
  ): Promise<string> {
    if (this.currentBackend === 'web3') {
      return await this.web3Service.commitOrder(tokenIn, tokenOut, amountIn, amountOut, isBuy);
    } else {
      // For ICP, we need to calculate commitment first
      const secretNonce = Math.floor(Math.random() * 1000000);
      const commitment = await this.icpService.calculateCommitment(
        tokenIn, tokenOut, amountIn, amountOut, isBuy, secretNonce
      );
      
      // Store order data locally for later revelation
      localStorage.setItem(`icp_order_${commitment}`, JSON.stringify({
        tokenIn, tokenOut, amountIn, amountOut, isBuy, secretNonce
      }));

      const trader = 'user'; // In production, get from wallet
      const timestamp = Date.now();
      
      return await this.icpService.commitOrder(commitment, timestamp, trader);
    }
  }

  async revealOrder(commitment: string): Promise<void> {
    if (this.currentBackend === 'web3') {
      return await this.web3Service.revealOrder(commitment);
    } else {
      const orderData = localStorage.getItem(`icp_order_${commitment}`);
      if (!orderData) {
        throw new Error('Order data not found');
      }

      const order = JSON.parse(orderData);
      const encryptedOrder = this.icpService.createEncryptedOrder(
        'encrypted_data_placeholder', // In production, encrypt the order data
        commitment,
        order.secretNonce
      );

      await this.icpService.revealOrder(encryptedOrder);
      
      // Clean up local storage
      localStorage.removeItem(`icp_order_${commitment}`);
    }
  }

  async getOrderBook(tradingPair: string): Promise<UnifiedOrderBook> {
    if (this.currentBackend === 'web3') {
      // Web3 doesn't have a direct order book, so we'll return empty
      return { buys: [], sells: [] };
    } else {
      const orderBook = await this.icpService.getOrderBook(tradingPair);
      return {
        buys: orderBook.buys.map(order => ({
          id: order.id,
          trader: order.trader,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          amountOut: order.amountOut,
          isBuy: order.isBuy,
          nonce: Number(order.nonce),
          timestamp: Number(order.timestamp),
          commitment: order.commitment,
          isRevealed: order.isRevealed,
          isExecuted: order.isExecuted,
          isCancelled: order.isCancelled
        })),
        sells: orderBook.sells.map(order => ({
          id: order.id,
          trader: order.trader,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          amountOut: order.amountOut,
          isBuy: order.isBuy,
          nonce: Number(order.nonce),
          timestamp: Number(order.timestamp),
          commitment: order.commitment,
          isRevealed: order.isRevealed,
          isExecuted: order.isExecuted,
          isCancelled: order.isCancelled
        }))
      };
    }
  }

  async getOrder(orderId: string): Promise<UnifiedOrder | null> {
    if (this.currentBackend === 'web3') {
      const order = await this.web3Service.getOrder(orderId);
      if (!order) return null;
      
      return {
        id: orderId,
        trader: order.trader,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        amountOut: order.amountOut,
        isBuy: order.isBuy,
        nonce: 0, // Web3 doesn't expose nonce
        timestamp: order.timestamp,
        commitment: orderId,
        isRevealed: order.isRevealed,
        isExecuted: order.isExecuted,
        isCancelled: false
      };
    } else {
      const order = await this.icpService.getOrder(orderId);
      if (!order) return null;
      
      return {
        id: order.id,
        trader: order.trader,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        amountOut: order.amountOut,
        isBuy: order.isBuy,
        nonce: Number(order.nonce),
        timestamp: Number(order.timestamp),
        commitment: order.commitment,
        isRevealed: order.isRevealed,
        isExecuted: order.isExecuted,
        isCancelled: order.isCancelled
      };
    }
  }

  async cancelOrder(orderId: string, trader: string): Promise<boolean> {
    if (this.currentBackend === 'web3') {
      // Web3 doesn't have cancel order, so we'll return false
      return false;
    } else {
      return await this.icpService.cancelOrder(orderId, trader);
    }
  }

  // State Channels
  async openStateChannel(
    participant: string,
    initialBalance: string,
    collateral: string
  ): Promise<UnifiedStateChannel> {
    if (this.currentBackend === 'web3') {
      await this.web3Service.openStateChannel(initialBalance);
      // Web3 doesn't return channel details, so we'll create a mock
      return {
        id: 'web3-channel',
        participants: [participant],
        balance: initialBalance,
        nonce: 0,
        lastUpdate: Date.now(),
        isActive: true
      };
    } else {
      const channel = await this.icpService.openStateChannel(participant, initialBalance, collateral);
      return {
        id: channel.id,
        participants: channel.participants,
        balance: channel.balance,
        nonce: Number(channel.nonce),
        lastUpdate: Number(channel.lastUpdate),
        isActive: channel.isActive,
        emergencyWithdrawTime: channel.emergencyWithdrawTime ? Number(channel.emergencyWithdrawTime) : undefined
      };
    }
  }

  async getStateChannel(channelId: string): Promise<UnifiedStateChannel | null> {
    if (this.currentBackend === 'web3') {
      const channel = await this.web3Service.getStateChannel('user'); // Web3 uses trader address
      if (!channel) return null;
      
      return {
        id: channelId,
        participants: ['user'],
        balance: channel.balance,
        nonce: channel.nonce,
        lastUpdate: Date.now(),
        isActive: channel.isActive
      };
    } else {
      const channel = await this.icpService.getStateChannel(channelId);
      if (!channel) return null;
      
      return {
        id: channel.id,
        participants: channel.participants,
        balance: channel.balance,
        nonce: Number(channel.nonce),
        lastUpdate: Number(channel.lastUpdate),
        isActive: channel.isActive,
        emergencyWithdrawTime: channel.emergencyWithdrawTime ? Number(channel.emergencyWithdrawTime) : undefined
      };
    }
  }

  // Statistics
  async getNetworkStats(): Promise<UnifiedNetworkStats> {
    if (this.currentBackend === 'web3') {
      // Web3 doesn't have network stats, so we'll return mock data
      return {
        totalOrders: 0,
        totalMatches: 0,
        totalVolume: '0',
        activeChannels: 0,
        averagePrice: '0'
      };
    } else {
      const stats = await this.icpService.getNetworkStats();
      return {
        totalOrders: Number(stats.totalOrders),
        totalMatches: Number(stats.totalMatches),
        totalVolume: stats.totalVolume,
        activeChannels: Number(stats.activeChannels),
        averagePrice: stats.averagePrice
      };
    }
  }

  // Utility Methods
  getBackendType(): BackendType {
    return this.currentBackend;
  }

  getBackendInfo(): string {
    if (this.currentBackend === 'web3') {
      return `Web3 (${this.config.contractAddress || 'No contract'})`;
    } else {
      return `ICP (${this.config.canisterId || 'Local'})`;
    }
  }

  // Switch backend
  async switchBackend(config: BackendConfig): Promise<boolean> {
    await this.disconnect();
    this.config = config;
    this.currentBackend = config.type;
    return await this.connect();
  }
}

// Export singleton instance with default config
export const backendService = new BackendService({
  type: 'web3',
  contractAddress: '',
  useLocal: false
}); 