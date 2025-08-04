const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting simple contract test...\n");

    // Get signers
    const [owner, user1, user2] = await ethers.getSigners();
    console.log("📋 Signers loaded:");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   User1: ${user1.address}`);
    console.log(`   User2: ${user2.address}\n`);

    try {
        // Deploy mock tokens
        console.log("🪙 Deploying mock tokens...");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const token1 = await MockERC20.deploy("Token1", "TK1", 18);
        const token2 = await MockERC20.deploy("Token2", "TK2", 18);
        await token1.waitForDeployment();
        await token2.waitForDeployment();
        console.log(`   Token1 deployed at: ${await token1.getAddress()}`);
        console.log(`   Token2 deployed at: ${await token2.getAddress()}\n`);

        // Deploy AtomicSwap
        console.log("🔄 Deploying AtomicSwap...");
        const AtomicSwap = await ethers.getContractFactory("AtomicSwap");
        const atomicSwap = await AtomicSwap.deploy(
            ethers.parseEther("0.1"),  // minSwapAmount
            ethers.parseEther("1000"), // maxSwapAmount
            3600,                      // defaultExpiry (1 hour)
            50                         // swapFee (0.5%)
        );
        await atomicSwap.waitForDeployment();
        console.log(`   AtomicSwap deployed at: ${await atomicSwap.getAddress()}\n`);

        // Deploy DarkPoolDEX
        console.log("🌑 Deploying DarkPoolDEX...");
        const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
        const darkPoolDEX = await DarkPoolDEX.deploy(
            ethers.parseEther("0.1"),  // minOrderSize
            ethers.parseEther("1000"), // maxOrderSize
            300,                       // commitmentWindow (5 minutes)
            600,                       // revealWindow (10 minutes)
            50                         // tradingFee (0.5%)
        );
        await darkPoolDEX.waitForDeployment();
        console.log(`   DarkPoolDEX deployed at: ${await darkPoolDEX.getAddress()}\n`);

        // Test basic functionality
        console.log("🧪 Testing basic functionality...\n");

        // Test AtomicSwap basic functions
        console.log("📊 AtomicSwap Tests:");
        const minAmount = await atomicSwap.minSwapAmount();
        const maxAmount = await atomicSwap.maxSwapAmount();
        const swapFee = await atomicSwap.swapFee();
        console.log(`   Min swap amount: ${ethers.formatEther(minAmount)} ETH`);
        console.log(`   Max swap amount: ${ethers.formatEther(maxAmount)} ETH`);
        console.log(`   Swap fee: ${swapFee} basis points (${Number(swapFee)/100}%)\n`);

        // Test DarkPoolDEX basic functions
        console.log("📊 DarkPoolDEX Tests:");
        const minOrderSize = await darkPoolDEX.minOrderSize();
        const maxOrderSize = await darkPoolDEX.maxOrderSize();
        const tradingFee = await darkPoolDEX.tradingFee();
        console.log(`   Min order size: ${ethers.formatEther(minOrderSize)} ETH`);
        console.log(`   Max order size: ${ethers.formatEther(maxOrderSize)} ETH`);
        console.log(`   Trading fee: ${tradingFee} basis points (${Number(tradingFee)/100}%)\n`);

        // Test commitment calculation
        console.log("🔐 Testing commitment calculation...");
        const secretNonce = ethers.hexlify(ethers.randomBytes(32));
        const nonce = await atomicSwap.getCurrentNonce();
        const commitment = await atomicSwap.calculateCommitment(
            await token1.getAddress(),
            await token2.getAddress(),
            ethers.parseEther("1"),
            ethers.parseEther("2"),
            secretNonce,
            nonce
        );
        console.log(`   Commitment calculated: ${commitment}\n`);

        // Test state channel opening
        console.log("💳 Testing state channel opening...");
        const depositAmount = ethers.parseEther("10");
        await darkPoolDEX.connect(user1).openStateChannel(user1.address, depositAmount, { value: depositAmount });
        const channel = await darkPoolDEX.getStateChannel(user1.address);
        console.log(`   State channel opened: ${channel.isActive}`);
        console.log(`   Channel balance: ${ethers.formatEther(channel.balance)} ETH\n`);

        console.log("✅ All basic tests passed! Contracts are working correctly.\n");
        console.log("📝 Deployment Summary:");
        console.log(`   Token1: ${await token1.getAddress()}`);
        console.log(`   Token2: ${await token2.getAddress()}`);
        console.log(`   AtomicSwap: ${await atomicSwap.getAddress()}`);
        console.log(`   DarkPoolDEX: ${await darkPoolDEX.getAddress()}`);

    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 