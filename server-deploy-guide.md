# Руководство по развертыванию на сервере

## 1. Подготовка сервера

Сначала установите необходимые зависимости:

```bash
# Установка Node.js (если еще не установлен)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версии
node -v  # Должно быть 18.х или выше
npm -v

# Установка PM2 для управления процессами
sudo npm install -g pm2

# Установка Git (если еще не установлен)
sudo apt install -y git
```

## 2. Клонирование репозитория

```bash
# Создайте директорию или используйте существующую
cd /var/www/html
git clone https://github.com/username/crypto-signal-tracker.git logicalplacewep
cd logicalplacewep
```

## 3. Настройка переменных окружения

```bash
# Создайте файл .env
cp dotenv-example .env

# Отредактируйте файл с правильными значениями
nano .env
```

## 4. Развертывание приложения

Используйте подготовленный скрипт деплоя:

```bash
chmod +x deploy.sh
./deploy.sh
```

Скрипт автоматически:
- Установит зависимости
- Проверит наличие файла .env
- Создаст директорию для логов
- Соберет приложение
- Настроит и запустит приложение с PM2

## 5. Настройка Nginx

```bash
# Создайте конфигурацию для вашего сайта
sudo cp nginx-config-example.conf /etc/nginx/sites-available/imm2.dinet.fvds.ru.conf

# Отредактируйте конфигурацию, если необходимо
sudo nano /etc/nginx/sites-available/imm2.dinet.fvds.ru.conf

# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/imm2.dinet.fvds.ru.conf /etc/nginx/sites-enabled/

# Проверьте конфигурацию Nginx
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

## 6. Настройка SSL (если еще не сделано)

```bash
# Установите certbot
sudo apt install -y certbot python3-certbot-nginx

# Получите SSL-сертификат
sudo certbot --nginx -d imm2.dinet.fvds.ru

# Проверьте автоматическое обновление сертификатов
sudo certbot renew --dry-run
```

## 7. Обновление приложения

При каждом обновлении кода:

```bash
cd /var/www/html/logicalplacewep
git pull
./deploy.sh
```

## 8. Мониторинг и управление

```bash
# Просмотр логов PM2
pm2 logs crypto-signal

# Просмотр статуса приложения
pm2 status

# Перезапуск приложения
pm2 restart crypto-signal

# Остановка приложения
pm2 stop crypto-signal

# Запуск приложения
pm2 start crypto-signal
```

## 9. Тестирование

После завершения настройки, проверьте приложение:

- Откройте в браузере: https://imm2.dinet.fvds.ru
- Проверьте доступность API: https://imm2.dinet.fvds.ru/api/crypto/top
- Отправьте тестовое сообщение: https://imm2.dinet.fvds.ru/api/telegram/test

## Решение проблем

### Приложение не запускается

1. Проверьте логи PM2:
   ```bash
   pm2 logs crypto-signal
   ```

2. Проверьте наличие файла .env с правильными значениями.

3. Проверьте наличие и права доступа к директории logs:
   ```bash
   ls -la /var/www/html/logicalplacewep/logs
   ```

### Nginx не проксирует запросы

1. Проверьте конфигурацию Nginx:
   ```bash
   sudo nginx -t
   ```

2. Проверьте, запущено ли приложение и доступно ли оно на порту 5002:
   ```bash
   curl http://localhost:5002
   ```

3. Проверьте логи Nginx:
   ```bash
   sudo tail -f /var/log/nginx/imm2.dinet.fvds.ru.error.log
   ```