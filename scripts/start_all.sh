#!/bin/bash

echo "🚀 Полный запуск MeeMee Bot + ngrok"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Проверка Redis
echo "1️⃣ Проверка Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis работает${NC}"
else
    echo -e "${YELLOW}⚠️  Redis не запущен. Запускаем...${NC}"
    redis-server --daemonize yes
    sleep 2
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis запущен${NC}"
    else
        echo -e "${RED}❌ Не удалось запустить Redis${NC}"
        echo "Запустите вручную: redis-server"
        exit 1
    fi
fi

echo ""

# 2. Проверка Node.js
echo "2️⃣ Проверка Node.js..."
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите: https://nodejs.org/"
    exit 1
fi

echo ""

# 3. Проверка зависимостей
echo "3️⃣ Проверка зависимостей..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Устанавливаем зависимости...${NC}"
    npm install
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
else
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
fi

echo ""

# 4. Проверка .env
echo "4️⃣ Проверка .env файла..."
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env файл не найден!${NC}"
    exit 1
fi

# Проверка ключевых параметров
if ! grep -q "BOT_TOKEN=" .env || grep -q "BOT_TOKEN=$" .env; then
    echo -e "${RED}❌ BOT_TOKEN не настроен в .env${NC}"
    exit 1
fi

if ! grep -q "KIE_AI_API_KEY=" .env || grep -q "KIE_AI_API_KEY=$" .env; then
    echo -e "${YELLOW}⚠️  KIE_AI_API_KEY не настроен (генерация видео не будет работать)${NC}"
fi

echo -e "${GREEN}✅ .env файл найден${NC}"

echo ""

# 5. Проверка ngrok
echo "5️⃣ Проверка ngrok..."
if command -v ngrok > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ngrok установлен${NC}"
    
    # Проверка запущен ли ngrok
    if ps aux | grep -v grep | grep "ngrok http 3000" > /dev/null; then
        echo -e "${GREEN}✅ ngrok уже запущен${NC}"
        
        # Получаем URL
        sleep 1
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ ! -z "$NGROK_URL" ]; then
            echo -e "${GREEN}📡 ngrok URL: $NGROK_URL${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Запускаем ngrok...${NC}"
        nohup ngrok http 3000 > logs/ngrok.log 2>&1 &
        sleep 3
        
        # Получаем URL
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ ! -z "$NGROK_URL" ]; then
            echo -e "${GREEN}✅ ngrok запущен${NC}"
            echo -e "${GREEN}📡 ngrok URL: $NGROK_URL${NC}"
        else
            echo -e "${RED}❌ Не удалось получить ngrok URL${NC}"
        fi
    fi
else
    echo -e "${RED}❌ ngrok не установлен!${NC}"
    echo ""
    echo "Установите ngrok:"
    echo "1. Зайдите на https://ngrok.com/"
    echo "2. Зарегистрируйтесь"
    echo "3. Скачайте и установите ngrok"
    echo "4. Запустите: ngrok config add-authtoken ВАШ_ТОКЕН"
    echo ""
    read -p "Продолжить без ngrok? (webhook не будут работать) y/n: " continue_without_ngrok
    if [ "$continue_without_ngrok" != "y" ]; then
        exit 1
    fi
fi

echo ""

# 6. Остановка старых процессов
echo "6️⃣ Остановка старых процессов..."
pkill -f "node src/backend/index.js" 2>/dev/null
pkill -f "node src/bot_start.js" 2>/dev/null
pkill -f "node src/bot_start_admin.js" 2>/dev/null
sleep 1
echo -e "${GREEN}✅ Старые процессы остановлены${NC}"

echo ""

# 7. Создание папки для логов
mkdir -p logs

# 8. Проверка PM2
echo "7️⃣ Выбор режима запуска..."
if command -v pm2 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PM2 установлен${NC}"
    echo ""
    echo "Использовать PM2? (рекомендуется)"
    read -p "y/n: " use_pm2
    if [ "$use_pm2" = "y" ]; then
        USE_PM2=true
    else
        USE_PM2=false
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не установлен${NC}"
    echo ""
    echo "Установить PM2? (рекомендуется для продакшена)"
    read -p "y/n: " install_pm2
    if [ "$install_pm2" = "y" ]; then
        echo "Устанавливаем PM2..."
        npm install -g pm2
        USE_PM2=true
    else
        USE_PM2=false
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 9. Запуск сервисов
if [ "$USE_PM2" = true ]; then
    echo "🚀 Запуск через PM2..."
    echo ""
    
    # Удаляем старые процессы PM2
    pm2 delete meemee-backend meemee-bot meemee-admin 2>/dev/null
    
    # Запускаем новые
    pm2 start src/backend/index.js --name "meemee-backend"
    pm2 start src/bot_start.js --name "meemee-bot"
    pm2 start src/bot_start_admin.js --name "meemee-admin"
    
    echo ""
    echo -e "${GREEN}✅ Все сервисы запущены через PM2!${NC}"
    echo ""
    pm2 status
    
else
    echo "🚀 Запуск в фоновом режиме..."
    echo ""
    
    # Запуск в фоне с перенаправлением логов
    nohup node src/backend/index.js > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Backend запущен (PID: $BACKEND_PID)${NC}"
    
    sleep 2
    
    nohup node src/bot_start.js > logs/bot.log 2>&1 &
    BOT_PID=$!
    echo -e "${GREEN}✅ Основной бот запущен (PID: $BOT_PID)${NC}"
    
    sleep 2
    
    nohup node src/bot_start_admin.js > logs/admin.log 2>&1 &
    ADMIN_PID=$!
    echo -e "${GREEN}✅ Админ бот запущен (PID: $ADMIN_PID)${NC}"
    
    # Сохраняем PID в файл
    echo "$BACKEND_PID" > logs/backend.pid
    echo "$BOT_PID" > logs/bot.pid
    echo "$ADMIN_PID" > logs/admin.pid
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Все сервисы запущены и работают!${NC}"
echo ""

# 10. Итоговая информация
echo "📊 Статус сервисов:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Redis:          работает"
echo "✅ Backend:        http://localhost:3000"
echo "✅ Основной бот:   @meemee12_bot"
echo "✅ Админ бот:      запущен"

if [ ! -z "$NGROK_URL" ]; then
    echo "✅ ngrok:          $NGROK_URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 11. Webhook URLs
if [ ! -z "$NGROK_URL" ]; then
    echo "🌐 Webhook URLs для настройки:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Lava (карты):"
    echo "  $NGROK_URL/webhook/lava"
    echo ""
    echo "0xprocessing (крипта):"
    echo "  $NGROK_URL/webhook/crypto"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}⚠️  ВАЖНО: Настройте эти URL в Lava и 0xprocessing!${NC}"
    echo ""
fi

# 12. Полезные команды
echo "📋 Полезные команды:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$USE_PM2" = true ]; then
    echo "  pm2 logs              - просмотр всех логов"
    echo "  pm2 logs meemee-bot   - логи основного бота"
    echo "  pm2 restart all       - перезапуск всех сервисов"
    echo "  pm2 stop all          - остановка всех сервисов"
else
    echo "  tail -f logs/bot.log      - логи основного бота"
    echo "  tail -f logs/backend.log  - логи backend"
    echo "  tail -f logs/admin.log    - логи админа"
    echo "  ./stop.sh                 - остановка всех сервисов"
fi

echo ""
echo "  redis-cli ping        - проверка Redis"
echo "  curl http://localhost:4040/api/tunnels - проверка ngrok"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 MeeMee Bot полностью запущен и готов к работе!${NC}"
echo ""
echo "Откройте @meemee12_bot в Telegram и напишите /start"
echo ""
