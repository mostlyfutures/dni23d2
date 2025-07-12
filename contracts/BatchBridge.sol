// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BatchBridge
 * @dev Enables batch processing of cross-chain swaps to minimize transaction costs
 * @notice Supports batching multiple swaps into single bridge transactions
 * @custom:security-contact security@darkpooldex.com
 */
contract BatchBridge is ReentrancyGuard, AccessControl {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant MIN_BATCH_SIZE = 5;
    uint256 public constant BATCH_TIMEOUT = 300; // 5 minutes

    // ============ STRUCTS ============
    
    struct BatchSwap {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 expectedAmountOut;
        uint256 nonce;
        uint256 timestamp;
        bool isProcessed;
        bool isFailed;
        string failureReason;
    }

    struct BatchRequest {
        uint256 batchId;
        address[] users;
        address[] tokensIn;
        address[] tokensOut;
        uint256[] amountsIn;
        uint256[] expectedAmountsOut;
        uint256 totalAmountIn;
        uint256 timestamp;
        bool isDeposited;
        bool isWithdrawn;
        bool isCompleted;
    }

    struct BridgeConfig {
        address bridgeAddress;
        uint256 minBatchSize;
        uint256 maxBatchSize;
        uint256 batchTimeout;
        bool isActive;
        uint256 feeBps; // Bridge fee in basis points
    }

    // ============ EVENTS ============
    
    event BatchSwapRequested(
        uint256 indexed batchId,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut
    );

    event BatchDeposited(
        uint256 indexed batchId,
        address tokenIn,
        uint256 totalAmount,
        uint256 bridgeFee
    );

    event BatchWithdrawn(
        uint256 indexed batchId,
        address tokenOut,
        uint256 totalAmount
    );

    event BatchCompleted(
        uint256 indexed batchId,
        uint256 successfulSwaps,
        uint256 failedSwaps
    );

    event BridgeConfigUpdated(
        address indexed bridgeAddress,
        uint256 minBatchSize,
        uint256 maxBatchSize,
        uint256 feeBps
    );

    // ============ STATE VARIABLES ============
    
    mapping(uint256 => BatchRequest) public batchRequests;
    mapping(uint256 => mapping(address => BatchSwap)) public batchSwaps;
    mapping(address => BridgeConfig) public bridgeConfigs;
    
    uint256 public batchNonce;
    uint256 public totalBatchesProcessed;
    uint256 public totalSwapsProcessed;
    
    address public feeCollector;
    uint256 public bridgeFeeBps; // Default bridge fee

    // ============ MODIFIERS ============
    
    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Not operator");
        _;
    }

    modifier onlyBridge() {
        require(hasRole(BRIDGE_ROLE, msg.sender), "Not bridge");
        _;
    }

    modifier validBatchSize(uint256 size) {
        require(size >= MIN_BATCH_SIZE, "Batch too small");
        require(size <= MAX_BATCH_SIZE, "Batch too large");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(uint256 _bridgeFeeBps) {
        require(_bridgeFeeBps <= 1000, "Fee too high"); // Max 10%
        
        bridgeFeeBps = _bridgeFeeBps;
        feeCollector = msg.sender;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @dev Request a swap to be included in the next batch
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param expectedAmountOut Expected output amount
     */
    function requestBatchSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut
    ) external nonReentrant {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid tokens");
        require(amountIn > 0, "Invalid amount");
        require(expectedAmountOut > 0, "Invalid expected amount");
        
        uint256 batchId = batchNonce;
        uint256 swapNonce = batchSwaps[batchId][msg.sender].nonce;
        
        batchSwaps[batchId][msg.sender] = BatchSwap({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            expectedAmountOut: expectedAmountOut,
            nonce: swapNonce.add(1),
            timestamp: block.timestamp,
            isProcessed: false,
            isFailed: false,
            failureReason: ""
        });

        emit BatchSwapRequested(
            batchId,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            expectedAmountOut
        );
    }

    /**
     * @dev Create a new batch from pending swap requests
     * @param users Array of user addresses to include in batch
     * @param minBatchSize Minimum batch size required
     */
    function createBatch(
        address[] calldata users,
        uint256 minBatchSize
    ) external onlyOperator validBatchSize(users.length) {
        require(users.length >= minBatchSize, "Insufficient users for batch");
        
        uint256 batchId = batchNonce++;
        uint256 totalAmountIn = 0;
        
        address[] memory tokensIn = new address[](users.length);
        address[] memory tokensOut = new address[](users.length);
        uint256[] memory amountsIn = new uint256[](users.length);
        uint256[] memory expectedAmountsOut = new uint256[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            BatchSwap storage swap = batchSwaps[batchId.sub(1)][users[i]];
            require(swap.user != address(0), "Invalid swap request");
            require(!swap.isProcessed, "Swap already processed");
            
            tokensIn[i] = swap.tokenIn;
            tokensOut[i] = swap.tokenOut;
            amountsIn[i] = swap.amountIn;
            expectedAmountsOut[i] = swap.expectedAmountOut;
            totalAmountIn = totalAmountIn.add(swap.amountIn);
            
            // Mark as processed
            swap.isProcessed = true;
        }
        
        batchRequests[batchId] = BatchRequest({
            batchId: batchId,
            users: users,
            tokensIn: tokensIn,
            tokensOut: tokensOut,
            amountsIn: amountsIn,
            expectedAmountsOut: expectedAmountsOut,
            totalAmountIn: totalAmountIn,
            timestamp: block.timestamp,
            isDeposited: false,
            isWithdrawn: false,
            isCompleted: false
        });
        
        totalBatchesProcessed = totalBatchesProcessed.add(1);
        totalSwapsProcessed = totalSwapsProcessed.add(users.length);
    }

    /**
     * @dev Execute batch deposit to bridge (called by bridge operator)
     * @param batchId Batch identifier
     * @param bridgeAddress Target bridge address
     */
    function executeBatchDeposit(
        uint256 batchId,
        address bridgeAddress
    ) external onlyBridge {
        BatchRequest storage batch = batchRequests[batchId];
        require(batch.batchId != 0, "Batch does not exist");
        require(!batch.isDeposited, "Already deposited");
        
        // Calculate bridge fee
        uint256 bridgeFee = batch.totalAmountIn.mul(bridgeFeeBps).div(10000);
        uint256 netAmount = batch.totalAmountIn.sub(bridgeFee);
        
        // Transfer tokens to bridge
        IERC20(batch.tokensIn[0]).safeTransferFrom(
            address(this),
            bridgeAddress,
            netAmount
        );
        
        // Transfer fee to collector
        if (bridgeFee > 0) {
            IERC20(batch.tokensIn[0]).safeTransfer(feeCollector, bridgeFee);
        }
        
        batch.isDeposited = true;
        
        emit BatchDeposited(batchId, batch.tokensIn[0], netAmount, bridgeFee);
    }

    /**
     * @dev Execute batch withdrawal from bridge (called by bridge operator)
     * @param batchId Batch identifier
     * @param totalAmountOut Total amount received from bridge
     * @param successfulSwaps Number of successful swaps
     */
    function executeBatchWithdrawal(
        uint256 batchId,
        uint256 totalAmountOut,
        uint256 successfulSwaps
    ) external onlyBridge {
        BatchRequest storage batch = batchRequests[batchId];
        require(batch.isDeposited, "Not deposited");
        require(!batch.isWithdrawn, "Already withdrawn");
        
        batch.isWithdrawn = true;
        batch.isCompleted = true;
        
        emit BatchWithdrawn(batchId, batch.tokensOut[0], totalAmountOut);
        emit BatchCompleted(batchId, successfulSwaps, batch.users.length.sub(successfulSwaps));
    }

    /**
     * @dev Mark a swap as failed within a batch
     * @param batchId Batch identifier
     * @param user User address
     * @param reason Failure reason
     */
    function markSwapFailed(
        uint256 batchId,
        address user,
        string calldata reason
    ) external onlyOperator {
        BatchSwap storage swap = batchSwaps[batchId][user];
        require(swap.user != address(0), "Swap does not exist");
        require(!swap.isFailed, "Already marked as failed");
        
        swap.isFailed = true;
        swap.failureReason = reason;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Update bridge configuration
     * @param bridgeAddress Bridge contract address
     * @param minBatchSize Minimum batch size
     * @param maxBatchSize Maximum batch size
     * @param feeBps Bridge fee in basis points
     */
    function updateBridgeConfig(
        address bridgeAddress,
        uint256 minBatchSize,
        uint256 maxBatchSize,
        uint256 feeBps
    ) external onlyOperator {
        require(bridgeAddress != address(0), "Invalid bridge address");
        require(feeBps <= 1000, "Fee too high");
        
        bridgeConfigs[bridgeAddress] = BridgeConfig({
            bridgeAddress: bridgeAddress,
            minBatchSize: minBatchSize,
            maxBatchSize: maxBatchSize,
            batchTimeout: BATCH_TIMEOUT,
            isActive: true,
            feeBps: feeBps
        });
        
        emit BridgeConfigUpdated(bridgeAddress, minBatchSize, maxBatchSize, feeBps);
    }

    /**
     * @dev Update default bridge fee
     * @param newFeeBps New fee in basis points
     */
    function updateBridgeFee(uint256 newFeeBps) external onlyOperator {
        require(newFeeBps <= 1000, "Fee too high");
        bridgeFeeBps = newFeeBps;
    }

    /**
     * @dev Update fee collector address
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external onlyOperator {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get batch request details
     * @param batchId Batch identifier
     */
    function getBatchRequest(uint256 batchId) external view returns (BatchRequest memory) {
        return batchRequests[batchId];
    }

    /**
     * @dev Get swap details within a batch
     * @param batchId Batch identifier
     * @param user User address
     */
    function getBatchSwap(uint256 batchId, address user) external view returns (BatchSwap memory) {
        return batchSwaps[batchId][user];
    }

    /**
     * @dev Get bridge configuration
     * @param bridgeAddress Bridge contract address
     */
    function getBridgeConfig(address bridgeAddress) external view returns (BridgeConfig memory) {
        return bridgeConfigs[bridgeAddress];
    }

    /**
     * @dev Calculate batch cost savings
     * @param batchSize Number of swaps in batch
     * @param individualCost Cost per individual swap
     * @param batchCost Total batch cost
     */
    function calculateBatchSavings(
        uint256 batchSize,
        uint256 individualCost,
        uint256 batchCost
    ) external pure returns (uint256 savings, uint256 costPerSwap) {
        uint256 totalIndividualCost = individualCost.mul(batchSize);
        savings = totalIndividualCost.sub(batchCost);
        costPerSwap = batchCost.div(batchSize);
    }
} 