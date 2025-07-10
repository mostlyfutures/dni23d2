// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title DarkPoolDEX
 * @dev A privacy-preserving decentralized exchange with commit-reveal scheme
 * @notice Implements zero-cost trading with state channels and encrypted order matching
 */
contract DarkPoolDEX is ReentrancyGuard, Pausable, Ownable {
    using ECDSA for bytes32;

    // ============ STRUCTS ============
    
    struct Order {
        address trader;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 nonce;
        uint256 timestamp;
        bool isBuy;
        bool isRevealed;
        bool isExecuted;
        bytes32 commitment;
    }

    struct StateChannel {
        address trader;
        uint256 balance;
        uint256 nonce;
        uint256 lastUpdate;
        bool isActive;
    }

    struct Match {
        address trader1;
        address trader2;
        address tokenIn;
        address tokenOut;
        uint256 amount1;
        uint256 amount2;
        uint256 timestamp;
        bool isSettled;
    }

    // ============ EVENTS ============
    
    event OrderCommitted(
        bytes32 indexed commitment,
        address indexed trader,
        uint256 timestamp
    );

    event OrderRevealed(
        bytes32 indexed commitment,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bool isBuy
    );

    event OrderMatched(
        bytes32 indexed commitment1,
        bytes32 indexed commitment2,
        address trader1,
        address trader2,
        uint256 amount1,
        uint256 amount2
    );

    event TradeExecuted(
        address indexed trader1,
        address indexed trader2,
        address tokenIn,
        address tokenOut,
        uint256 amount1,
        uint256 amount2,
        uint256 timestamp
    );

    event StateChannelOpened(
        address indexed trader,
        uint256 balance,
        uint256 nonce
    );

    event StateChannelUpdated(
        address indexed trader,
        uint256 newBalance,
        uint256 newNonce
    );

    event StateChannelClosed(
        address indexed trader,
        uint256 finalBalance
    );

    // ============ STATE VARIABLES ============
    
    mapping(bytes32 => Order) public orders;
    mapping(address => StateChannel) public stateChannels;
    mapping(bytes32 => Match) public matches;
    
    uint256 public orderNonce;
    uint256 public matchNonce;
    uint256 public minOrderSize;
    uint256 public maxOrderSize;
    uint256 public commitmentWindow;
    uint256 public revealWindow;
    
    address public feeCollector;
    uint256 public tradingFee; // in basis points (1 = 0.01%)
    
    // ============ MODIFIERS ============
    
    modifier onlyValidOrder(bytes32 commitment) {
        require(orders[commitment].trader != address(0), "Order does not exist");
        require(!orders[commitment].isExecuted, "Order already executed");
        _;
    }

    modifier onlyOrderOwner(bytes32 commitment) {
        require(orders[commitment].trader == msg.sender, "Not order owner");
        _;
    }

    modifier onlyActiveStateChannel(address trader) {
        require(stateChannels[trader].isActive, "State channel not active");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(
        uint256 _minOrderSize,
        uint256 _maxOrderSize,
        uint256 _commitmentWindow,
        uint256 _revealWindow,
        uint256 _tradingFee
    ) {
        minOrderSize = _minOrderSize;
        maxOrderSize = _maxOrderSize;
        commitmentWindow = _commitmentWindow;
        revealWindow = _revealWindow;
        tradingFee = _tradingFee;
        feeCollector = msg.sender;
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @dev Commit an order hash to the blockchain
     * @param commitment Hash of the order details + secret nonce
     */
    function commitOrder(bytes32 commitment) external whenNotPaused {
        require(commitment != bytes32(0), "Invalid commitment");
        require(orders[commitment].trader == address(0), "Commitment already exists");
        
        orders[commitment] = Order({
            trader: msg.sender,
            tokenIn: address(0),
            tokenOut: address(0),
            amountIn: 0,
            amountOut: 0,
            nonce: orderNonce++,
            timestamp: block.timestamp,
            isBuy: false,
            isRevealed: false,
            isExecuted: false,
            commitment: commitment
        });

        emit OrderCommitted(commitment, msg.sender, block.timestamp);
    }

    /**
     * @dev Reveal the actual order details after commitment
     * @param commitment The original commitment hash
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param amountOut Output amount
     * @param isBuy Whether this is a buy order
     * @param secretNonce The secret nonce used in commitment
     */
    function revealOrder(
        bytes32 commitment,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bool isBuy,
        uint256 secretNonce
    ) external onlyValidOrder(commitment) onlyOrderOwner(commitment) {
        Order storage order = orders[commitment];
        
        require(!order.isRevealed, "Order already revealed");
        require(block.timestamp <= order.timestamp + revealWindow, "Reveal window expired");
        
        // Verify the commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            isBuy,
            secretNonce
        ));
        require(commitment == expectedCommitment, "Invalid commitment");
        
        // Validate order parameters
        require(amountIn >= minOrderSize, "Amount too small");
        require(amountIn <= maxOrderSize, "Amount too large");
        require(tokenIn != tokenOut, "Same token");
        
        // Update order with revealed details
        order.tokenIn = tokenIn;
        order.tokenOut = tokenOut;
        order.amountIn = amountIn;
        order.amountOut = amountOut;
        order.isBuy = isBuy;
        order.isRevealed = true;
        
        emit OrderRevealed(
            commitment,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            isBuy
        );
    }

    /**
     * @dev Match two revealed orders
     * @param commitment1 First order commitment
     * @param commitment2 Second order commitment
     */
    function matchOrders(
        bytes32 commitment1,
        bytes32 commitment2
    ) external onlyValidOrder(commitment1) onlyValidOrder(commitment2) {
        Order storage order1 = orders[commitment1];
        Order storage order2 = orders[commitment2];
        
        require(order1.isRevealed && order2.isRevealed, "Orders not revealed");
        require(order1.isBuy != order2.isBuy, "Same order type");
        require(order1.tokenIn == order2.tokenOut, "Token mismatch");
        require(order1.tokenOut == order2.tokenIn, "Token mismatch");
        
        // Determine buy and sell orders
        Order storage buyOrder = order1.isBuy ? order1 : order2;
        Order storage sellOrder = order1.isBuy ? order2 : order1;
        
        // Check if orders can be matched
        require(buyOrder.amountOut >= sellOrder.amountIn, "Insufficient liquidity");
        
        // Calculate match amounts
        uint256 matchAmount = sellOrder.amountIn;
        uint256 buyAmount = (matchAmount * buyOrder.amountOut) / buyOrder.amountIn;
        
        // Create match record
        bytes32 matchId = keccak256(abi.encodePacked(
            commitment1,
            commitment2,
            matchNonce++
        ));
        
        matches[matchId] = Match({
            trader1: buyOrder.trader,
            trader2: sellOrder.trader,
            tokenIn: sellOrder.tokenIn,
            tokenOut: buyOrder.tokenIn,
            amount1: buyAmount,
            amount2: matchAmount,
            timestamp: block.timestamp,
            isSettled: false
        });
        
        // Mark orders as executed
        order1.isExecuted = true;
        order2.isExecuted = true;
        
        emit OrderMatched(
            commitment1,
            commitment2,
            buyOrder.trader,
            sellOrder.trader,
            buyAmount,
            matchAmount
        );
    }

    /**
     * @dev Settle a matched trade using state channels
     * @param matchId The match identifier
     * @param signature1 Signature from trader1
     * @param signature2 Signature from trader2
     */
    function settleMatch(
        bytes32 matchId,
        bytes memory signature1,
        bytes memory signature2
    ) external {
        Match storage matchData = matches[matchId];
        require(matchData.trader1 != address(0), "Match does not exist");
        require(!matchData.isSettled, "Match already settled");
        
        // Verify signatures
        bytes32 matchHash = keccak256(abi.encodePacked(
            matchId,
            matchData.amount1,
            matchData.amount2,
            matchData.timestamp
        ));
        
        address signer1 = matchHash.toEthSignedMessageHash().recover(signature1);
        address signer2 = matchHash.toEthSignedMessageHash().recover(signature2);
        
        require(signer1 == matchData.trader1, "Invalid signature 1");
        require(signer2 == matchData.trader2, "Invalid signature 2");
        
        // Update state channels
        _updateStateChannel(matchData.trader1, matchData.amount1, true);
        _updateStateChannel(matchData.trader2, matchData.amount2, true);
        
        matchData.isSettled = true;
        
        emit TradeExecuted(
            matchData.trader1,
            matchData.trader2,
            matchData.tokenIn,
            matchData.tokenOut,
            matchData.amount1,
            matchData.amount2,
            block.timestamp
        );
    }

    // ============ STATE CHANNEL FUNCTIONS ============

    /**
     * @dev Open a state channel for a trader
     * @param trader The trader address
     * @param initialBalance Initial balance to deposit
     */
    function openStateChannel(address trader, uint256 initialBalance) 
        external 
        payable 
        whenNotPaused 
    {
        require(trader != address(0), "Invalid trader");
        require(initialBalance > 0, "Invalid balance");
        require(msg.value >= initialBalance, "Insufficient deposit");
        require(!stateChannels[trader].isActive, "Channel already active");
        
        stateChannels[trader] = StateChannel({
            trader: trader,
            balance: initialBalance,
            nonce: 0,
            lastUpdate: block.timestamp,
            isActive: true
        });
        
        emit StateChannelOpened(trader, initialBalance, 0);
    }

    /**
     * @dev Update state channel balance (called by authorized parties)
     * @param trader The trader address
     * @param newBalance New balance
     * @param newNonce New nonce
     * @param signature Signature from trader
     */
    function updateStateChannel(
        address trader,
        uint256 newBalance,
        uint256 newNonce,
        bytes memory signature
    ) external onlyActiveStateChannel(trader) {
        StateChannel storage channel = stateChannels[trader];
        
        require(newNonce > channel.nonce, "Invalid nonce");
        
        // Verify signature
        bytes32 updateHash = keccak256(abi.encodePacked(
            trader,
            newBalance,
            newNonce,
            block.timestamp
        ));
        
        address signer = updateHash.toEthSignedMessageHash().recover(signature);
        require(signer == trader, "Invalid signature");
        
        channel.balance = newBalance;
        channel.nonce = newNonce;
        channel.lastUpdate = block.timestamp;
        
        emit StateChannelUpdated(trader, newBalance, newNonce);
    }

    /**
     * @dev Close a state channel and withdraw funds
     * @param trader The trader address
     * @param finalBalance Final balance
     * @param signature Signature from trader
     */
    function closeStateChannel(
        address trader,
        uint256 finalBalance,
        bytes memory signature
    ) external onlyActiveStateChannel(trader) {
        StateChannel storage channel = stateChannels[trader];
        
        // Verify signature
        bytes32 closeHash = keccak256(abi.encodePacked(
            trader,
            finalBalance,
            "CLOSE",
            block.timestamp
        ));
        
        address signer = closeHash.toEthSignedMessageHash().recover(signature);
        require(signer == trader, "Invalid signature");
        
        channel.isActive = false;
        channel.balance = finalBalance;
        
        // Transfer final balance to trader
        payable(trader).transfer(finalBalance);
        
        emit StateChannelClosed(trader, finalBalance);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _updateStateChannel(
        address trader,
        uint256 amount,
        bool isCredit
    ) internal {
        StateChannel storage channel = stateChannels[trader];
        
        if (isCredit) {
            channel.balance += amount;
        } else {
            require(channel.balance >= amount, "Insufficient balance");
            channel.balance -= amount;
        }
        
        channel.nonce++;
        channel.lastUpdate = block.timestamp;
    }

    // ============ ADMIN FUNCTIONS ============

    function setTradingFee(uint256 _tradingFee) external onlyOwner {
        require(_tradingFee <= 1000, "Fee too high"); // Max 10%
        tradingFee = _tradingFee;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    function setOrderLimits(uint256 _minOrderSize, uint256 _maxOrderSize) external onlyOwner {
        require(_minOrderSize < _maxOrderSize, "Invalid limits");
        minOrderSize = _minOrderSize;
        maxOrderSize = _maxOrderSize;
    }

    function setWindows(uint256 _commitmentWindow, uint256 _revealWindow) external onlyOwner {
        commitmentWindow = _commitmentWindow;
        revealWindow = _revealWindow;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ VIEW FUNCTIONS ============

    function getOrder(bytes32 commitment) external view returns (Order memory) {
        return orders[commitment];
    }

    function getStateChannel(address trader) external view returns (StateChannel memory) {
        return stateChannels[trader];
    }

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function calculateCommitment(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bool isBuy,
        uint256 secretNonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            isBuy,
            secretNonce
        ));
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
} 