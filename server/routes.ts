import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchCryptoPriceData, fetchTopCryptos, CryptoSymbol } from "./services/cryptoApi";
import { initTelegramBot, sendTestMessage } from "./services/telegramService";
import { initScheduler, runManualCheck } from "./services/schedulerService";
import { getLogContent } from "./services/loggerService";
import NodeCache from "node-cache";

// Cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

export async function registerRoutes(app: Express): Promise<Server> {
  // Legacy Bitcoin price data endpoint (for backward compatibility)
  app.get("/api/bitcoin/:timeframe", async (req, res) => {
    try {
      const timeframe = req.params.timeframe;
      const validTimeframes = ["1h", "4h", "1d", "1w"];
      
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({ 
          message: "Invalid timeframe. Valid values are: 1h, 4h, 1d, 1w" 
        });
      }
      
      // Check cache first
      const cacheKey = `BTC_${timeframe}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Fetch from API if not in cache
      const data = await fetchCryptoPriceData('BTC', timeframe);
      
      // Store in cache
      cache.set(cacheKey, data);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching Bitcoin data:", error);
      res.status(500).json({ 
        message: "Failed to fetch Bitcoin price data" 
      });
    }
  });

  // New endpoint for any cryptocurrency with indicators
  app.get("/api/crypto/:symbol/:timeframe", async (req, res) => {
    try {
      const { symbol, timeframe } = req.params;
      const validTimeframes = ["1h", "4h", "1d", "1w"];
      
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({ 
          message: "Invalid timeframe. Valid values are: 1h, 4h, 1d, 1w" 
        });
      }
      
      // Check cache first
      const cacheKey = `${symbol}_${timeframe}_with_indicators`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Fetch from API if not in cache
      const data = await fetchCryptoPriceData(symbol as CryptoSymbol, timeframe);
      
      // Calculate Bollinger Bands using the same algorithm as Telegram service
      const calculateBollingerBands = (candleData: any[], period: number = 20, multiplier: number = 2.0) => {
        if (candleData.length < period) return [];
        
        const result = [];
        for (let i = period - 1; i < candleData.length; i++) {
          const periodData = candleData.slice(i - period + 1, i + 1);
          const sum = periodData.reduce((acc, candle) => acc + candle.close, 0);
          const sma = sum / period;
          const squaredDiffs = periodData.map(candle => Math.pow(candle.close - sma, 2));
          const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / period;
          const stdDev = Math.sqrt(variance);
          const lower = sma - (multiplier * stdDev);
          
          // Check for buy signal (price <= lower BB)
          const entrySignal = candleData[i].close <= lower;
          
          result.push({
            time: candleData[i].time,
            bbLowerDaily: lower, // Same as weekly for now
            bbLowerWeekly: lower,
            entrySignal
          });
        }
        return result;
      };
      
      // Add indicators to the response
      const indicators = calculateBollingerBands(data.candles);
      const response = {
        ...data,
        indicators
      };
      
      // Store in cache
      cache.set(cacheKey, response);
      
      res.json(response);
    } catch (error) {
      console.error(`Error fetching ${req.params.symbol} data:`, error);
      res.status(500).json({ 
        message: `Failed to fetch ${req.params.symbol} price data` 
      });
    }
  });

  // Endpoint to get top cryptocurrencies by market cap
  app.get("/api/crypto/top", async (req, res) => {
    try {
      // Get limit from query params, default to 100, max 100
      const limit = Math.min(parseInt(req.query.limit as string || "100"), 100);
      
      // Check cache first
      const cacheKey = `top_cryptos_${limit}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Fetch from API if not in cache
      const data = await fetchTopCryptos(limit);
      
      // Store in cache
      cache.set(cacheKey, data);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching top cryptocurrencies:", error);
      res.status(500).json({ 
        message: "Failed to fetch top cryptocurrencies" 
      });
    }
  });

  // Добавляем API для проверки и отправки сигналов на покупку
  app.get("/api/signals/check", async (req, res) => {
    try {
      // Всегда проверяем все доступные криптовалюты (игнорируем limit из запроса)
      const result = await runManualCheck(100);
      
      res.json({ 
        success: result,
        message: result 
          ? "Проверка сигналов для всех доступных криптовалют успешно запущена" 
          : "Ошибка при запуске проверки сигналов"
      });
    } catch (error) {
      console.error("Error checking signals:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to check signals" 
      });
    }
  });
  
  // Добавляем API для тестовой отправки сообщения в Telegram
  app.get("/api/telegram/test", async (req, res) => {
    try {
      console.log("Sending test message to Telegram...");
      const result = await sendTestMessage();
      
      res.json({ 
        success: result,
        message: result 
          ? "Test message successfully sent to Telegram" 
          : "Error sending test message to Telegram"
      });
    } catch (error) {
      console.error("Error sending test message to Telegram:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to send test message to Telegram" 
      });
    }
  });
  
  // Добавляем API для просмотра логов проверок сигналов
  app.get("/api/logs/:type", (req, res) => {
    try {
      const { type } = req.params;
      const validTypes = ["signals", "checks", "errors"];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid log type. Valid values are: signals, checks, errors" 
        });
      }
      
      const logContent = getLogContent(type as "signals" | "checks" | "errors");
      res.json({ 
        success: true, 
        data: logContent,
        type 
      });
    } catch (error) {
      console.error("Error getting logs:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get logs" 
      });
    }
  });

  // Инициализируем Telegram-бота при запуске сервера
  const telegramBot = initTelegramBot();
  if (telegramBot) {
    console.log("Telegram бот успешно инициализирован");
    
    // Инициализируем планировщик задач
    const scheduler = initScheduler();
    if (scheduler) {
      console.log("Планировщик задач успешно запущен. Проверка сигналов будет выполняться ежедневно в 08:00 UTC");
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
