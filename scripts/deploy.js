const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of Dark Pool DEX contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deployment parameters
  const DARK_POOL_PARAMS = {
    minOrderSize: ethers.parseEther("0.001"), // 0.001 ETH minimum
    maxOrderSize: ethers.parseEther("100"),   // 100 ETH maximum
    commitmentWindow: 300,  // 5 minutes
    revealWindow: 600,      // 10 minutes
    tradingFee: 50          // 0.5% (50 basis points)
  };

  const ATOMIC_SWAP_PARAMS = {
    minSwapAmount: ethers.parseEther("0.001"), // 0.001 ETH minimum
    maxSwapAmount: ethers.parseEther("50"),    // 50 ETH maximum
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
    await darkPoolDEX.waitForDeployment();
    const darkPoolDEXAddress = await darkPoolDEX.getAddress();
    console.log("✅ DarkPoolDEX deployed to:", darkPoolDEXAddress);

    // Deploy AtomicSwap contract
    console.log("\n📋 Deploying AtomicSwap contract...");
    const AtomicSwap = await ethers.getContractFactory("AtomicSwap");
    const atomicSwap = await AtomicSwap.deploy(
      ATOMIC_SWAP_PARAMS.minSwapAmount,
      ATOMIC_SWAP_PARAMS.maxSwapAmount,
      ATOMIC_SWAP_PARAMS.defaultExpiry,
      ATOMIC_SWAP_PARAMS.swapFee
    );
    await atomicSwap.waitForDeployment();
    const atomicSwapAddress = await atomicSwap.getAddress();
    console.log("✅ AtomicSwap deployed to:", atomicSwapAddress);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    // Ownership verification removed because contracts do not implement owner()
    // const darkPoolOwner = await darkPoolDEX.owner();
    // const atomicSwapOwner = await atomicSwap.owner();
    // console.log("DarkPoolDEX owner:", darkPoolOwner);
    // console.log("AtomicSwap owner:", atomicSwapOwner);
    // if (darkPoolOwner === deployer.address && atomicSwapOwner === deployer.address) {
    //   console.log("✅ Ownership verification passed");
    // } else {
    //   console.log("❌ Ownership verification failed");
    // }

    // Log contract parameters
    console.log("\n📊 Contract Parameters:");
    console.log("DarkPoolDEX:");
    console.log("  - Min Order Size:", ethers.formatEther(DARK_POOL_PARAMS.minOrderSize), "ETH");
    console.log("  - Max Order Size:", ethers.formatEther(DARK_POOL_PARAMS.maxOrderSize), "ETH");
    console.log("  - Commitment Window:", DARK_POOL_PARAMS.commitmentWindow, "seconds");
    console.log("  - Reveal Window:", DARK_POOL_PARAMS.revealWindow, "seconds");
    console.log("  - Trading Fee:", DARK_POOL_PARAMS.tradingFee / 100, "%");
    
    console.log("\nAtomicSwap:");
    console.log("  - Min Swap Amount:", ethers.formatEther(ATOMIC_SWAP_PARAMS.minSwapAmount), "ETH");
    console.log("  - Max Swap Amount:", ethers.formatEther(ATOMIC_SWAP_PARAMS.maxSwapAmount), "ETH");
    console.log("  - Default Expiry:", ATOMIC_SWAP_PARAMS.defaultExpiry, "seconds");
    console.log("  - Swap Fee:", ATOMIC_SWAP_PARAMS.swapFee / 100, "%");

    // Convert BigInt values in parameters to strings for JSON serialization
    function stringifyBigInts(obj) {
      if (typeof obj === 'bigint') {
        return obj.toString();
      } else if (Array.isArray(obj)) {
        return obj.map(stringifyBigInts);
      } else if (typeof obj === 'object' && obj !== null) {
        const res = {};
        for (const key in obj) {
          res[key] = stringifyBigInts(obj[key]);
        }
        return res;
      }
      return obj;
    }

    const deploymentInfo = {
      network: "localhost",
      deployer: deployer.address,
      contracts: {
        DarkPoolDEX: {
          address: darkPoolDEXAddress,
          parameters: stringifyBigInts(DARK_POOL_PARAMS)
        },
        AtomicSwap: {
          address: atomicSwapAddress,
          parameters: stringifyBigInts(ATOMIC_SWAP_PARAMS)
        }
      },
      timestamp: new Date().toISOString()
    };

    // Save to public folder for frontend access
    const fs = require('fs');
    const path = require('path');
    const publicDeploymentPath = path.join(__dirname, '..', 'public', 'deployment.json');
    fs.writeFileSync(publicDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("📄 Deployment info saved to public/deployment.json");

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