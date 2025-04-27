#!/bin/bash

# Скрипт для деплоя приложения на сервер
# Запускать на сервере после git pull

# Определяем директорию установки
INSTALL_DIR="/var/www/html/logicalplacewep"
LOG_FILE="$INSTALL_DIR/deploy.log"

# Начинаем логирование
echo "=== Начало деплоя: $(date) ===" > $LOG_FILE

# Проверяем, что мы находимся в правильной директории
if [ "$(pwd)" != "$INSTALL_DIR" ]; then
  echo "⚠️ Ошибка: Скрипт должен запускаться из директории $INSTALL_DIR" | tee -a $LOG_FILE
  exit 1
fi

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..." | tee -a $LOG_FILE
npm install --production >> $LOG_FILE 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️ Ошибка при установке зависимостей" | tee -a $LOG_FILE
  exit 1
fi

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
  echo "⚠️ Файл .env не найден. Создаем из .env.example..." | tee -a $LOG_FILE
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✅ Файл .env создан из шаблона. Пожалуйста, отредактируйте его с правильными значениями." | tee -a $LOG_FILE
  else
    echo "⚠️ Файл .env.example не найден. Пожалуйста, создайте файл .env вручную." | tee -a $LOG_FILE
  fi
fi

# Создаем директорию для логов, если её нет
mkdir -p logs
chmod 777 logs
echo "✅ Директория logs создана и настроена" | tee -a $LOG_FILE

# Собираем приложение
echo "🔧 Сборка приложения..." | tee -a $LOG_FILE
npm run build >> $LOG_FILE 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️ Ошибка при сборке приложения" | tee -a $LOG_FILE
  exit 1
fi

# Проверяем установку PM2
if ! command -v pm2 &> /dev/null; then
  echo "📦 PM2 не установлен. Устанавливаем..." | tee -a $LOG_FILE
  npm install -g pm2 >> $LOG_FILE 2>&1
fi

# Настраиваем и запускаем приложение с PM2
echo "🚀 Настраиваем PM2..." | tee -a $LOG_FILE

# Проверяем, запущено ли уже приложение через PM2
PM2_CHECK=$(pm2 list | grep crypto-signal)
if [ -n "$PM2_CHECK" ]; then
  echo "🔄 Перезапускаем существующее приложение в PM2..." | tee -a $LOG_FILE
  pm2 reload crypto-signal >> $LOG_FILE 2>&1
else
  echo "🚀 Запускаем новое приложение в PM2..." | tee -a $LOG_FILE
  pm2 start npm --name "crypto-signal" -- start >> $LOG_FILE 2>&1
  pm2 save >> $LOG_FILE 2>&1
fi

# Проверяем статус после запуска
PM2_STATUS=$(pm2 show crypto-signal | grep status | head -1)
echo "📊 Статус PM2: $PM2_STATUS" | tee -a $LOG_FILE

# Показываем информацию о порте
echo "🌐 Приложение запущено на порту 5002" | tee -a $LOG_FILE
echo "✅ Для доступа через nginx, убедитесь, что настроен правильный проксирование на порт 5002" | tee -a $LOG_FILE

echo "=== Деплой завершен: $(date) ===" | tee -a $LOG_FILE