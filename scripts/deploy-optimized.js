require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Optimized Dark Pool DEX Infrastructure...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy BatchBridge contract
  console.log("\n📦 Deploying BatchBridge contract...");
  const BatchBridge = await ethers.getContractFactory("BatchBridge");
  const batchBridge = await BatchBridge.deploy(50); // 0.5% default bridge fee
  await batchBridge.deployed();
  console.log("✅ BatchBridge deployed to:", batchBridge.address);

  // Deploy DarkPoolDEX contract
  console.log("\n🕳️ Deploying DarkPoolDEX contract...");
  const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
  const darkPoolDEX = await DarkPoolDEX.deploy(
          ethers.parseEther("0.001"), // minOrderSize: 0.001 ETH
      ethers.parseEther("100"),   // maxOrderSize: 100 ETH
    300,  // commitmentWindow: 5 minutes
    600,  // revealWindow: 10 minutes
    50    // tradingFee: 0.5%
  );
  await darkPoolDEX.deployed();
  console.log("✅ DarkPoolDEX deployed to:", darkPoolDEX.address);

  // Deploy AtomicSwap contract
  console.log("\n⚛️ Deploying AtomicSwap contract...");
  const AtomicSwap = await ethers.getContractFactory("AtomicSwap");
  const atomicSwap = await AtomicSwap.deploy(
          ethers.parseEther("0.001"), // minSwapAmount: 0.001 ETH
      ethers.parseEther("100"),   // maxSwapAmount: 100 ETH
    3600, // defaultExpiry: 1 hour
    50    // swapFee: 0.5%
  );
  await atomicSwap.deployed();
  console.log("✅ AtomicSwap deployed to:", atomicSwap.address);

  // Deploy mock tokens for testing
  console.log("\n🪙 Deploying mock tokens...");
  const MockToken = await ethers.getContractFactory("MockERC20");
  
  const mockQNT = await MockToken.deploy("Quant", "QNT", 18);
  await mockQNT.deployed();
  console.log("✅ Mock QNT deployed to:", mockQNT.address);

  const mockRENDER = await MockToken.deploy("Render Token", "RENDER", 18);
  await mockRENDER.deployed();
  console.log("✅ Mock RENDER deployed to:", mockRENDER.address);

  const mockUSDC = await MockToken.deploy("USD Coin", "USDC", 6);
  await mockUSDC.deployed();
  console.log("✅ Mock USDC deployed to:", mockUSDC.address);

  // Configure BatchBridge with bridge addresses
  console.log("\n🔗 Configuring BatchBridge...");
  
  // Add bridge configurations (using mock addresses for now)
  const mockBridgeAddresses = {
    multichain: "0x1234567890123456789012345678901234567890",
    stargate: "0x2345678901234567890123456789012345678901",
    layerzero: "0x3456789012345678901234567890123456789012"
  };

  await batchBridge.updateBridgeConfig(
    mockBridgeAddresses.multichain,
    5,   // minBatchSize
    100, // maxBatchSize
    20   // feeBps: 0.2%
  );

  await batchBridge.updateBridgeConfig(
    mockBridgeAddresses.stargate,
    10,  // minBatchSize
    50,  // maxBatchSize
    15   // feeBps: 0.15%
  );

  await batchBridge.updateBridgeConfig(
    mockBridgeAddresses.layerzero,
    3,   // minBatchSize
    75,  // maxBatchSize
    25   // feeBps: 0.25%
  );

  console.log("✅ Bridge configurations added");

  // Grant roles to deployer
  console.log("\n🔐 Setting up roles...");
  
  const OPERATOR_ROLE = await batchBridge.OPERATOR_ROLE();
  const BRIDGE_ROLE = await batchBridge.BRIDGE_ROLE();
  
  await batchBridge.grantRole(OPERATOR_ROLE, deployer.address);
  await batchBridge.grantRole(BRIDGE_ROLE, deployer.address);
  
  console.log("✅ Roles configured");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      batchBridge: batchBridge.address,
      darkPoolDEX: darkPoolDEX.address,
      atomicSwap: atomicSwap.address,
      mockTokens: {
        QNT: mockQNT.address,
        RENDER: mockRENDER.address,
        USDC: mockUSDC.address
      }
    },
    bridgeAddresses: mockBridgeAddresses,
    timestamp: new Date().toISOString()
  };

  // Save to file
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}.json`;
  
  // Ensure deployments directory exists
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  // Verify contracts on Etherscan (if not localhost)
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    console.log("\n🔍 Verifying contracts on Etherscan...");
    
    try {
      await hre.run("verify:verify", {
        address: batchBridge.address,
        constructorArguments: [50],
      });
      console.log("✅ BatchBridge verified");
    } catch (error) {
      console.log("⚠️ BatchBridge verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: darkPoolDEX.address,
        constructorArguments: [
          ethers.parseEther("0.001"),
          ethers.parseEther("100"),
          300,
          600,
          50
        ],
      });
      console.log("✅ DarkPoolDEX verified");
    } catch (error) {
      console.log("⚠️ DarkPoolDEX verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: atomicSwap.address,
        constructorArguments: [
          ethers.parseEther("0.001"),
          ethers.parseEther("100"),
          3600,
          50
        ],
      });
      console.log("✅ AtomicSwap verified");
    } catch (error) {
      console.log("⚠️ AtomicSwap verification failed:", error.message);
    }
  }

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📊 Deployment Summary:");
  console.log("Network:", hre.network.name);
  console.log("BatchBridge:", batchBridge.address);
  console.log("DarkPoolDEX:", darkPoolDEX.address);
  console.log("AtomicSwap:", atomicSwap.address);
  console.log("Mock QNT:", mockQNT.address);
  console.log("Mock RENDER:", mockRENDER.address);
  console.log("Mock USDC:", mockUSDC.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 