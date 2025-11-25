#!/bin/bash

echo "🚀 Запуск MeeMee Bot - Все сервисы"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Проверка и запуск Redis
echo "1️⃣ Проверка Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis уже запущен"
else
    echo "⚠️  Redis не запущен. Запускаем..."
    redis-server --daemonize yes
    sleep 2
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis запущен"
    else
        echo "❌ Не удалось запустить Redis"
        echo "Запустите вручную: redis-server"
        exit 1
    fi
fi

echo ""

# 2. Проверка Node.js
echo "2️⃣ Проверка Node.js..."
if command -v node > /dev/null 2>&1; then
    echo "✅ Node.js $(node -v)"
else
    echo "❌ Node.js не установлен!"
    exit 1
fi

echo ""

# 3. Установка зависимостей
echo "3️⃣ Проверка зависимостей..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  Устанавливаем зависимости..."
    npm install
else
    echo "✅ Зависимости установлены"
fi

echo ""

# 4. Остановка старых процессов
echo "4️⃣ Остановка старых процессов..."
pkill -f "node src/backend/index.js" 2>/dev/null
pkill -f "node src/bot_start.js" 2>/dev/null
pkill -f "node src/bot_start_admin.js" 2>/dev/null
sleep 1
echo "✅ Старые процессы остановлены"

echo ""

# 5. Проверка PM2
echo "5️⃣ Проверка PM2..."
if command -v pm2 > /dev/null 2>&1; then
    echo "✅ PM2 установлен"
    USE_PM2=true
else
    echo "⚠️  PM2 не установлен"
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

# 6. Запуск сервисов
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
    echo "✅ Все сервисы запущены через PM2!"
    echo ""
    pm2 status
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Полезные команды:"
    echo "  pm2 logs              - просмотр всех логов"
    echo "  pm2 logs meemee-bot   - логи основного бота"
    echo "  pm2 restart all       - перезапуск всех сервисов"
    echo "  pm2 stop all          - остановка всех сервисов"
    echo "  pm2 delete all        - удаление всех процессов"
    echo ""
    echo "🌐 Webhook endpoints:"
    echo "  http://localhost:3000/webhook/lava   - для Lava"
    echo "  http://localhost:3000/webhook/crypto - для 0xprocessing"
    echo ""
    echo "🤖 Боты:"
    echo "  @meemee12_bot - основной бот"
    echo "  Админ бот - для управления"
    echo ""
    
else
    echo "🚀 Запуск в фоновом режиме..."
    echo ""
    
    # Запуск в фоне с перенаправлением логов
    nohup node src/backend/index.js > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "✅ Backend запущен (PID: $BACKEND_PID)"
    
    sleep 2
    
    nohup node src/bot_start.js > logs/bot.log 2>&1 &
    BOT_PID=$!
    echo "✅ Основной бот запущен (PID: $BOT_PID)"
    
    sleep 2
    
    nohup node src/bot_start_admin.js > logs/admin.log 2>&1 &
    ADMIN_PID=$!
    echo "✅ Админ бот запущен (PID: $ADMIN_PID)"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Процессы:"
    echo "  Backend: $BACKEND_PID"
    echo "  Bot:     $BOT_PID"
    echo "  Admin:   $ADMIN_PID"
    echo ""
    echo "📋 Логи:"
    echo "  tail -f logs/backend.log  - логи backend"
    echo "  tail -f logs/bot.log      - логи бота"
    echo "  tail -f logs/admin.log    - логи админа"
    echo ""
    echo "🛑 Остановка:"
    echo "  kill $BACKEND_PID $BOT_PID $ADMIN_PID"
    echo "  или используйте: ./stop.sh"
    echo ""
fi

echo "✅ Все сервисы запущены и работают!"
echo ""
echo "🎉 MeeMee Bot готов к работе!"
