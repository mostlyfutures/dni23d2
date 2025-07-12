#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Dark Pool DEX Quick Start');
console.log('============================\n');

async function runCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} completed successfully`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    console.log('⚠️  .env file not found. Creating from template...');
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ Created .env file from template');
      console.log('⚠️  Please update .env with your private key and API keys');
    } else {
      console.log('❌ .env.example not found. Please create .env file manually');
    }
  }

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    await runCommand('npm install', 'Installing dependencies');
  }

  // Check if contracts are compiled
  if (!fs.existsSync('artifacts')) {
    console.log('🔨 Compiling contracts...');
    await runCommand('npm run compile', 'Compiling contracts');
  }
}

async function deployInfrastructure() {
  console.log('\n🏗️  Step 1: Deploying Core Infrastructure\n');
  
  // Deploy to local network first for testing
  console.log('📍 Deploying to local network...');
  await runCommand('npm run deploy:local', 'Local deployment');
  
  // Deploy to testnets
  console.log('🌐 Deploying to testnets...');
  await runCommand('npm run deploy:polygon', 'Polygon Mumbai deployment');
  await runCommand('npm run deploy:arbitrum', 'Arbitrum Sepolia deployment');
  await runCommand('npm run deploy:optimism', 'Optimism Sepolia deployment');
  
  console.log('✅ Infrastructure deployment completed');
}

async function testBridgeIntegration() {
  console.log('\n🌉 Step 2: Testing Bridge API Integration\n');
  
  await runCommand('npm run bridge:test', 'Bridge API testing');
  
  console.log('✅ Bridge integration testing completed');
}

async function startCostMonitoring() {
  console.log('\n📊 Step 3: Starting Cost Monitoring\n');
  
  // Start monitoring in background
  console.log('📈 Starting cost monitoring service...');
  const monitoringProcess = execSync('npm run start:monitoring', { 
    encoding: 'utf8', 
    stdio: 'pipe',
    detached: true 
  });
  
  console.log('✅ Cost monitoring started');
  console.log('💡 Monitoring will continue in background');
}

async function runIntegrationTests() {
  console.log('\n🧪 Running Integration Tests\n');
  
  await runCommand('npm run bridge:test', 'Full integration testing');
  
  console.log('✅ Integration tests completed');
}

async function showDeploymentSummary() {
  console.log('\n📋 Deployment Summary\n');
  
  // Read deployment files
  const deploymentsDir = 'deployments';
  if (fs.existsSync(deploymentsDir)) {
    const files = fs.readdirSync(deploymentsDir);
    
    console.log('📍 Deployed Networks:');
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const network = file.replace('.json', '');
        console.log(`   ✅ ${network}`);
      }
    });
  }
  
  console.log('\n🎯 Cost Targets:');
  console.log('   • Target Cost: $0.01-0.02 per swap');
  console.log('   • Batch Processing: 60-80% cost reduction');
  console.log('   • Route Optimization: Automatic cheapest route selection');
  
  console.log('\n🌉 Bridge Integration:');
  console.log('   • Constellation: Free bridge (0 cost)');
  console.log('   • LayerZero: $0.012 base fee');
  console.log('   • Multichain: $0.01 base fee');
  console.log('   • Stargate: $0.015 base fee');
  
  console.log('\n📊 Monitoring:');
  console.log('   • Real-time cost tracking');
  console.log('   • Automatic optimization triggers');
  console.log('   • Bridge performance analysis');
}

async function main() {
  try {
    // Step 0: Check prerequisites
    await checkPrerequisites();
    
    // Step 1: Deploy infrastructure
    await deployInfrastructure();
    
    // Step 2: Test bridge integration
    await testBridgeIntegration();
    
    // Step 3: Start cost monitoring
    await startCostMonitoring();
    
    // Step 4: Run integration tests
    await runIntegrationTests();
    
    // Step 5: Show summary
    await showDeploymentSummary();
    
    console.log('\n🎉 Quick Start Completed Successfully!');
    console.log('\n📚 Next Steps:');
    console.log('   1. Review deployment logs in deployments/');
    console.log('   2. Test swaps using the frontend interface');
    console.log('   3. Monitor cost performance with npm run cost:analyze');
    console.log('   4. Check optimization triggers and bridge performance');
    console.log('   5. Deploy to mainnet when ready');
    
    console.log('\n🔗 Useful Commands:');
    console.log('   • npm run bridge:test - Test bridge integration');
    console.log('   • npm run cost:analyze - Analyze cost performance');
    console.log('   • npm run start:monitoring - Start cost monitoring');
    console.log('   • npm run security:coverage - Run security analysis');
    
  } catch (error) {
    console.error('\n❌ Quick Start Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your .env file configuration');
    console.log('   2. Ensure you have sufficient testnet tokens');
    console.log('   3. Verify network connectivity');
    console.log('   4. Check deployment logs for specific errors');
    
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main }; 