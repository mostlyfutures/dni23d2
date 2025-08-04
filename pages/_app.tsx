import React from 'react';
import '../src/index.css';
import '../src/App.css';
import '../src/components/Header.css';
import '../src/components/Logo.css';
import '../src/components/SwapInterface.css';
import '../src/components/TokenSelector.css';
import '../src/components/WalletButton.css';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp; 