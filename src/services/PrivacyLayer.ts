import { ethers } from 'ethers';

// Types for the privacy layer
export interface EncryptedOrder {
  encryptedData: string;
  commitment: string;
  timestamp: number;
  nonce: number;
}

export interface OrderDetails {
  trader: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  isBuy: boolean;
  secretNonce: number;
}

export interface CommitmentData {
  commitment: string;
  timestamp: number;
  trader: string;
}

export class PrivacyLayer {
  private enginePublicKey: string | null = null;
  private readonly COMMITMENT_WINDOW = 300; // 5 minutes
  private readonly REVEAL_WINDOW = 600; // 10 minutes

  constructor(enginePublicKey?: string) {
    if (enginePublicKey) {
      this.enginePublicKey = enginePublicKey;
    }
  }

  /**
   * Set the matching engine's public key for ECIES encryption
   */
  setEnginePublicKey(publicKey: string): void {
    this.enginePublicKey = publicKey;
  }

  /**
   * Generate a cryptographic commitment for an order
   * This is the first step in the commit-reveal scheme
   */
  async generateCommitment(orderDetails: Omit<OrderDetails, 'secretNonce'>): Promise<{
    commitment: string;
    secretNonce: number;
    commitmentData: CommitmentData;
  }> {
    // Generate a random secret nonce
    const secretNonce = Math.floor(Math.random() * 1000000);
    
    // Create the commitment hash
    const commitmentData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'address', 'uint256', 'uint256', 'bool', 'uint256'],
      [
        orderDetails.trader,
        orderDetails.tokenIn,
        orderDetails.tokenOut,
        ethers.parseEther(orderDetails.amountIn),
        ethers.parseEther(orderDetails.amountOut),
        orderDetails.isBuy,
        secretNonce
      ]
    );

    const commitment = ethers.keccak256(commitmentData);

    return {
      commitment,
      secretNonce,
      commitmentData: {
        commitment,
        timestamp: Math.floor(Date.now() / 1000),
        trader: orderDetails.trader
      }
    };
  }

  /**
   * Verify a commitment matches the revealed order details
   */
  async verifyCommitment(
    commitment: string,
    orderDetails: OrderDetails
  ): Promise<boolean> {
    const expectedCommitment = await this.generateCommitment({
      trader: orderDetails.trader,
      tokenIn: orderDetails.tokenIn,
      tokenOut: orderDetails.tokenOut,
      amountIn: orderDetails.amountIn,
      amountOut: orderDetails.amountOut,
      isBuy: orderDetails.isBuy
    });

    return expectedCommitment.commitment === commitment;
  }

  /**
   * Encrypt order details using ECIES for the reveal phase
   * This ensures only the matching engine can decrypt the order
   */
  async encryptOrderDetails(
    orderDetails: OrderDetails,
    commitment: string
  ): Promise<EncryptedOrder> {
    if (!this.enginePublicKey) {
      throw new Error('Engine public key not set');
    }

    // Create the order payload
    const orderPayload = {
      trader: orderDetails.trader,
      tokenIn: orderDetails.tokenIn,
      tokenOut: orderDetails.tokenOut,
      amountIn: orderDetails.amountIn,
      amountOut: orderDetails.amountOut,
      isBuy: orderDetails.isBuy,
      secretNonce: orderDetails.secretNonce,
      commitment: commitment
    };

    // Convert to JSON and encrypt
    const orderJson = JSON.stringify(orderPayload);
    
    // For now, we'll use a simplified encryption approach
    // In production, you'd use proper ECIES implementation
    const encryptedData = await this.simpleEncrypt(orderJson, this.enginePublicKey);

    return {
      encryptedData,
      commitment,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: orderDetails.secretNonce
    };
  }

  /**
   * Decrypt order details (used by the matching engine)
   */
  async decryptOrderDetails(
    encryptedOrder: EncryptedOrder,
    privateKey: string
  ): Promise<OrderDetails> {
    try {
      const decryptedJson = await this.simpleDecrypt(encryptedOrder.encryptedData, privateKey);
      const orderPayload = JSON.parse(decryptedJson);
      
      // Verify the commitment matches
      const isValid = await this.verifyCommitment(
        encryptedOrder.commitment,
        orderPayload
      );

      if (!isValid) {
        throw new Error('Commitment verification failed');
      }

      return orderPayload;
    } catch (error) {
      throw new Error(`Failed to decrypt order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a commitment is within the valid time window
   */
  isCommitmentValid(commitmentData: CommitmentData): boolean {
    const now = Math.floor(Date.now() / 1000);
    const age = now - commitmentData.timestamp;
    
    return age >= 0 && age <= this.COMMITMENT_WINDOW;
  }

  /**
   * Check if a reveal is within the valid time window
   */
  isRevealValid(encryptedOrder: EncryptedOrder): boolean {
    const now = Math.floor(Date.now() / 1000);
    const age = now - encryptedOrder.timestamp;
    
    return age >= 0 && age <= this.REVEAL_WINDOW;
  }

  /**
   * Simplified encryption for development
   * In production, replace with proper ECIES implementation
   */
  private async simpleEncrypt(data: string, publicKey: string): Promise<string> {
    // This is a placeholder implementation
    // In production, use a proper ECIES library like 'eciesjs'
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    // Simple XOR encryption with public key hash (NOT for production)
    const keyHash = ethers.keccak256(publicKey);
    const keyBytes = ethers.getBytes(keyHash);
    
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return ethers.hexlify(encrypted);
  }

  /**
   * Simplified decryption for development
   * In production, replace with proper ECIES implementation
   */
  private async simpleDecrypt(encryptedData: string, privateKey: string): Promise<string> {
    // This is a placeholder implementation
    // In production, use a proper ECIES library like 'eciesjs'
    const encryptedBytes = ethers.getBytes(encryptedData);
    
    // Simple XOR decryption (NOT for production)
    const keyHash = ethers.keccak256(privateKey);
    const keyBytes = ethers.getBytes(keyHash);
    
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Generate a new key pair for the matching engine
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey
    };
  }

  /**
   * Create a signature for order verification
   */
  async signOrder(orderDetails: OrderDetails, privateKey: string): Promise<string> {
    const orderHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'address', 'uint256', 'uint256', 'bool', 'uint256'],
        [
          orderDetails.trader,
          orderDetails.tokenIn,
          orderDetails.tokenOut,
          ethers.parseEther(orderDetails.amountIn),
          ethers.parseEther(orderDetails.amountOut),
          orderDetails.isBuy,
          orderDetails.secretNonce
        ]
      )
    );

    const wallet = new ethers.Wallet(privateKey);
    return await wallet.signMessage(ethers.getBytes(orderHash));
  }

  /**
   * Verify an order signature
   */
  async verifyOrderSignature(
    orderDetails: OrderDetails,
    signature: string,
    expectedSigner: string
  ): Promise<boolean> {
    try {
      const orderHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'address', 'uint256', 'uint256', 'bool', 'uint256'],
          [
            orderDetails.trader,
            orderDetails.tokenIn,
            orderDetails.tokenOut,
            ethers.parseEther(orderDetails.amountIn),
            ethers.parseEther(orderDetails.amountOut),
            orderDetails.isBuy,
            orderDetails.secretNonce
          ]
        )
      );

      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(orderHash), signature);
      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      return false;
    }
  }
} 