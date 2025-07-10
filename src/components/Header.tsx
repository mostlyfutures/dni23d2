import React from 'react';
import './Header.css';
import Logo from './Logo';
import WalletButton from './WalletButton';

interface HeaderProps {
  onConnect?: (account: string, provider: string) => void;
  onDisconnect?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onConnect, onDisconnect }) => {
  return (
    <header className="header">
      <div className="header-content">
        <Logo />
        <WalletButton 
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
      </div>
    </header>
  );
};

export default Header; 