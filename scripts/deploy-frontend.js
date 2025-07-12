const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Dark Pool DEX contracts...");

  // Get the contract factory
  const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
  const AtomicSwap = await ethers.getContractFactory("AtomicSwap");

  // Contract parameters
  const MIN_ORDER_SIZE = ethers.parseEther("0.001");
  const MAX_ORDER_SIZE = ethers.parseEther("100");
  const COMMITMENT_WINDOW = 300; // 5 minutes
  const REVEAL_WINDOW = 600; // 10 minutes
  const TRADING_FEE = 50; // 0.5%

  // AtomicSwap parameters
  const MIN_SWAP_AMOUNT = ethers.parseEther("0.001");
  const MAX_SWAP_AMOUNT = ethers.parseEther("100");
  const DEFAULT_EXPIRY = 3600; // 1 hour
  const SWAP_FEE = 25; // 0.25%

  console.log("📋 Contract Parameters:");
  console.log(`   Min Order Size: ${ethers.formatEther(MIN_ORDER_SIZE)} ETH`);
  console.log(`   Max Order Size: ${ethers.formatEther(MAX_ORDER_SIZE)} ETH`);
  console.log(`   Commitment Window: ${COMMITMENT_WINDOW} seconds`);
  console.log(`   Reveal Window: ${REVEAL_WINDOW} seconds`);
  console.log(`   Trading Fee: ${TRADING_FEE / 100}%`);
  console.log(`   Min Swap Amount: ${ethers.formatEther(MIN_SWAP_AMOUNT)} ETH`);
  console.log(`   Max Swap Amount: ${ethers.formatEther(MAX_SWAP_AMOUNT)} ETH`);
  console.log(`   Default Expiry: ${DEFAULT_EXPIRY} seconds`);
  console.log(`   Swap Fee: ${SWAP_FEE / 100}%`);

  // Deploy DarkPoolDEX
  console.log("\n🔧 Deploying DarkPoolDEX...");
  const darkPoolDEX = await DarkPoolDEX.deploy(
    MIN_ORDER_SIZE,
    MAX_ORDER_SIZE,
    COMMITMENT_WINDOW,
    REVEAL_WINDOW,
    TRADING_FEE
  );
  await darkPoolDEX.waitForDeployment();
  const darkPoolAddress = await darkPoolDEX.getAddress();

  // Deploy AtomicSwap
  console.log("🔧 Deploying AtomicSwap...");
  const atomicSwap = await AtomicSwap.deploy(
    MIN_SWAP_AMOUNT,
    MAX_SWAP_AMOUNT,
    DEFAULT_EXPIRY,
    SWAP_FEE
  );
  await atomicSwap.waitForDeployment();
  const atomicSwapAddress = await atomicSwap.getAddress();

  console.log("\n✅ Deployment Complete!");
  console.log("📄 Contract Addresses:");
  console.log(`   DarkPoolDEX: ${darkPoolAddress}`);
  console.log(`   AtomicSwap: ${atomicSwapAddress}`);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`\n🌐 Network: ${networkName}`);
  console.log(`🔗 Chain ID: ${network.chainId}`);

  // Create deployment info file
  const deploymentInfo = {
    network: networkName,
    chainId: network.chainId.toString(),
    contracts: {
      DarkPoolDEX: darkPoolAddress,
      AtomicSwap: atomicSwapAddress
    },
    parameters: {
      minOrderSize: ethers.formatEther(MIN_ORDER_SIZE),
      maxOrderSize: ethers.formatEther(MAX_ORDER_SIZE),
      commitmentWindow: COMMITMENT_WINDOW.toString(),
      revealWindow: REVEAL_WINDOW.toString(),
      tradingFee: TRADING_FEE.toString(),
      minSwapAmount: ethers.formatEther(MIN_SWAP_AMOUNT),
      maxSwapAmount: ethers.formatEther(MAX_SWAP_AMOUNT),
      defaultExpiry: DEFAULT_EXPIRY.toString(),
      swapFee: SWAP_FEE.toString()
    },
    deployedAt: new Date().toISOString()
  };

  // Write to file
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n📁 Deployment info saved to: ${deploymentPath}`);

  // Frontend integration instructions
  console.log("\n🎯 Frontend Integration:");
  console.log("1. Copy the DarkPoolDEX address above");
  console.log("2. Update your frontend with the contract address");
  console.log("3. Ensure your wallet is connected to the same network");
  console.log("4. Test the commit-reveal flow");

  console.log("\n🔗 For local development:");
  console.log("   - Use MetaMask with localhost:8545");
  console.log("   - Import test accounts with private keys from hardhat");
  console.log("   - Fund accounts with: npx hardhat node");

  console.log("\n🔗 For testnet deployment:");
  console.log("   - Update hardhat.config.js with your RPC URL and private key");
  console.log("   - Run: npx hardhat run scripts/deploy-frontend.js --network <network>");

  return {
    darkPoolAddress,
    atomicSwapAddress,
    networkName,
    chainId: network.chainId
  };
}

main()
  .then((result) => {
    console.log("\n🎉 Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 