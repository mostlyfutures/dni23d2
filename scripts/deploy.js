const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of Dark Pool DEX contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.getBalance()).toString());

  // Deployment parameters
  const DARK_POOL_PARAMS = {
    minOrderSize: ethers.utils.parseEther("0.001"), // 0.001 ETH minimum
    maxOrderSize: ethers.utils.parseEther("100"),   // 100 ETH maximum
    commitmentWindow: 300,  // 5 minutes
    revealWindow: 600,      // 10 minutes
    tradingFee: 50          // 0.5% (50 basis points)
  };

  const ATOMIC_SWAP_PARAMS = {
    minSwapAmount: ethers.utils.parseEther("0.001"), // 0.001 ETH minimum
    maxSwapAmount: ethers.utils.parseEther("50"),    // 50 ETH maximum
    defaultExpiry: 3600,    // 1 hour
    swapFee: 30             // 0.3% (30 basis points)
  };

  try {
    // Deploy DarkPoolDEX contract
    console.log("\n📋 Deploying DarkPoolDEX contract...");
    const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
    const darkPoolDEX = await DarkPoolDEX.deploy(
      DARK_POOL_PARAMS.minOrderSize,
      DARK_POOL_PARAMS.maxOrderSize,
      DARK_POOL_PARAMS.commitmentWindow,
      DARK_POOL_PARAMS.revealWindow,
      DARK_POOL_PARAMS.tradingFee
    );
    await darkPoolDEX.deployed();
    console.log("✅ DarkPoolDEX deployed to:", darkPoolDEX.address);

    // Deploy AtomicSwap contract
    console.log("\n📋 Deploying AtomicSwap contract...");
    const AtomicSwap = await ethers.getContractFactory("AtomicSwap");
    const atomicSwap = await AtomicSwap.deploy(
      ATOMIC_SWAP_PARAMS.minSwapAmount,
      ATOMIC_SWAP_PARAMS.maxSwapAmount,
      ATOMIC_SWAP_PARAMS.defaultExpiry,
      ATOMIC_SWAP_PARAMS.swapFee
    );
    await atomicSwap.deployed();
    console.log("✅ AtomicSwap deployed to:", atomicSwap.address);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    
    const darkPoolOwner = await darkPoolDEX.owner();
    const atomicSwapOwner = await atomicSwap.owner();
    
    console.log("DarkPoolDEX owner:", darkPoolOwner);
    console.log("AtomicSwap owner:", atomicSwapOwner);
    
    if (darkPoolOwner === deployer.address && atomicSwapOwner === deployer.address) {
      console.log("✅ Ownership verification passed");
    } else {
      console.log("❌ Ownership verification failed");
    }

    // Log contract parameters
    console.log("\n📊 Contract Parameters:");
    console.log("DarkPoolDEX:");
    console.log("  - Min Order Size:", ethers.utils.formatEther(DARK_POOL_PARAMS.minOrderSize), "ETH");
    console.log("  - Max Order Size:", ethers.utils.formatEther(DARK_POOL_PARAMS.maxOrderSize), "ETH");
    console.log("  - Commitment Window:", DARK_POOL_PARAMS.commitmentWindow, "seconds");
    console.log("  - Reveal Window:", DARK_POOL_PARAMS.revealWindow, "seconds");
    console.log("  - Trading Fee:", DARK_POOL_PARAMS.tradingFee / 100, "%");
    
    console.log("\nAtomicSwap:");
    console.log("  - Min Swap Amount:", ethers.utils.formatEther(ATOMIC_SWAP_PARAMS.minSwapAmount), "ETH");
    console.log("  - Max Swap Amount:", ethers.utils.formatEther(ATOMIC_SWAP_PARAMS.maxSwapAmount), "ETH");
    console.log("  - Default Expiry:", ATOMIC_SWAP_PARAMS.defaultExpiry, "seconds");
    console.log("  - Swap Fee:", ATOMIC_SWAP_PARAMS.swapFee / 100, "%");

    // Save deployment info
    const deploymentInfo = {
      network: network.name,
      deployer: deployer.address,
      contracts: {
        DarkPoolDEX: {
          address: darkPoolDEX.address,
          parameters: DARK_POOL_PARAMS
        },
        AtomicSwap: {
          address: atomicSwap.address,
          parameters: ATOMIC_SWAP_PARAMS
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log("\n📄 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Update frontend with contract addresses");
    console.log("2. Test contract functionality");
    console.log("3. Deploy to testnet for further testing");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 