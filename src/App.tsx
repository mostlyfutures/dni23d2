import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import SwapInterface from './components/SwapInterface';

function App() {
  const [connectedAccount, setConnectedAccount] = useState<string>('');
  const [walletProvider, setWalletProvider] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDeploymentInfo = async () => {
      try {
        console.log('🔍 Trying to fetch deployment.json...');
        const response = await fetch('/deployment.json');
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Deployment data:', data);
          // Fix: The correct path is data.contracts.DarkPoolDEX.address
          const contractAddr = data.contracts.DarkPoolDEX.address;
          setContractAddress(contractAddr);
          console.log('✅ Contract address loaded:', contractAddr);
        } else {
          console.warn('⚠️ deployment.json not found - using fallback');
          // Set a fallback address for local testing
          setContractAddress('0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
          console.log('⚠️ Using fallback contract address: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
        }
      } catch (error) {
        console.error('❌ Failed to load deployment info:', error);
        // Set a fallback address for local testing
        setContractAddress('0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
        console.log('⚠️ Using fallback contract address: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
      } finally {
        setIsLoading(false);
      }
    };

    loadDeploymentInfo();
  }, []);

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

  const handleContractDeploy = (address: string) => {
    setContractAddress(address);
    console.log(`Contract deployed at: ${address}`);
  };

  if (isLoading) {
    return <div className="App">Loading...</div>;
  }

  return (
    <div className="App">
      <Header 
        onConnect={handleWalletConnect}
        onDisconnect={handleWalletDisconnect}
        onContractDeploy={handleContractDeploy}
      />
      <main className="main-content">
        <SwapInterface 
          connectedAccount={connectedAccount}
          walletProvider={walletProvider}
          contractAddress={contractAddress}
        />
      </main>
    </div>
  );
}

export default App;