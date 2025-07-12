const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { ethers } = require('ethers');
// Import PrivacyLayer - we'll need to compile TypeScript or use a different approach
// For now, let's create a simplified version inline

class PrivacyLayer {
  constructor(enginePublicKey) {
    this.enginePublicKey = enginePublicKey;
  }

  static generateKeyPair() {
    const wallet = ethers.Wallet.createRandom();
    return {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey
    };
  }

  setEnginePublicKey(publicKey) {
    this.enginePublicKey = publicKey;
  }

  async decryptOrderDetails(encryptedOrder, privateKey) {
    // Simplified decryption for now
    try {
      const decryptedData = await this.simpleDecrypt(encryptedOrder.encryptedData, privateKey);
      return JSON.parse(decryptedData);
    } catch (error) {
      throw new Error(`Failed to decrypt order: ${error.message}`);
    }
  }

  async simpleDecrypt(encryptedData, privateKey) {
    // Simplified XOR decryption (NOT for production)
    const encryptedBytes = ethers.getBytes(encryptedData);
    const keyHash = ethers.keccak256(privateKey);
    const keyBytes = ethers.getBytes(keyHash);
    
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  isCommitmentValid(commitmentData) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - commitmentData.timestamp;
    return age >= 0 && age <= 300; // 5 minutes
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Order book data structures
class OrderBook {
  constructor() {
    this.buyOrders = new Map(); // commitment -> order
    this.sellOrders = new Map(); // commitment -> order
    this.commitments = new Map(); // commitment -> commitmentData
    this.encryptedOrders = new Map(); // commitment -> encryptedOrder
  }

  addCommitment(commitment, commitmentData) {
    this.commitments.set(commitment, commitmentData);
  }

  addEncryptedOrder(commitment, encryptedOrder) {
    this.encryptedOrders.set(commitment, encryptedOrder);
  }

  addOrder(commitment, order) {
    if (order.isBuy) {
      this.buyOrders.set(commitment, order);
    } else {
      this.sellOrders.set(commitment, order);
    }
  }

  removeOrder(commitment) {
    this.buyOrders.delete(commitment);
    this.sellOrders.delete(commitment);
    this.commitments.delete(commitment);
    this.encryptedOrders.delete(commitment);
  }

  getMatchingOrders(order) {
    const oppositeOrders = order.isBuy ? this.sellOrders : this.buyOrders;
    const matches = [];

    for (const [commitment, oppositeOrder] of oppositeOrders) {
      if (this.canMatch(order, oppositeOrder)) {
        matches.push({ commitment, order: oppositeOrder });
      }
    }

    return matches.sort((a, b) => {
      // Sort by best price first
      const priceA = parseFloat(a.order.amountOut) / parseFloat(a.order.amountIn);
      const priceB = parseFloat(b.order.amountOut) / parseFloat(b.order.amountIn);
      
      return order.isBuy ? priceA - priceB : priceB - priceA;
    });
  }

  canMatch(order1, order2) {
    // Check if tokens match
    if (order1.tokenIn !== order2.tokenOut || order1.tokenOut !== order2.tokenIn) {
      return false;
    }

    // Check if prices are compatible
    const price1 = parseFloat(order1.amountOut) / parseFloat(order1.amountIn);
    const price2 = parseFloat(order2.amountOut) / parseFloat(order2.amountIn);

    if (order1.isBuy) {
      return price1 >= price2; // Buy order price >= sell order price
    } else {
      return price2 >= price1; // Sell order price <= buy order price
    }
  }
}

// Matching engine with batched epochs
class MatchingEngine {
  constructor() {
    this.orderBook = new OrderBook();
    this.epochInterval = 1000; // 1 second epochs
    this.currentEpoch = 0;
    this.pendingOrders = [];
    this.privacyLayer = new PrivacyLayer();
    this.engineKeys = PrivacyLayer.generateKeyPair();
    
    // Set the engine's public key
    this.privacyLayer.setEnginePublicKey(this.engineKeys.publicKey);
    
    // Start epoch processing
    this.startEpochProcessing();
  }

  async startEpochProcessing() {
    setInterval(() => {
      this.processEpoch();
    }, this.epochInterval);
  }

  async processEpoch() {
    this.currentEpoch++;
    console.log(`🔄 Processing epoch ${this.currentEpoch} with ${this.pendingOrders.length} pending orders`);

    if (this.pendingOrders.length === 0) {
      return;
    }

    // Process all pending orders in this epoch
    const ordersToProcess = [...this.pendingOrders];
    this.pendingOrders = [];

    // Decrypt and add orders to order book
    for (const encryptedOrder of ordersToProcess) {
      try {
        const orderDetails = await this.privacyLayer.decryptOrderDetails(
          encryptedOrder,
          this.engineKeys.privateKey
        );

        // Verify commitment is still valid
        const commitmentData = this.orderBook.commitments.get(encryptedOrder.commitment);
        if (!commitmentData || !this.privacyLayer.isCommitmentValid(commitmentData)) {
          console.log(`❌ Invalid commitment: ${encryptedOrder.commitment}`);
          continue;
        }

        // Add to order book
        this.orderBook.addOrder(encryptedOrder.commitment, orderDetails);
        console.log(`✅ Order added to book: ${encryptedOrder.commitment}`);

      } catch (error) {
        console.error(`❌ Failed to process order: ${error.message}`);
      }
    }

    // Perform matching
    await this.performMatching();
  }

  async performMatching() {
    const matches = [];
    const processedCommitments = new Set();

    // Find all possible matches
    for (const [commitment, order] of this.orderBook.buyOrders) {
      if (processedCommitments.has(commitment)) continue;

      const matchingOrders = this.orderBook.getMatchingOrders(order);
      
      for (const match of matchingOrders) {
        if (processedCommitments.has(match.commitment)) continue;

        // Create match
        const matchResult = {
          buyCommitment: order.isBuy ? commitment : match.commitment,
          sellCommitment: order.isBuy ? match.commitment : commitment,
          buyOrder: order.isBuy ? order : match.order,
          sellOrder: order.isBuy ? match.order : order,
          matchPrice: this.calculateMatchPrice(order, match.order),
          timestamp: Date.now(),
          epoch: this.currentEpoch
        };

        matches.push(matchResult);
        processedCommitments.add(commitment);
        processedCommitments.add(match.commitment);
        break; // One match per order
      }
    }

    // Execute matches
    for (const match of matches) {
      await this.executeMatch(match);
    }

    console.log(`🎯 Epoch ${this.currentEpoch} completed with ${matches.length} matches`);
  }

  calculateMatchPrice(order1, order2) {
    // Use the price that's better for the market
    const price1 = parseFloat(order1.amountOut) / parseFloat(order1.amountIn);
    const price2 = parseFloat(order2.amountOut) / parseFloat(order2.amountIn);
    
    return order1.isBuy ? Math.min(price1, price2) : Math.max(price1, price2);
  }

  async executeMatch(match) {
    console.log(`⚡ Executing match: ${match.buyCommitment} ↔ ${match.sellCommitment}`);
    
    // Remove matched orders from book
    this.orderBook.removeOrder(match.buyCommitment);
    this.orderBook.removeOrder(match.sellCommitment);

    // In a real implementation, you'd trigger on-chain settlement here
    // For now, we'll just log the match
    console.log(`✅ Match executed:`, {
      buyTrader: match.buyOrder.trader,
      sellTrader: match.sellOrder.trader,
      amount: match.buyOrder.amountIn,
      price: match.matchPrice
    });
  }

  addPendingOrder(encryptedOrder) {
    this.pendingOrders.push(encryptedOrder);
    console.log(`📝 Order queued for epoch ${this.currentEpoch + 1}: ${encryptedOrder.commitment}`);
  }

  getEnginePublicKey() {
    return this.engineKeys.publicKey;
  }

  getOrderBookStatus() {
    return {
      buyOrders: this.orderBook.buyOrders.size,
      sellOrders: this.orderBook.sellOrders.size,
      pendingOrders: this.pendingOrders.length,
      currentEpoch: this.currentEpoch
    };
  }
}

// Initialize matching engine
const matchingEngine = new MatchingEngine();

// API Routes

// Get engine public key
app.get('/api/engine/public-key', (req, res) => {
  res.json({ publicKey: matchingEngine.getEnginePublicKey() });
});

// Submit commitment (Phase 1 of commit-reveal)
app.post('/api/orders/commit', (req, res) => {
  try {
    const { commitment, timestamp, trader } = req.body;
    
    if (!commitment || !timestamp || !trader) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Add commitment to order book
    matchingEngine.orderBook.addCommitment(commitment, {
      commitment,
      timestamp,
      trader
    });

    console.log(`📝 Commitment received: ${commitment} from ${trader}`);
    res.json({ success: true, commitment });
  } catch (error) {
    console.error('Commitment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit encrypted order (Phase 2 of commit-reveal)
app.post('/api/orders/reveal', (req, res) => {
  try {
    const { encryptedData, commitment, timestamp, nonce } = req.body;
    
    if (!encryptedData || !commitment || !timestamp || !nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const encryptedOrder = {
      encryptedData,
      commitment,
      timestamp,
      nonce
    };

    // Add to pending orders for next epoch
    matchingEngine.addPendingOrder(encryptedOrder);

    console.log(`🔓 Order revealed: ${commitment}`);
    res.json({ success: true, commitment });
  } catch (error) {
    console.error('Reveal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order book status
app.get('/api/orderbook/status', (req, res) => {
  res.json(matchingEngine.getOrderBookStatus());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: Date.now(),
    epoch: matchingEngine.currentEpoch
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dark Pool Matching Engine running on port ${PORT}`);
  console.log(`🔑 Engine public key: ${matchingEngine.getEnginePublicKey()}`);
  console.log(`⏱️  Epoch interval: ${matchingEngine.epochInterval}ms`);
});

module.exports = { app, matchingEngine }; 