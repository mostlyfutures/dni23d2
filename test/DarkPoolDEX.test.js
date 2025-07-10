const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DarkPoolDEX", function () {
  let darkPoolDEX;
  let owner;
  let trader1;
  let trader2;
  let feeCollector;

  const MIN_ORDER_SIZE = ethers.parseEther("0.001");
  const MAX_ORDER_SIZE = ethers.parseEther("100");
  const COMMITMENT_WINDOW = 300; // 5 minutes
  const REVEAL_WINDOW = 600; // 10 minutes
  const TRADING_FEE = 50; // 0.5%

  beforeEach(async function () {
    [owner, trader1, trader2, feeCollector] = await ethers.getSigners();

    const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
    darkPoolDEX = await DarkPoolDEX.deploy(
      MIN_ORDER_SIZE,
      MAX_ORDER_SIZE,
      COMMITMENT_WINDOW,
      REVEAL_WINDOW,
      TRADING_FEE
    );
    // No .deployed() needed in ethers v6
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await darkPoolDEX.owner()).to.equal(owner.address);
    });

    it("Should set the correct parameters", async function () {
      expect(await darkPoolDEX.minOrderSize()).to.equal(MIN_ORDER_SIZE);
      expect(await darkPoolDEX.maxOrderSize()).to.equal(MAX_ORDER_SIZE);
      expect(await darkPoolDEX.commitmentWindow()).to.equal(COMMITMENT_WINDOW);
      expect(await darkPoolDEX.revealWindow()).to.equal(REVEAL_WINDOW);
      expect(await darkPoolDEX.tradingFee()).to.equal(TRADING_FEE);
    });

    it("Should set fee collector to owner", async function () {
      expect(await darkPoolDEX.feeCollector()).to.equal(owner.address);
    });
  });

  describe("Order Commitment", function () {
    it("Should allow committing an order", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(darkPoolDEX.connect(trader1).commitOrder(commitment))
        .to.emit(darkPoolDEX, "OrderCommitted");

      const order = await darkPoolDEX.getOrder(commitment);
      expect(order.trader).to.equal(trader1.address);
      expect(order.isRevealed).to.be.false;
      expect(order.isExecuted).to.be.false;
    });

    it("Should not allow committing zero commitment", async function () {
      await expect(darkPoolDEX.connect(trader1).commitOrder(ethers.ZeroHash))
        .to.be.revertedWith("Invalid commitment");
    });

    it("Should not allow committing same commitment twice", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await darkPoolDEX.connect(trader1).commitOrder(commitment);
      
      await expect(darkPoolDEX.connect(trader2).commitOrder(commitment))
        .to.be.revertedWith("Commitment already exists");
    });
  });

  describe("Order Revelation", function () {
    let commitment;
    let secretNonce;

    beforeEach(async function () {
      secretNonce = 12345;
      const tokenIn = ethers.ZeroAddress; // ETH
      const tokenOut = "0x1111111111111111111111111111111111111111"; // Mock USDC
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500"); // 1500 USDC
      const isBuy = true;

      // Use abi.encodePacked to match the contract
      commitment = ethers.keccak256(ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "bool", "uint256"],
        [tokenIn, tokenOut, amountIn, amountOut, isBuy, secretNonce]
      ));

      await darkPoolDEX.connect(trader1).commitOrder(commitment);
    });

    it("Should allow revealing an order", async function () {
      const tokenIn = ethers.ZeroAddress;
      const tokenOut = "0x1111111111111111111111111111111111111111";
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500");
      const isBuy = true;

      await expect(darkPoolDEX.connect(trader1).revealOrder(
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        secretNonce
      ))
        .to.emit(darkPoolDEX, "OrderRevealed")
        .withArgs(commitment, trader1.address, tokenIn, tokenOut, amountIn, amountOut, isBuy);

      const order = await darkPoolDEX.getOrder(commitment);
      expect(order.isRevealed).to.be.true;
      expect(order.tokenIn).to.equal(tokenIn);
      expect(order.tokenOut).to.equal(tokenOut);
      expect(order.amountIn).to.equal(amountIn);
      expect(order.amountOut).to.equal(amountOut);
      expect(order.isBuy).to.equal(isBuy);
    });

    it("Should not allow revealing with invalid commitment", async function () {
      const tokenIn = ethers.ZeroAddress;
      const tokenOut = "0x1111111111111111111111111111111111111111";
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500");
      const isBuy = true;
      const wrongNonce = 54321;

      await expect(darkPoolDEX.connect(trader1).revealOrder(
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        wrongNonce
      ))
        .to.be.revertedWith("Invalid commitment");
    });

    it("Should not allow revealing twice", async function () {
      const tokenIn = ethers.ZeroAddress;
      const tokenOut = "0x1111111111111111111111111111111111111111";
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500");
      const isBuy = true;

      await darkPoolDEX.connect(trader1).revealOrder(
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        secretNonce
      );

      await expect(darkPoolDEX.connect(trader1).revealOrder(
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        secretNonce
      ))
        .to.be.revertedWith("Order already revealed");
    });

    it("Should not allow revealing after window expires", async function () {
      // Fast forward time past reveal window
      await ethers.provider.send("evm_increaseTime", [REVEAL_WINDOW + 1]);
      await ethers.provider.send("evm_mine");

      const tokenIn = ethers.ZeroAddress;
      const tokenOut = "0x1111111111111111111111111111111111111111";
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500");
      const isBuy = true;

      await expect(darkPoolDEX.connect(trader1).revealOrder(
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        secretNonce
      ))
        .to.be.revertedWith("Reveal window expired");
    });
  });

  describe("State Channels", function () {
    it("Should allow opening a state channel", async function () {
      const initialBalance = ethers.parseEther("10");
      
      await expect(darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance }))
        .to.emit(darkPoolDEX, "StateChannelOpened")
        .withArgs(trader1.address, initialBalance, 0);

      const channel = await darkPoolDEX.getStateChannel(trader1.address);
      expect(channel.trader).to.equal(trader1.address);
      expect(channel.balance).to.equal(initialBalance);
      expect(channel.isActive).to.be.true;
    });

    it("Should not allow opening channel with insufficient deposit", async function () {
      const initialBalance = ethers.parseEther("10");
      const deposit = ethers.parseEther("5");
      
      await expect(darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: deposit }))
        .to.be.revertedWith("Insufficient deposit");
    });

    it("Should not allow opening duplicate channel", async function () {
      const initialBalance = ethers.parseEther("10");
      
      await darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance });
      
      await expect(darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance }))
        .to.be.revertedWith("Channel already active");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set trading fee", async function () {
      const newFee = 100; // 1%
      await darkPoolDEX.setTradingFee(newFee);
      expect(await darkPoolDEX.tradingFee()).to.equal(newFee);
    });

    it("Should not allow non-owner to set trading fee", async function () {
      const newFee = 100;
      await expect(darkPoolDEX.connect(trader1).setTradingFee(newFee))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow setting fee too high", async function () {
      const newFee = 1001; // > 10%
      await expect(darkPoolDEX.setTradingFee(newFee))
        .to.be.revertedWith("Fee too high");
    });

    it("Should allow owner to pause and unpause", async function () {
      await darkPoolDEX.pause();
      expect(await darkPoolDEX.paused()).to.be.true;

      await darkPoolDEX.unpause();
      expect(await darkPoolDEX.paused()).to.be.false;
    });
  });

  describe("Utility Functions", function () {
    it("Should calculate commitment correctly", async function () {
      const tokenIn = ethers.ZeroAddress;
      const tokenOut = "0x1111111111111111111111111111111111111111";
      const amountIn = ethers.parseEther("1");
      const amountOut = ethers.parseEther("1500");
      const isBuy = true;
      const secretNonce = 12345;

      // Use abi.encodePacked to match the contract
      const expectedCommitment = ethers.keccak256(ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "bool", "uint256"],
        [tokenIn, tokenOut, amountIn, amountOut, isBuy, secretNonce]
      ));

      const calculatedCommitment = await darkPoolDEX.calculateCommitment(
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        isBuy,
        secretNonce
      );

      expect(calculatedCommitment).to.equal(expectedCommitment);
    });
  });
});

// Helper function to get current block timestamp
async function time() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
} 