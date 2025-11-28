#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER_USER="aiviral"
SERVER_IP="185.231.154.191"
SERVER_PATH="/home/aiviral/memememe"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🚀 Деплой YouTube интеграции на сервер"
echo "═══════════════════════════════════════════════════════"
echo ""

# Создаем резервную копию .env на сервере
echo "📦 Создаю резервную копию .env на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_PATH} && cp .env .env.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Загружаем .env
echo "📤 Загружаю .env на сервер..."
scp .env ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/.env

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка загрузки .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .env загружен${NC}"
echo ""

# Загружаем обновленные файлы сервисов
echo "📤 Загружаю обновленные файлы..."
scp -r src/services ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка загрузки файлов${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Файлы загружены${NC}"
echo ""

# Запускаем OAuth сервер
echo "🌐 Запускаю YouTube OAuth сервер..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_PATH} && pm2 start src/youtube_oauth_server.js --name youtube-oauth || pm2 restart youtube-oauth"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка запуска OAuth сервера${NC}"
    exit 1
fi

echo -e "${GREEN}✅ OAuth сервер запущен${NC}"
echo ""

# Перезапускаем бота
echo "🔄 Перезапускаю бота на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_PATH} && pm2 restart meemee-bot"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка перезапуска бота${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Бот перезапущен${NC}"
echo ""

# Проверяем статус
echo "📊 Статус сервисов:"
ssh ${SERVER_USER}@${SERVER_IP} "pm2 status"

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Деплой завершен успешно!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Проверьте работу:"
echo "  1. Сгенерируйте видео в боте"
echo "  2. Нажмите '📺 Выложить на YouTube'"
echo "  3. Подключите свой YouTube канал"
echo "  4. Видео загрузится на ваш канал"
echo ""
echo "Логи:"
echo "  ssh ${SERVER_USER}@${SERVER_IP}"
echo "  cd ${SERVER_PATH}"
echo "  pm2 logs meemee-bot"
echo "  pm2 logs youtube-oauth"
echo ""
