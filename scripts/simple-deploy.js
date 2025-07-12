require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Simple Dark Pool DEX Deployment");
  console.log("==================================\n");

  // Check if private key is set
  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found in environment");
    console.log("📝 Please create a .env file with:");
    console.log("   PRIVATE_KEY=your_wallet_private_key_here");
    console.log("\n💡 You can get your private key from MetaMask:");
    console.log("   1. Open MetaMask");
    console.log("   2. Go to Account Details");
    console.log("   3. Click 'Export Private Key'");
    console.log("   4. Copy the private key (without 0x prefix)");
    return;
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  // Get balance using ethers provider
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Check if we have enough balance
  if (balance < ethers.parseEther("0.01")) {
    console.log("❌ Insufficient balance for deployment");
    console.log("💧 Get testnet ETH from:");
    console.log("   • Polygon Mumbai: https://faucet.polygon.technology/");
    console.log("   • Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia");
    console.log("   • Optimism Sepolia: https://app.optimism.io/faucet");
    return;
  }

  try {
    // Deploy BatchBridge contract
    console.log("\n📦 Deploying BatchBridge...");
    const batchBridge = await ethers.deployContract("BatchBridge", [50]); // 0.5% default fee
    await batchBridge.waitForDeployment();
    console.log("✅ BatchBridge deployed to:", await batchBridge.getAddress());

    // Deploy DarkPoolDEX contract
    console.log("\n🕳️ Deploying DarkPoolDEX...");
    const darkPoolDEX = await ethers.deployContract("DarkPoolDEX", [
      ethers.parseEther("0.001"), // minOrderSize
      ethers.parseEther("100"),   // maxOrderSize
      300,  // commitmentWindow: 5 minutes
      600,  // revealWindow: 10 minutes
      50    // tradingFee: 0.5%
    ]);
    await darkPoolDEX.waitForDeployment();
    console.log("✅ DarkPoolDEX deployed to:", await darkPoolDEX.getAddress());

    // Deploy mock tokens
    console.log("\n🪙 Deploying mock tokens...");
    
    const mockQNT = await ethers.deployContract("MockERC20", ["Quant", "QNT", 18]);
    await mockQNT.waitForDeployment();
    console.log("✅ Mock QNT deployed to:", await mockQNT.getAddress());

    const mockRENDER = await ethers.deployContract("MockERC20", ["Render Token", "RENDER", 18]);
    await mockRENDER.waitForDeployment();
    console.log("✅ Mock RENDER deployed to:", await mockRENDER.getAddress());

    // Save deployment info
    const deploymentInfo = {
      network: hre.network.name,
      deployer: deployer.address,
      contracts: {
        batchBridge: await batchBridge.getAddress(),
        darkPoolDEX: await darkPoolDEX.getAddress(),
        mockTokens: {
          QNT: await mockQNT.getAddress(),
          RENDER: await mockRENDER.getAddress()
        }
      },
      timestamp: new Date().toISOString()
    };

    // Save to file
    const fs = require('fs');
    const deploymentPath = `deployments/${hre.network.name}.json`;
    
    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments');
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📊 Summary:");
    console.log("Network:", hre.network.name);
    console.log("BatchBridge:", await batchBridge.getAddress());
    console.log("DarkPoolDEX:", await darkPoolDEX.getAddress());
    console.log("Mock QNT:", await mockQNT.getAddress());
    console.log("Mock RENDER:", await mockRENDER.getAddress());

    console.log("\n🔗 Next Steps:");
    console.log("1. Test the contracts with: npm run bridge:test");
    console.log("2. Start cost monitoring with: npm run start:monitoring");
    console.log("3. Deploy to other networks: npm run deploy:polygon");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Get testnet ETH from:");
      console.log("   • Polygon Mumbai: https://faucet.polygon.technology/");
      console.log("   • Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia");
      console.log("   • Optimism Sepolia: https://app.optimism.io/faucet");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }); 