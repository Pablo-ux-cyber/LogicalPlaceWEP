import { UTCTimestamp } from 'lightweight-charts';

export type TimeFrame = '1w';
export type CryptoSymbol = string;

export interface CryptoCurrency {
  id: string;
  name: string;
  marketCap: number;
  price: number;
  imageUrl: string;
  rank: number;
}

export interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: UTCTimestamp;
  value: number;
  color: string;
}

export interface CryptoChartData {
  candles: CandleData[];
  volumes: VolumeData[];
}

// For backward compatibility
export type BitcoinChartData = CryptoChartData;
