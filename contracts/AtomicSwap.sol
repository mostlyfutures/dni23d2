// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AtomicSwap
 * @dev Peer-to-peer atomic swaps with privacy features
 * @notice Enables direct token swaps between users without order book
 */
contract AtomicSwap is ReentrancyGuard, Pausable, Ownable {
    using ECDSA for bytes32;

    // ============ STRUCTS ============
    
    struct SwapOffer {
        address offerer;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 nonce;
        uint256 expiry;
        bool isActive;
        bytes32 commitment;
    }

    struct SwapExecution {
        address offerer;
        address taker;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 timestamp;
        bool isCompleted;
    }

    // ============ EVENTS ============
    
    event SwapOffered(
        bytes32 indexed commitment,
        address indexed offerer,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 expiry
    );

    event SwapTaken(
        bytes32 indexed commitment,
        address indexed taker,
        address indexed offerer,
        uint256 amountIn,
        uint256 amountOut
    );

    event SwapCompleted(
        bytes32 indexed commitment,
        address offerer,
        address taker,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    event SwapCancelled(
        bytes32 indexed commitment,
        address indexed offerer
    );

    // ============ STATE VARIABLES ============
    
    mapping(bytes32 => SwapOffer) public swapOffers;
    mapping(bytes32 => SwapExecution) public swapExecutions;
    
    uint256 public swapNonce;
    uint256 public minSwapAmount;
    uint256 public maxSwapAmount;
    uint256 public defaultExpiry;
    
    address public feeCollector;
    uint256 public swapFee; // in basis points
    
    // ============ MODIFIERS ============
    
    modifier onlyValidOffer(bytes32 commitment) {
        require(swapOffers[commitment].offerer != address(0), "Offer does not exist");
        require(swapOffers[commitment].isActive, "Offer not active");
        require(block.timestamp <= swapOffers[commitment].expiry, "Offer expired");
        _;
    }

    modifier onlyOfferOwner(bytes32 commitment) {
        require(swapOffers[commitment].offerer == msg.sender, "Not offer owner");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(
        uint256 _minSwapAmount,
        uint256 _maxSwapAmount,
        uint256 _defaultExpiry,
        uint256 _swapFee
    ) {
        minSwapAmount = _minSwapAmount;
        maxSwapAmount = _maxSwapAmount;
        defaultExpiry = _defaultExpiry;
        swapFee = _swapFee;
        feeCollector = msg.sender;
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @dev Create a new atomic swap offer
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param amountOut Output amount
     * @param secretNonce Secret nonce for commitment
     * @param customExpiry Custom expiry time (0 for default)
     */
    function createSwapOffer(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 secretNonce,
        uint256 customExpiry
    ) external whenNotPaused {
        require(tokenIn != tokenOut, "Same token");
        require(amountIn >= minSwapAmount, "Amount too small");
        require(amountIn <= maxSwapAmount, "Amount too large");
        require(amountOut > 0, "Invalid output amount");
        
        uint256 expiry = customExpiry > 0 ? customExpiry : block.timestamp + defaultExpiry;
        require(expiry > block.timestamp, "Invalid expiry");
        
        bytes32 commitment = keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            secretNonce,
            swapNonce
        ));
        
        require(swapOffers[commitment].offerer == address(0), "Commitment already exists");
        
        swapOffers[commitment] = SwapOffer({
            offerer: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOut: amountOut,
            nonce: swapNonce++,
            expiry: expiry,
            isActive: true,
            commitment: commitment
        });
        
        emit SwapOffered(
            commitment,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            expiry
        );
    }

    /**
     * @dev Take an existing swap offer
     * @param commitment The offer commitment
     * @param secretNonce The secret nonce used in the offer
     */
    function takeSwapOffer(
        bytes32 commitment,
        uint256 secretNonce
    ) external onlyValidOffer(commitment) nonReentrant {
        SwapOffer storage offer = swapOffers[commitment];
        
        require(msg.sender != offer.offerer, "Cannot take own offer");
        
        // Verify the commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(
            offer.tokenIn,
            offer.tokenOut,
            offer.amountIn,
            offer.amountOut,
            secretNonce,
            offer.nonce
        ));
        require(commitment == expectedCommitment, "Invalid commitment");
        
        // Create swap execution record
        bytes32 executionId = keccak256(abi.encodePacked(
            commitment,
            msg.sender,
            block.timestamp
        ));
        
        swapExecutions[executionId] = SwapExecution({
            offerer: offer.offerer,
            taker: msg.sender,
            tokenIn: offer.tokenIn,
            tokenOut: offer.tokenOut,
            amountIn: offer.amountIn,
            amountOut: offer.amountOut,
            timestamp: block.timestamp,
            isCompleted: false
        });
        
        // Mark offer as taken
        offer.isActive = false;
        
        emit SwapTaken(
            commitment,
            msg.sender,
            offer.offerer,
            offer.amountIn,
            offer.amountOut
        );
    }

    /**
     * @dev Complete an atomic swap with signatures
     * @param executionId The execution identifier
     * @param offererSignature Signature from offerer
     * @param takerSignature Signature from taker
     */
    function completeSwap(
        bytes32 executionId,
        bytes memory offererSignature,
        bytes memory takerSignature
    ) external {
        SwapExecution storage execution = swapExecutions[executionId];
        require(execution.offerer != address(0), "Execution does not exist");
        require(!execution.isCompleted, "Swap already completed");
        
        // Verify signatures
        bytes32 swapHash = keccak256(abi.encodePacked(
            executionId,
            execution.amountIn,
            execution.amountOut,
            execution.timestamp
        ));
        
        address offererSigner = swapHash.toEthSignedMessageHash().recover(offererSignature);
        address takerSigner = swapHash.toEthSignedMessageHash().recover(takerSignature);
        
        require(offererSigner == execution.offerer, "Invalid offerer signature");
        require(takerSigner == execution.taker, "Invalid taker signature");
        
        // Calculate fees
        uint256 feeAmount = (execution.amountIn * swapFee) / 10000;
        uint256 netAmount = execution.amountIn - feeAmount;
        
        // Execute the swap (in a real implementation, you'd transfer tokens)
        // For now, we just mark it as completed
        
        execution.isCompleted = true;
        
        emit SwapCompleted(
            executionId,
            execution.offerer,
            execution.taker,
            execution.tokenIn,
            execution.tokenOut,
            execution.amountIn,
            execution.amountOut,
            block.timestamp
        );
    }

    /**
     * @dev Cancel an active swap offer
     * @param commitment The offer commitment
     */
    function cancelSwapOffer(bytes32 commitment) 
        external 
        onlyValidOffer(commitment) 
        onlyOfferOwner(commitment) 
    {
        SwapOffer storage offer = swapOffers[commitment];
        offer.isActive = false;
        
        emit SwapCancelled(commitment, msg.sender);
    }

    // ============ UTILITY FUNCTIONS ============

    /**
     * @dev Calculate commitment hash for an offer
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param amountOut Output amount
     * @param secretNonce Secret nonce
     * @param nonce Offer nonce
     */
    function calculateCommitment(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 secretNonce,
        uint256 nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            secretNonce,
            nonce
        ));
    }

    /**
     * @dev Get current swap nonce for commitment calculation
     */
    function getCurrentNonce() external view returns (uint256) {
        return swapNonce;
    }

    // ============ ADMIN FUNCTIONS ============

    function setSwapFee(uint256 _swapFee) external onlyOwner {
        require(_swapFee <= 1000, "Fee too high"); // Max 10%
        swapFee = _swapFee;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    function setSwapLimits(uint256 _minSwapAmount, uint256 _maxSwapAmount) external onlyOwner {
        require(_minSwapAmount < _maxSwapAmount, "Invalid limits");
        minSwapAmount = _minSwapAmount;
        maxSwapAmount = _maxSwapAmount;
    }

    function setDefaultExpiry(uint256 _defaultExpiry) external onlyOwner {
        require(_defaultExpiry > 0, "Invalid expiry");
        defaultExpiry = _defaultExpiry;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ VIEW FUNCTIONS ============

    function getSwapOffer(bytes32 commitment) external view returns (SwapOffer memory) {
        return swapOffers[commitment];
    }

    function getSwapExecution(bytes32 executionId) external view returns (SwapExecution memory) {
        return swapExecutions[executionId];
    }

    function isOfferActive(bytes32 commitment) external view returns (bool) {
        SwapOffer storage offer = swapOffers[commitment];
        return offer.isActive && block.timestamp <= offer.expiry;
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
} 