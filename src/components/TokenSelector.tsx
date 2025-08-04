import React, { useState } from 'react';

interface Token {
  symbol: string;
  name: string;
  icon: string;
}

interface TokenSelectorProps {
  value: string;
  onChange: (token: string) => void;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const tokens: Token[] = [
    { symbol: 'ETH', name: 'Ethereum', icon: '🔷' },
    { symbol: 'USDC', name: 'USD Coin', icon: '🔵' },
    { symbol: 'USDT', name: 'Tether', icon: '🟢' },
    { symbol: 'DAI', name: 'Dai', icon: '🟡' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '🟠' },
    { symbol: 'LINK', name: 'Chainlink', icon: '🔗' }
  ];

  const selectedToken = tokens.find(token => token.symbol === value) || tokens[0];

  const handleTokenSelect = (token: Token) => {
    onChange(token.symbol);
    setIsOpen(false);
  };

  return (
    <div className="token-selector">
      <button
        className="token-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="token-info">
          <span className="token-icon">{selectedToken.icon}</span>
          <span className="token-symbol">{selectedToken.symbol}</span>
        </div>
        <svg
          className={`token-arrow ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="token-dropdown">
          {tokens.map((token) => (
            <button
              key={token.symbol}
              className={`token-option ${token.symbol === value ? 'selected' : ''}`}
              onClick={() => handleTokenSelect(token)}
              type="button"
            >
              <div className="token-info">
                <span className="token-icon">{token.icon}</span>
                <div className="token-details">
                  <span className="token-symbol">{token.symbol}</span>
                  <span className="token-name">{token.name}</span>
                </div>
              </div>
              {token.symbol === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="var(--primary-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 