import cron from 'node-cron';
import { checkBuySignals } from './telegramService';
import { fetchTopCryptos } from './cryptoApi';

/**
 * Получить фиксированный список монет для анализа
 */
export function getFixedCoinsList(): string[] {
  // Фиксированный список монет для анализа (топ-70 по капитализации, без стейблкоинов)
  return [
    // Топ-10 по капитализации
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
    // Обязательно добавляем TRX
    'TRX',
    // Остальные популярные альткоины (топ-60)
    'LINK', 'XLM', 'ATOM', 'UNI', 'ALGO', 'NEAR', 'VET', 'FIL', 'XTZ', 'AAVE',
    'EOS', 'EGLD', 'SAND', 'THETA', 'AXS', 'MANA', 'QNT', 'CRO', 'APE', 'GRT',
    'KCS', 'FTM', 'XMR', 'FLOW', 'LDO', 'HT', 'CHZ', 'APT', 'IMX', 'SNX',
    'ONE', 'ENJ', 'LRC', 'BAT', 'ZIL', 'ROSE', 'NEO', 'ZRX', 'STX', 'ONT',
    'DASH', 'ZEC', 'GMT', 'AR', 'OP', 'COMP', 'GALA', 'FET', 'XEM', 'KAVA',
    // Дополняем до 70
    'RSR', 'BTT', 'HOT', 'CELR', 'TRB', 'RVN', 'SXP', 'STORJ', 'SC', 'KSM'
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