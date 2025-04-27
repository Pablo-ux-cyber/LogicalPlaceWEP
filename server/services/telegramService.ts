import TelegramBot from 'node-telegram-bot-api';
import { fetchCryptoPriceData } from './cryptoApi';
import { logToFile, logCryptoCheck, logError, logCheckSummary } from './loggerService';
// Импортируем интерфейс для свечи
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Типы для сохранения подписанных чатов
type TelegramChat = {
  chatId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  subscribedAt: Date;
};

// Типы для сигналов
type BuySignal = {
  symbol: string;
  price: number;
  time: Date;
  bbLowerDaily: number;
  bbLowerWeekly: number;
};

// ID группы для отправки сигналов
const TARGET_GROUP_CHAT_ID = process.env.TELEGRAM_TARGET_GROUP_ID || '@logicalplace';

// Инициализация бота
const token = process.env.TELEGRAM_BOT_TOKEN || '';
let bot: TelegramBot | null = null;

/**
 * Инициализировать Telegram-бота
 */
export function initTelegramBot() {
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN не задан. Telegram-бот не будет запущен.');
    return null;
  }

  try {
    // Создаем бота с включенным polling
    bot = new TelegramBot(token, { polling: true });
    console.log('Telegram-бот успешно запущен');

    // Обработчик команды /start
    bot.onText(/\/start/, (msg: any) => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || 'пользователь';
      
      if (bot) {
        bot.sendMessage(
          chatId,
          `Привет, ${firstName}! Бот настроен на отправку сигналов в группу @logicalplace при обнаружении сигналов на покупку, когда цена опустится ниже нижней границы полос Боллинджера на дневном и недельном таймфреймах.`
        );
      }
    });

    // Обработчик команды /status
    bot.onText(/\/status/, (msg: any) => {
      const chatId = msg.chat.id;
      if (bot) {
        bot.sendMessage(
          chatId,
          `Бот активен и проверяет сигналы каждый день в 08:00 UTC для всех монет из списка топ-100 по рыночной капитализации. Сигналы отправляются в группу @logicalplace.`
        );
      }
    });

    // Обработчик команды /help
    bot.onText(/\/help/, (msg: any) => {
      const chatId = msg.chat.id;
      if (bot) {
        bot.sendMessage(
          chatId,
          `Доступные команды:
/start - Информация о боте
/status - Проверить статус бота
/help - Показать эту справку`
        );
      }
    });

    return bot;
  } catch (error) {
    console.error('Ошибка при инициализации Telegram-бота:', error);
    return null;
  }
}

/**
 * Отправить уведомление о сигнале на покупку
 */
export function sendBuySignal(signal: BuySignal) {
  if (!bot) {
    console.warn('Telegram-бот не инициализирован. Не могу отправить сигнал.');
    return;
  }

  // Определяем базовый URL нашего приложения
  const appBaseUrl = process.env.APP_URL || 'https://your-app-url.com';
  
  // Формируем ссылку на график этой монеты
  const chartUrl = `${appBaseUrl}/?symbol=${signal.symbol}`;
  
  const message = `✨ <b>${signal.symbol}</b> | BUY SIGNAL ✨

📌 Price: $${signal.price.toFixed(2)}
📉 BB Daily: $${signal.bbLowerDaily.toFixed(2)}
📉 BB Weekly: $${signal.bbLowerWeekly.toFixed(2)}

🔍 <a href="${chartUrl}">View Chart</a>`;

  // Отправляем в группу с поддержкой HTML-разметки
  bot.sendMessage(TARGET_GROUP_CHAT_ID, message, { parse_mode: 'HTML' })
    .then(() => {
      console.log(`Buy signal for ${signal.symbol} sent to group ${TARGET_GROUP_CHAT_ID}`);
    })
    .catch((error: any) => {
      console.error(`Error sending message to group ${TARGET_GROUP_CHAT_ID}:`, error);
    });
}

/**
 * Отправить тестовое сообщение в группу
 */
export function sendTestMessage() {
  if (!bot) {
    console.warn('Telegram bot is not initialized. Cannot send test message.');
    return false;
  }

  // Всегда отправляем пример сигнала по Solana (для тестирования)
  const isExampleSignal = true;
  
  if (isExampleSignal) {
    // Отправляем пример сигнала для SOL
    const solExample: BuySignal = {
      symbol: 'SOL',
      price: 147.82,
      time: new Date(),
      bbLowerDaily: 138.25,
      bbLowerWeekly: 142.35
    };
    
    console.log('Sending SOL example signal');
    sendBuySignal(solExample);
    return true;
  } else {
    // Обычное тестовое сообщение
    const message = `🔬 TEST MESSAGE 🔬
    
✅ This is a test message to verify the bot is working.
✅ If you can see this message, the bot is correctly configured and can send messages to the group.

🕙 Time sent: ${new Date().toLocaleString()}`;

    // Отправляем в группу
    return bot.sendMessage(TARGET_GROUP_CHAT_ID, message)
      .then(() => {
        console.log(`Test message sent to group ${TARGET_GROUP_CHAT_ID}`);
        return true;
      })
      .catch((error: any) => {
        console.error(`Error sending test message to group ${TARGET_GROUP_CHAT_ID}:`, error);
        return false;
      });
  }
}

/**
 * Расчет индикаторов Боллинджера
 * @param data Массив свечей
 * @param period Период для расчета (по умолчанию 20)
 * @param multiplier Множитель для стандартного отклонения (по умолчанию 2.0)
 */
function calculateBollingerBands(data: CandleData[], period: number = 20, multiplier: number = 2.0) {
  if (data.length < period) {
    console.warn(`Недостаточно данных для расчета полос Боллинджера. Нужно как минимум ${period}, имеется ${data.length}.`);
    return [];
  }

  const result = [];

  for (let i = period - 1; i < data.length; i++) {
    // Собираем данные за период
    const periodData = data.slice(i - period + 1, i + 1);
    
    // Расчет SMA (простое скользящее среднее)
    const sum = periodData.reduce((acc, candle) => acc + candle.close, 0);
    const sma = sum / period;
    
    // Расчет стандартного отклонения
    const squaredDiffs = periodData.map(candle => Math.pow(candle.close - sma, 2));
    const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / period;
    const stdDev = Math.sqrt(variance);
    
    // Проверяем, не слишком ли мало стандартное отклонение 
    // (это может произойти, если все данные одинаковые или их очень мало)
    const minStdDevPercent = 0.01; // Минимальное стандартное отклонение как процент от SMA
    const minStdDev = Math.max(sma * minStdDevPercent, 0.001); // Не менее 1% от SMA или 0.001 абсолютного значения
    
    // Если стандартное отклонение слишком маленькое, используем минимальное значение
    let effectiveStdDev = stdDev;
    if (stdDev < minStdDev) {
      console.log(`Предупреждение: Низкое стандартное отклонение (${stdDev.toFixed(6)}) для SMA=${sma.toFixed(2)}. Используем минимальное значение ${minStdDev.toFixed(6)}.`);
      effectiveStdDev = minStdDev;
    }
    
    // Расчет верхней и нижней полос с использованием эффективного стандартного отклонения
    const upper = sma + (multiplier * effectiveStdDev);
    const lower = sma - (multiplier * effectiveStdDev);
    
    result.push({
      time: data[i].time,
      sma,
      upper,
      lower,
      stdDev,
      effectiveStdDev
    });
  }

  return result;
}

/**
 * Проверить наличие сигналов на покупку для всех криптовалют
 */
export async function checkBuySignals(cryptoSymbols: string[]) {
  if (!bot) {
    console.warn('Telegram-бот не инициализирован. Проверка сигналов отменена.');
    return;
  }

  const message = `Проверка сигналов на покупку для ${cryptoSymbols.length} криптовалют на недельном таймфрейме...`;
  console.log(message);
  logToFile(message, 'checks');
  
  let successCount = 0;
  let errorCount = 0;
  let signalCount = 0;
  
  // Определяем размер пакета для одновременной обработки
  const batchSize = 5; // Обрабатываем по 5 монет одновременно
  
  // Разбиваем весь список на пакеты
  for (let i = 0; i < cryptoSymbols.length; i += batchSize) {
    // Берем текущий пакет монет (не более batchSize)
    const batch = cryptoSymbols.slice(i, i + batchSize);
    
    console.log(`Обработка пакета ${Math.floor(i / batchSize) + 1}/${Math.ceil(cryptoSymbols.length / batchSize)} - ${batch.join(', ')}...`);
    
    // Запускаем проверку всех монет в текущем пакете параллельно
    const batchPromises = batch.map(async (symbol) => {
      try {
        console.log(`Проверка ${symbol}...`);
        
        // Получаем данные недельного таймфрейма
        const weeklyData = await fetchCryptoPriceData(symbol, '1w');
        
        // Получаем также данные дневного таймфрейма
        const dailyData = await fetchCryptoPriceData(symbol, '1d');
        
        // Проверяем наличие данных
        if (!weeklyData.candles.length || !dailyData.candles.length) {
          const noDataMessage = `Нет данных для ${symbol}. Пропускаем.`;
          console.warn(noDataMessage);
          logError(symbol, noDataMessage);
          return { success: false, error: true, signal: false };
        }
        
        // Получаем последние свечи
        const lastWeeklyCandle = weeklyData.candles[weeklyData.candles.length - 1];
        const lastDailyCandle = dailyData.candles[dailyData.candles.length - 1];
        
        // Рассчитываем полосы Боллинджера для обоих таймфреймов
        const weeklyBB = calculateBollingerBands(weeklyData.candles);
        const dailyBB = calculateBollingerBands(dailyData.candles);
        
        if (!weeklyBB.length || !dailyBB.length) {
          const noBBMessage = `Не удалось рассчитать полосы Боллинджера для ${symbol}. Пропускаем.`;
          console.warn(noBBMessage);
          logError(symbol, noBBMessage);
          return { success: false, error: true, signal: false };
        }
        
        // Получаем значения полос для последних свечей
        const lastWeeklyBB = weeklyBB[weeklyBB.length - 1];
        const lastDailyBB = dailyBB[dailyBB.length - 1];
        
        // Текущая цена (берем из последней дневной свечи, она более актуальна)
        const currentPrice = lastDailyCandle.close;
        const bbLowerWeekly = lastWeeklyBB.lower;
        const bbLowerDaily = lastDailyBB.lower;
        
        // Проверяем дневной и недельный BB, точно как в вашем PineScript коде:
        // entry_condition = source <= bb_lower_d and source <= bb_lower_w 
        // Оба таймфрейма должны быть ниже соответствующей полосы Боллинджера
        const isPriceBelowDailyBB = currentPrice <= bbLowerDaily;
        const isPriceBelowWeeklyBB = currentPrice <= bbLowerWeekly;
        
        // Логируем данные для отладки
        console.log(`${symbol}: Цена ${currentPrice.toFixed(4)} ${isPriceBelowDailyBB ? '<=' : '>'} BB Daily ${bbLowerDaily.toFixed(4)}, ${isPriceBelowWeeklyBB ? '<=' : '>'} BB Weekly ${bbLowerWeekly.toFixed(4)}`);
        
        // Добавляем расширенную информацию для отладки
        if (lastWeeklyBB.stdDev < 0.001 || lastDailyBB.stdDev < 0.001) {
          console.log(`${symbol} - ОТЛАДКА РАСЧЕТОВ: Daily: SMA=${lastDailyBB.sma.toFixed(4)}, StdDev=${lastDailyBB.stdDev.toFixed(6)}, EffStdDev=${lastDailyBB.effectiveStdDev?.toFixed(6) || 'N/A'}`);
          console.log(`${symbol} - ОТЛАДКА РАСЧЕТОВ: Weekly: SMA=${lastWeeklyBB.sma.toFixed(4)}, StdDev=${lastWeeklyBB.stdDev.toFixed(6)}, EffStdDev=${lastWeeklyBB.effectiveStdDev?.toFixed(6) || 'N/A'}`);
        }
        
        // Сигнал возникает ТОЛЬКО по недельному таймфрейму - когда цена ниже недельной полосы
        const isBuySignal = isPriceBelowWeeklyBB;
        
        // Логируем результат проверки с информацией о дневной и недельной полосе
        logCryptoCheck(symbol, currentPrice, bbLowerWeekly, isBuySignal, bbLowerDaily);
        
        if (isBuySignal) {
          // Дополнительная проверка - исключаем нежелательные криптовалюты из сигналов
          const excludedCoins = [
            // Стейблкоины, которые могли пропустить первичную фильтрацию
            'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'GUSD', 'USDD', 'USDP', 'FRAX', 'LUSD',
            // Врапнутые токены и их вариации
            'WBTC', 'WETH', 'WBNB', 'WAVAX', 'WMATIC', 'WFTM', 'WSOL', 'WTRX', 'WONE', 'WRUNE'
          ];
          
          // Также исключаем монеты с подозрительными паттернами в названии
          const suspiciousPatterns = ['USD', 'wrapped', 'pegged', 'stable', 'cash'];
          
          if (excludedCoins.includes(symbol.toUpperCase())) {
            console.log(`Сигнал для ${symbol} был отфильтрован, так как монета находится в списке исключений`);
            return { success: true, error: false, signal: false };
          }
          
          if (suspiciousPatterns.some(pattern => symbol.toLowerCase().includes(pattern.toLowerCase()))) {
            console.log(`Сигнал для ${symbol} был отфильтрован из-за подозрительного названия`);
            return { success: true, error: false, signal: false };
          }
          
          const signalMessage = `⚠️ Найден сигнал на покупку для ${symbol}!`;
          console.log(signalMessage);
          logToFile(signalMessage, 'signals');
          
          // Отправляем сигнал с данными дневной и недельной полосы Боллинджера
          sendBuySignal({
            symbol,
            price: currentPrice,
            time: new Date(lastDailyCandle.time * 1000),
            bbLowerDaily,
            bbLowerWeekly
          });
          
          return { success: true, error: false, signal: true };
        }
        
        return { success: true, error: false, signal: false };
      } catch (error) {
        const errorMessage = `Ошибка при проверке сигналов для ${symbol}: ${error}`;
        console.error(errorMessage);
        logError(symbol, String(error));
        return { success: false, error: true, signal: false };
      }
    });
    
    // Ждем завершения всех проверок в текущем пакете
    const batchResults = await Promise.all(batchPromises);
    
    // Подсчитываем результаты текущего пакета
    batchResults.forEach(result => {
      if (result.success) successCount++;
      if (result.error) errorCount++;
      if (result.signal) signalCount++;
    });
    
    // Добавляем небольшую паузу между пакетами, чтобы не перегрузить API и сервер
    if (i + batchSize < cryptoSymbols.length) {
      console.log(`Пауза между пакетами (2 секунды)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Логируем итоги проверки
  logCheckSummary(successCount, errorCount, signalCount);
}