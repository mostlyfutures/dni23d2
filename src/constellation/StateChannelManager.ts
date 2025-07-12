import { ethers } from 'ethers';

export interface StateChannel {
  trader: string;
  balance: bigint;
  nonce: number;
  isActive: boolean;
  lastUpdate: number;
  collateral: bigint;
}

export interface ChannelUpdate {
  trader: string;
  newBalance: bigint;
  nonce: number;
  timestamp: number;
  signature: string;
}

export class StateChannelManager {
  private channels: Map<string, StateChannel> = new Map();
  private readonly EMERGENCY_WITHDRAWAL_DELAY = 24 * 60 * 60; // 24 hours
  private readonly MIN_CHANNEL_BALANCE = ethers.parseEther("0.001");
  private readonly MAX_CHANNEL_BALANCE = ethers.parseEther("1000");

  constructor() {
    // Initialize with empty state
    this.channels = new Map();
  }

  /**
   * Open a new state channel for a trader
   */
  async openChannel(
    trader: string, 
    initialBalance: string,
    collateral: string
  ): Promise<StateChannel> {
    if (this.channels.has(trader)) {
      throw new Error('Channel already exists for trader');
    }

    const balance = ethers.parseEther(initialBalance);
    const collateralAmount = ethers.parseEther(collateral);

    if (balance < this.MIN_CHANNEL_BALANCE) {
      throw new Error('Initial balance below minimum');
    }

    if (balance > this.MAX_CHANNEL_BALANCE) {
      throw new Error('Initial balance above maximum');
    }

    const channel: StateChannel = {
      trader,
      balance,
      collateral: collateralAmount,
      nonce: 0,
      isActive: true,
      lastUpdate: Date.now()
    };

    this.channels.set(trader, channel);
    
    // Submit to Constellation DAG
    await this.submitToDAG({
      type: 'CHANNEL_OPEN',
      data: channel,
      timestamp: Date.now()
    });

    console.log(`✅ Channel opened for ${trader} with balance ${ethers.formatEther(balance)} ETH`);
    return channel;
  }

  /**
   * Update channel state with signed update
   */
  async updateChannel(
    trader: string,
    newBalance: string,
    signature: string
  ): Promise<void> {
    const channel = this.channels.get(trader);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (!channel.isActive) {
      throw new Error('Channel is not active');
    }

    const balance = ethers.parseEther(newBalance);
    const nextNonce = channel.nonce + 1;

    // Verify signature
    const isValid = await this.verifyChannelUpdate(
      trader,
      balance,
      nextNonce,
      signature
    );

    if (!isValid) {
      throw new Error('Invalid signature for channel update');
    }

    // Update channel
    channel.balance = balance;
    channel.nonce = nextNonce;
    channel.lastUpdate = Date.now();

    // Submit to Constellation DAG
    await this.submitToDAG({
      type: 'CHANNEL_UPDATE',
      data: {
        trader,
        newBalance: balance,
        nonce: nextNonce,
        timestamp: Date.now(),
        signature
      },
      timestamp: Date.now()
    });

    console.log(`✅ Channel updated for ${trader}: ${ethers.formatEther(balance)} ETH (nonce: ${nextNonce})`);
  }

  /**
   * Close a state channel
   */
  async closeChannel(
    trader: string,
    finalBalance: string,
    signature: string
  ): Promise<void> {
    const channel = this.channels.get(trader);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const balance = ethers.parseEther(finalBalance);
    const nextNonce = channel.nonce + 1;

    // Verify signature
    const isValid = await this.verifyChannelUpdate(
      trader,
      balance,
      nextNonce,
      signature
    );

    if (!isValid) {
      throw new Error('Invalid signature for channel closure');
    }

    // Close channel
    channel.balance = balance;
    channel.nonce = nextNonce;
    channel.isActive = false;
    channel.lastUpdate = Date.now();

    // Submit to Constellation DAG
    await this.submitToDAG({
      type: 'CHANNEL_CLOSE',
      data: {
        trader,
        finalBalance: balance,
        nonce: nextNonce,
        timestamp: Date.now(),
        signature
      },
      timestamp: Date.now()
    });

    console.log(`🔒 Channel closed for ${trader}: ${ethers.formatEther(balance)} ETH`);
  }

  /**
   * Emergency withdrawal (time-locked)
   */
  async emergencyWithdrawal(trader: string): Promise<void> {
    const channel = this.channels.get(trader);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const timeSinceUpdate = Date.now() - channel.lastUpdate;
    if (timeSinceUpdate < this.EMERGENCY_WITHDRAWAL_DELAY * 1000) {
      throw new Error('Emergency withdrawal not yet available');
    }

    // Process emergency withdrawal
    channel.isActive = false;
    channel.lastUpdate = Date.now();

    // Submit to Constellation DAG
    await this.submitToDAG({
      type: 'EMERGENCY_WITHDRAWAL',
      data: {
        trader,
        balance: channel.balance,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });

    console.log(`🚨 Emergency withdrawal processed for ${trader}: ${ethers.formatEther(channel.balance)} ETH`);
  }

  /**
   * Get channel information
   */
  getChannel(trader: string): StateChannel | null {
    return this.channels.get(trader) || null;
  }

  /**
   * Get all active channels
   */
  getActiveChannels(): StateChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.isActive);
  }

  /**
   * Get total locked value
   */
  getTotalLockedValue(): bigint {
    return Array.from(this.channels.values())
      .filter(channel => channel.isActive)
      .reduce((total, channel) => total + channel.balance, ethers.parseEther("0"));
  }

  /**
   * Verify channel update signature
   */
  private async verifyChannelUpdate(
    trader: string,
    newBalance: bigint,
    nonce: number,
    signature: string
  ): Promise<boolean> {
    try {
      const updateHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'uint256', 'uint256'],
          [trader, newBalance, nonce, Math.floor(Date.now() / 1000)]
        )
      );

      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(updateHash), signature);
      return recoveredAddress.toLowerCase() === trader.toLowerCase();
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Submit transaction to Constellation DAG
   * This is a placeholder - replace with actual Constellation SDK integration
   */
  private async submitToDAG(transaction: any): Promise<void> {
    // TODO: Integrate with Constellation SDK
    console.log('📡 Submitting to Constellation DAG:', transaction.type);
    
    // Simulate DAG submission
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, this would be:
    // await constellationClient.submitTransaction(transaction);
  }

  /**
   * Load state from Constellation DAG
   */
  async loadStateFromDAG(): Promise<void> {
    // TODO: Load state from Constellation DAG
    console.log('📥 Loading state from Constellation DAG...');
    
    // In production, this would be:
    // const state = await constellationClient.getState();
    // this.channels = new Map(state.channels);
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): {
    totalChannels: number;
    activeChannels: number;
    totalValue: string;
    averageBalance: string;
  } {
    const channels = Array.from(this.channels.values());
    const activeChannels = channels.filter(c => c.isActive);
    const totalValue = this.getTotalLockedValue();
    const averageBalance = activeChannels.length > 0 
      ? totalValue / BigInt(activeChannels.length) 
      : ethers.parseEther("0");

    return {
      totalChannels: channels.length,
      activeChannels: activeChannels.length,
      totalValue: ethers.formatEther(totalValue),
      averageBalance: ethers.formatEther(averageBalance)
    };
  }
} 