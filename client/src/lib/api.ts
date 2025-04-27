import { CandleData, VolumeData, TimeFrame, CryptoSymbol, CryptoCurrency } from '@/types/chart';

// Legacy function for backward compatibility
export async function fetchBitcoinData(timeframe: TimeFrame): Promise<{ candles: CandleData[], volumes: VolumeData[] }> {
  return fetchCryptoData('BTC', timeframe);
}

// New function that supports multiple cryptocurrencies
export async function fetchCryptoData(symbol: CryptoSymbol, timeframe: TimeFrame): Promise<{ candles: CandleData[], volumes: VolumeData[] }> {
  const response = await fetch(`/api/crypto/${symbol}/${timeframe}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol} data: ${response.statusText}`);
  }
  
  return await response.json();
}

// Function to fetch top cryptocurrencies by market cap
export async function fetchTopCryptos(limit: number = 100): Promise<CryptoCurrency[]> {
  const response = await fetch(`/api/crypto/top?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch top cryptocurrencies: ${response.statusText}`);
  }
  
  return await response.json();
}
