import React, { useState, useEffect } from 'react';
import TokenSelector from './TokenSelector';
import { web3Service } from '../services/Web3Service';
import { fetchTokenPrices } from '../utils/priceFetcher';

interface SwapInterfaceProps {
  connectedAccount?: string;
  walletProvider?: string;
  contractAddress?: string;
}

const SwapInterface: React.FC<SwapInterfaceProps> = ({ 
  connectedAccount, 
  walletProvider,
  contractAddress
}) => {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [pendingCommitments, setPendingCommitments] = useState<string[]>([]);
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, number>>({ ETH: 0, QNT: 0, RENDER: 0, USDC: 0 });
  const [contractConnected, setContractConnected] = useState(false);

  // Token addresses (real deployed contracts for localhost)
  const tokenAddresses = {
    ETH: '0x0000000000000000000000000000000000000000',
    QNT: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    RENDER: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    USDC: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0'
  };

  useEffect(() => {
    fetchPrices();
  }, [fromToken, toToken]);

  useEffect(() => {
    if (fromAmount && prices[fromToken] && prices[toToken]) {
      const fromValue = parseFloat(fromAmount);
      if (!isNaN(fromValue)) {
        const usdValue = fromValue * prices[fromToken];
        const toValue = usdValue / prices[toToken];
        setToAmount(toValue ? toValue.toFixed(6) : '');
      }
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken, prices]);

  useEffect(() => {
    const initializeContract = async () => {
      if (connectedAccount && contractAddress) {
        try {
          setOrderStatus('Connecting to contract...');
          const connected = await web3Service.connect();
          if (connected) {
            const contractConnected = await web3Service.connectToContract(contractAddress);
            if (contractConnected) {
              const info = await web3Service.getContractInfo();
              setContractInfo(info);
              setContractConnected(true);
              setupEventListeners();
              setOrderStatus('Contract connected successfully');
            } else {
              setOrderStatus('Failed to connect to contract');
            }
          } else {
            setOrderStatus('Failed to connect wallet');
          }
        } catch (error) {
          setOrderStatus('Failed to connect to contract');
        }
      }
    };
    initializeContract();
  }, [connectedAccount, contractAddress]);

  const fetchPrices = async () => {
    try {
      const priceData = await fetchTokenPrices();
      setPrices(priceData);
    } catch (error) {
      setOrderStatus('Failed to fetch prices.');
    }
  };

  const loadContractInfo = async () => {
    try {
      if (contractAddress) {
        await web3Service.connectToContract(contractAddress);
        setContractConnected(true);
        const info = await web3Service.getContractInfo();
        setContractInfo(info);
        setupEventListeners();
      }
    } catch (error) {
      setContractConnected(false);
      setOrderStatus('Failed to connect to contract.');
    }
  };

  const setupEventListeners = () => {
    try {
      web3Service.onOrderCommitted((commitment, trader, timestamp) => {
        setPendingCommitments(prev => [...prev, commitment]);
        setOrderStatus(`Order committed! Commitment: ${commitment.slice(0, 10)}...`);
      });
      web3Service.onOrderRevealed((commitment, trader, tokenIn, tokenOut, amountIn, amountOut, isBuy) => {
        setOrderStatus(`Order revealed! Ready for matching.`);
      });
      web3Service.onOrderMatched((commitment1, commitment2, trader1, trader2, amount1, amount2) => {
        setOrderStatus(`Order matched! Trade executed successfully.`);
      });
    } catch (err) {
      setOrderStatus('Error setting up event listeners.');
    }
  };

  const handleSwap = async () => {
    if (!connectedAccount) {
      setOrderStatus('Please connect your wallet');
      return;
    }
    if (!contractAddress) {
      setOrderStatus('Contract address not found');
      return;
    }
    if (!contractConnected) {
      setOrderStatus('Contract not connected - trying to reconnect...');
      try {
        const connected = await web3Service.connect();
        if (connected) {
          const contractConnected = await web3Service.connectToContract(contractAddress);
          if (contractConnected) {
            setContractConnected(true);
            setOrderStatus('Contract reconnected - please try again');
          }
        }
      } catch (error) {
        setOrderStatus('Failed to reconnect to contract');
      }
      return;
    }
    if (!fromAmount) {
      setOrderStatus('Please enter an amount to swap');
      return;
    }
    if (fromToken === toToken) {
      setOrderStatus('Cannot swap the same token');
      return;
    }
    setIsLoading(true);
    setOrderStatus('Committing order...');
    try {
      const commitment = await web3Service.commitOrder(
        tokenAddresses[fromToken as keyof typeof tokenAddresses],
        tokenAddresses[toToken as keyof typeof tokenAddresses],
        fromAmount,
        toAmount,
        true
      );
      setOrderStatus(`Order committed! Commitment: ${commitment.slice(0, 10)}...`);
      setFromAmount('');
      setToAmount('');
    } catch (error) {
      setOrderStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealOrder = async (commitment: string) => {
    setIsLoading(true);
    setOrderStatus('Revealing order...');
    try {
      await web3Service.revealOrder(commitment);
      setOrderStatus('Order revealed successfully!');
      setPendingCommitments(prev => prev.filter(c => c !== commitment));
    } catch (error) {
      setOrderStatus(`Error revealing order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="swap-interface">
      <div className="swap-card">
        <div className="swap-header">
          <h2>Dark Pool Swap</h2>
          <p className="swap-subtitle">Private, Decentralized Swaps</p>
          {connectedAccount && (
            <div className="connection-status">
              <span className="status-indicator connected"></span>
              <span className="status-text">
                Connected via {walletProvider} ({connectedAccount.slice(0, 6)}...{connectedAccount.slice(-4)})
              </span>
            </div>
          )}
          {contractInfo && (
            <div className="contract-info">
              <small>
                Fee: {parseInt(contractInfo.tradingFee) / 100}% | 
                Min: {parseFloat(contractInfo.minOrderSize)} | 
                Max: {parseFloat(contractInfo.maxOrderSize)}
              </small>
            </div>
          )}
        </div>
        <div className="swap-form">
          <div className="token-input">
            <div className="input-header">
              <span>From</span>
              <span className="balance">Balance: 0.00</span>
            </div>
            <div className="input-container">
              <input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="amount-input"
              />
              <TokenSelector
                value={fromToken}
                onChange={setFromToken}
              />
            </div>
          </div>
          <div className="swap-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="token-input">
            <div className="input-header">
              <span>To</span>
              <span className="balance">Balance: 0.00</span>
            </div>
            <div className="input-container">
              <input
                type="number"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="amount-input"
              />
              <TokenSelector
                value={toToken}
                onChange={setToToken}
              />
            </div>
          </div>
          {orderStatus && (
            <div className="order-status">
              <p>{orderStatus}</p>
            </div>
          )}
          <button
            className={`swap-button ${!connectedAccount || isLoading ? 'disabled' : ''}`}
            onClick={handleSwap}
            disabled={!connectedAccount || isLoading}
          >
            {isLoading ? 'Processing...' : !connectedAccount ? 'Connect Wallet to Swap' : 'Commit Order'}
          </button>
        </div>
        {pendingCommitments.length > 0 && (
          <div className="pending-orders">
            <h3>Pending Orders</h3>
            {pendingCommitments.map((commitment, index) => (
              <div key={index} className="pending-order">
                <span className="commitment">
                  {commitment.slice(0, 10)}...{commitment.slice(-8)}
                </span>
                <button
                  className="reveal-button"
                  onClick={() => handleRevealOrder(commitment)}
                  disabled={isLoading}
                >
                  Reveal
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SwapInterface;