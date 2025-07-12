export async function fetchTokenPrices(): Promise<Record<string, number>> {
  // CoinGecko IDs for the tokens
  const ids = {
    ETH: 'ethereum',
    USDC: 'usd-coin',
    USDT: 'tether',
    DAI: 'dai',
  };
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,tether,dai&vs_currencies=usd`;
  const res = await fetch(url);
  const data = await res.json();
  return {
    ETH: data[ids.ETH]?.usd || 0,
    USDC: data[ids.USDC]?.usd || 0,
    USDT: data[ids.USDT]?.usd || 0,
    DAI: data[ids.DAI]?.usd || 0,
  };
} 