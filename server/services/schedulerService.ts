import cron from 'node-cron';
import { checkBuySignals } from './telegramService';
import { fetchTopCryptos } from './cryptoApi';

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
      // Получаем список всех криптовалют для проверки
      const cryptos = await fetchTopCryptos(100); // Проверяем все подходящие криптовалюты из топ-100
      const symbols = cryptos.map(crypto => crypto.id);
      
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
      // Получаем все доступные криптовалюты для первоначальной проверки
      // Запрашиваем до 100 монет, включая основные и дополнительные
      const cryptos = await fetchTopCryptos(100);
      const symbols = cryptos.map(crypto => crypto.id);
      
      console.log(`Получено ${symbols.length} криптовалют для проверки (включая основные)`);
      
      // Запускаем проверку сигналов для всех доступных монет
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
export async function runManualCheck(limit: number = 100) {
  console.log(`Запуск ручной проверки сигналов для всех доступных криптовалют (макс. ${limit})`);
  
  try {
    // Получаем полный список криптовалют для проверки
    const cryptos = await fetchTopCryptos(limit);
    const symbols = cryptos.map(crypto => crypto.id);
    
    console.log(`Получено ${symbols.length} криптовалют для проверки`);
    
    // Запускаем проверку сигналов
    await checkBuySignals(symbols);
    
    console.log('Ручная проверка завершена успешно');
    return true;
  } catch (error) {
    console.error('Ошибка при ручной проверке сигналов:', error);
    return false;
  }
}