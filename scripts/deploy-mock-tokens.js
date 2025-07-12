const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying mock tokens with account:", deployer.address);

  const initialSupply = ethers.parseUnits("1000000", 18); // 1,000,000 tokens

  const tokens = [
    { name: "USD Coin", symbol: "USDC" },
    { name: "Tether USD", symbol: "USDT" },
    { name: "Dai Stablecoin", symbol: "DAI" }
  ];

  const addresses = {};

  for (const token of tokens) {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const contract = await MockERC20.deploy(token.name, token.symbol, initialSupply);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    addresses[token.symbol] = address;
    console.log(`${token.symbol} deployed at: ${address}`);
  }

  // Save addresses to a file for frontend use
  const fs = require('fs');
  fs.writeFileSync('mock-token-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\nToken addresses saved to mock-token-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 