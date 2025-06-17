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
          `Бот активен и проверяет сигналы каждый день в 08:00 UTC для фиксированного списка из 69 криптовалют. Сигналы отправляются в группу @logicalplace.`
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
📉 BB (1W): $${signal.bbLowerWeekly.toFixed(2)}

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

  // Отключаем автоматическую отправку тестовых сигналов
  const isExampleSignal = false;
  
  if (isExampleSignal) {
    // Отправляем пример сигнала для SOL
    const solExample: BuySignal = {
      symbol: 'SOL',
      price: 147.82,
      time: new Date(),
      bbLowerDaily: 0, // Не используется в этой версии
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
 * Расчет индикаторов Боллинджера точно как в PineScript
 * Используем настройки: длина = 20, источник = close, множитель = 2.0
 * Формула: basis = sma(close, 20), dev = mult * stdev(close, 20), lower = basis - dev
 */
function calculateBollingerBands(data: CandleData[], length: number = 20, mult: number = 2.0) {
  if (data.length < length) {
    console.warn(`Недостаточно данных для расчета полос Боллинджера. Нужно как минимум ${length}, имеется ${data.length}.`);
    return [];
  }

  const result = [];

  for (let i = length - 1; i < data.length; i++) {
    // Собираем цены закрытия за период (как в PineScript: sma(close, length))
    const closePrices = [];
    for (let j = i - length + 1; j <= i; j++) {
      closePrices.push(data[j].close);
    }
    
    // Расчет SMA (basis в PineScript)
    const basis = closePrices.reduce((sum, price) => sum + price, 0) / length;
    
    // Расчет стандартного отклонения (как в PineScript: stdev(close, length))
    const squaredDiffs = closePrices.map(price => Math.pow(price - basis, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / length; // PineScript использует N, не N-1
    const stdev = Math.sqrt(variance);
    
    // Расчет отклонения (dev в PineScript)
    const dev = mult * stdev;
    
    // Расчет полос (как в PineScript)
    const upper = basis + dev;
    const lower = basis - dev;
    
    result.push({
      time: data[i].time,
      sma: basis,
      upper,
      lower,
      stdDev: stdev,
      dev
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
        
        // Получаем данные только недельного таймфрейма
        const weeklyData = await fetchCryptoPriceData(symbol, '1w');
        
        // Проверяем наличие данных
        if (!weeklyData.candles.length) {
          const noDataMessage = `Нет данных для ${symbol}. Пропускаем.`;
          console.warn(noDataMessage);
          logError(symbol, noDataMessage);
          return { success: false, error: true, signal: false };
        }
        
        // Получаем последнюю свечу недельного таймфрейма
        const lastWeeklyCandle = weeklyData.candles[weeklyData.candles.length - 1];
        
        // Рассчитываем полосы Боллинджера для недельного таймфрейма
        const weeklyBB = calculateBollingerBands(weeklyData.candles);
        
        if (!weeklyBB.length) {
          const noBBMessage = `Не удалось рассчитать полосы Боллинджера для ${symbol}. Пропускаем.`;
          console.warn(noBBMessage);
          logError(symbol, noBBMessage);
          return { success: false, error: true, signal: false };
        }
        
        // Получаем значения полос для последней свечи
        const lastWeeklyBB = weeklyBB[weeklyBB.length - 1];
        
        // Проверяем условие для сигнала на покупку - только недельный таймфрейм
        const currentPrice = lastWeeklyCandle.close;
        const bbLowerWeekly = lastWeeklyBB.lower;
        
        // Сигнал возникает когда цена ниже недельной нижней полосы Боллинджера
        const isBuySignal = currentPrice <= bbLowerWeekly;
        
        // Детальное логирование для отладки расчетов
        const lastCandle = weeklyData.candles[weeklyData.candles.length - 1];
        const candleDate = new Date(lastCandle.time * 1000);
        
        console.log(`[DEBUG] ${symbol} - Последняя свеча: ${candleDate.toISOString()}`);
        console.log(`[DEBUG] ${symbol} - Цена закрытия: ${currentPrice}`);
        console.log(`[DEBUG] ${symbol} - BB Lower: ${bbLowerWeekly.toFixed(2)}`);
        console.log(`[DEBUG] ${symbol} - SMA: ${lastWeeklyBB.sma.toFixed(2)}`);
        console.log(`[DEBUG] ${symbol} - StdDev: ${lastWeeklyBB.stdDev.toFixed(4)}`);
        
        if (isBuySignal) {
          console.log(`⚠️ ${symbol}: Цена ${currentPrice} <= BB ${bbLowerWeekly.toFixed(2)} - СИГНАЛ НА ПОКУПКУ!`);
          logToFile(`⚠️ ${symbol}: Цена ${currentPrice} <= BB ${bbLowerWeekly.toFixed(2)} - СИГНАЛ НА ПОКУПКУ!`, 'signals');
        } else {
          console.log(`${symbol}: Цена ${currentPrice} > BB ${bbLowerWeekly.toFixed(2)}`);
        }
        
        // Логируем результат проверки
        logCryptoCheck(symbol, currentPrice, bbLowerWeekly, isBuySignal);
        
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
          
          const signalMessage = `⚠️ ОТКЛЮЧЕНО: Найден сигнал на покупку для ${symbol}!`;
          console.log(signalMessage);
          logToFile(signalMessage, 'signals');
          
          // ВРЕМЕННО ОТКЛЮЧЕНО: Отправка сигналов в Telegram приостановлена
          // до обновления кода на продакшн сервере
          console.log(`[ОТКЛЮЧЕНО] Сигнал для ${symbol} НЕ отправлен в Telegram`);
          logToFile(`[ОТКЛЮЧЕНО] Сигнал для ${symbol} НЕ отправлен в Telegram`, 'signals');
          
          // sendBuySignal({
          //   symbol,
          //   price: currentPrice,
          //   time: new Date(lastWeeklyCandle.time * 1000),
          //   bbLowerDaily: 0,
          //   bbLowerWeekly
          // });
          
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