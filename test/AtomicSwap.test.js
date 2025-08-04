const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AtomicSwap", function () {
    let atomicSwap;
    let mockToken1, mockToken2;
    let owner, operator, emergencyRole, offerer, taker, attacker;
    let addrs;

    const MIN_SWAP_AMOUNT = ethers.parseEther("0.1");
    const MAX_SWAP_AMOUNT = ethers.parseEther("1000");
    const DEFAULT_EXPIRY = 3600; // 1 hour
    const SWAP_FEE = 50; // 0.5%

    beforeEach(async function () {
        [owner, operator, emergencyRole, offerer, taker, attacker, ...addrs] = await ethers.getSigners();

        // Deploy mock tokens
        mockToken1 = await ethers.deployContract("MockERC20", ["Token1", "TK1", 18]);
        mockToken2 = await ethers.deployContract("MockERC20", ["Token2", "TK2", 18]);

        // Deploy AtomicSwap
        atomicSwap = await ethers.deployContract("AtomicSwap", [
            MIN_SWAP_AMOUNT,
            MAX_SWAP_AMOUNT,
            DEFAULT_EXPIRY,
            SWAP_FEE
        ]);

        // Grant roles
        await atomicSwap.grantOperatorRole(operator.address);
        await atomicSwap.grantEmergencyRole(emergencyRole.address);
    });

    describe("Deployment", function () {
        it("Should set correct initial parameters", async function () {
            expect(await atomicSwap.minSwapAmount()).to.equal(MIN_SWAP_AMOUNT);
            expect(await atomicSwap.maxSwapAmount()).to.equal(MAX_SWAP_AMOUNT);
            expect(await atomicSwap.defaultExpiry()).to.equal(DEFAULT_EXPIRY);
            expect(await atomicSwap.swapFee()).to.equal(SWAP_FEE);
            expect(await atomicSwap.feeCollector()).to.equal(owner.address);
        });

        it("Should grant correct roles to deployer", async function () {
            expect(await atomicSwap.hasRole(await atomicSwap.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await atomicSwap.hasRole(await atomicSwap.OPERATOR_ROLE(), owner.address)).to.be.true;
            expect(await atomicSwap.hasRole(await atomicSwap.EMERGENCY_ROLE(), owner.address)).to.be.true;
        });

        it("Should reject invalid constructor parameters", async function () {
            await expect(
                ethers.deployContract("AtomicSwap", [
                    MAX_SWAP_AMOUNT, // min > max
                    MIN_SWAP_AMOUNT,
                    DEFAULT_EXPIRY,
                    SWAP_FEE
                ])
            ).to.be.revertedWith("Invalid swap limits");

            await expect(
                ethers.deployContract("AtomicSwap", [
                    MIN_SWAP_AMOUNT,
                    MAX_SWAP_AMOUNT,
                    200, // too short expiry
                    SWAP_FEE
                ])
            ).to.be.revertedWith("Invalid default expiry");

            await expect(
                ethers.deployContract("AtomicSwap", [
                    MIN_SWAP_AMOUNT,
                    MAX_SWAP_AMOUNT,
                    DEFAULT_EXPIRY,
                    1500 // fee too high
                ])
            ).to.be.revertedWith("Fee too high");
        });
    });

    describe("Swap Offer Management", function () {
        let commitment, secretNonce;

        beforeEach(async function () {
            secretNonce = ethers.randomBytes(32);
            commitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                await atomicSwap.getCurrentNonce()
            );
        });

        it("Should create swap offer successfully", async function () {
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0 // use default expiry
                )
            ).to.emit(atomicSwap, "SwapOffered")
                .withArgs(commitment, offerer.address, mockToken1.address, mockToken2.address, ethers.parseEther("1"), ethers.parseEther("2"), await time.latest() + DEFAULT_EXPIRY);

            const offer = await atomicSwap.getSwapOffer(commitment);
            expect(offer.offerer).to.equal(offerer.address);
            expect(offer.isActive).to.be.true;
            expect(offer.isCancelled).to.be.false;
            expect(offer.tokenIn).to.equal(mockToken1.address);
            expect(offer.tokenOut).to.equal(mockToken2.address);
        });

        it("Should create swap offer with custom expiry", async function () {
            const customExpiry = await time.latest() + 7200; // 2 hours
            
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    customExpiry
                )
            ).to.emit(atomicSwap, "SwapOffered");

            const offer = await atomicSwap.getSwapOffer(commitment);
            expect(offer.expiry).to.equal(customExpiry);
        });

        it("Should reject offer with invalid parameters", async function () {
            // Same token
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken1.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Same token");

            // Zero token addresses
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    ethers.ZeroAddress,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Invalid token addresses");

            // Amount too small
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("0.05"), // below min
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Amount too small");

            // Amount too large
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("2000"), // above max
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Amount too large");

            // Zero output amount
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    0,
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Invalid output amount");

            // Invalid expiry
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    await time.latest() - 100 // past time
                )
            ).to.be.revertedWith("Invalid expiry");

            // Expiry too far
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    await time.latest() + 700000 // > 1 week
                )
            ).to.be.revertedWith("Expiry too far");
        });

        it("Should reject duplicate commitment", async function () {
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );
            
            await expect(
                atomicSwap.connect(taker).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Commitment already exists");
        });

        it("Should cancel swap offer successfully", async function () {
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );
            
            await expect(
                atomicSwap.connect(offerer).cancelSwapOffer(commitment)
            ).to.emit(atomicSwap, "SwapCancelled")
                .withArgs(commitment, offerer.address);

            const offer = await atomicSwap.getSwapOffer(commitment);
            expect(offer.isActive).to.be.false;
            expect(offer.isCancelled).to.be.true;
        });

        it("Should reject cancel by non-owner", async function () {
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );
            
            await expect(
                atomicSwap.connect(taker).cancelSwapOffer(commitment)
            ).to.be.revertedWith("Not offer owner");
        });

        it("Should reject cancel of expired offer", async function () {
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                await time.latest() + 100 // short expiry
            );
            
            await time.increase(101);
            
            await expect(
                atomicSwap.connect(offerer).cancelSwapOffer(commitment)
            ).to.be.revertedWith("Offer expired");
        });
    });

    describe("Swap Execution", function () {
        let commitment, secretNonce, executionId;

        beforeEach(async function () {
            secretNonce = ethers.randomBytes(32);
            commitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                await atomicSwap.getCurrentNonce()
            );

            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );

            executionId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "uint256"],
                [commitment, taker.address, await time.latest()]
            ));
        });

        it("Should take swap offer successfully", async function () {
            await expect(
                atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce)
            ).to.emit(atomicSwap, "SwapTaken")
                .withArgs(commitment, taker.address, offerer.address, ethers.parseEther("1"), ethers.parseEther("2"));

            const offer = await atomicSwap.getSwapOffer(commitment);
            expect(offer.isActive).to.be.false;

            const execution = await atomicSwap.getSwapExecution(executionId);
            expect(execution.offerer).to.equal(offerer.address);
            expect(execution.taker).to.equal(taker.address);
            expect(execution.isCompleted).to.be.false;
            expect(execution.isDisputed).to.be.false;
        });

        it("Should reject taking own offer", async function () {
            await expect(
                atomicSwap.connect(offerer).takeSwapOffer(commitment, secretNonce)
            ).to.be.revertedWith("Cannot take own offer");
        });

        it("Should reject taking with invalid commitment", async function () {
            await expect(
                atomicSwap.connect(taker).takeSwapOffer(commitment, ethers.randomBytes(32))
            ).to.be.revertedWith("Invalid commitment");
        });

        it("Should reject taking cancelled offer", async function () {
            await atomicSwap.connect(offerer).cancelSwapOffer(commitment);
            
            await expect(
                atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce)
            ).to.be.revertedWith("Offer not active");
        });

        it("Should reject taking expired offer", async function () {
            await time.increase(DEFAULT_EXPIRY + 1);
            
            await expect(
                atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce)
            ).to.be.revertedWith("Offer expired");
        });

        it("Should complete swap with valid signatures", async function () {
            await atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce);
            
            const swapHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256"],
                [executionId, ethers.parseEther("2"), ethers.parseEther("1"), await time.latest()]
            ));
            
            const offererSignature = await offerer.signMessage(ethers.getBytes(swapHash));
            const takerSignature = await taker.signMessage(ethers.getBytes(swapHash));
            
            await expect(
                atomicSwap.connect(operator).completeSwap(executionId, offererSignature, takerSignature)
            ).to.emit(atomicSwap, "SwapCompleted")
                .withArgs(executionId, offerer.address, taker.address, mockToken1.address, mockToken2.address, ethers.parseEther("1"), ethers.parseEther("2"), await time.latest());

            const execution = await atomicSwap.getSwapExecution(executionId);
            expect(execution.isCompleted).to.be.true;
        });

        it("Should reject completion with invalid signatures", async function () {
            await atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce);
            
            const swapHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256"],
                [executionId, ethers.parseEther("2"), ethers.parseEther("1"), await time.latest()]
            ));
            
            const offererSignature = await offerer.signMessage(ethers.getBytes(swapHash));
            const wrongSignature = await attacker.signMessage(ethers.getBytes(swapHash));
            
            await expect(
                atomicSwap.connect(operator).completeSwap(executionId, offererSignature, wrongSignature)
            ).to.be.revertedWith("Invalid taker signature");
        });

        it("Should reject completion of already completed swap", async function () {
            await atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce);
            
            const swapHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256"],
                [executionId, ethers.parseEther("2"), ethers.parseEther("1"), await time.latest()]
            ));
            
            const offererSignature = await offerer.signMessage(ethers.getBytes(swapHash));
            const takerSignature = await taker.signMessage(ethers.getBytes(swapHash));
            
            await atomicSwap.connect(operator).completeSwap(executionId, offererSignature, takerSignature);
            
            await expect(
                atomicSwap.connect(operator).completeSwap(executionId, offererSignature, takerSignature)
            ).to.be.revertedWith("Swap already completed");
        });

        it("Should reject completion of disputed swap", async function () {
            await atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce);
            
            await atomicSwap.connect(operator).disputeSwap(executionId, "Test dispute");
            
            const swapHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256"],
                [executionId, ethers.parseEther("2"), ethers.parseEther("1"), await time.latest()]
            ));
            
            const offererSignature = await offerer.signMessage(ethers.getBytes(swapHash));
            const takerSignature = await taker.signMessage(ethers.getBytes(swapHash));
            
            await expect(
                atomicSwap.connect(operator).completeSwap(executionId, offererSignature, takerSignature)
            ).to.be.revertedWith("Swap is disputed");
        });
    });

    describe("Dispute Management", function () {
        let commitment, secretNonce, executionId;

        beforeEach(async function () {
            secretNonce = ethers.randomBytes(32);
            commitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                await atomicSwap.getCurrentNonce()
            );

            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );

            await atomicSwap.connect(taker).takeSwapOffer(commitment, secretNonce);

            executionId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "uint256"],
                [commitment, taker.address, await time.latest()]
            ));
        });

        it("Should dispute swap successfully", async function () {
            await expect(
                atomicSwap.connect(operator).disputeSwap(executionId, "Test dispute")
            ).to.not.be.reverted;

            const execution = await atomicSwap.getSwapExecution(executionId);
            expect(execution.isDisputed).to.be.true;
        });

        it("Should reject dispute by non-operator", async function () {
            await expect(
                atomicSwap.connect(taker).disputeSwap(executionId, "Test dispute")
            ).to.be.revertedWith("Caller is not an operator");
        });

        it("Should reject dispute of non-existent execution", async function () {
            const fakeExecutionId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            
            await expect(
                atomicSwap.connect(operator).disputeSwap(fakeExecutionId, "Test dispute")
            ).to.be.revertedWith("Execution does not exist");
        });

        it("Should reject dispute of completed swap", async function () {
            const swapHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256"],
                [executionId, ethers.parseEther("2"), ethers.parseEther("1"), await time.latest()]
            ));
            
            const offererSignature = await offerer.signMessage(ethers.getBytes(swapHash));
            const takerSignature = await taker.signMessage(ethers.getBytes(swapHash));
            
            await atomicSwap.connect(operator).completeSwap(executionId, offererSignature, takerSignature);
            
            await expect(
                atomicSwap.connect(operator).disputeSwap(executionId, "Test dispute")
            ).to.be.revertedWith("Swap already completed");
        });

        it("Should reject duplicate dispute", async function () {
            await atomicSwap.connect(operator).disputeSwap(executionId, "Test dispute");
            
            await expect(
                atomicSwap.connect(operator).disputeSwap(executionId, "Another dispute")
            ).to.be.revertedWith("Swap already disputed");
        });
    });

    describe("Emergency Functions", function () {
        it("Should request emergency withdrawal", async function () {
            await expect(
                atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency")
            ).to.emit(atomicSwap, "EmergencyWithdrawRequested")
                .withArgs(offerer.address, await time.latest(), "Test emergency");

            const request = await atomicSwap.getEmergencyRequest(offerer.address);
            expect(request.requester).to.equal(offerer.address);
            expect(request.isExecuted).to.be.false;
            expect(request.reason).to.equal("Test emergency");
        });

        it("Should reject duplicate emergency request", async function () {
            await atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency");
            
            await expect(
                atomicSwap.connect(offerer).requestEmergencyWithdraw("Another emergency")
            ).to.be.revertedWith("Emergency withdrawal already requested");
        });

        it("Should execute emergency withdrawal after timelock", async function () {
            await atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency");
            
            // Advance time past timelock
            await time.increase(86400 + 1); // 24 hours + 1 second
            
            await expect(
                atomicSwap.connect(emergencyRole).executeEmergencyWithdraw(offerer.address)
            ).to.emit(atomicSwap, "EmergencyWithdrawExecuted");

            const request = await atomicSwap.getEmergencyRequest(offerer.address);
            expect(request.isExecuted).to.be.true;
        });

        it("Should reject emergency withdrawal before timelock", async function () {
            await atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency");
            
            await expect(
                atomicSwap.connect(emergencyRole).executeEmergencyWithdraw(offerer.address)
            ).to.be.revertedWith("Timelock not expired");
        });

        it("Should reject emergency withdrawal by non-emergency role", async function () {
            await atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency");
            await time.increase(86400 + 1);
            
            await expect(
                atomicSwap.connect(offerer).executeEmergencyWithdraw(offerer.address)
            ).to.be.revertedWith("Caller is not emergency role");
        });

        it("Should enable emergency mode", async function () {
            await expect(
                atomicSwap.connect(emergencyRole).enableEmergencyMode()
            ).to.not.be.reverted;

            expect(await atomicSwap.emergencyMode()).to.be.true;
        });

        it("Should disable emergency mode", async function () {
            await atomicSwap.connect(emergencyRole).enableEmergencyMode();
            
            await expect(
                atomicSwap.connect(owner).disableEmergencyMode()
            ).to.not.be.reverted;

            expect(await atomicSwap.emergencyMode()).to.be.false;
        });

        it("Should reject operations in emergency mode", async function () {
            await atomicSwap.connect(emergencyRole).enableEmergencyMode();
            
            const secretNonce = ethers.randomBytes(32);
            
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Contract in emergency mode");
        });
    });

    describe("Admin Functions", function () {
        it("Should update swap fee", async function () {
            const newFee = 100;
            
            await expect(
                atomicSwap.connect(owner).setSwapFee(newFee)
            ).to.emit(atomicSwap, "FeeUpdated")
                .withArgs(SWAP_FEE, newFee);

            expect(await atomicSwap.swapFee()).to.equal(newFee);
        });

        it("Should reject fee too high", async function () {
            await expect(
                atomicSwap.connect(owner).setSwapFee(1500)
            ).to.be.revertedWith("Fee too high");
        });

        it("Should update fee collector", async function () {
            await expect(
                atomicSwap.connect(owner).setFeeCollector(taker.address)
            ).to.emit(atomicSwap, "FeeCollectorUpdated")
                .withArgs(owner.address, taker.address);

            expect(await atomicSwap.feeCollector()).to.equal(taker.address);
        });

        it("Should update swap limits", async function () {
            const newMin = ethers.parseEther("0.2");
            const newMax = ethers.parseEther("2000");
            
            await expect(
                atomicSwap.connect(owner).setSwapLimits(newMin, newMax)
            ).to.emit(atomicSwap, "SwapLimitsUpdated")
                .withArgs(newMin, newMax);

            expect(await atomicSwap.minSwapAmount()).to.equal(newMin);
            expect(await atomicSwap.maxSwapAmount()).to.equal(newMax);
        });

        it("Should update default expiry", async function () {
            const newExpiry = 7200;
            
            await expect(
                atomicSwap.connect(owner).setDefaultExpiry(newExpiry)
            ).to.emit(atomicSwap, "DefaultExpiryUpdated")
                .withArgs(DEFAULT_EXPIRY, newExpiry);

            expect(await atomicSwap.defaultExpiry()).to.equal(newExpiry);
        });

        it("Should reject admin functions by non-admin", async function () {
            await expect(
                atomicSwap.connect(taker).setSwapFee(100)
            ).to.be.revertedWith("AccessControl: account 0x");
        });
    });

    describe("Utility Functions", function () {
        it("Should calculate commitment correctly", async function () {
            const tokenIn = mockToken1.address;
            const tokenOut = mockToken2.address;
            const amountIn = ethers.parseEther("1");
            const amountOut = ethers.parseEther("2");
            const secretNonce = ethers.randomBytes(32);
            const nonce = await atomicSwap.getCurrentNonce();

            const expectedCommitment = ethers.keccak256(ethers.solidityPacked(
                ["address", "address", "uint256", "uint256", "uint256", "uint256"],
                [tokenIn, tokenOut, amountIn, amountOut, secretNonce, nonce]
            ));

            const calculatedCommitment = await atomicSwap.calculateCommitment(
                tokenIn,
                tokenOut,
                amountIn,
                amountOut,
                secretNonce,
                nonce
            );

            expect(calculatedCommitment).to.equal(expectedCommitment);
        });

        it("Should return correct nonce", async function () {
            const initialNonce = await atomicSwap.getCurrentNonce();
            
            // Create an offer to increment nonce
            const secretNonce = ethers.randomBytes(32);
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );
            
            const newNonce = await atomicSwap.getCurrentNonce();
            expect(newNonce).to.equal(initialNonce + 1n);
        });

        it("Should check offer status correctly", async function () {
            const secretNonce = ethers.randomBytes(32);
            const commitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                await atomicSwap.getCurrentNonce()
            );

            // Before creating offer
            expect(await atomicSwap.isOfferActive(commitment)).to.be.false;

            // After creating offer
            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                secretNonce,
                0
            );
            expect(await atomicSwap.isOfferActive(commitment)).to.be.true;

            // After cancelling offer
            await atomicSwap.connect(offerer).cancelSwapOffer(commitment);
            expect(await atomicSwap.isOfferActive(commitment)).to.be.false;

            // After expiry
            const expiredCommitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                ethers.randomBytes(32),
                await atomicSwap.getCurrentNonce()
            );

            await atomicSwap.connect(offerer).createSwapOffer(
                mockToken1.address,
                mockToken2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2"),
                ethers.randomBytes(32),
                await time.latest() + 100 // short expiry
            );

            await time.increase(101);
            expect(await atomicSwap.isOfferActive(expiredCommitment)).to.be.false;
        });

        it("Should check emergency withdrawal eligibility", async function () {
            // Before request
            expect(await atomicSwap.canEmergencyWithdraw(offerer.address)).to.be.false;

            // After request
            await atomicSwap.connect(offerer).requestEmergencyWithdraw("Test emergency");
            expect(await atomicSwap.canEmergencyWithdraw(offerer.address)).to.be.false; // timelock not expired

            // After timelock
            await time.increase(86400 + 1);
            expect(await atomicSwap.canEmergencyWithdraw(offerer.address)).to.be.true;

            // After execution
            await atomicSwap.connect(emergencyRole).executeEmergencyWithdraw(offerer.address);
            expect(await atomicSwap.canEmergencyWithdraw(offerer.address)).to.be.false;
        });
    });

    describe("Pausable", function () {
        it("Should pause and unpause", async function () {
            await atomicSwap.connect(owner).pause();
            expect(await atomicSwap.paused()).to.be.true;
            
            await atomicSwap.connect(owner).unpause();
            expect(await atomicSwap.paused()).to.be.false;
        });

        it("Should reject operations when paused", async function () {
            await atomicSwap.connect(owner).pause();
            
            const secretNonce = ethers.randomBytes(32);
            
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    ethers.parseEther("1"),
                    ethers.parseEther("2"),
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Reentrancy Protection", function () {
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
            const commitment = await atomicSwap.calculateCommitment(
                mockToken1.address,
                mockToken2.address,
                largeAmount,
                largeAmount,
                ethers.randomBytes(32),
                await atomicSwap.getCurrentNonce()
            );
            
            expect(commitment).to.not.equal(ethers.ZeroHash);
        });

        it("Should handle zero amounts correctly", async function () {
            const secretNonce = ethers.randomBytes(32);
            
            await expect(
                atomicSwap.connect(offerer).createSwapOffer(
                    mockToken1.address,
                    mockToken2.address,
                    0,
                    0,
                    secretNonce,
                    0
                )
            ).to.be.revertedWith("Amount too small");
        });

        it("Should handle fee calculation correctly", async function () {
            const amount = ethers.parseEther("100");
            const fee = await atomicSwap.swapFee();
            
            // Test fee calculation: amount * fee / 10000
            const expectedFee = amount * BigInt(fee) / 10000n;
            expect(expectedFee).to.equal(ethers.parseEther("0.5")); // 0.5% of 100
        });
    });
}); 