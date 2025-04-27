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
const TARGET_GROUP_CHAT_ID = '@logicalplace';

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
      
      bot.sendMessage(
        chatId,
        `Привет, ${firstName}! Бот настроен на отправку сигналов в группу @logicalplace при обнаружении сигналов на покупку, когда цена опустится ниже нижней границы полос Боллинджера на дневном и недельном таймфреймах.`
      );
    });

    // Обработчик команды /status
    bot.onText(/\/status/, (msg: any) => {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        `Бот активен и проверяет сигналы каждый день в 08:00 UTC для всех монет из списка топ-100 по рыночной капитализации. Сигналы отправляются в группу @logicalplace.`
      );
    });

    // Обработчик команды /help
    bot.onText(/\/help/, (msg: any) => {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        `Доступные команды:
/start - Информация о боте
/status - Проверить статус бота
/help - Показать эту справку`
      );
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

  // Всегда отправляем пример сигнала по Solana (для тестирования)
  const isExampleSignal = true;
  
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
    
    // Расчет верхней и нижней полос
    const upper = sma + (multiplier * stdDev);
    const lower = sma - (multiplier * stdDev);
    
    result.push({
      time: data[i].time,
      sma,
      upper,
      lower,
      stdDev
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

  // Проверяем каждую криптовалюту
  for (const symbol of cryptoSymbols) {
    try {
      console.log(`Проверка ${symbol}...`);
      
      // Получаем данные только недельного таймфрейма
      const weeklyData = await fetchCryptoPriceData(symbol, '1w');
      
      // Проверяем наличие данных
      if (!weeklyData.candles.length) {
        const noDataMessage = `Нет данных для ${symbol}. Пропускаем.`;
        console.warn(noDataMessage);
        logError(symbol, noDataMessage);
        continue;
      }
      
      // Получаем последнюю свечу недельного таймфрейма
      const lastWeeklyCandle = weeklyData.candles[weeklyData.candles.length - 1];
      
      // Рассчитываем полосы Боллинджера для недельного таймфрейма
      const weeklyBB = calculateBollingerBands(weeklyData.candles);
      
      if (!weeklyBB.length) {
        const noBBMessage = `Не удалось рассчитать полосы Боллинджера для ${symbol}. Пропускаем.`;
        console.warn(noBBMessage);
        logError(symbol, noBBMessage);
        continue;
      }
      
      // Получаем значения полос для последней свечи
      const lastWeeklyBB = weeklyBB[weeklyBB.length - 1];
      
      // Проверяем условие для сигнала на покупку - только недельный таймфрейм
      const currentPrice = lastWeeklyCandle.close;
      const bbLowerWeekly = lastWeeklyBB.lower;
      
      // Сигнал возникает когда цена ниже недельной нижней полосы Боллинджера
      const isBuySignal = currentPrice <= bbLowerWeekly;
      
      // Логируем результат проверки
      logCryptoCheck(symbol, currentPrice, bbLowerWeekly, isBuySignal);
      
      if (isBuySignal) {
        const signalMessage = `⚠️ Найден сигнал на покупку для ${symbol}!`;
        console.log(signalMessage);
        logToFile(signalMessage, 'signals');
        signalCount++;
        
        // Отправляем сигнал
        sendBuySignal({
          symbol,
          price: currentPrice,
          time: new Date(lastWeeklyCandle.time * 1000),
          bbLowerDaily: 0, // Не используется в этой версии
          bbLowerWeekly
        });
      }
      
      successCount++;
    } catch (error) {
      errorCount++;
      const errorMessage = `Ошибка при проверке сигналов для ${symbol}: ${error}`;
      console.error(errorMessage);
      logError(symbol, String(error));
    }
  }
  
  // Логируем итоги проверки
  logCheckSummary(successCount, errorCount, signalCount);
}