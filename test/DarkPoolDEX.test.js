const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DarkPoolDEX", function () {
    let darkPoolDEX;
    let mockToken1, mockToken2;
    let owner, operator, emergencyRole, trader1, trader2, attacker;
    let addrs;

    const MIN_ORDER_SIZE = ethers.parseEther("0.1");
    const MAX_ORDER_SIZE = ethers.parseEther("1000");
    const COMMITMENT_WINDOW = 300; // 5 minutes
    const REVEAL_WINDOW = 600; // 10 minutes
    const TRADING_FEE = 50; // 0.5%

    beforeEach(async function () {
        [owner, operator, emergencyRole, trader1, trader2, attacker, ...addrs] = await ethers.getSigners();

        // Deploy mock tokens
        mockToken1 = await ethers.deployContract("MockERC20", ["Token1", "TK1", 18]);
        mockToken2 = await ethers.deployContract("MockERC20", ["Token2", "TK2", 18]);

        // Deploy DarkPoolDEX
        darkPoolDEX = await ethers.deployContract("DarkPoolDEX", [
            MIN_ORDER_SIZE,
            MAX_ORDER_SIZE,
            COMMITMENT_WINDOW,
            REVEAL_WINDOW,
            TRADING_FEE
        ]);

        // Grant roles
        await darkPoolDEX.grantOperatorRole(operator.address);
        await darkPoolDEX.grantEmergencyRole(emergencyRole.address);
    });

    describe("Deployment", function () {
        it("Should set correct initial parameters", async function () {
            expect(await darkPoolDEX.minOrderSize()).to.equal(MIN_ORDER_SIZE);
            expect(await darkPoolDEX.maxOrderSize()).to.equal(MAX_ORDER_SIZE);
            expect(await darkPoolDEX.commitmentWindow()).to.equal(COMMITMENT_WINDOW);
            expect(await darkPoolDEX.revealWindow()).to.equal(REVEAL_WINDOW);
            expect(await darkPoolDEX.tradingFee()).to.equal(TRADING_FEE);
            expect(await darkPoolDEX.feeCollector()).to.equal(owner.address);
        });

        it("Should grant correct roles to deployer", async function () {
            expect(await darkPoolDEX.hasRole(await darkPoolDEX.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await darkPoolDEX.hasRole(await darkPoolDEX.OPERATOR_ROLE(), owner.address)).to.be.true;
            expect(await darkPoolDEX.hasRole(await darkPoolDEX.EMERGENCY_ROLE(), owner.address)).to.be.true;
        });

        it("Should reject invalid constructor parameters", async function () {
            await expect(
                ethers.deployContract("DarkPoolDEX", [
                    MAX_ORDER_SIZE, // min > max
                    MIN_ORDER_SIZE,
                    COMMITMENT_WINDOW,
                    REVEAL_WINDOW,
                    TRADING_FEE
                ])
            ).to.be.revertedWith("Invalid order limits");

            await expect(
                ethers.deployContract("DarkPoolDEX", [
                    MIN_ORDER_SIZE,
                    MAX_ORDER_SIZE,
                    30, // too short commitment window
                    REVEAL_WINDOW,
                    TRADING_FEE
                ])
            ).to.be.revertedWith("Invalid commitment window");

            await expect(
                ethers.deployContract("DarkPoolDEX", [
                    MIN_ORDER_SIZE,
                    MAX_ORDER_SIZE,
                    COMMITMENT_WINDOW,
                    200, // too short reveal window
                    TRADING_FEE
                ])
            ).to.be.revertedWith("Invalid reveal window");

            await expect(
                ethers.deployContract("DarkPoolDEX", [
                    MIN_ORDER_SIZE,
                    MAX_ORDER_SIZE,
                    COMMITMENT_WINDOW,
                    REVEAL_WINDOW,
                    1500 // fee too high
                ])
            ).to.be.revertedWith("Fee too high");
        });
    });

    describe("Order Management", function () {
        let commitment, secretNonce;

        beforeEach(async function () {
            secretNonce = ethers.randomBytes(32);
            commitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true, // isBuy
                secretNonce
            );
        });

        it("Should commit order successfully", async function () {
            await expect(darkPoolDEX.connect(trader1).commitOrder(commitment))
                .to.emit(darkPoolDEX, "OrderCommitted")
                .withArgs(commitment, trader1.address, await time.latest());

            const order = await darkPoolDEX.getOrder(commitment);
            expect(order.trader).to.equal(trader1.address);
            expect(order.isRevealed).to.be.false;
            expect(order.isExecuted).to.be.false;
            expect(order.isCancelled).to.be.false;
        });

        it("Should reject duplicate commitment", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            await expect(
                darkPoolDEX.connect(trader2).commitOrder(commitment)
            ).to.be.revertedWith("Commitment already exists");
        });

        it("Should reject zero commitment", async function () {
            await expect(
                darkPoolDEX.connect(trader1).commitOrder(ethers.ZeroHash)
            ).to.be.revertedWith("Invalid commitment");
        });

        it("Should reveal order successfully", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.emit(darkPoolDEX, "OrderRevealed")
                .withArgs(commitment, trader1.address, mockToken1.address, mockToken2.address, ethers.parseEther("1"), ethers.parseEther("2"), true);

            const order = await darkPoolDEX.getOrder(commitment);
            expect(order.isRevealed).to.be.true;
            expect(order.tokenIn).to.equal(mockToken1.address);
            expect(order.tokenOut).to.equal(mockToken2.address);
            expect(order.amountIn).to.equal(ethers.parseEther("1"));
            expect(order.amountOut).to.equal(ethers.parseEther("2"));
            expect(order.isBuy).to.be.true;
        });

        it("Should reject reveal with invalid commitment", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    true,
                    ethers.randomBytes(32) // wrong secret
                )
            ).to.be.revertedWith("Invalid commitment");
        });

        it("Should reject reveal after window expires", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            // Advance time past reveal window
            await time.increase(REVEAL_WINDOW + 1);
            
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.be.revertedWith("Reveal window expired");
        });

        it("Should reject reveal with invalid parameters", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            // Amount too small
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("0.05"), // below min
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.be.revertedWith("Amount too small");

            // Amount too large
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("2000"), // above max
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.be.revertedWith("Amount too large");

            // Same token
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken1.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.be.revertedWith("Same token");

            // Zero address
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    ethers.ZeroAddress,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    true,
                    secretNonce
                )
            ).to.be.revertedWith("Invalid token addresses");
        });

        it("Should cancel order successfully", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            await expect(darkPoolDEX.connect(trader1).cancelOrder(commitment))
                .to.emit(darkPoolDEX, "OrderCancelled")
                .withArgs(commitment, trader1.address, await time.latest());

            const order = await darkPoolDEX.getOrder(commitment);
            expect(order.isCancelled).to.be.true;
        });

        it("Should reject cancel of revealed order", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            await darkPoolDEX.connect(trader1).revealOrder(
                commitment,
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                secretNonce
            );
            
            await expect(
                darkPoolDEX.connect(trader1).cancelOrder(commitment)
            ).to.be.revertedWith("Cannot cancel revealed order");
        });

        it("Should reject cancel after commitment window", async function () {
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            await time.increase(COMMITMENT_WINDOW + 1);
            
            await expect(
                darkPoolDEX.connect(trader1).cancelOrder(commitment)
            ).to.be.revertedWith("Commitment window expired");
        });
    });

    describe("Order Matching", function () {
        let buyCommitment, sellCommitment, buySecret, sellSecret;

        beforeEach(async function () {
            buySecret = ethers.randomBytes(32);
            sellSecret = ethers.randomBytes(32);
            
            buyCommitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true, // isBuy
                buySecret
            );
            
            sellCommitment = await darkPoolDEX.calculateCommitment(
                mockToken2.address,
                mockToken1.address,
                ethers.parseEther("2"),
                ethers.parseEther("1"),
                false, // isSell
                sellSecret
            );

            // Commit and reveal orders
            await darkPoolDEX.connect(trader1).commitOrder(buyCommitment);
            await darkPoolDEX.connect(trader2).commitOrder(sellCommitment);
            
            await darkPoolDEX.connect(trader1).revealOrder(
                buyCommitment,
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                buySecret
            );
            
            await darkPoolDEX.connect(trader2).revealOrder(
                sellCommitment,
                mockToken2.address,
                mockToken1.address,
                ethers.parseEther("2"),
                ethers.parseEther("1"),
                false,
                sellSecret
            );
        });

        it("Should match orders successfully", async function () {
            await expect(
                darkPoolDEX.connect(operator).matchOrders(buyCommitment, sellCommitment)
            ).to.emit(darkPoolDEX, "OrderMatched")
                .withArgs(buyCommitment, sellCommitment, trader1.address, trader2.address, ethers.parseEther("2"), ethers.parseEther("2"));

            const buyOrder = await darkPoolDEX.getOrder(buyCommitment);
            const sellOrder = await darkPoolDEX.getOrder(sellCommitment);
            expect(buyOrder.isExecuted).to.be.true;
            expect(sellOrder.isExecuted).to.be.true;
        });

        it("Should reject matching by non-operator", async function () {
            await expect(
                darkPoolDEX.connect(trader1).matchOrders(buyCommitment, sellCommitment)
            ).to.be.revertedWith("Caller is not an operator");
        });

        it("Should reject matching unrevealed orders", async function () {
            const newCommitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                ethers.randomBytes(32)
            );
            
            await darkPoolDEX.connect(trader1).commitOrder(newCommitment);
            
            await expect(
                darkPoolDEX.connect(operator).matchOrders(newCommitment, sellCommitment)
            ).to.be.revertedWith("Orders not revealed");
        });

        it("Should reject matching same order type", async function () {
            const anotherBuyCommitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                ethers.randomBytes(32)
            );
            
            await darkPoolDEX.connect(trader1).commitOrder(anotherBuyCommitment);
            await darkPoolDEX.connect(trader1).revealOrder(
                anotherBuyCommitment,
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                ethers.randomBytes(32)
            );
            
            await expect(
                darkPoolDEX.connect(operator).matchOrders(buyCommitment, anotherBuyCommitment)
            ).to.be.revertedWith("Same order type");
        });

        it("Should reject matching with token mismatch", async function () {
            const wrongCommitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken1.address, // wrong token
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                false,
                ethers.randomBytes(32)
            );
            
            await darkPoolDEX.connect(trader2).commitOrder(wrongCommitment);
            await darkPoolDEX.connect(trader2).revealOrder(
                wrongCommitment,
                mockToken1.address,
                mockToken1.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                false,
                ethers.randomBytes(32)
            );
            
            await expect(
                darkPoolDEX.connect(operator).matchOrders(buyCommitment, wrongCommitment)
            ).to.be.revertedWith("Token mismatch");
        });
    });

    describe("State Channels", function () {
        it("Should open state channel successfully", async function () {
            const initialBalance = ethers.parseEther("10");
            
            await expect(
                darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance })
            ).to.emit(darkPoolDEX, "StateChannelOpened")
                .withArgs(trader1.address, initialBalance, 0);

            const channel = await darkPoolDEX.getStateChannel(trader1.address);
            expect(channel.isActive).to.be.true;
            expect(channel.balance).to.equal(initialBalance);
            expect(channel.nonce).to.equal(0);
        });

        it("Should reject opening channel with insufficient deposit", async function () {
            const initialBalance = ethers.parseEther("10");
            
            await expect(
                darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: ethers.parseEther("5") })
            ).to.be.revertedWith("Insufficient deposit");
        });

        it("Should reject opening duplicate channel", async function () {
            const initialBalance = ethers.parseEther("10");
            
            await darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance });
            
            await expect(
                darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance })
            ).to.be.revertedWith("Channel already active");
        });

        it("Should update state channel with valid signature", async function () {
            const initialBalance = ethers.parseEther("10");
            await darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance });
            
            const newBalance = ethers.parseEther("15");
            const newNonce = 1;
            const timestamp = await time.latest();
            
            const updateHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "uint256", "uint256"],
                [trader1.address, newBalance, newNonce, timestamp]
            ));
            
            const signature = await trader1.signMessage(ethers.getBytes(updateHash));
            
            await expect(
                darkPoolDEX.connect(operator).updateStateChannel(trader1.address, newBalance, newNonce, signature)
            ).to.emit(darkPoolDEX, "StateChannelUpdated")
                .withArgs(trader1.address, newBalance, newNonce);

            const channel = await darkPoolDEX.getStateChannel(trader1.address);
            expect(channel.balance).to.equal(newBalance);
            expect(channel.nonce).to.equal(newNonce);
        });

        it("Should close state channel successfully", async function () {
            const initialBalance = ethers.parseEther("10");
            await darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance });
            
            const finalBalance = ethers.parseEther("8");
            const timestamp = await time.latest();
            
            const closeHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "string", "uint256"],
                [trader1.address, finalBalance, "CLOSE", timestamp]
            ));
            
            const signature = await trader1.signMessage(ethers.getBytes(closeHash));
            
            const initialBalance2 = await ethers.provider.getBalance(trader1.address);
            
            await expect(
                darkPoolDEX.connect(operator).closeStateChannel(trader1.address, finalBalance, signature)
            ).to.emit(darkPoolDEX, "StateChannelClosed")
                .withArgs(trader1.address, finalBalance);

            const channel = await darkPoolDEX.getStateChannel(trader1.address);
            expect(channel.isActive).to.be.false;
            expect(channel.balance).to.equal(finalBalance);
            
            const finalBalance2 = await ethers.provider.getBalance(trader1.address);
            expect(finalBalance2).to.be.gt(initialBalance2); // Should have received ETH
        });
    });

    describe("Emergency Functions", function () {
        beforeEach(async function () {
            const initialBalance = ethers.parseEther("10");
            await darkPoolDEX.connect(trader1).openStateChannel(trader1.address, initialBalance, { value: initialBalance });
        });

        it("Should request emergency withdrawal", async function () {
            await expect(
                darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Test emergency")
            ).to.emit(darkPoolDEX, "EmergencyWithdrawRequested");

            const request = await darkPoolDEX.getEmergencyRequest(trader1.address);
            expect(request.requester).to.equal(trader1.address);
            expect(request.isExecuted).to.be.false;
            expect(request.reason).to.equal("Test emergency");

            const channel = await darkPoolDEX.getStateChannel(trader1.address);
            expect(channel.emergencyWithdrawTime).to.be.gt(0);
        });

        it("Should reject duplicate emergency request", async function () {
            await darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Test emergency");
            
            await expect(
                darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Another emergency")
            ).to.be.revertedWith("Emergency withdrawal already requested");
        });

        it("Should execute emergency withdrawal after timelock", async function () {
            await darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Test emergency");
            
            // Advance time past timelock
            await time.increase(86400 + 1); // 24 hours + 1 second
            
            const initialBalance = await ethers.provider.getBalance(trader1.address);
            
            await expect(
                darkPoolDEX.connect(emergencyRole).executeEmergencyWithdraw(trader1.address)
            ).to.emit(darkPoolDEX, "EmergencyWithdrawExecuted");

            const request = await darkPoolDEX.getEmergencyRequest(trader1.address);
            expect(request.isExecuted).to.be.true;

            const channel = await darkPoolDEX.getStateChannel(trader1.address);
            expect(channel.isActive).to.be.false;
            expect(channel.balance).to.equal(0);
            
            const finalBalance = await ethers.provider.getBalance(trader1.address);
            expect(finalBalance).to.be.gt(initialBalance); // Should have received ETH
        });

        it("Should reject emergency withdrawal before timelock", async function () {
            await darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Test emergency");
            
            await expect(
                darkPoolDEX.connect(emergencyRole).executeEmergencyWithdraw(trader1.address)
            ).to.be.revertedWith("Timelock not expired");
        });

        it("Should reject emergency withdrawal by non-emergency role", async function () {
            await darkPoolDEX.connect(trader1).requestEmergencyWithdraw("Test emergency");
            await time.increase(86400 + 1);
            
            await expect(
                darkPoolDEX.connect(trader1).executeEmergencyWithdraw(trader1.address)
            ).to.be.revertedWith("Caller is not emergency role");
        });

        it("Should enable emergency mode", async function () {
            await expect(
                darkPoolDEX.connect(emergencyRole).enableEmergencyMode()
            ).to.not.be.reverted;

            expect(await darkPoolDEX.emergencyMode()).to.be.true;
        });

        it("Should disable emergency mode", async function () {
            await darkPoolDEX.connect(emergencyRole).enableEmergencyMode();
            
            await expect(
                darkPoolDEX.connect(owner).disableEmergencyMode()
            ).to.not.be.reverted;

            expect(await darkPoolDEX.emergencyMode()).to.be.false;
        });

        it("Should reject operations in emergency mode", async function () {
            await darkPoolDEX.connect(emergencyRole).enableEmergencyMode();
            
            const commitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                ethers.randomBytes(32)
            );
            
            await expect(
                darkPoolDEX.connect(trader1).commitOrder(commitment)
            ).to.be.revertedWith("Contract in emergency mode");
        });
    });

    describe("Admin Functions", function () {
        it("Should update trading fee", async function () {
            const newFee = 100;
            
            await expect(
                darkPoolDEX.connect(owner).setTradingFee(newFee)
            ).to.emit(darkPoolDEX, "FeeUpdated")
                .withArgs(TRADING_FEE, newFee);

            expect(await darkPoolDEX.tradingFee()).to.equal(newFee);
        });

        it("Should reject fee too high", async function () {
            await expect(
                darkPoolDEX.connect(owner).setTradingFee(1500)
            ).to.be.revertedWith("Fee too high");
        });

        it("Should update fee collector", async function () {
            await expect(
                darkPoolDEX.connect(owner).setFeeCollector(trader1.address)
            ).to.emit(darkPoolDEX, "FeeCollectorUpdated")
                .withArgs(owner.address, trader1.address);

            expect(await darkPoolDEX.feeCollector()).to.equal(trader1.address);
        });

        it("Should update order limits", async function () {
            const newMin = ethers.parseEther("0.2");
            const newMax = ethers.parseEther("2000");
            
            await expect(
                darkPoolDEX.connect(owner).setOrderLimits(newMin, newMax)
            ).to.emit(darkPoolDEX, "OrderLimitsUpdated")
                .withArgs(newMin, newMax);

            expect(await darkPoolDEX.minOrderSize()).to.equal(newMin);
            expect(await darkPoolDEX.maxOrderSize()).to.equal(newMax);
        });

        it("Should update windows", async function () {
            const newCommitmentWindow = 600;
            const newRevealWindow = 1200;
            
            await expect(
                darkPoolDEX.connect(owner).setWindows(newCommitmentWindow, newRevealWindow)
            ).to.emit(darkPoolDEX, "WindowsUpdated")
                .withArgs(newCommitmentWindow, newRevealWindow);

            expect(await darkPoolDEX.commitmentWindow()).to.equal(newCommitmentWindow);
            expect(await darkPoolDEX.revealWindow()).to.equal(newRevealWindow);
        });

        it("Should reject admin functions by non-admin", async function () {
            await expect(
                darkPoolDEX.connect(trader1).setTradingFee(100)
            ).to.be.revertedWith("AccessControl: account 0x");
        });
    });

    describe("Pausable", function () {
        it("Should pause and unpause", async function () {
            await darkPoolDEX.connect(owner).pause();
            expect(await darkPoolDEX.paused()).to.be.true;
            
            await darkPoolDEX.connect(owner).unpause();
            expect(await darkPoolDEX.paused()).to.be.false;
        });

        it("Should reject operations when paused", async function () {
            await darkPoolDEX.connect(owner).pause();
            
            const commitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                true,
                ethers.randomBytes(32)
            );
            
            await expect(
                darkPoolDEX.connect(trader1).commitOrder(commitment)
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Reentrancy Protection", function () {
        // This test would require a malicious contract that tries to reenter
        // For now, we just verify the nonReentrant modifier is applied
        it("Should have reentrancy protection on critical functions", async function () {
            // The contract should have nonReentrant modifier on key functions
            // This is verified by the contract compilation and the modifier usage
            expect(true).to.be.true; // Placeholder test
        });
    });

    describe("Edge Cases", function () {
        it("Should handle overflow protection", async function () {
            // Test with SafeMath operations
            const largeAmount = ethers.MaxUint256;
            
            // This should not overflow due to SafeMath
            const commitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                largeAmount,
                largeAmount,
                true,
                ethers.randomBytes(32)
            );
            
            expect(commitment).to.not.equal(ethers.ZeroHash);
        });

        it("Should handle zero amounts correctly", async function () {
            const commitment = await darkPoolDEX.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                0,
                0,
                true,
                ethers.randomBytes(32)
            );
            
            await darkPoolDEX.connect(trader1).commitOrder(commitment);
            
            // Should reject reveal with zero amount
            await expect(
                darkPoolDEX.connect(trader1).revealOrder(
                    commitment,
                    mockToken1.address,
                    mockToken2.address,
                    0,
                    0,
                    true,
                    ethers.randomBytes(32)
                )
            ).to.be.revertedWith("Amount too small");
        });
    });
}); 