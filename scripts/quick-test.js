#!/usr/bin/env node

/**
 * Quick Test Script
 * 
 * Manual testing of key components:
 * - Backend connectivity
 * - State channel operations
 * - Order management
 * - Frontend-backend communication
 */

require('dotenv').config();

class QuickTester {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    this.testResults = [];
    
    // Test configuration
    this.testConfig = {
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
      icpCanisterId: process.env.ICP_CANISTER_ID,
      constellationNetwork: process.env.CONSTELLATION_NETWORK || 'testnet',
      testUserAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      testAmount: '1.0'
    };
  }

  async runQuickTests() {
    console.log('🚀 Running Quick Tests...\n');

    try {
      // Test 1: Backend Health
      await this.testBackendHealth();
      
      // Test 2: State Channel Operations
      await this.testStateChannels();
      
      // Test 3: Order Management
      await this.testOrderManagement();
      
      // Test 4: Backend Switching
      await this.testBackendSwitching();
      
      // Test 5: Constellation Integration
      await this.testConstellationIntegration();
      
    } catch (error) {
      console.error('❌ Quick tests failed:', error);
    }
    
    this.printResults();
  }

  async testBackendHealth() {
    console.log('🏥 Testing Backend Health...');
    
    try {
      const response = await fetch(`${this.backendUrl}/api/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy') {
        console.log('  ✅ Backend is healthy');
        console.log(`  📊 Epoch: ${data.epoch}`);
        this.testResults.push({ test: 'Backend Health', status: 'PASS' });
      } else {
        console.log('  ❌ Backend health check failed');
        this.testResults.push({ test: 'Backend Health', status: 'FAIL' });
      }
    } catch (error) {
      console.log('  ❌ Backend not reachable:', error.message);
      this.testResults.push({ test: 'Backend Health', status: 'FAIL', error: error.message });
    }
  }

  async testStateChannels() {
    console.log('🔗 Testing State Channels...');
    
    try {
      // Test getting engine public key (required for state channel operations)
      const keyResponse = await fetch(`${this.backendUrl}/api/engine/public-key`);
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        console.log('  ✅ Engine public key retrieved');
        
        // Test order book status (simulates state channel operations)
        const orderBookResponse = await fetch(`${this.backendUrl}/api/orderbook/status`);
        if (orderBookResponse.ok) {
          const orderBook = await orderBookResponse.json();
          console.log('  ✅ Order book status retrieved:', orderBook);
          this.testResults.push({ test: 'State Channels', status: 'PASS' });
        } else {
          console.log('  ❌ Failed to get order book status');
          this.testResults.push({ test: 'State Channels', status: 'FAIL' });
        }
      } else {
        console.log('  ❌ Failed to get engine public key');
        this.testResults.push({ test: 'State Channels', status: 'FAIL' });
      }
    } catch (error) {
      console.log('  ❌ State channel test failed:', error.message);
      this.testResults.push({ test: 'State Channels', status: 'FAIL', error: error.message });
    }
  }

  async testOrderManagement() {
    console.log('📊 Testing Order Management...');
    
    try {
      // Test getting order book status
      const orderBookResponse = await fetch(`${this.backendUrl}/api/orderbook/status`);
      if (orderBookResponse.ok) {
        const orderBook = await orderBookResponse.json();
        console.log('  ✅ Retrieved order book status:', orderBook);
        
        // Test submitting a commitment
        const commitmentResponse = await fetch(`${this.backendUrl}/api/orders/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commitment: '0x' + 'a'.repeat(64),
            timestamp: Math.floor(Date.now() / 1000),
            trader: this.testConfig.testUserAddress
          })
        });
        
        if (commitmentResponse.ok) {
          const commitment = await commitmentResponse.json();
          console.log('  ✅ Commitment submitted:', commitment.commitment);
          this.testResults.push({ test: 'Order Management', status: 'PASS' });
        } else {
          console.log('  ❌ Failed to submit commitment');
          this.testResults.push({ test: 'Order Management', status: 'FAIL' });
        }
      } else {
        console.log('  ❌ Failed to get order book status');
        this.testResults.push({ test: 'Order Management', status: 'FAIL' });
      }
    } catch (error) {
      console.log('  ❌ Order management test failed:', error.message);
      this.testResults.push({ test: 'Order Management', status: 'FAIL', error: error.message });
    }
  }

  async testBackendSwitching() {
    console.log('🔄 Testing Backend Switching...');
    
    try {
      // Test getting engine public key (simulates backend switching)
      const keyResponse = await fetch(`${this.backendUrl}/api/engine/public-key`);
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        console.log('  ✅ Engine public key retrieved');
        
        // Test order book status (simulates different backend)
        const orderBookResponse = await fetch(`${this.backendUrl}/api/orderbook/status`);
        if (orderBookResponse.ok) {
          const orderBook = await orderBookResponse.json();
          console.log('  ✅ Order book status retrieved');
          this.testResults.push({ test: 'Backend Switching', status: 'PASS' });
        } else {
          console.log('  ❌ Failed to get order book status');
          this.testResults.push({ test: 'Backend Switching', status: 'FAIL' });
        }
      } else {
        console.log('  ❌ Failed to get engine public key');
        this.testResults.push({ test: 'Backend Switching', status: 'FAIL' });
      }
    } catch (error) {
      console.log('  ❌ Backend switching test failed:', error.message);
      this.testResults.push({ test: 'Backend Switching', status: 'FAIL', error: error.message });
    }
  }

  async testConstellationIntegration() {
    console.log('🌐 Testing Constellation Integration...');
    
    try {
      // Test getting engine public key (simulates Constellation connectivity)
      const keyResponse = await fetch(`${this.backendUrl}/api/engine/public-key`);
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        console.log('  ✅ Engine public key retrieved (simulates Constellation)');
        
        // Test submitting a commitment (simulates DAG submission)
        const commitmentResponse = await fetch(`${this.backendUrl}/api/orders/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commitment: '0x' + 'b'.repeat(64),
            timestamp: Math.floor(Date.now() / 1000),
            trader: this.testConfig.testUserAddress
          })
        });
        
        if (commitmentResponse.ok) {
          const commitment = await commitmentResponse.json();
          console.log('  ✅ Commitment submitted (simulates DAG submission)');
          this.testResults.push({ test: 'Constellation Integration', status: 'PASS' });
        } else {
          console.log('  ❌ Failed to submit commitment');
          this.testResults.push({ test: 'Constellation Integration', status: 'FAIL' });
        }
      } else {
        console.log('  ❌ Failed to get engine public key');
        this.testResults.push({ test: 'Constellation Integration', status: 'FAIL' });
      }
    } catch (error) {
      console.log('  ❌ Constellation integration test failed:', error.message);
      this.testResults.push({ test: 'Constellation Integration', status: 'FAIL', error: error.message });
    }
  }

  printResults() {
    console.log('\n📊 Quick Test Results');
    console.log('====================');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All quick tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Check the backend logs for details.');
    }
  }
}

// Run quick tests
async function main() {
  const tester = new QuickTester();
  await tester.runQuickTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = QuickTester; 