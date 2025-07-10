import React, { useState } from 'react';
import './App.css';
import Header from './components/Header';
import SwapInterface from './components/SwapInterface';

function App() {
  const [connectedAccount, setConnectedAccount] = useState<string>('');
  const [walletProvider, setWalletProvider] = useState<string>('');

  const handleWalletConnect = (account: string, provider: string) => {
    setConnectedAccount(account);
    setWalletProvider(provider);
    console.log(`Connected to ${provider} with account: ${account}`);
  };

  const handleWalletDisconnect = () => {
    setConnectedAccount('');
    setWalletProvider('');
    console.log('Wallet disconnected');
  };

  return (
    <div className="App">
      <Header 
        onConnect={handleWalletConnect}
        onDisconnect={handleWalletDisconnect}
      />
      <main className="main-content">
        <SwapInterface 
          connectedAccount={connectedAccount}
          walletProvider={walletProvider}
        />
      </main>
    </div>
  );
}

export default App; 