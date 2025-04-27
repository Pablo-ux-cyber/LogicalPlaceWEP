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
    // Use the CryptoCompare API to get top coins
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    const url = 'https://min-api.cryptocompare.com/data/top/mktcapfull';
    
    const params = {
      limit,
      tsym: 'USD',
      api_key: apiKey
    };
    
    const response = await axios.get(url, { params });
    
    if (!response.data || !response.data.Data) {
      throw new Error('Invalid data format from CryptoCompare API');
    }
    
    // Transform the data to our format
    const cryptos: CryptoCurrency[] = response.data.Data.map((item: any, index: number) => {
      const coinInfo = item.CoinInfo || {};
      const raw = item.RAW?.USD || {};
      const display = item.DISPLAY?.USD || {};
      
      return {
        id: coinInfo.Name || '',
        name: coinInfo.FullName || '',
        marketCap: raw.MKTCAP || 0,
        price: raw.PRICE || 0,
        imageUrl: coinInfo.ImageUrl ? `https://www.cryptocompare.com${coinInfo.ImageUrl}` : '',
        rank: index + 1
      };
    }).filter((crypto: CryptoCurrency) => {
      // Remove empty entries
      if (!crypto.id || !crypto.name) return false;
      
      // Filter out stablecoins
      const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'GUSD', 'USDD', 'USDP', 'FRAX', 'LUSD'];
      if (stablecoins.includes(crypto.id)) return false;
      
      // Filter out wrapped tokens
      const wrappedTokens = ['WBTC', 'WETH', 'WBNB', 'WAVAX', 'WMATIC', 'WFTM', 'WSOL', 'WTRX', 'WONE', 'WRUNE'];
      if (wrappedTokens.includes(crypto.id)) return false;
      
      // Filter out by name patterns
      if (
        crypto.name.toLowerCase().includes('wrapped') || 
        crypto.name.toLowerCase().includes('usd') || 
        crypto.id.startsWith('W') && crypto.name.includes('(') || 
        crypto.id.includes('USD')
      ) return false;
      
      return true;
    });
    
    console.log(`Fetched ${cryptos.length} cryptocurrencies`);
    return cryptos;
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