import cron from 'node-cron';
import { checkBuySignals } from './telegramService';
import { fetchTopCryptos } from './cryptoApi';

// Расписание для проверки сигналов
let signalCheckSchedule: cron.ScheduledTask | null = null;

// Список криптовалют для проверки, предоставленный пользователем
const CRYPTO_LIST = [
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

/**
 * Запустить планировщик задач
 */
export function initScheduler() {
  // Проверка сигналов каждый день в 08:00 UTC
  signalCheckSchedule = cron.schedule('0 8 * * *', async () => {
    console.log('Запуск запланированной проверки сигналов на покупку');
    
    try {
      // Используем предоставленный пользователем список монет, а не запрашиваем все через API
      console.log(`Проверяем ${CRYPTO_LIST.length} указанных криптовалют`);
      
      // Запускаем проверку сигналов
      await checkBuySignals(CRYPTO_LIST);
      
      console.log('Запланированная проверка завершена успешно');
    } catch (error) {
      console.error('Ошибка при запланированной проверке сигналов:', error);
    }
  });

  console.log('Планировщик задач успешно запущен. Проверка сигналов будет выполняться ежедневно в 08:00 UTC');
  
  // Также сразу запускаем первую проверку через 5 секунд после старта сервера 
  // (чтобы проверить, что всё работает)
  setTimeout(async () => {
    console.log('Запуск первоначальной проверки сигналов на покупку');
    
    try {
      // Используем предоставленный пользователем список монет
      console.log(`Проверяем ${CRYPTO_LIST.length} указанных криптовалют`);
      
      // Запускаем проверку сигналов для всех монет из списка
      await checkBuySignals(CRYPTO_LIST);
      
      console.log('Первоначальная проверка завершена успешно');
    } catch (error) {
      console.error('Ошибка при первоначальной проверке сигналов:', error);
    }
  }, 5000);
  
  return signalCheckSchedule;
}

/**
 * Остановить планировщик задач
 */
export function stopScheduler() {
  if (signalCheckSchedule) {
    signalCheckSchedule.stop();
    signalCheckSchedule = null;
    console.log('Планировщик задач остановлен');
  }
}

/**
 * Запустить ручную проверку сигналов
 */
export async function runManualCheck(limit: number = 100) {
  console.log(`Запуск ручной проверки сигналов для ${CRYPTO_LIST.length} указанных криптовалют`);
  
  try {
    // Запускаем проверку сигналов по заданному списку
    await checkBuySignals(CRYPTO_LIST);
    
    console.log('Ручная проверка завершена успешно');
    return true;
  } catch (error) {
    console.error('Ошибка при ручной проверке сигналов:', error);
    return false;
  }
}