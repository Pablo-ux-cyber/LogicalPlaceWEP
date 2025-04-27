#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/var/www/html/logicalplacewep
SERVICE_NAME=crypto-signal.service

# Разрешаем Git работать в этой папке вне зависимости от владельца
git config --global --add safe.directory "$REPO_DIR"

# Перейти в репозиторий
cd "$REPO_DIR"

# Сохраняем все JSON из корня во временную папку
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
echo "[$(date)] 📦 Сохраняем JSON-файлы в $TMP_DIR…"
shopt -s nullglob
for f in *.json; do
  mv -- "$f" "$TMP_DIR/"
done

# Фиксируем старый коммит
OLD_HEAD=$(git rev-parse HEAD)

echo "[$(date)] ⬇️  Обновляем код из origin/main (жёсткий сброс)"
git fetch origin main
git reset --hard origin/main

echo "[$(date)] 📄 Обновлённые файлы с $OLD_HEAD до $(git rev-parse HEAD):"
git diff --name-status "$OLD_HEAD" HEAD || true

# Восстанавливаем JSON обратно
echo "[$(date)] 🔄 Восстанавливаем JSON-файлы из $TMP_DIR…"
for f in "$TMP_DIR"/*.json; do
  mv -- "$f" "$REPO_DIR/$(basename "$f")"
done

# Перезапускаем сервис
echo "[$(date)] 🔁 Перезапускаем сервис $SERVICE_NAME…"
systemctl restart "$SERVICE_NAME"

echo "[$(date)] ✅ Синхронизация завершена."
