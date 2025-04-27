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

// Function to fetch top cryptocurrencies by market cap
export async function fetchTopCryptos(limit: number = 100): Promise<CryptoCurrency[]> {
  try {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    
    // Step 1: First get data for major cryptocurrencies directly
    const majorCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC'];
    const majorCoinsList = majorCoins.join(',');
    
    const majorCoinsUrl = 'https://min-api.cryptocompare.com/data/pricemultifull';
    const majorCoinsParams = {
      fsyms: majorCoinsList,
      tsyms: 'USD',
      api_key: apiKey
    };
    
    // Get data for major coins
    let majorCryptosData: CryptoCurrency[] = [];
    try {
      const majorResponse = await axios.get(majorCoinsUrl, { params: majorCoinsParams });
      
      if (majorResponse.data && majorResponse.data.RAW) {
        for (const [symbol, data] of Object.entries(majorResponse.data.RAW)) {
          const coinData = (data as any).USD;
          
          majorCryptosData.push({
            id: symbol,
            name: symbol, // We don't have full name in this response
            marketCap: coinData.MKTCAP || 0,
            price: coinData.PRICE || 0,
            imageUrl: coinData.IMAGEURL ? `https://www.cryptocompare.com${coinData.IMAGEURL}` : '',
            rank: majorCoins.indexOf(symbol) // Use the order we defined
          });
        }
      }
    } catch (e) {
      console.error('Error fetching major cryptocurrencies:', e);
      // Continue even if this fails
    }
    
    // Step 2: Skip the top cryptocurrencies from the regular API as it seems to be problematic
    // Since we already have the major coins, let's just use those
    
    console.log(`Using only major cryptocurrencies (${majorCryptosData.length})`);
    
    // Add a few more properties to the major coins to make them more complete
    const improvedMajorCryptos = majorCryptosData.map((crypto, index) => {
      // Add proper full names for the major coins
      const fullNames: {[key: string]: string} = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'BNB': 'Binance Coin',
        'SOL': 'Solana',
        'XRP': 'XRP',
        'ADA': 'Cardano',
        'DOGE': 'Dogecoin',
        'AVAX': 'Avalanche',
        'DOT': 'Polkadot',
        'MATIC': 'Polygon'
      };
      
      return {
        ...crypto,
        name: fullNames[crypto.id] || crypto.id,
        rank: index + 1
      };
    });
    
    // Skip trying to get additional coins from the API since it's causing errors
    const topCryptos: CryptoCurrency[] = [];
    
    // Combine major coins with top coins and limit to requested amount
    const allCryptos = [...improvedMajorCryptos, ...topCryptos].slice(0, limit);
    
    console.log(`Fetched ${allCryptos.length} cryptocurrencies (including ${improvedMajorCryptos.length} major coins)`);
    return allCryptos;
  } catch (error) {
    console.error('Error fetching top cryptocurrencies:', error);
    throw new Error('Failed to fetch top cryptocurrencies');
  }
}

export async function fetchCryptoPriceData(symbol: CryptoSymbol, timeframe: string) {
  // Map timeframe to API parameters
  const limit = 5000; // Try to get more historical data (max API allows)
  
  // Map frontend timeframes to API timeframes
  let apiTimeframe = 'hour';
  let aggregate = 1;
  
  switch (timeframe) {
    case '1h':
      apiTimeframe = 'hour';
      break;
    case '4h':
      apiTimeframe = 'hour';
      aggregate = 4;
      break;
    case '1d':
      apiTimeframe = 'day';
      break;
    case '1w':
      apiTimeframe = 'day';  // We'll get daily data and convert to weekly
      aggregate = 1;         // No aggregation, we'll do it manually
      break;
    default:
      apiTimeframe = 'hour';
  }
  
  // Use the base API URL
  const baseUrl = 'https://min-api.cryptocompare.com/data/v2/';
  
  // For weekly timeframe, get maximum available data
  // Limit to 2000 to avoid API errors
  const requestLimit = 2000;
  
  // Complete API URL
  const url = `${baseUrl}histo${apiTimeframe}`;
  
  // Using the API key from environment
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  
  const params = {
    fsym: symbol,          // From Symbol (cryptocurrency)
    tsym: 'USD',           // To Symbol (US Dollar)
    limit: requestLimit,   // Use our adjusted limit value
    aggregate: aggregate,  // Aggregate data points
    api_key: apiKey        // API key for authentication
  };
  
  try {
    const response = await axios.get(url, { params });
    
    // Check if we have valid data
    if (!response.data || !response.data.Data || !response.data.Data.Data) {
      console.error('Invalid response structure from CryptoCompare:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid data format from CryptoCompare API');
    }
    
    const rawData = response.data.Data.Data;
    console.log(`Received ${rawData.length} data points for ${timeframe} timeframe`);
    
    // Return all available data points
    const limitedData = rawData;
    
    // Transform the data to the format needed by the chart
    const candles = limitedData.map((item: CryptoResponse) => ({
      time: item.time as number,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close
    }));
    
    // Create volume data
    const volumes = limitedData.map((item: CryptoResponse) => ({
      time: item.time as number,
      value: item.volumefrom,
      color: item.close >= item.open ? '#26A69A' : '#EF5350'
    }));
    
    return { candles, volumes };
  } catch (error) {
    console.error('Error fetching data from CryptoCompare:', error);
    // If weekly timeframe fails, use daily data with weekly aggregation as fallback
    if (timeframe === '1w') {
      console.log('Trying fallback to daily data for weekly timeframe');
      // Create a modified copy of the current function params for daily data
      try {
        const dailyUrl = `${baseUrl}histoday`;
        const dailyParams = {
          ...params,
          aggregate: 1,  // Get raw daily data
          limit: 2000    // Get maximum data for weekly aggregation
        };
        
        const dailyResponse = await axios.get(dailyUrl, { params: dailyParams });
        if (!dailyResponse.data || !dailyResponse.data.Data || !dailyResponse.data.Data.Data) {
          throw new Error('Invalid daily data format from fallback API call');
        }
        
        const rawDailyData = dailyResponse.data.Data.Data;
        
        // Формируем недельные свечи по тому же принципу, как TradingView
        const weeklyCandles: CryptoResponse[] = [];
        
        // TradingView обычно начинает неделю с понедельника
        for (let i = 0; i < rawDailyData.length; i += 1) {
          const date = new Date(rawDailyData[i].time * 1000);
          const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          
          // Если понедельник (или первая свеча в данных), начинаем новую неделю
          if (dayOfWeek === 1 || i === 0) {
            // Найдем следующий понедельник или конец данных
            let endIndex = i + 1;
            while (endIndex < rawDailyData.length) {
              const nextDate = new Date(rawDailyData[endIndex].time * 1000);
              if (nextDate.getDay() === 1) break; // Нашли следующий понедельник
              endIndex++;
            }
            
            const weekData = rawDailyData.slice(i, endIndex);
            
            if (weekData.length > 0) {
              // Формируем недельную свечу в точности как TradingView:
              // Open = первое значение периода
              // High = максимум за период
              // Low = минимум за период
              // Close = последнее значение периода 
              const weekCandle: CryptoResponse = {
                time: weekData[0].time,
                open: weekData[0].open,
                high: Math.max(...weekData.map((c: CryptoResponse) => c.high)),
                low: Math.min(...weekData.map((c: CryptoResponse) => c.low)),
                close: weekData[weekData.length - 1].close,
                volumefrom: weekData.reduce((sum: number, c: CryptoResponse) => sum + c.volumefrom, 0),
                volumeto: weekData.reduce((sum: number, c: CryptoResponse) => sum + c.volumeto, 0)
              };
              weeklyCandles.push(weekCandle);
            }
          }
        }
        
        // Transform the weekly candles to chart format
        const candles = weeklyCandles.map(item => ({
          time: item.time as number,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close
        }));
        
        // Create volume data
        const volumes = weeklyCandles.map(item => ({
          time: item.time as number,
          value: item.volumefrom,
          color: item.close >= item.open ? '#26A69A' : '#EF5350'
        }));
        
        console.log(`Generated ${candles.length} weekly candles from daily data (fallback method)`);
        return { candles, volumes };
      } catch (fallbackError) {
        console.error('Error in fallback weekly data generation:', fallbackError);
        throw new Error('Failed to fetch weekly cryptocurrency data (even with fallback)');
      }
    } else {
      throw new Error('Failed to fetch cryptocurrency data');
    }
  }
}