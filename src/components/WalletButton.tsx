import React, { useState, useEffect, useRef } from 'react';
import './WalletButton.css';

interface WalletButtonProps {
  onConnect?: (account: string, provider: string) => void;
  onDisconnect?: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

const WalletButton: React.FC<WalletButtonProps> = ({ onConnect, onDisconnect }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if already connected
    checkConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('disconnect', handleDisconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearConnectionTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startConnectionTimeout = () => {
    clearConnectionTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsConnecting(false);
      alert('Connection timeout. Please try again.');
    }, 5000); // 5 seconds
  };

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          setProvider('metamask');
          if (onConnect) {
            onConnect(accounts[0], 'metamask');
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      handleDisconnect();
    } else {
      setAccount(accounts[0]);
      if (onConnect) {
        onConnect(accounts[0], provider);
      }
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAccount('');
    setProvider('');
    clearConnectionTimeout();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install MetaMask to use this feature.');
      return;
    }

    setIsConnecting(true);
    startConnectionTimeout();

    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      clearConnectionTimeout();
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        setProvider('metamask');
        if (onConnect) {
          onConnect(accounts[0], 'metamask');
        }
      }
    } catch (error: any) {
      clearConnectionTimeout();
      if (error.code === 4001) {
        alert('Please connect to MetaMask to use this feature.');
      } else {
        console.error('Error connecting to MetaMask:', error);
        alert('Failed to connect to MetaMask. Please try again.');
      }
      setIsConnecting(false);
    }
  };

  const connectWalletConnect = async () => {
    setIsConnecting(true);
    startConnectionTimeout();

    try {
      // For now, we'll simulate WalletConnect
      // In a real implementation, you would use the WalletConnect library
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      clearConnectionTimeout();
      
      // Simulate a wallet address
      const mockAccount = '0x' + Array.from({length: 40}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      setAccount(mockAccount);
      setIsConnected(true);
      setProvider('walletconnect');
      if (onConnect) {
        onConnect(mockAccount, 'walletconnect');
      }
    } catch (error) {
      clearConnectionTimeout();
      console.error('Error connecting to WalletConnect:', error);
      alert('Failed to connect to WalletConnect. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (window.ethereum) {
      await connectMetaMask();
    } else {
      // If MetaMask is not available, show options
      const choice = window.confirm(
        'MetaMask is not installed. Would you like to try WalletConnect instead?'
      );
      if (choice) {
        await connectWalletConnect();
      }
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnected) {
    return (
      <div className="wallet-button-container">
        <button className="wallet-button connected" onClick={handleDisconnect}>
          <div className="wallet-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
          <span className="wallet-text">
            {formatAddress(account)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-button-container">
      <button
        className={`wallet-button ${isConnecting ? 'connecting' : ''}`}
        onClick={handleConnect}
        disabled={isConnecting}
      >
        <div className="wallet-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V12Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 21V13H7V21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 3V8H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="wallet-text">
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </span>
      </button>
    </div>
  );
};

export default WalletButton; 