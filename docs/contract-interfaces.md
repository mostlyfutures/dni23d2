# Dark Pool DEX Contract Interfaces

This document provides comprehensive interface documentation for the Dark Pool DEX smart contracts, designed for frontend and off-chain engine integration.

## Table of Contents

1. [DarkPoolDEX Contract](#darkpooldex-contract)
2. [AtomicSwap Contract](#atomicswap-contract)
3. [Integration Examples](#integration-examples)
4. [Security Considerations](#security-considerations)
5. [Error Handling](#error-handling)

## DarkPoolDEX Contract

### Contract Address
```solidity
address public darkPoolDEX;
```

### Core Functions

#### Order Management

##### `commitOrder(bytes32 commitment)`
Commits an order hash to the blockchain for privacy.

**Parameters:**
- `commitment` (bytes32): Hash of order details + secret nonce

**Events:**
- `OrderCommitted(bytes32 indexed commitment, address indexed trader, uint256 timestamp)`

**Example:**
```javascript
const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256", "uint256", "bool", "uint256"],
    [tokenIn, tokenOut, amountIn, amountOut, isBuy, secretNonce]
));

await darkPoolDEX.commitOrder(commitment);
```

##### `revealOrder(bytes32 commitment, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 secretNonce)`
Reveals the actual order details after commitment.

**Parameters:**
- `commitment` (bytes32): Original commitment hash
- `tokenIn` (address): Input token address
- `tokenOut` (address): Output token address
- `amountIn` (uint256): Input amount
- `amountOut` (uint256): Output amount
- `isBuy` (bool): Whether this is a buy order
- `secretNonce` (uint256): Secret nonce used in commitment

**Events:**
- `OrderRevealed(bytes32 indexed commitment, address indexed trader, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bool isBuy)`

**Example:**
```javascript
await darkPoolDEX.revealOrder(
    commitment,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    isBuy,
    secretNonce
);
```

##### `cancelOrder(bytes32 commitment)`
Cancels an order before it's revealed.

**Parameters:**
- `commitment` (bytes32): Order commitment to cancel

**Events:**
- `OrderCancelled(bytes32 indexed commitment, address indexed trader, uint256 timestamp)`

#### Order Matching

##### `matchOrders(bytes32 commitment1, bytes32 commitment2)`
Matches two revealed orders (Operator only).

**Parameters:**
- `commitment1` (bytes32): First order commitment
- `commitment2` (bytes32): Second order commitment

**Events:**
- `OrderMatched(bytes32 indexed commitment1, bytes32 indexed commitment2, address trader1, address trader2, uint256 amount1, uint256 amount2)`

#### Trade Settlement

##### `settleMatch(bytes32 matchId, bytes memory signature1, bytes memory signature2)`
Settles a matched trade using state channels.

**Parameters:**
- `matchId` (bytes32): Match identifier
- `signature1` (bytes): Signature from trader1
- `signature2` (bytes): Signature from trader2

**Events:**
- `TradeExecuted(address indexed trader1, address indexed trader2, address tokenIn, address tokenOut, uint256 amount1, uint256 amount2, uint256 timestamp)`

#### State Channel Management

##### `openStateChannel(address trader, uint256 initialBalance)`
Opens a state channel for a trader.

**Parameters:**
- `trader` (address): Trader address
- `initialBalance` (uint256): Initial balance to deposit

**Value:** Must send ETH equal to initialBalance

**Events:**
- `StateChannelOpened(address indexed trader, uint256 balance, uint256 nonce)`

##### `updateStateChannel(address trader, uint256 newBalance, uint256 newNonce, bytes memory signature)`
Updates state channel balance (requires signature).

**Parameters:**
- `trader` (address): Trader address
- `newBalance` (uint256): New balance
- `newNonce` (uint256): New nonce
- `signature` (bytes): Signature from trader

**Events:**
- `StateChannelUpdated(address indexed trader, uint256 newBalance, uint256 newNonce)`

##### `closeStateChannel(address trader, uint256 finalBalance, bytes memory signature)`
Closes a state channel and withdraws funds.

**Parameters:**
- `trader` (address): Trader address
- `finalBalance` (uint256): Final balance
- `signature` (bytes): Signature from trader

**Events:**
- `StateChannelClosed(address indexed trader, uint256 finalBalance)`

#### Emergency Functions

##### `requestEmergencyWithdraw(string memory reason)`
Requests emergency withdrawal from state channel.

**Parameters:**
- `reason` (string): Reason for emergency withdrawal

**Events:**
- `EmergencyWithdrawRequested(address indexed trader, uint256 requestTime, string reason)`

##### `executeEmergencyWithdraw(address trader)`
Executes emergency withdrawal after timelock (Emergency role only).

**Parameters:**
- `trader` (address): Trader to withdraw for

**Events:**
- `EmergencyWithdrawExecuted(address indexed trader, uint256 amount, uint256 timestamp)`

### View Functions

#### `getOrder(bytes32 commitment) returns (Order memory)`
Returns order details.

**Returns:**
```solidity
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
    bool isCancelled;
    bytes32 commitment;
}
```

#### `getStateChannel(address trader) returns (StateChannel memory)`
Returns state channel details.

**Returns:**
```solidity
struct StateChannel {
    address trader;
    uint256 balance;
    uint256 nonce;
    uint256 lastUpdate;
    bool isActive;
    uint256 emergencyWithdrawTime;
}
```

#### `calculateCommitment(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 secretNonce) returns (bytes32)`
Calculates commitment hash for order.

#### `canEmergencyWithdraw(address trader) returns (bool)`
Checks if emergency withdrawal is available.

### Admin Functions

#### `setTradingFee(uint256 _tradingFee)`
Sets trading fee (Admin only).

#### `setFeeCollector(address _feeCollector)`
Sets fee collector address (Admin only).

#### `setOrderLimits(uint256 _minOrderSize, uint256 _maxOrderSize)`
Sets order size limits (Admin only).

#### `setWindows(uint256 _commitmentWindow, uint256 _revealWindow)`
Sets time windows (Admin only).

#### `pause() / unpause()`
Pauses/unpauses contract (Admin only).

#### `enableEmergencyMode() / disableEmergencyMode()`
Enables/disables emergency mode.

## AtomicSwap Contract

### Core Functions

#### `createSwapOffer(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 secretNonce, uint256 customExpiry)`
Creates a new atomic swap offer.

**Parameters:**
- `tokenIn` (address): Input token address
- `tokenOut` (address): Output token address
- `amountIn` (uint256): Input amount
- `amountOut` (uint256): Output amount
- `secretNonce` (uint256): Secret nonce for commitment
- `customExpiry` (uint256): Custom expiry time (0 for default)

**Events:**
- `SwapOffered(bytes32 indexed commitment, address indexed offerer, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 expiry)`

#### `takeSwapOffer(bytes32 commitment, uint256 secretNonce)`
Takes an existing swap offer.

**Parameters:**
- `commitment` (bytes32): Offer commitment
- `secretNonce` (uint256): Secret nonce used in offer

**Events:**
- `SwapTaken(bytes32 indexed commitment, address indexed taker, address indexed offerer, uint256 amountIn, uint256 amountOut)`

#### `completeSwap(bytes32 executionId, bytes memory offererSignature, bytes memory takerSignature)`
Completes an atomic swap with signatures.

**Parameters:**
- `executionId` (bytes32): Execution identifier
- `offererSignature` (bytes): Signature from offerer
- `takerSignature` (bytes): Signature from taker

**Events:**
- `SwapCompleted(bytes32 indexed commitment, address offerer, address taker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)`

#### `cancelSwapOffer(bytes32 commitment)`
Cancels an active swap offer.

**Parameters:**
- `commitment` (bytes32): Offer commitment

**Events:**
- `SwapCancelled(bytes32 indexed commitment, address indexed offerer)`

### View Functions

#### `getSwapOffer(bytes32 commitment) returns (SwapOffer memory)`
Returns swap offer details.

#### `getSwapExecution(bytes32 executionId) returns (SwapExecution memory)`
Returns swap execution details.

#### `isOfferActive(bytes32 commitment) returns (bool)`
Checks if offer is active.

#### `calculateCommitment(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 secretNonce, uint256 nonce) returns (bytes32)`
Calculates commitment hash for offer.

## Integration Examples

### Frontend Integration

#### Creating an Order
```javascript
import { ethers } from 'ethers';

class DarkPoolDEXClient {
    constructor(contractAddress, signer) {
        this.contract = new ethers.Contract(contractAddress, ABI, signer);
    }

    async createOrder(tokenIn, tokenOut, amountIn, amountOut, isBuy) {
        // Generate secret nonce
        const secretNonce = ethers.randomBytes(32);
        
        // Calculate commitment
        const commitment = await this.contract.calculateCommitment(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            isBuy,
            secretNonce
        );

        // Commit order
        const tx = await this.contract.commitOrder(commitment);
        await tx.wait();

        // Reveal order
        const revealTx = await this.contract.revealOrder(
            commitment,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            isBuy,
            secretNonce
        );
        await revealTx.wait();

        return { commitment, secretNonce };
    }

    async openStateChannel(initialBalance) {
        const tx = await this.contract.openStateChannel(
            await this.contract.signer.getAddress(),
            initialBalance,
            { value: initialBalance }
        );
        return await tx.wait();
    }

    async getOrderStatus(commitment) {
        const order = await this.contract.getOrder(commitment);
        return {
            isRevealed: order.isRevealed,
            isExecuted: order.isExecuted,
            isCancelled: order.isCancelled,
            trader: order.trader,
            timestamp: order.timestamp
        };
    }
}
```

#### Atomic Swap Integration
```javascript
class AtomicSwapClient {
    constructor(contractAddress, signer) {
        this.contract = new ethers.Contract(contractAddress, ABI, signer);
    }

    async createSwapOffer(tokenIn, tokenOut, amountIn, amountOut, expiry = 0) {
        const secretNonce = ethers.randomBytes(32);
        const nonce = await this.contract.getCurrentNonce();
        
        const commitment = await this.contract.calculateCommitment(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            secretNonce,
            nonce
        );

        const tx = await this.contract.createSwapOffer(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            secretNonce,
            expiry
        );
        await tx.wait();

        return { commitment, secretNonce };
    }

    async takeSwapOffer(commitment, secretNonce) {
        const tx = await this.contract.takeSwapOffer(commitment, secretNonce);
        return await tx.wait();
    }

    async getActiveOffers() {
        // This would require indexing events or using a subgraph
        // Implementation depends on your data source
    }
}
```

### Off-Chain Engine Integration

#### Order Matching Engine
```javascript
class OrderMatchingEngine {
    constructor(contractAddress, operatorKey) {
        this.contract = new ethers.Contract(contractAddress, ABI, new ethers.Wallet(operatorKey));
    }

    async matchOrders(commitment1, commitment2) {
        try {
            const tx = await this.contract.matchOrders(commitment1, commitment2);
            const receipt = await tx.wait();
            
            // Parse OrderMatched event
            const matchEvent = receipt.logs.find(log => 
                log.eventName === 'OrderMatched'
            );
            
            return {
                matchId: matchEvent.args.matchId,
                trader1: matchEvent.args.trader1,
                trader2: matchEvent.args.trader2,
                amount1: matchEvent.args.amount1,
                amount2: matchEvent.args.amount2
            };
        } catch (error) {
            console.error('Order matching failed:', error);
            throw error;
        }
    }

    async settleMatch(matchId, signature1, signature2) {
        const tx = await this.contract.settleMatch(matchId, signature1, signature2);
        return await tx.wait();
    }

    async updateStateChannel(trader, newBalance, newNonce, signature) {
        const tx = await this.contract.updateStateChannel(trader, newBalance, newNonce, signature);
        return await tx.wait();
    }
}
```

#### Event Monitoring
```javascript
class EventMonitor {
    constructor(contractAddress, provider) {
        this.contract = new ethers.Contract(contractAddress, ABI, provider);
    }

    async monitorOrderEvents() {
        this.contract.on('OrderCommitted', (commitment, trader, timestamp) => {
            console.log('Order committed:', { commitment, trader, timestamp });
            // Update order book
        });

        this.contract.on('OrderRevealed', (commitment, trader, tokenIn, tokenOut, amountIn, amountOut, isBuy) => {
            console.log('Order revealed:', { commitment, trader, tokenIn, tokenOut, amountIn, amountOut, isBuy });
            // Update order book with full details
        });

        this.contract.on('OrderMatched', (commitment1, commitment2, trader1, trader2, amount1, amount2) => {
            console.log('Orders matched:', { commitment1, commitment2, trader1, trader2, amount1, amount2 });
            // Process match
        });

        this.contract.on('TradeExecuted', (trader1, trader2, tokenIn, tokenOut, amount1, amount2, timestamp) => {
            console.log('Trade executed:', { trader1, trader2, tokenIn, tokenOut, amount1, amount2, timestamp });
            // Update balances
        });
    }
}
```

## Security Considerations

### Access Control
- All admin functions require `DEFAULT_ADMIN_ROLE`
- Order matching requires `OPERATOR_ROLE`
- Emergency functions require `EMERGENCY_ROLE`

### Reentrancy Protection
- All state-changing functions use `nonReentrant` modifier
- External calls are made at the end of functions

### Emergency Controls
- Contract can be paused by admin
- Emergency mode can be enabled by emergency role
- Emergency withdrawals have 24-hour timelock

### Input Validation
- All parameters are validated for reasonable ranges
- Token addresses must be non-zero
- Amounts must be within min/max limits
- Time windows have minimum and maximum bounds

## Error Handling

### Common Error Messages
- `"Order does not exist"`: Commitment not found
- `"Order already executed"`: Order has been matched
- `"Order already revealed"`: Order details already disclosed
- `"Reveal window expired"`: Time limit exceeded for revealing
- `"Invalid commitment"`: Commitment hash doesn't match parameters
- `"Amount too small/large"`: Order size outside limits
- `"Same token"`: Input and output tokens are identical
- `"Caller is not an operator"`: Missing operator role
- `"Contract in emergency mode"`: Emergency mode is active

### Error Handling Best Practices
```javascript
async function handleContractError(contractCall) {
    try {
        return await contractCall();
    } catch (error) {
        if (error.code === 'ACTION_REJECTED') {
            throw new Error('Transaction rejected by user');
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
            throw new Error('Insufficient funds for transaction');
        } else if (error.message.includes('Order does not exist')) {
            throw new Error('Order not found');
        } else {
            console.error('Contract error:', error);
            throw new Error('Contract operation failed');
        }
    }
}
```

### Gas Estimation
```javascript
async function estimateGas(contractCall) {
    try {
        const gasEstimate = await contractCall.estimateGas();
        return gasEstimate.mul(120).div(100); // Add 20% buffer
    } catch (error) {
        console.error('Gas estimation failed:', error);
        throw new Error('Unable to estimate gas cost');
    }
}
```

## Testing

### Unit Tests
Run comprehensive test suite:
```bash
npm run test:contracts
```

### Security Tests
Run security analysis:
```bash
node scripts/security-analysis.js
```

### Integration Tests
Test with local network:
```bash
npx hardhat node
npm run test:integration
```

## Deployment

### Contract Deployment
```javascript
async function deployContracts() {
    const DarkPoolDEX = await ethers.getContractFactory("DarkPoolDEX");
    const darkPoolDEX = await DarkPoolDEX.deploy(
        ethers.parseEther("0.1"),    // minOrderSize
        ethers.parseEther("1000"),   // maxOrderSize
        300,                         // commitmentWindow (5 min)
        600,                         // revealWindow (10 min)
        50                           // tradingFee (0.5%)
    );
    await darkPoolDEX.waitForDeployment();
    
    return darkPoolDEX;
}
```

### Verification
```bash
npx hardhat verify --network mainnet CONTRACT_ADDRESS "param1" "param2" ...
```

---

For additional support or questions, refer to the main documentation or contact the development team. 