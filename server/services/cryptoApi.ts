import axios from 'axios';

interface CryptoResponse {
  time: number;
  close: number;
  high: number;
  low: number;
  open: number;
  volumefrom: number;
  volumeto: number;
}

export interface CryptoCurrency {
  id: string;        // Symbol (BTC, ETH, etc.)
  name: string;      // Full name (Bitcoin, Ethereum, etc.)
  marketCap: number; // Market capitalization
  price: number;     // Current price
  imageUrl: string;  // URL to the crypto logo
  rank: number;      // Rank by market cap
}

export type CryptoSymbol = string; // Now we'll support any symbol

// Список криптовалют для проверки, предоставленный пользователем
export const CRYPTO_LIST = [
  'BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'DOGE', 'ADA', 'TRX',
  'SUI', 'LINK', 'AVAX', 'XLM', 'LEO', 'TON', 'SHIB', 'HBAR',
  'BCH', 'LTC', 'DOT', 'HYPE',
  'BGB', 'PI', 'XMR',
  'CBBTC', 'PEPE', 'UNI', 'APT', 'OKB', 'NEAR', 'TAO', 'ONDO', 'TRUMP', 'GT', 'ICP',
  'ETC', 'AAVE', 'KAS', 'CRO', 'MNT', 'VET', 'RENDER',
  'POL', 'ATOM', 'ENA',
  'FET', 'ALGO', 'FTN', 'FIL', 'TIA',
  'ARB',
  'WLD', 'BONK',
  'STX', 'JUP', 'KCS', 'OP', 'MKR',
  'NEXO', 'QNT', 'FARTCOIN', 'IMX', 'IP',
  'FLR', 'SEI', 'EOS', 'INJ',
  'GRT',
  'CRV',
  'RAY'
];

// Полные названия для монет
const CRYPTO_NAMES: {[key: string]: string} = {
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'BNB': 'Binance Coin',
  'SOL': 'Solana',
  'XRP': 'XRP',
  'ADA': 'Cardano',
  'DOGE': 'Dogecoin',
  'AVAX': 'Avalanche',
  'DOT': 'Polkadot',
  'TRX': 'TRON',
  'LINK': 'Chainlink',
  'XLM': 'Stellar',
  'LEO': 'LEO Token',
  'TON': 'Toncoin',
  'SHIB': 'Shiba Inu',
  'HBAR': 'Hedera',
  'BCH': 'Bitcoin Cash',
  'LTC': 'Litecoin',
  'HYPE': 'Hyperliquid',
  'BGB': 'Bitget Token',
  'PI': 'Pi Network',
  'XMR': 'Monero',
  'CBBTC': 'Cave Bitcoin',
  'PEPE': 'Pepe',
  'UNI': 'Uniswap',
  'APT': 'Aptos',
  'OKB': 'OKB',
  'NEAR': 'NEAR Protocol',
  'TAO': 'Bittensor',
  'ONDO': 'Ondo',
  'TRUMP': 'Trump',
  'GT': 'GateToken',
  'ICP': 'Internet Computer',
  'ETC': 'Ethereum Classic',
  'AAVE': 'Aave',
  'KAS': 'Kaspa',
  'CRO': 'Cronos',
  'MNT': 'Mantle',
  'VET': 'VeChain',
  'RENDER': 'Render',
  'POL': 'Polygon zkEVM',
  'ATOM': 'Cosmos Hub',
  'ENA': 'Ethena',
  'FET': 'Fetch.ai',
  'ALGO': 'Algorand',
  'FTN': 'Fountain',
  'FIL': 'Filecoin',
  'TIA': 'Celestia',
  'ARB': 'Arbitrum',
  'WLD': 'Worldcoin',
  'BONK': 'Bonk',
  'STX': 'Stacks',
  'JUP': 'Jupiter',
  'KCS': 'KuCoin Token',
  'OP': 'Optimism',
  'MKR': 'Maker',
  'NEXO': 'Nexo',
  'QNT': 'Quant',
  'FARTCOIN': 'Fartcoin',
  'IMX': 'Immutable X',
  'IP': 'IP',
  'FLR': 'Flare',
  'SEI': 'Sei',
  'EOS': 'EOS',
  'INJ': 'Injective',
  'GRT': 'The Graph',
  'CRV': 'Curve DAO',
  'RAY': 'Raydium'
};

// Function to fetch top cryptocurrencies by market cap
export async function fetchTopCryptos(limit: number = 100): Promise<CryptoCurrency[]> {
  try {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    
    // Отфильтруем список, чтобы ограничить максимальным количеством монет, если указан лимит
    const limitedList = CRYPTO_LIST.slice(0, limit);
    const cryptoList = limitedList.join(',');
    
    // URL и параметры для запроса цен нескольких монет одновременно
    const url = 'https://min-api.cryptocompare.com/data/pricemultifull';
    const params = {
      fsyms: cryptoList, // Используем наш список
      tsyms: 'USD',
      api_key: apiKey
    };
    
    // Запрашиваем данные для всех монет одним запросом
    console.log(`Requesting data for ${limitedList.length} cryptocurrencies...`);
    
    try {
      const response = await axios.get(url, { params });
      
      let result: CryptoCurrency[] = [];
      
      if (response.data && response.data.RAW) {
        // Преобразуем данные в наш формат
        for (let i = 0; i < limitedList.length; i++) {
          const symbol = limitedList[i];
          
          if (response.data.RAW[symbol] && response.data.RAW[symbol].USD) {
            const data = response.data.RAW[symbol].USD;
            
            result.push({
              id: symbol,
              name: CRYPTO_NAMES[symbol] || symbol, // Используем ранее определенное имя или сам символ
              marketCap: data.MKTCAP || 0,
              price: data.PRICE || 0,
              imageUrl: data.IMAGEURL ? `https://www.cryptocompare.com${data.IMAGEURL}` : '',
              rank: i + 1 // Ранг по порядку в нашем списке
            });
          } else {
            // Если данных нет, добавляем монету без данных о цене
            result.push({
              id: symbol,
              name: CRYPTO_NAMES[symbol] || symbol,
              marketCap: 0,
              price: 0,
              imageUrl: '',
              rank: i + 1
            });
          }
        }
      } else {
        console.log('API returned invalid data format, creating list with empty price data');
        
        // Если API не вернул данные, создаем список без данных о ценах
        result = limitedList.map((symbol, index) => ({
          id: symbol,
          name: CRYPTO_NAMES[symbol] || symbol,
          marketCap: 0,
          price: 0,
          imageUrl: '',
          rank: index + 1
        }));
      }
      
      console.log(`Fetched ${result.length} cryptocurrencies from the specified list`);
      return result;
    } catch (error) {
      console.error('Error in fetchTopCryptos:', error);
      
      // В случае ошибки возвращаем список монет без данных о ценах
      return limitedList.map((symbol, index) => ({
        id: symbol,
        name: CRYPTO_NAMES[symbol] || symbol,
        marketCap: 0,
        price: 0,
        imageUrl: '',
        rank: index + 1
      }));
    }
  } catch (error) {
    console.error('Error in fetchTopCryptos outer try block:', error);
    return []; // Return empty array on error
  }
}

// Function to fetch historical price data for a specific cryptocurrency
export async function fetchCryptoPriceData(symbol: CryptoSymbol, timeframe: string) {
  try {
    // Проверяем, что символ монеты не пустой
    if (!symbol) {
      console.error('Symbol is empty');
      throw new Error('Symbol is required');
    }
    
    // API key from environment
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    
    // Define parameters based on timeframe
    let url = 'https://min-api.cryptocompare.com/data/v2/histoday';
    let limit = 2000; // Maximum allowed by the API for daily
    let aggregate = 1;
    
    if (timeframe === '1h') {
      url = 'https://min-api.cryptocompare.com/data/v2/histohour';
    } else if (timeframe === '1d' || timeframe === 'daily') {
      // Already using histoday
    } else if (timeframe === '1w' || timeframe === 'weekly') {
      // Для недельного таймфрейма нам нужно иметь минимум 20 недель данных
      // для правильного расчета Bollinger Bands (согласно PineScript)
      limit = 300; // Больше недельных данных для корректного расчета BB
      aggregate = 7; // Aggregate 7 days to get weekly data
    } else {
      console.warn(`Unknown timeframe: ${timeframe}, defaulting to daily`);
    }
    
    // Prepare request parameters
    const params = {
      fsym: symbol.toUpperCase(),
      tsym: 'USD',
      limit,
      aggregate,
      api_key: apiKey
    };
    
    // Make the request
    const response = await axios.get(url, { params });
    
    // Check if we have valid data
    if (!response.data || !response.data.Data || !response.data.Data.Data) {
      console.error('Invalid response structure from CryptoCompare:', response.data);
      throw new Error('Invalid data format from CryptoCompare API');
    }
    
    // Extract the data
    const historicalData: CryptoResponse[] = response.data.Data.Data;
    console.log(`Received ${historicalData.length} data points for ${timeframe} timeframe`);
    
    // If we're requesting weekly data but got daily data (which can happen due to API limitations),
    // we need to aggregate it manually into weekly candles
    let processedData = historicalData;
    
    // Special handling for weekly timeframe when we need to convert daily to weekly
    if ((timeframe === '1w' || timeframe === 'weekly') && aggregate === 1) {
      console.log('Converting daily data to weekly candles...');
      try {
        processedData = aggregateDailyToWeekly(historicalData);
        console.log(`Generated ${processedData.length} weekly candles from daily data`);
      } catch (aggregationError) {
        console.error('Failed to aggregate daily data to weekly:', aggregationError);
        // Continue with the original data
      }
    }
    
    // Transform the data into candle format and volume format
    const candles = processedData.map(item => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close
    }));
    
    const volumes = processedData.map(item => {
      // Determine color based on whether the price went up or down
      const isUp = item.close >= item.open;
      return {
        time: item.time,
        value: item.volumefrom, // Volume in the base currency
        color: isUp ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)'
      };
    });
    
    return {
      candles,
      volumes
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    
    // Try to use fallback method to get weekly data if the error is specific to that
    if ((timeframe === '1w' || timeframe === 'weekly') && String(error).includes('weekly')) {
      console.log('Trying fallback to daily data for weekly timeframe');
      try {
        return await fetchDailyDataForWeekly(symbol);
      } catch (fallbackError) {
        console.error('Error in fallback weekly data generation:', fallbackError);
        throw new Error('Failed to fetch weekly cryptocurrency data (even with fallback)');
      }
    }
    
    throw error;
  }
}

// Helper function to convert daily candle data to weekly
function aggregateDailyToWeekly(dailyData: CryptoResponse[]): CryptoResponse[] {
  const weeklyData: CryptoResponse[] = [];
  let currentWeekData: CryptoResponse[] = [];
  let lastDayOfWeek = 0;
  
  // Process each daily candle
  for (const candle of dailyData) {
    const date = new Date(candle.time * 1000);
    const dayOfWeek = date.getUTCDay(); // 0 is Sunday, 6 is Saturday
    
    // Start a new week on Sunday
    if (dayOfWeek < lastDayOfWeek || currentWeekData.length === 0) {
      if (currentWeekData.length > 0) {
        // Calculate the weekly candle from the accumulated daily candles
        const weekOpen = currentWeekData[0].open;
        const weekClose = currentWeekData[currentWeekData.length - 1].close;
        const weekHigh = Math.max(...currentWeekData.map(c => c.high));
        const weekLow = Math.min(...currentWeekData.map(c => c.low));
        const weekVolumefrom = currentWeekData.reduce((sum, c) => sum + c.volumefrom, 0);
        const weekVolumeto = currentWeekData.reduce((sum, c) => sum + c.volumeto, 0);
        const weekTime = currentWeekData[0].time; // Use the first day's timestamp
        
        weeklyData.push({
          time: weekTime,
          open: weekOpen,
          high: weekHigh,
          low: weekLow,
          close: weekClose,
          volumefrom: weekVolumefrom,
          volumeto: weekVolumeto
        });
      }
      
      currentWeekData = [candle];
    } else {
      currentWeekData.push(candle);
    }
    
    lastDayOfWeek = dayOfWeek;
  }
  
  // Don't forget to process the last week if there's data accumulated
  if (currentWeekData.length > 0) {
    const weekOpen = currentWeekData[0].open;
    const weekClose = currentWeekData[currentWeekData.length - 1].close;
    const weekHigh = Math.max(...currentWeekData.map(c => c.high));
    const weekLow = Math.min(...currentWeekData.map(c => c.low));
    const weekVolumefrom = currentWeekData.reduce((sum, c) => sum + c.volumefrom, 0);
    const weekVolumeto = currentWeekData.reduce((sum, c) => sum + c.volumeto, 0);
    const weekTime = currentWeekData[0].time;
    
    weeklyData.push({
      time: weekTime,
      open: weekOpen,
      high: weekHigh,
      low: weekLow,
      close: weekClose,
      volumefrom: weekVolumefrom,
      volumeto: weekVolumeto
    });
  }
  
  return weeklyData;
}

// Fallback function to get daily data and manually convert to weekly
async function fetchDailyDataForWeekly(symbol: CryptoSymbol) {
  // Fetch daily data
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  const url = 'https://min-api.cryptocompare.com/data/v2/histoday';
  const params = {
    fsym: symbol.toUpperCase(),
    tsym: 'USD',
    limit: 2000, // Get as much data as possible
    api_key: apiKey
  };
  
  const response = await axios.get(url, { params });
  
  // Check if we have valid data
  if (!response.data || !response.data.Data || !response.data.Data.Data) {
    throw new Error('Invalid daily data format from fallback API call');
  }
  
  // Extract the daily data
  const dailyData: CryptoResponse[] = response.data.Data.Data;
  
  // Aggregate into weekly data
  const weeklyData = aggregateDailyToWeekly(dailyData);
  
  // Transform to the expected format
  const candles = weeklyData.map(item => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close
  }));
  
  const volumes = weeklyData.map(item => {
    const isUp = item.close >= item.open;
    return {
      time: item.time,
      value: item.volumefrom,
      color: isUp ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)'
    };
  });
  
  return {
    candles,
    volumes
  };
}
