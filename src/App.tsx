import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SwapInterface from './components/SwapInterface';
import { backendService } from './services/BackendService';

function App() {
  const [connectedAccount, setConnectedAccount] = useState<string>('');
  const [walletProvider, setWalletProvider] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDeploymentInfo = async () => {
      try {
        const response = await fetch('/deployment.json');
        if (response.ok) {
          const data = await response.json();
          const contractAddr = data.contracts.DarkPoolDEX.address;
          setContractAddress(contractAddr);
        } else {
          setContractAddress('0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
        }
      } catch (error) {
        setContractAddress('0x610178dA211FEF7D417bC0e6FeD39F05609AD788');
      } finally {
        setIsLoading(false);
      }
    };
    loadDeploymentInfo();
  }, []);

  const handleWalletConnect = (account: string, provider: string) => {
    setConnectedAccount(account);
    setWalletProvider(provider);
  };

  const handleWalletDisconnect = () => {
    setConnectedAccount('');
    setWalletProvider('');
  };

  const handleContractDeploy = (address: string) => {
    setContractAddress(address);
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