import { ethers } from 'ethers';
import DarkPoolDEXABI from '../contracts/DarkPoolDEX.json';

// Add TypeScript interfaces for the contract data structures
interface Order {
  trader: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  isBuy: boolean;
  isRevealed: boolean;
  isExecuted: boolean;
  timestamp: number;
}

interface StateChannel {
  trader: string;
  balance: string;
  isActive: boolean;
  nonce: number;
}

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string | null = null;

  // Contract parameters (should match deployment)
  private readonly MIN_ORDER_SIZE = ethers.parseEther("0.001");
  private readonly MAX_ORDER_SIZE = ethers.parseEther("100");
  private readonly COMMITMENT_WINDOW = 300; // 5 minutes
  private readonly REVEAL_WINDOW = 600; // 10 minutes
  private readonly TRADING_FEE = 50; // 0.5%

  async connect(): Promise<boolean> {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not installed');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Web3:', error);
      return false;
    }
  }

  async connectToContract(contractAddress: string): Promise<boolean> {
    try {
      if (!this.provider || !this.signer) {
        console.error('Provider or signer not available');
        return false;
      }

      console.log('🔗 Connecting to contract at:', contractAddress);
      console.log('📋 Using ABI with', DarkPoolDEXABI.abi.length, 'functions');

      this.contract = new ethers.Contract(
        contractAddress,
        DarkPoolDEXABI.abi,
        this.signer
      );

      this.contractAddress = contractAddress;

      // Test the contract connection by calling a simple view function
      try {
        console.log('🔍 Testing contract connection...');
        console.log('🔍 Contract address:', contractAddress);
        console.log('🔍 Provider:', this.provider);
        console.log('🔍 Signer:', this.signer);
        
              // First, let's check if the contract exists by getting its code
      const code = await this.provider.getCode(contractAddress);
      console.log('🔍 Contract code length:', code.length);
      
      // Check the network we're connected to
      const network = await this.provider.getNetwork();
      console.log('🔍 Connected to network:', {
        chainId: network.chainId.toString(),
        name: network.name,
        fullNetwork: network
      });
      
      // Check if we're on the correct network (localhost should be 31337)
      if (network.chainId.toString() !== '31337') {
        console.error('❌ Wrong network! Expected chainId 31337 (localhost), got:', network.chainId.toString());
        console.error('❌ Please switch MetaMask to localhost network');
        return false;
      }
        
        if (code === '0x') {
          console.error('❌ No contract found at address:', contractAddress);
          return false;
        }
        
        // Try to call the owner function
        const owner = await this.contract.owner();
        console.log('✅ Contract connected successfully, owner:', owner);
        
        // Check if calculateCommitment function exists
        if (typeof this.contract.calculateCommitment === 'function') {
          console.log('✅ calculateCommitment function is available');
        } else {
          console.error('❌ calculateCommitment function not found in contract');
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('❌ Contract connection test failed:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any)?.code,
          data: (error as any)?.data
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to connect to contract:', error);
      return false;
    }
  }

  async getAccount(): Promise<string | null> {
    if (!this.signer) return null;
    return await this.signer.getAddress();
  }

  async getBalance(): Promise<string> {
    if (!this.signer) return '0';
    const address = await this.signer.getAddress();
    const balance = await this.provider!.getBalance(address);
    return ethers.formatEther(balance);
  }

  // Order Management
  async commitOrder(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOut: string,
    isBuy: boolean
  ): Promise<string> {
    if (!this.contract) throw new Error('Contract not connected');

    try {
      console.log('🔍 Committing order with params:', {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy
      });

      const secretNonce = Math.floor(Math.random() * 1000000);
      
      console.log('🧮 Calculating commitment...');
      
      // Use a try-catch specifically for calculateCommitment
      let commitment;
      try {
        commitment = await this.contract.calculateCommitment(
          tokenIn,
          tokenOut,
          ethers.parseEther(amountIn),
          ethers.parseEther(amountOut),
          isBuy,
          secretNonce
        );
        console.log('✅ Commitment calculated:', commitment);
      } catch (calcError) {
        console.error('❌ Failed to calculate commitment:', calcError);
        // Fix: Handle unknown error type properly
        const errorMessage = calcError instanceof Error ? calcError.message : 'Unknown error';
        throw new Error(`Failed to calculate commitment: ${errorMessage}`);
      }

      console.log('📝 Committing order to blockchain...');
      const tx = await this.contract.commitOrder(commitment);
      console.log('⏳ Waiting for transaction confirmation...');
      await tx.wait();

      // Store the secret nonce locally for later revelation
      localStorage.setItem(`nonce_${commitment}`, secretNonce.toString());
      localStorage.setItem(`order_${commitment}`, JSON.stringify({
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy
      }));

      console.log('✅ Order committed successfully:', commitment);
      return commitment;
    } catch (error) {
      console.error('❌ Failed to commit order:', error);
      throw error;
    }
  }

  async revealOrder(commitment: string): Promise<void> {
    if (!this.contract) throw new Error('Contract not connected');

    const secretNonce = localStorage.getItem(`nonce_${commitment}`);
    const orderData = localStorage.getItem(`order_${commitment}`);

    if (!secretNonce || !orderData) {
      throw new Error('Order data not found');
    }

    const order = JSON.parse(orderData);

    const tx = await this.contract.revealOrder(
      commitment,
      order.tokenIn,
      order.tokenOut,
      ethers.parseEther(order.amountIn),
      ethers.parseEther(order.amountOut),
      order.isBuy,
      parseInt(secretNonce)
    );

    await tx.wait();
  }

  async getOrder(commitment: string): Promise<Order | null> {
    if (!this.contract) throw new Error('Contract not connected');

    try {
      const order = await this.contract.getOrder(commitment);
      return {
        trader: order.trader,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: ethers.formatEther(order.amountIn),
        amountOut: ethers.formatEther(order.amountOut),
        isBuy: order.isBuy,
        isRevealed: order.isRevealed,
        isExecuted: order.isExecuted,
        timestamp: order.timestamp.toNumber()
      };
    } catch (error) {
      console.error('Failed to get order:', error);
      return null;
    }
  }

  // State Channel Management
  async openStateChannel(initialBalance: string): Promise<void> {
    if (!this.contract) throw new Error('Contract not connected');

    const tx = await this.contract.openStateChannel(
      await this.signer!.getAddress(),
      ethers.parseEther(initialBalance),
      { value: ethers.parseEther(initialBalance) }
    );

    await tx.wait();
  }

  async getStateChannel(trader: string): Promise<StateChannel | null> {
    if (!this.contract) throw new Error('Contract not connected');

    try {
      const channel = await this.contract.getStateChannel(trader);
      return {
        trader: channel.trader,
        balance: ethers.formatEther(channel.balance),
        isActive: channel.isActive,
        nonce: channel.nonce.toNumber()
      };
    } catch (error) {
      console.error('Failed to get state channel:', error);
      return null;
    }
  }

  // Contract Info
  async getContractInfo() {
    if (!this.contract) throw new Error('Contract not connected');

    return {
      minOrderSize: ethers.formatEther(await this.contract.minOrderSize()),
      maxOrderSize: ethers.formatEther(await this.contract.maxOrderSize()),
      commitmentWindow: (await this.contract.commitmentWindow()).toString(),
      revealWindow: (await this.contract.revealWindow()).toString(),
      tradingFee: (await this.contract.tradingFee()).toString(),
      paused: await this.contract.paused()
    };
  }

  // Check if contract is connected
  isContractConnected(): boolean {
    return this.contract !== null;
  }

  // Event Listeners
  onOrderCommitted(callback: (commitment: string, trader: string, timestamp: number) => void) {
    if (!this.contract) throw new Error('Contract not connected');

    this.contract.on('OrderCommitted', callback);
  }

  onOrderRevealed(callback: (commitment: string, trader: string, tokenIn: string, tokenOut: string, amountIn: string, amountOut: string, isBuy: boolean) => void) {
    if (!this.contract) throw new Error('Contract not connected');

    this.contract.on('OrderRevealed', callback);
  }

  onOrderMatched(callback: (commitment1: string, commitment2: string, trader1: string, trader2: string, amount1: string, amount2: string) => void) {
    if (!this.contract) throw new Error('Contract not connected');

    this.contract.on('OrderMatched', callback);
  }

  // Utility Functions
  async calculateCommitment(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOut: string,
    isBuy: boolean,
    secretNonce: number
  ): Promise<string> {
    if (!this.contract) throw new Error('Contract not connected');

    return await this.contract.calculateCommitment(
      tokenIn,
      tokenOut,
      ethers.parseEther(amountIn),
      ethers.parseEther(amountOut),
      isBuy,
      secretNonce
    );
  }

  disconnect() {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.contractAddress = null;
  }
}

// Global instance
export const web3Service = new Web3Service();