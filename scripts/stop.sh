#!/bin/bash

echo "🛑 Остановка MeeMee Bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверка PM2
if command -v pm2 > /dev/null 2>&1; then
    echo "Остановка через PM2..."
    pm2 stop meemee-backend meemee-bot meemee-admin 2>/dev/null
    pm2 delete meemee-backend meemee-bot meemee-admin 2>/dev/null
    echo "✅ PM2 процессы остановлены"
fi

# Остановка обычных процессов
echo "Остановка Node.js процессов..."
pkill -f "node src/backend/index.js"
pkill -f "node src/bot_start.js"
pkill -f "node src/bot_start_admin.js"

sleep 1

# Проверка
if ps aux | grep -v grep | grep "node src/" > /dev/null; then
    echo "⚠️  Некоторые процессы еще работают"
    echo "Принудительная остановка..."
    pkill -9 -f "node src/"
    sleep 1
fi

echo "✅ Node.js процессы остановлены"
echo ""

# Остановка ngrok
if ps aux | grep -v grep | grep "ngrok http" > /dev/null; then
    read -p "Остановить ngrok? (y/n): " stop_ngrok
    if [ "$stop_ngrok" = "y" ]; then
        pkill -f "ngrok http"
        echo "✅ ngrok остановлен"
    fi
fi

echo ""

# Опционально остановить Redis
read -p "Остановить Redis? (y/n): " stop_redis
if [ "$stop_redis" = "y" ]; then
    redis-cli shutdown
    echo "✅ Redis остановлен"
fi

echo ""
echo "🎉 MeeMee Bot полностью остановлен"
