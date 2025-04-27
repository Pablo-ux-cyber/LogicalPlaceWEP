# Crypto Signal Tracker

Приложение для отслеживания сигналов на покупку криптовалют на основе полос Боллинджера.

## Особенности

- Отслеживание топ 100 криптовалют по рыночной капитализации
- Расчет полос Боллинджера на недельном таймфрейме
- Определение сигналов на покупку, когда цена опускается ниже нижней полосы
- Отправка уведомлений в Telegram-группу
- Интерактивные графики с возможностью масштабирования и прокрутки

## Требования

- Node.js 18+
- PostgreSQL (опционально)
- API ключ CryptoCompare
- Токен Telegram бота

## Установка

1. Клонировать репозиторий:
   ```bash
   git clone <url-репозитория>
   cd crypto-signal-tracker
   ```

2. Установить зависимости:
   ```bash
   npm install
   ```

3. Создать файл .env:
   ```
   # Токен Telegram бота
   TELEGRAM_BOT_TOKEN=ваш_токен_бота

   # API ключ CryptoCompare
   CRYPTOCOMPARE_API_KEY=ваш_api_ключ

   # URL вашего приложения
   APP_URL=https://your-app-url.com

   # Настройки для логирования
   LOGS_DIR=./logs

   # ID группы в Telegram для отправки сигналов
   TELEGRAM_TARGET_GROUP_ID=@ваша_группа

   # Порт для приложения
   PORT=5002
   ```

4. Создать директорию для логов:
   ```bash
   mkdir -p logs
   ```

5. Запустить приложение:
   ```bash
   npm run dev      # Для разработки
   npm run build    # Собрать приложение
   npm start        # Запустить production-версию
   ```

## Deployment на сервере

### Метод 1: Прямой деплой

1. Клонировать репозиторий на сервере:
   ```bash
   git clone <url-репозитория> /var/www/html/crypto-signal-tracker
   cd /var/www/html/crypto-signal-tracker
   ```

2. Установить зависимости:
   ```bash
   npm install
   ```

3. Создать файл .env (по образцу выше)

4. Создать директории для логов:
   ```bash
   mkdir -p logs
   chmod 777 logs
   ```

5. Сборка приложения:
   ```bash
   npm run build
   ```

6. Настроить PM2 для запуска приложения:
   ```bash
   npm install -g pm2
   pm2 start npm --name "crypto-signal-tracker" -- start
   pm2 save
   pm2 startup
   ```

### Метод 2: Установка через Git синхронизацию

1. Настроить Git webhook на сервере
2. Создать скрипт автоматического деплоя
3. Настроить Nginx как обратный прокси:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5002;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## API Endpoints

- GET `/api/crypto/top` - Получить список топ криптовалют
- GET `/api/crypto/:symbol/:timeframe` - Получить данные для построения графика
- GET `/api/signals/check` - Запустить проверку сигналов
- GET `/api/telegram/test` - Отправить тестовое сообщение в Telegram
- GET `/api/logs/:type` - Получить логи (signals, checks, errors)

## Telegram Bot Commands

- `/start` - Информация о боте
- `/status` - Проверить статус бота
- `/help` - Показать справку

## Лицензия

MIT