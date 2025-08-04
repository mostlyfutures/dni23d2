// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title AtomicSwap
 * @dev Peer-to-peer atomic swaps with privacy features
 * @notice Enables direct token swaps between users without order book
 * @custom:security-contact security@darkpooldex.com
 */
contract AtomicSwap is ReentrancyGuard, Pausable, AccessControl {
    using ECDSA for bytes32;
    using SafeMath for uint256;

    // ============ CONSTANTS ============
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE"); //bb
    
    uint256 public constant MAX_FEE_BPS = 1000; // 10% max fee
    uint256 public constant MIN_EXPIRY = 300; // 5 minutes
    uint256 public constant MAX_EXPIRY = 604800; // 1 week
    uint256 public constant EMERGENCY_TIMELOCK = 86400; // 24 hours

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
        bool isCancelled;
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
        bool isDisputed;
    }

    struct EmergencyRequest {
        address requester;
        uint256 requestTime;
        bool isExecuted;
        string reason;
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

    event EmergencyWithdrawRequested(
        address indexed requester,
        uint256 requestTime,
        string reason
    );

    event EmergencyWithdrawExecuted(
        address indexed requester,
        uint256 amount,
        uint256 timestamp
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event SwapLimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event DefaultExpiryUpdated(uint256 oldExpiry, uint256 newExpiry);

    // ============ STATE VARIABLES ============
    
    mapping(bytes32 => SwapOffer) public swapOffers;
    mapping(bytes32 => SwapExecution) public swapExecutions;
    mapping(address => EmergencyRequest) public emergencyRequests;
    
    uint256 public swapNonce;
    uint256 public minSwapAmount;
    uint256 public maxSwapAmount;
    uint256 public defaultExpiry;
    
    address public feeCollector;
    uint256 public swapFee; // in basis points
    
    bool public emergencyMode;
    uint256 public emergencyModeTime;

    // ============ MODIFIERS ============
    
    modifier onlyValidOffer(bytes32 commitment) {
        require(swapOffers[commitment].offerer != address(0), "Offer does not exist");
        require(swapOffers[commitment].isActive, "Offer not active");
        require(!swapOffers[commitment].isCancelled, "Offer cancelled");
        require(block.timestamp <= swapOffers[commitment].expiry, "Offer expired");
        _;
    }

    modifier onlyOfferOwner(bytes32 commitment) {
        require(swapOffers[commitment].offerer == msg.sender, "Not offer owner");
        _;
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Caller is not an operator");
        _;
    }

    modifier onlyEmergencyRole() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "Caller is not emergency role");
        _;
    }

    modifier notInEmergencyMode() {
        require(!emergencyMode, "Contract in emergency mode");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(
        uint256 _minSwapAmount,
        uint256 _maxSwapAmount,
        uint256 _defaultExpiry,
        uint256 _swapFee
    ) {
        require(_minSwapAmount < _maxSwapAmount, "Invalid swap limits");
        require(_defaultExpiry >= MIN_EXPIRY && _defaultExpiry <= MAX_EXPIRY, "Invalid default expiry");
        require(_swapFee <= MAX_FEE_BPS, "Fee too high");

        minSwapAmount = _minSwapAmount;
        maxSwapAmount = _maxSwapAmount;
        defaultExpiry = _defaultExpiry;
        swapFee = _swapFee;
        feeCollector = msg.sender;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
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
    ) external whenNotPaused notInEmergencyMode nonReentrant {
        require(tokenIn != tokenOut, "Same token");
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
        require(amountIn >= minSwapAmount, "Amount too small");
        require(amountIn <= maxSwapAmount, "Amount too large");
        require(amountOut > 0, "Invalid output amount");
        
        uint256 expiry = customExpiry > 0 ? customExpiry : block.timestamp.add(defaultExpiry);
        require(expiry > block.timestamp, "Invalid expiry");
        require(expiry <= block.timestamp.add(MAX_EXPIRY), "Expiry too far");
        
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
            isCancelled: false,
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
    ) external onlyValidOffer(commitment) nonReentrant whenNotPaused notInEmergencyMode {
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
            isCompleted: false,
            isDisputed: false
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
    ) external nonReentrant whenNotPaused notInEmergencyMode {
        SwapExecution storage execution = swapExecutions[executionId];
        require(execution.offerer != address(0), "Execution does not exist");
        require(!execution.isCompleted, "Swap already completed");
        require(!execution.isDisputed, "Swap is disputed");
        
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
        uint256 feeAmount = execution.amountIn.mul(swapFee).div(10000);
        uint256 netAmount = execution.amountIn.sub(feeAmount);
        
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
        whenNotPaused 
    {
        SwapOffer storage offer = swapOffers[commitment];
        offer.isActive = false;
        offer.isCancelled = true;
        
        emit SwapCancelled(commitment, msg.sender);
    }

    /**
     * @dev Dispute a swap execution (only operator)
     * @param executionId The execution identifier
     * @param reason Reason for dispute
     */
    function disputeSwap(bytes32 executionId, string memory reason) 
        external 
        onlyOperator 
        whenNotPaused 
    {
        SwapExecution storage execution = swapExecutions[executionId];
        require(execution.offerer != address(0), "Execution does not exist");
        require(!execution.isCompleted, "Swap already completed");
        require(!execution.isDisputed, "Swap already disputed");
        
        execution.isDisputed = true;
    }

    // ============ EMERGENCY FUNCTIONS ============

    /**
     * @dev Request emergency withdrawal
     * @param reason Reason for emergency withdrawal
     */
    function requestEmergencyWithdraw(string memory reason) external {
        require(emergencyRequests[msg.sender].requester == address(0), "Emergency withdrawal already requested");
        
        emergencyRequests[msg.sender] = EmergencyRequest({
            requester: msg.sender,
            requestTime: block.timestamp,
            isExecuted: false,
            reason: reason
        });
        
        emit EmergencyWithdrawRequested(msg.sender, block.timestamp, reason);
    }

    /**
     * @dev Execute emergency withdrawal after timelock
     * @param requester The requester to withdraw for
     */
    function executeEmergencyWithdraw(address requester) external onlyEmergencyRole nonReentrant {
        EmergencyRequest storage request = emergencyRequests[requester];
        
        require(request.requester == requester, "No emergency request");
        require(!request.isExecuted, "Already executed");
        require(block.timestamp >= request.requestTime.add(EMERGENCY_TIMELOCK), "Timelock not expired");
        
        request.isExecuted = true;
        
        // In a real implementation, you'd transfer any locked tokens
        // For now, we just mark it as executed
        
        emit EmergencyWithdrawExecuted(requester, 0, block.timestamp);
    }

    /**
     * @dev Enable emergency mode (only emergency role)
     */
    function enableEmergencyMode() external onlyEmergencyRole {
        require(!emergencyMode, "Already in emergency mode");
        emergencyMode = true;
        emergencyModeTime = block.timestamp;
    }

    /**
     * @dev Disable emergency mode (only admin)
     */
    function disableEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(emergencyMode, "Not in emergency mode");
        emergencyMode = false;
        emergencyModeTime = 0;
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

    function setSwapFee(uint256 _swapFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_swapFee <= MAX_FEE_BPS, "Fee too high");
        uint256 oldFee = swapFee;
        swapFee = _swapFee;
        emit FeeUpdated(oldFee, _swapFee);
    }

    function setFeeCollector(address _feeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeCollector != address(0), "Invalid address");
        address oldCollector = feeCollector;
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }

    function setSwapLimits(uint256 _minSwapAmount, uint256 _maxSwapAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minSwapAmount < _maxSwapAmount, "Invalid limits");
        minSwapAmount = _minSwapAmount;
        maxSwapAmount = _maxSwapAmount;
        emit SwapLimitsUpdated(_minSwapAmount, _maxSwapAmount);
    }

    function setDefaultExpiry(uint256 _defaultExpiry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_defaultExpiry >= MIN_EXPIRY && _defaultExpiry <= MAX_EXPIRY, "Invalid expiry");
        uint256 oldExpiry = defaultExpiry;
        defaultExpiry = _defaultExpiry;
        emit DefaultExpiryUpdated(oldExpiry, _defaultExpiry);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function grantOperatorRole(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, operator);
    }

    function revokeOperatorRole(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, operator);
    }

    function grantEmergencyRole(address emergency) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(EMERGENCY_ROLE, emergency);
    }

    function revokeEmergencyRole(address emergency) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(EMERGENCY_ROLE, emergency);
    }

    // ============ VIEW FUNCTIONS ============

    function getSwapOffer(bytes32 commitment) external view returns (SwapOffer memory) {
        return swapOffers[commitment];
    }

    function getSwapExecution(bytes32 executionId) external view returns (SwapExecution memory) {
        return swapExecutions[executionId];
    }

    function getEmergencyRequest(address requester) external view returns (EmergencyRequest memory) {
        return emergencyRequests[requester];
    }

    function isOfferActive(bytes32 commitment) external view returns (bool) {
        SwapOffer storage offer = swapOffers[commitment];
        return offer.isActive && !offer.isCancelled && block.timestamp <= offer.expiry;
    }

    function canEmergencyWithdraw(address requester) external view returns (bool) {
        EmergencyRequest storage request = emergencyRequests[requester];
        return request.requester == requester && 
               !request.isExecuted && 
               block.timestamp >= request.requestTime.add(EMERGENCY_TIMELOCK);
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }

    receive() external payable {}
} 