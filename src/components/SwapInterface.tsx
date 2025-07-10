import React, { useState } from 'react';
import './SwapInterface.css';
import TokenSelector from './TokenSelector';

interface SwapInterfaceProps {
  connectedAccount?: string;
  walletProvider?: string;
}

const SwapInterface: React.FC<SwapInterfaceProps> = ({ 
  connectedAccount, 
  walletProvider 
}) => {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  const handleSwap = () => {
    if (!connectedAccount) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!fromAmount || !toAmount) {
      alert('Please enter amounts for both tokens');
      return;
    }

    console.log(`Swapping ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`);
    // Here you would implement the actual swap logic
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
                onChange={(e) => setToAmount(e.target.value)}
                className="amount-input"
              />
              <TokenSelector
                value={toToken}
                onChange={setToToken}
              />
            </div>
          </div>

          <button
            className={`swap-button ${!connectedAccount ? 'disabled' : ''}`}
            onClick={handleSwap}
            disabled={!connectedAccount}
          >
            {!connectedAccount ? 'Connect Wallet to Swap' : 'Swap'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapInterface; 