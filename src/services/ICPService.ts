import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '../declarations/dark_pool_backend.d';

// Types matching the ICP backend
export interface ICPOrder {
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

export interface ICPEncryptedOrder {
  encryptedData: string;
  commitment: string;
  timestamp: number;
  nonce: number;
}

export interface ICPStateChannel {
  id: string;
  participants: string[];
  balance: string;
  nonce: number;
  lastUpdate: number;
  isActive: boolean;
  emergencyWithdrawTime?: number;
}

export interface ICPTradingPair {
  tokenIn: string;
  tokenOut: string;
  minOrderSize: string;
  maxOrderSize: string;
  tradingFee: number;
  isActive: boolean;
}

export interface ICPBalance {
  token: string;
  amount: string;
  lastUpdate: number;
}

export interface ICPMatch {
  id: string;
  buyOrder: string;
  sellOrder: string;
  price: string;
  amount: string;
  timestamp: number;
  executedAt: number;
}

export interface ICPOrderBook {
  buys: ICPOrder[];
  sells: ICPOrder[];
}

export interface ICPNetworkStats {
  totalOrders: number;
  totalMatches: number;
  totalVolume: string;
  activeChannels: number;
  averagePrice: string;
}

export interface ICPHealthStatus {
  status: string;
  timestamp: number;
  epoch: number;
  version: string;
  network: string;
}

export interface ICPSystemStatus {
  isPaused: boolean;
  totalOrders: number;
  activeChannels: number;
}

export interface ICPEpochInfo {
  currentEpoch: number;
  lastProcessed: number;
}

export class ICPService {
  private agent: HttpAgent | null = null;
  private backend: any = null;
  private canisterId: string | null = null;
  private isConnected: boolean = false;

  // Configuration
  private readonly ICP_HOST = 'https://ic0.app';
  private readonly LOCAL_HOST = 'http://127.0.0.1:8000';

  constructor() {
    this.initializeAgent();
  }

  private initializeAgent() {
    try {
      // Initialize the agent
      this.agent = new HttpAgent({ 
        host: this.ICP_HOST
      });

      console.log('✅ ICP Agent initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ICP agent:', error);
    }
  }

  async connect(canisterId?: string): Promise<boolean> {
    try {
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // Use provided canister ID or try to get from environment
      this.canisterId = canisterId || process.env.REACT_APP_ICP_CANISTER_ID || '';

      if (!this.canisterId) {
        console.warn('⚠️ No canister ID provided, will use local development');
        // For local development, we'll use a mock canister ID
        this.canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai'; // Mock ID for local testing
      }

      console.log('🔗 Connecting to ICP canister:', this.canisterId);

      // Create the actor
      this.backend = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: this.canisterId
      });

      // Test the connection
      const health = await this.backend.health();
      console.log('✅ ICP Backend connected successfully:', health);

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to ICP backend:', error);
      this.isConnected = false;
      return false;
    }
  }

  async connectLocal(): Promise<boolean> {
    try {
      // For local development
      this.agent = new HttpAgent({ 
        host: this.LOCAL_HOST
      });

      this.canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai'; // Local canister ID

      this.backend = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: this.canisterId
      });

      const health = await this.backend.health();
      console.log('✅ Local ICP Backend connected:', health);

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to local ICP backend:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Health and Status
  async getHealth(): Promise<ICPHealthStatus> {
    if (!this.backend) throw new Error('Backend not connected');
    return await this.backend.health();
  }

  async getVersion(): Promise<string> {
    if (!this.backend) throw new Error('Backend not connected');
    return await this.backend.getVersion();
  }

  async getSystemStatus(): Promise<ICPSystemStatus> {
    if (!this.backend) throw new Error('Backend not connected');
    return await this.backend.getSystemStatus();
  }

  // Order Management
  async commitOrder(
    commitment: string,
    timestamp: number,
    trader: string
  ): Promise<string> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      console.log('🔍 Committing order to ICP backend:', { commitment, timestamp, trader });
      
      const txId = await this.backend.commitOrder(commitment, BigInt(timestamp), trader);
      console.log('✅ Order committed successfully:', txId);
      
      return txId;
    } catch (error) {
      console.error('❌ Failed to commit order:', error);
      throw error;
    }
  }

  async revealOrder(encryptedOrder: ICPEncryptedOrder): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      console.log('🔍 Revealing order to ICP backend:', encryptedOrder);
      
      const result = await this.backend.revealOrder(encryptedOrder);
      console.log('✅ Order revealed successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to reveal order:', error);
      throw error;
    }
  }

  async getOrderBook(tradingPair: string): Promise<ICPOrderBook> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const orderBook = await this.backend.getOrderBook(tradingPair);
      return orderBook;
    } catch (error) {
      console.error('❌ Failed to get order book:', error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<ICPOrder | null> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const order = await this.backend.getOrder(orderId);
      return order;
    } catch (error) {
      console.error('❌ Failed to get order:', error);
      throw error;
    }
  }

  async cancelOrder(orderId: string, trader: string): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.cancelOrder(orderId, trader);
      return result;
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      throw error;
    }
  }

  // State Channels
  async openStateChannel(
    participant: string,
    initialBalance: string,
    collateral: string
  ): Promise<ICPStateChannel> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const channel = await this.backend.openStateChannel(participant, initialBalance, collateral);
      return channel;
    } catch (error) {
      console.error('❌ Failed to open state channel:', error);
      throw error;
    }
  }

  async updateStateChannel(
    channelId: string,
    newBalance: string,
    signature: string
  ): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.updateStateChannel(channelId, newBalance, signature);
      return result;
    } catch (error) {
      console.error('❌ Failed to update state channel:', error);
      throw error;
    }
  }

  async getStateChannel(channelId: string): Promise<ICPStateChannel | null> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const channel = await this.backend.getStateChannel(channelId);
      return channel;
    } catch (error) {
      console.error('❌ Failed to get state channel:', error);
      throw error;
    }
  }

  async getUserStateChannels(userAddress: string): Promise<ICPStateChannel[]> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const channels = await this.backend.getUserStateChannels(userAddress);
      return channels;
    } catch (error) {
      console.error('❌ Failed to get user state channels:', error);
      throw error;
    }
  }

  async emergencyWithdrawal(channelId: string): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.emergencyWithdrawal(channelId);
      return result;
    } catch (error) {
      console.error('❌ Failed to initiate emergency withdrawal:', error);
      throw error;
    }
  }

  // Trading Pairs and Balances
  async getTradingPairs(): Promise<{ pair: string; config: ICPTradingPair }[]> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const pairs = await this.backend.getTradingPairs();
      return pairs;
    } catch (error) {
      console.error('❌ Failed to get trading pairs:', error);
      throw error;
    }
  }

  async getUserBalances(userAddress: string): Promise<ICPBalance[]> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const balances = await this.backend.getUserBalances(userAddress);
      return balances;
    } catch (error) {
      console.error('❌ Failed to get user balances:', error);
      throw error;
    }
  }

  async updateBalance(
    userAddress: string,
    token: string,
    amount: string
  ): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.updateBalance(userAddress, token, amount);
      return result;
    } catch (error) {
      console.error('❌ Failed to update balance:', error);
      throw error;
    }
  }

  // Statistics and Monitoring
  async getNetworkStats(): Promise<ICPNetworkStats> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const stats = await this.backend.getNetworkStats();
      return stats;
    } catch (error) {
      console.error('❌ Failed to get network stats:', error);
      throw error;
    }
  }

  async getRecentMatches(limit: number): Promise<ICPMatch[]> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const matches = await this.backend.getRecentMatches(BigInt(limit));
      return matches;
    } catch (error) {
      console.error('❌ Failed to get recent matches:', error);
      throw error;
    }
  }

  async getEpochInfo(): Promise<ICPEpochInfo> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const epochInfo = await this.backend.getEpochInfo();
      return epochInfo;
    } catch (error) {
      console.error('❌ Failed to get epoch info:', error);
      throw error;
    }
  }

  // Privacy Layer
  async getEnginePublicKey(): Promise<string> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const publicKey = await this.backend.getEnginePublicKey();
      return publicKey;
    } catch (error) {
      console.error('❌ Failed to get engine public key:', error);
      throw error;
    }
  }

  async verifyCommitment(
    commitment: string,
    encryptedOrder: ICPEncryptedOrder
  ): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.verifyCommitment(commitment, encryptedOrder);
      return result;
    } catch (error) {
      console.error('❌ Failed to verify commitment:', error);
      throw error;
    }
  }

  // Administrative Functions
  async setTradingPair(pair: string, config: ICPTradingPair): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.setTradingPair(pair, config);
      return result;
    } catch (error) {
      console.error('❌ Failed to set trading pair:', error);
      throw error;
    }
  }

  async pauseTrading(): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.pauseTrading();
      return result;
    } catch (error) {
      console.error('❌ Failed to pause trading:', error);
      throw error;
    }
  }

  async resumeTrading(): Promise<boolean> {
    if (!this.backend) throw new Error('Backend not connected');

    try {
      const result = await this.backend.resumeTrading();
      return result;
    } catch (error) {
      console.error('❌ Failed to resume trading:', error);
      throw error;
    }
  }

  // Utility Methods
  isBackendConnected(): boolean {
    return this.isConnected && this.backend !== null;
  }

  getCanisterId(): string | null {
    return this.canisterId;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.backend = null;
    this.agent = null;
    console.log('🔌 Disconnected from ICP backend');
  }

  // Helper method to create encrypted order
  createEncryptedOrder(
    encryptedData: string,
    commitment: string,
    nonce: number
  ): ICPEncryptedOrder {
    return {
      encryptedData,
      commitment,
      timestamp: Date.now(),
      nonce
    };
  }

  // Helper method to calculate commitment hash
  async calculateCommitment(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOut: string,
    isBuy: boolean,
    secretNonce: number
  ): Promise<string> {
    // Simple hash calculation (in production, use proper cryptographic hash)
    const data = `${tokenIn}${tokenOut}${amountIn}${amountOut}${isBuy}${secretNonce}${Date.now()}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const icpService = new ICPService(); 