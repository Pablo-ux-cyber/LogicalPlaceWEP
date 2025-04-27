import cron from 'node-cron';
import { checkBuySignals } from './telegramService';
import { fetchTopCryptos } from './cryptoApi';

/**
 * Получить фиксированный список монет для анализа
 */
export function getFixedCoinsList(): string[] {
  // Фиксированный список монет для анализа, согласно требованиям
  return [
    // Топ монеты по капитализации
    'BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'DOGE', 'ADA', 'TRX', 'SUI', 'LINK',
    'AVAX', 'XLM', 'LEO', 'TON', 'SHIB', 'HBAR', 'BCH', 'LTC', 'DOT', 'HYPE',
    'BGB', 'PI', 'XMR', 'CBBTC', 'PEPE', 'UNI', 'APT', 'OKB', 'NEAR', 'TAO',
    'ONDO', 'TRUMP', 'GT', 'ICP', 'ETC', 'AAVE', 'KAS', 'CRO', 'MNT', 'VET',
    'RENDER', 'POL', 'ATOM', 'ENA', 'FET', 'ALGO', 'FTN', 'FIL', 'TIA', 'ARB',
    'WLD', 'BONK', 'STX', 'JUP', 'KCS', 'OP', 'MKR', 'NEXO', 'QNT', 'FARTCOIN',
    'IMX', 'IP', 'FLR', 'SEI', 'EOS', 'INJ', 'GRT', 'CRV', 'RAY'
  ];
}

// Расписание для проверки сигналов
let signalCheckSchedule: cron.ScheduledTask | null = null;

/**
 * Запустить планировщик задач
 */
export function initScheduler() {
  // Проверка сигналов каждый день в 08:00 UTC
  signalCheckSchedule = cron.schedule('0 8 * * *', async () => {
    console.log('Запуск запланированной проверки сигналов на покупку');
    
    try {
      // Используем фиксированный список монет вместо запроса к API
      const symbols = getFixedCoinsList();
      console.log(`Используем ${symbols.length} монет из фиксированного списка для плановой проверки`);
      
      // Запускаем проверку сигналов
      await checkBuySignals(symbols);
      
      console.log('Запланированная проверка завершена успешно');
    } catch (error) {
      console.error('Ошибка при запланированной проверке сигналов:', error);
    }
  });

  console.log('Планировщик задач успешно запущен');
  
  // Также сразу запускаем первую проверку через 5 секунд после старта сервера 
  // (чтобы проверить, что всё работает)
  setTimeout(async () => {
    console.log('Запуск первоначальной проверки сигналов на покупку');
    
    try {
      // Используем фиксированный список монет вместо запроса к API
      const symbols = getFixedCoinsList();
      console.log(`Используем ${symbols.length} монет из фиксированного списка для первоначальной проверки`);
      
      // Запускаем проверку сигналов
      await checkBuySignals(symbols);
      
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
export async function runManualCheck(limit: number = 70) {
  console.log(`Запуск ручной проверки сигналов для ${limit} монет из фиксированного списка`);
  
  try {
    // Используем фиксированный список монет вместо запроса к API
    const symbols = getFixedCoinsList().slice(0, limit);
    
    console.log(`Используем ${symbols.length} монет из фиксированного списка для ручной проверки`);
    
    // Запускаем проверку сигналов
    await checkBuySignals(symbols);
    
    console.log('Ручная проверка завершена успешно');
    return { success: true, message: `Проверено ${symbols.length} монет` };
  } catch (error) {
    console.error('Ошибка при ручной проверке сигналов:', error);
    return { 
      success: false, 
      message: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
    };
  }
}