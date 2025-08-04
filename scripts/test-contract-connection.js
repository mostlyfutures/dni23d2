const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Testing Contract Connection...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log("👤 Using account:", deployer.address);
  
  // Contract address from deployment
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  console.log("📋 Contract address:", contractAddress);
  
  // Get the contract factory
  const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
  
  // Attach to the deployed contract
  const contract = DarkPoolDEX.attach(contractAddress);
  
  try {
    // Test basic contract functions
    console.log("\n🔍 Testing contract functions...");
    
    // Get contract parameters (these are public state variables)
    const minOrderSize = await contract.minOrderSize();
    const maxOrderSize = await contract.maxOrderSize();
    const commitmentWindow = await contract.commitmentWindow();
    const revealWindow = await contract.revealWindow();
    const tradingFee = await contract.tradingFee();
    const feeCollector = await contract.feeCollector();
    const orderNonce = await contract.orderNonce();
    
    console.log("✅ Contract parameters:");
    console.log("   - Min Order Size:", ethers.formatEther(minOrderSize), "ETH");
    console.log("   - Max Order Size:", ethers.formatEther(maxOrderSize), "ETH");
    console.log("   - Commitment Window:", commitmentWindow.toString(), "seconds");
    console.log("   - Reveal Window:", revealWindow.toString(), "seconds");
    console.log("   - Trading Fee:", tradingFee.toString(), "basis points");
    console.log("   - Fee Collector:", feeCollector);
    console.log("   - Order Nonce:", orderNonce.toString());
    
    // Test calculateCommitment function
    console.log("\n🧮 Testing calculateCommitment function...");
    const tokenIn = "0x0000000000000000000000000000000000000000"; // ETH
    const tokenOut = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // QNT
    const amountIn = ethers.parseEther("1.0");
    const amountOut = ethers.parseEther("100.0");
    const isBuy = true;
    const secretNonce = 12345;
    
    const commitment = await contract.calculateCommitment(
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      isBuy,
      secretNonce
    );
    
    console.log("✅ Commitment calculated:", commitment);
    
    // Test getting an order (should return empty order for non-existent commitment)
    console.log("\n📋 Testing getOrder function...");
    const order = await contract.getOrder(commitment);
    console.log("✅ Order retrieved (should be empty):", {
      trader: order.trader,
      isRevealed: order.isRevealed,
      isExecuted: order.isExecuted
    });
    
    console.log("✅ Contract connection successful!");
    
  } catch (error) {
    console.error("❌ Contract test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 