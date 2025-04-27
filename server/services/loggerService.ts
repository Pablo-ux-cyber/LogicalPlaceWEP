import * as fs from 'fs';
import * as path from 'path';

// Используем путь из переменной окружения или по умолчанию из текущей директории
const LOG_DIR = process.env.LOGS_DIR || 'logs';
const SIGNAL_LOG_FILE = 'signals.log';
const CHECK_LOG_FILE = 'checks.log';
const ERROR_LOG_FILE = 'errors.log';

// Создаем директорию для логов, если она не существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Записать сообщение в лог-файл
 * @param message Сообщение для логирования
 * @param logType Тип лога (signals, checks, errors)
 */
export function logToFile(message: string, logType: 'signals' | 'checks' | 'errors' = 'checks'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  let logFileName: string;
  switch (logType) {
    case 'signals':
      logFileName = SIGNAL_LOG_FILE;
      break;
    case 'errors':
      logFileName = ERROR_LOG_FILE;
      break;
    default:
      logFileName = CHECK_LOG_FILE;
      break;
  }
  
  const logFilePath = path.join(LOG_DIR, logFileName);
  
  // Записываем лог в файл (добавляем в конец файла)
  fs.appendFileSync(logFilePath, logMessage);
  
  // Также выводим в консоль для удобства мониторинга
  console.log(message);
}

/**
 * Логировать информацию о проверке монеты
 * @param symbol Символ криптовалюты
 * @param price Текущая цена
 * @param bbValue Значение нижней полосы Боллинджера
 * @param isSignal Найден ли сигнал
 */
export function logCryptoCheck(symbol: string, price: number, bbValue: number, isSignal: boolean): void {
  const status = isSignal 
    ? `⚠️ ${symbol}: Цена ${price} <= BB ${bbValue.toFixed(2)} - СИГНАЛ НА ПОКУПКУ!` 
    : `${symbol}: Цена ${price} > BB ${bbValue.toFixed(2)}`;
  
  logToFile(status, isSignal ? 'signals' : 'checks');
}

/**
 * Логировать ошибки при проверке монеты
 * @param symbol Символ криптовалюты
 * @param error Текст ошибки
 */
export function logError(symbol: string, error: string): void {
  logToFile(`❌ Ошибка при проверке ${symbol}: ${error}`, 'errors');
}

/**
 * Логировать итоги проверки
 * @param successful Количество успешно проверенных монет
 * @param errors Количество монет с ошибками
 * @param signals Количество найденных сигналов
 */
export function logCheckSummary(successful: number, errors: number, signals: number): void {
  const summary = `✅ Проверка завершена! Успешно: ${successful}, с ошибками: ${errors}, найдено сигналов: ${signals}`;
  logToFile(summary, signals > 0 ? 'signals' : 'checks');
}

/**
 * Получить содержимое лог-файла
 * @param logType Тип лога (signals, checks, errors)
 * @returns Содержимое лог-файла
 */
export function getLogContent(logType: 'signals' | 'checks' | 'errors' = 'checks'): string {
  let logFileName: string;
  switch (logType) {
    case 'signals':
      logFileName = SIGNAL_LOG_FILE;
      break;
    case 'errors':
      logFileName = ERROR_LOG_FILE;
      break;
    default:
      logFileName = CHECK_LOG_FILE;
      break;
  }
  
  const logFilePath = path.join(LOG_DIR, logFileName);
  
  if (!fs.existsSync(logFilePath)) {
    return 'Лог-файл пуст или не существует';
  }
  
  // Читаем последние 1000 строк файла
  try {
    const content = fs.readFileSync(logFilePath, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-1000).join('\n');
    return lastLines;
  } catch (error) {
    return `Ошибка при чтении лог-файла: ${error}`;
  }
}