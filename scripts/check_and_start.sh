#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MeeMee Bot - Автоматическая проверка и запуск"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Проверка Node.js
echo "1️⃣  Проверка Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js установлен: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi

# 2. Проверка Yarn
echo "2️⃣  Проверка Yarn..."
if command -v yarn &> /dev/null; then
    YARN_VERSION=$(yarn --version)
    echo -e "${GREEN}✅ Yarn установлен: v$YARN_VERSION${NC}"
else
    echo -e "${RED}❌ Yarn не установлен${NC}"
    exit 1
fi

# 3. Проверка Redis
echo "3️⃣  Проверка Redis..."
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✅ Redis запущен и работает${NC}"
else
    echo -e "${YELLOW}⚠️  Redis не запущен, попытка запуска...${NC}"
    redis-server --daemonize yes
    sleep 2
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis успешно запущен${NC}"
    else
        echo -e "${RED}❌ Не удалось запустить Redis${NC}"
        exit 1
    fi
fi

# 4. Проверка зависимостей
echo "4️⃣  Проверка зависимостей..."
cd /app/meemee_bot
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules существует${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules не найден, установка...${NC}"
    yarn install --silent
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
fi

# 5. Проверка .env файла
echo "5️⃣  Проверка .env файла..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env файл существует${NC}"
    
    # Проверка обязательных переменных
    MISSING_VARS=()
    
    if ! grep -q "BOT_TOKEN=" .env || grep -q "BOT_TOKEN=$" .env; then
        MISSING_VARS+=("BOT_TOKEN")
    fi
    
    if ! grep -q "LAVA_PAYMENT_API=" .env || grep -q "LAVA_PAYMENT_API=$" .env; then
        MISSING_VARS+=("LAVA_PAYMENT_API")
    fi
    
    if ! grep -q "KIE_AI_API_KEY=" .env || grep -q "KIE_AI_API_KEY=$" .env; then
        MISSING_VARS+=("KIE_AI_API_KEY")
    fi
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Отсутствуют обязательные переменные: ${MISSING_VARS[*]}${NC}"
        echo -e "${YELLOW}   Проверьте файл .env${NC}"
    else
        echo -e "${GREEN}✅ Все обязательные переменные заполнены${NC}"
    fi
else
    echo -e "${RED}❌ .env файл не найден${NC}"
    echo -e "${YELLOW}   Создайте .env файл из .env.example${NC}"
    exit 1
fi

# 6. Проверка config.js (Offer ID)
echo "6️⃣  Проверка Offer ID..."
if grep -q "YOUR_LAVA_OFFER_ID" src/config.js; then
    echo -e "${YELLOW}⚠️  В config.js есть placeholder'ы для Offer ID${NC}"
    echo -e "${YELLOW}   Обновите offerIdLava в src/config.js${NC}"
else
    echo -e "${GREEN}✅ Offer ID настроены${NC}"
fi

# 7. Проверка Supervisor конфигурации
echo "7️⃣  Проверка Supervisor..."
if [ -f "/etc/supervisor/conf.d/meemee.conf" ]; then
    echo -e "${GREEN}✅ Supervisor конфиг существует${NC}"
else
    echo -e "${YELLOW}⚠️  Supervisor конфиг не найден, копирование...${NC}"
    sudo cp supervisor_meemee.conf /etc/supervisor/conf.d/meemee.conf
    sudo supervisorctl reread
    sudo supervisorctl update
    echo -e "${GREEN}✅ Supervisor конфиг установлен${NC}"
fi

# 8. Запуск сервисов
echo "8️⃣  Запуск сервисов..."

# Проверка статуса и запуск если нужно
BOT_STATUS=$(sudo supervisorctl status meemee_bot 2>&1 | grep -o "RUNNING\|STOPPED\|FATAL" || echo "NOT_FOUND")
WEBHOOK_STATUS=$(sudo supervisorctl status meemee_webhook 2>&1 | grep -o "RUNNING\|STOPPED\|FATAL" || echo "NOT_FOUND")

if [ "$BOT_STATUS" = "NOT_FOUND" ]; then
    echo -e "${YELLOW}⚠️  meemee_bot не найден, добавление...${NC}"
    sudo supervisorctl reread
    sudo supervisorctl update
fi

if [ "$WEBHOOK_STATUS" = "NOT_FOUND" ]; then
    echo -e "${YELLOW}⚠️  meemee_webhook не найден, добавление...${NC}"
    sudo supervisorctl reread
    sudo supervisorctl update
fi

# Перезапуск сервисов
echo -e "${YELLOW}🔄 Перезапуск сервисов...${NC}"
sudo supervisorctl restart meemee_bot meemee_webhook 2>&1 | grep -v "ERROR"

sleep 3

# 9. Проверка статуса сервисов
echo "9️⃣  Проверка статуса сервисов..."
BOT_STATUS=$(sudo supervisorctl status meemee_bot | grep -o "RUNNING\|STOPPED\|FATAL")
WEBHOOK_STATUS=$(sudo supervisorctl status meemee_webhook | grep -o "RUNNING\|STOPPED\|FATAL")

if [ "$BOT_STATUS" = "RUNNING" ]; then
    echo -e "${GREEN}✅ meemee_bot: RUNNING${NC}"
else
    echo -e "${RED}❌ meemee_bot: $BOT_STATUS${NC}"
    echo -e "${YELLOW}   Проверьте логи: tail -50 /var/log/supervisor/meemee_bot.err.log${NC}"
fi

if [ "$WEBHOOK_STATUS" = "RUNNING" ]; then
    echo -e "${GREEN}✅ meemee_webhook: RUNNING${NC}"
else
    echo -e "${RED}❌ meemee_webhook: $WEBHOOK_STATUS${NC}"
    echo -e "${YELLOW}   Проверьте логи: tail -50 /var/log/supervisor/meemee_webhook.err.log${NC}"
fi

# 10. Проверка webhook endpoints
echo "🔟 Проверка webhook endpoints..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health 2>&1)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✅ Webhook сервер отвечает${NC}"
    echo -e "   URL: http://localhost:3000"
else
    echo -e "${RED}❌ Webhook сервер не отвечает${NC}"
fi

# 11. Итоговая информация
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Итоговый статус"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🤖 Бот: @$(grep BOT_NAME .env | cut -d= -f2)"
echo "📡 Webhook: http://localhost:3000"
echo ""
echo "📝 Полезные команды:"
echo "   • Логи бота:    tail -f /var/log/supervisor/meemee_bot.out.log"
echo "   • Логи webhook: tail -f /var/log/supervisor/meemee_webhook.out.log"
echo "   • Статус:       sudo supervisorctl status | grep meemee"
echo "   • Перезапуск:   sudo supervisorctl restart meemee_bot meemee_webhook"
echo ""
echo "📚 Полная документация: /app/meemee_bot/START_PROJECT.md"
echo ""

# Проверка ngrok
if pgrep -x "ngrok" > /dev/null; then
    echo "🌐 Ngrok запущен"
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    if [ ! -z "$NGROK_URL" ]; then
        echo "   Public URL: $NGROK_URL"
        echo "   Lava webhook: $NGROK_URL/webhook/lava"
        echo "   Crypto webhook: $NGROK_URL/webhook/crypto"
    fi
else
    echo -e "${YELLOW}⚠️  Ngrok не запущен${NC}"
    echo "   Для настройки webhook'ов запустите:"
    echo "   ngrok http 3000"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Проверка завершена!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
