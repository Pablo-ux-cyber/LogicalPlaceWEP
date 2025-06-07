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

/**
 * Aggregate daily candles into weekly candles like TradingView
 * Week starts on Monday and ends on Sunday
 */
function aggregateDailyToWeekly(dailyData: CryptoResponse[]) {
  const weeklyCandles = [];
  const weeklyVolumes = [];
  
  // Group daily candles by week (Monday to Sunday)
  let currentWeek: CryptoResponse[] = [];
  let currentWeekStart = 0;
  
  for (const item of dailyData) {
    const date = new Date(item.time * 1000);
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of this week (TradingView week start)
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const mondayDate = new Date(date);
    mondayDate.setUTCDate(date.getUTCDate() + mondayOffset);
    mondayDate.setUTCHours(0, 0, 0, 0);
    const weekStart = Math.floor(mondayDate.getTime() / 1000);
    
    // If this is a new week, process the previous week
    if (currentWeekStart !== weekStart && currentWeek.length > 0) {
      const weekCandle = createWeeklyCandle(currentWeek, currentWeekStart);
      weeklyCandles.push(weekCandle);
      
      const weekVolume = {
        time: currentWeekStart,
        value: currentWeek.reduce((sum, day) => sum + day.volumefrom, 0),
        color: weekCandle.close >= weekCandle.open ? '#26A69A' : '#EF5350'
      };
      weeklyVolumes.push(weekVolume);
      
      currentWeek = [];
    }
    
    currentWeekStart = weekStart;
    currentWeek.push(item);
  }
  
  // Process the last week
  if (currentWeek.length > 0) {
    const weekCandle = createWeeklyCandle(currentWeek, currentWeekStart);
    weeklyCandles.push(weekCandle);
    
    const weekVolume = {
      time: currentWeekStart,
      value: currentWeek.reduce((sum, day) => sum + day.volumefrom, 0),
      color: weekCandle.close >= weekCandle.open ? '#26A69A' : '#EF5350'
    };
    weeklyVolumes.push(weekVolume);
  }
  
  console.log(`Aggregated ${dailyData.length} daily candles into ${weeklyCandles.length} weekly candles`);
  return { candles: weeklyCandles, volumes: weeklyVolumes };
}

/**
 * Create a weekly candle from daily candles
 */
function createWeeklyCandle(weekData: CryptoResponse[], weekStart: number) {
  // Sort by time to ensure proper order
  const sortedData = weekData.sort((a, b) => a.time - b.time);
  
  return {
    time: weekStart,
    open: sortedData[0].open,  // First day's open
    high: Math.max(...sortedData.map(d => d.high)),  // Week's highest high
    low: Math.min(...sortedData.map(d => d.low)),    // Week's lowest low
    close: sortedData[sortedData.length - 1].close   // Last day's close
  };
}

// Function to fetch top cryptocurrencies by market cap
export async function fetchTopCryptos(limit: number = 100): Promise<CryptoCurrency[]> {
  try {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    
    // Фиксированный список монет для анализа, согласно требованиям
    const fixedCoinsList = [
      // Топ монеты по капитализации
      'BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'DOGE', 'ADA', 'TRX', 'SUI', 'LINK',
      'AVAX', 'XLM', 'LEO', 'TON', 'SHIB', 'HBAR', 'BCH', 'LTC', 'DOT', 'HYPE',
      'BGB', 'PI', 'XMR', 'CBBTC', 'PEPE', 'UNI', 'APT', 'OKB', 'NEAR', 'TAO',
      'ONDO', 'TRUMP', 'GT', 'ICP', 'ETC', 'AAVE', 'KAS', 'CRO', 'MNT', 'VET',
      'RENDER', 'POL', 'ATOM', 'ENA', 'FET', 'ALGO', 'FTN', 'FIL', 'TIA', 'ARB',
      'WLD', 'BONK', 'STX', 'JUP', 'KCS', 'OP', 'MKR', 'NEXO', 'QNT', 'FARTCOIN',
      'IMX', 'IP', 'FLR', 'SEI', 'EOS', 'INJ', 'GRT', 'CRV', 'RAY'
    ];
    
    // Используем фиксированный список монет вместо получения списка из API
    const majorCoins = fixedCoinsList;
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
    
    // Используем только монеты из фиксированного списка
    console.log(`Got ${majorCryptosData.length} cryptocurrencies from the fixed list`);
    
    // Add proper full names for the major coins
    const fullNames: {[key: string]: string} = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'XRP': 'XRP',
      'BNB': 'Binance Coin',
      'SOL': 'Solana',
      'DOGE': 'Dogecoin',
      'ADA': 'Cardano',
      'TRX': 'TRON',
      'SUI': 'Sui',
      'LINK': 'Chainlink',
      'AVAX': 'Avalanche',
      'XLM': 'Stellar',
      'LEO': 'LEO Token',
      'TON': 'Toncoin',
      'SHIB': 'Shiba Inu',
      'HBAR': 'Hedera',
      'BCH': 'Bitcoin Cash',
      'LTC': 'Litecoin',
      'DOT': 'Polkadot',
      'HYPE': 'Hypesquad',
      'XMR': 'Monero',
      'UNI': 'Uniswap',
      'APT': 'Aptos',
      'NEAR': 'NEAR Protocol',
      'AAVE': 'Aave',
      'VET': 'VeChain',
      'ATOM': 'Cosmos',
      'FET': 'Fetch.ai',
      'ALGO': 'Algorand',
      'FIL': 'Filecoin',
      'STX': 'Stacks',
      'KCS': 'KuCoin Token',
      'OP': 'Optimism',
      'QNT': 'Quant',
      'IMX': 'Immutable X',
      'EOS': 'EOS',
      'GRT': 'The Graph'
    };
    
    // Improve our major cryptocurrencies with proper names
    const improvedMajorCryptos = majorCryptosData.map((crypto, index) => {
      return {
        ...crypto,
        name: fullNames[crypto.id] || crypto.id,
        rank: index + 1
      };
    });
    
    // Используем только монеты из фиксированного списка, без дополнительных запросов
    console.log(`Using only ${improvedMajorCryptos.length} cryptocurrencies from the fixed list`);
    
    // Возвращаем только монеты из фиксированного списка
    return improvedMajorCryptos;
    
    // Ниже неиспользуемый код со списком дополнительных монет (оставлен в качестве справки)
    const additionalCoins = [
      // Обязательная монета - всегда должна быть в списке
      { id: 'TRX', name: 'TRON' },
      
      // Топ-50 по капитализации
      { id: 'LINK', name: 'Chainlink' },
      { id: 'XLM', name: 'Stellar' },
      { id: 'ATOM', name: 'Cosmos' },
      { id: 'UNI', name: 'Uniswap' },
      { id: 'ALGO', name: 'Algorand' },
      { id: 'NEAR', name: 'NEAR Protocol' },
      { id: 'VET', name: 'VeChain' },
      { id: 'FIL', name: 'Filecoin' },
      { id: 'XTZ', name: 'Tezos' },
      { id: 'AAVE', name: 'Aave' },
      { id: 'EOS', name: 'EOS' },
      { id: 'EGLD', name: 'MultiversX' },
      { id: 'SAND', name: 'The Sandbox' },
      { id: 'THETA', name: 'Theta Network' },
      { id: 'AXS', name: 'Axie Infinity' },
      { id: 'MANA', name: 'Decentraland' },
      { id: 'QNT', name: 'Quant' },
      { id: 'CRO', name: 'Cronos' },
      { id: 'APE', name: 'ApeCoin' },
      { id: 'GRT', name: 'The Graph' },
      { id: 'KCS', name: 'KuCoin Token' },
      { id: 'FTM', name: 'Fantom' },
      { id: 'XMR', name: 'Monero' },
      { id: 'FLOW', name: 'Flow' },
      { id: 'LDO', name: 'Lido DAO' },
      { id: 'HT', name: 'Huobi Token' },
      { id: 'CHZ', name: 'Chiliz' },
      { id: 'APT', name: 'Aptos' },
      { id: 'IMX', name: 'Immutable X' },
      { id: 'SNX', name: 'Synthetix' },
      
      // 50-100 по капитализации
      { id: 'ONE', name: 'Harmony' },
      { id: 'ENJ', name: 'Enjin Coin' },
      { id: 'LRC', name: 'Loopring' },
      { id: 'BAT', name: 'Basic Attention Token' },
      { id: 'ZIL', name: 'Zilliqa' },
      { id: 'ROSE', name: 'Oasis Network' },
      { id: 'NEO', name: 'NEO' },
      { id: 'ZRX', name: '0x' },
      { id: 'STX', name: 'Stacks' },
      { id: 'ONT', name: 'Ontology' },
      { id: 'DASH', name: 'Dash' },
      { id: 'ZEC', name: 'Zcash' },
      { id: 'GMT', name: 'STEPN' },
      { id: 'AR', name: 'Arweave' },
      { id: 'OP', name: 'Optimism' },
      { id: 'COMP', name: 'Compound' },
      { id: 'GALA', name: 'Gala' },
      { id: 'FET', name: 'Fetch.ai' },
      { id: 'XEM', name: 'NEM' },
      { id: 'KAVA', name: 'Kava' },
      
      // Другие популярные альткоины
      { id: 'RSR', name: 'Reserve Rights' },
      { id: 'BTT', name: 'BitTorrent' },
      { id: 'HOT', name: 'Holo' },
      { id: 'CELR', name: 'Celer Network' },
      { id: 'TRB', name: 'Tellor' },
      { id: 'RVN', name: 'Ravencoin' },
      { id: 'SXP', name: 'SXP' },
      { id: 'STORJ', name: 'Storj' },
      { id: 'SC', name: 'Siacoin' },
      { id: 'KSM', name: 'Kusama' },
      { id: 'ZEN', name: 'Horizen' },
      { id: 'ICX', name: 'ICON' },
      { id: 'QTUM', name: 'Qtum' },
      { id: 'DGB', name: 'DigiByte' },
      { id: 'BAL', name: 'Balancer' },
      { id: 'DYDX', name: 'dYdX' },
      { id: 'SUSHI', name: 'SushiSwap' },
      { id: 'OMG', name: 'OMG Network' },
      { id: 'ANKR', name: 'Ankr' },
      { id: 'SKL', name: 'SKALE Network' },
      
      // Криптовалюты с низкой капитализацией, но с потенциалом
      { id: 'CKB', name: 'Nervos Network' },
      { id: 'POLY', name: 'Polymath' },
      { id: 'OGN', name: 'Origin Protocol' },
      { id: 'GLM', name: 'Golem' },
      { id: 'AUDIO', name: 'Audius' },
      { id: 'SRM', name: 'Serum' },
      { id: 'RLC', name: 'iExec RLC' },
      { id: 'CVX', name: 'Convex Finance' },
      { id: 'YFI', name: 'yearn.finance' },
      { id: 'ALPHA', name: 'Alpha Venture DAO' },
      { id: 'NKN', name: 'NKN' },
      { id: 'BNT', name: 'Bancor' },
      { id: 'OCEAN', name: 'Ocean Protocol' },
      { id: 'FXS', name: 'Frax Share' },
      { id: 'MASK', name: 'Mask Network' },
      { id: 'REQ', name: 'Request' },
      { id: 'XVG', name: 'Verge' },
      { id: 'REN', name: 'Ren' },
      { id: 'PAXG', name: 'PAX Gold' },
      { id: 'RAY', name: 'Raydium' }
    ];
    
    let topCryptos: CryptoCurrency[] = [];
    
    // Сначала пробуем получить данные из API
    const url = 'https://min-api.cryptocompare.com/data/top/mktcapfull';
    
    const params = {
      limit: limit + 50, // Request more to compensate for filtering
      tsym: 'USD',
      api_key: apiKey
    };
    
    try {
      // Запрос к API для получения топ-криптовалют
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.Data && Array.isArray(response.data.Data)) {
        // Transform the data to our format
        topCryptos = response.data.Data
          .filter((item: any) => item.CoinInfo && item.RAW?.USD) // Ensure data is valid
          .map((item: any, index: number) => {
            const coinInfo = item.CoinInfo || {};
            const raw = item.RAW?.USD || {};
            
            return {
              id: coinInfo.Name || '',
              name: coinInfo.FullName || '',
              marketCap: raw.MKTCAP || 0,
              price: raw.PRICE || 0,
              imageUrl: coinInfo.ImageUrl ? `https://www.cryptocompare.com${coinInfo.ImageUrl}` : '',
              rank: index + improvedMajorCryptos.length + 1 // Start after major coins
            };
          })
          .filter((crypto: CryptoCurrency) => {
            // Remove empty entries
            if (!crypto.id || !crypto.name) return false;
            
            // Already have this in major coins
            if (majorCoins.includes(crypto.id)) return false;
            
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
          
        console.log(`Successfully got ${topCryptos.length} additional cryptocurrencies from the API`);
      } else {
        console.log('API returned invalid data format, using predefined list of additional cryptocurrencies');
        
        // Если API вернул некорректные данные, используем предопределенный список
        topCryptos = additionalCoins
          .filter(coin => !majorCoins.includes(coin.id))
          .map((coin, index) => {
            // Создаем объект криптовалюты с примерными данными
            return {
              id: coin.id,
              name: coin.name,
              marketCap: 0, // Точное значение будет получено при запросе конкретной монеты
              price: 0,     // Точное значение будет получено при запросе конкретной монеты
              imageUrl: '', // Иконка будет получена при необходимости
              rank: index + improvedMajorCryptos.length + 1
            };
          });
          
        console.log(`Using ${topCryptos.length} predefined additional cryptocurrencies`);
      }
    } catch(error) {
      console.log('Failed to get additional cryptocurrencies from API, using predefined list');
      
      // Если произошла ошибка при запросе к API, используем предопределенный список
      // и делаем отдельные запросы для получения реальных данных о ценах и капитализации
      const additionalCryptoPromises = additionalCoins
        .filter(coin => !majorCoins.includes(coin.id))
        .map(async (coin, index) => {
          try {
            // Делаем запрос для получения реальных данных по каждой монете
            const singleCoinUrl = 'https://min-api.cryptocompare.com/data/pricemultifull';
            const singleCoinParams = {
              fsyms: coin.id,
              tsyms: 'USD',
              api_key: apiKey
            };
            
            const response = await axios.get(singleCoinUrl, { params: singleCoinParams });
            
            // Проверяем валидность ответа
            if (response.data && response.data.RAW && response.data.RAW[coin.id] && response.data.RAW[coin.id].USD) {
              const coinData = response.data.RAW[coin.id].USD;
              
              return {
                id: coin.id,
                name: coin.name,
                marketCap: coinData.MKTCAP || 0,
                price: coinData.PRICE || 0,
                imageUrl: coinData.IMAGEURL ? `https://www.cryptocompare.com${coinData.IMAGEURL}` : '',
                rank: index + improvedMajorCryptos.length + 1
              };
            } else {
              // Если данные не получены, создаем запись с минимальными данными
              return {
                id: coin.id,
                name: coin.name,
                marketCap: 0,
                price: 0,
                imageUrl: '',
                rank: index + improvedMajorCryptos.length + 1
              };
            }
          } catch (err) {
            // В случае ошибки, создаем запись с минимальными данными
            console.log(`Error fetching data for ${coin.id}: ${err}`);
            return {
              id: coin.id,
              name: coin.name,
              marketCap: 0,
              price: 0,
              imageUrl: '',
              rank: index + improvedMajorCryptos.length + 1
            };
          }
        });
      
      // Ждем завершения всех запросов
      topCryptos = await Promise.all(additionalCryptoPromises);
        
      console.log(`Using ${topCryptos.length} predefined additional cryptocurrencies`);
    }
    
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
      // Для недельного таймфрейма получаем дневные данные и агрегируем их вручную
      // чтобы точно контролировать начало недели (понедельник как в TradingView)
      apiTimeframe = 'day';
      aggregate = 1;  // Получаем дневные данные
      break;
    default:
      apiTimeframe = 'hour';
  }
  
  // Use the base API URL
  const baseUrl = 'https://min-api.cryptocompare.com/data/v2/';
  
  // Adjust request limit based on timeframe
  let requestLimit = 2000;
  if (timeframe === '1w') {
    // For weekly data, get 2000 daily candles to manually aggregate into ~285 weeks
    requestLimit = 2000;
  }
  
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
    
    // For weekly timeframe, aggregate daily data into weekly candles
    if (timeframe === '1w') {
      return aggregateDailyToWeekly(limitedData);
    }

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