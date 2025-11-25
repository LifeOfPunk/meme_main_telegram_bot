#!/bin/bash

echo "🚀 Запуск MeeMee Bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверка Redis
echo "1️⃣ Проверка Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis работает"
else
    echo "❌ Redis не запущен!"
    echo "Запустите: redis-server"
    exit 1
fi

echo ""
echo "2️⃣ Проверка Node.js..."
if command -v node > /dev/null 2>&1; then
    echo "✅ Node.js $(node -v)"
else
    echo "❌ Node.js не установлен!"
    exit 1
fi

echo ""
echo "3️⃣ Проверка зависимостей..."
if [ -d "node_modules" ]; then
    echo "✅ Зависимости установлены"
else
    echo "⚠️  Устанавливаем зависимости..."
    npm install
fi

echo ""
echo "4️⃣ Проверка .env файла..."
if [ -f ".env" ]; then
    echo "✅ .env файл найден"
else
    echo "❌ .env файл не найден!"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Выберите режим запуска:"
echo ""
echo "1) Разработка (3 терминала вручную)"
echo "2) PM2 (продакшен)"
echo "3) Только backend"
echo "4) Только основной бот"
echo "5) Только админ бот"
echo ""
read -p "Ваш выбор (1-5): " choice

case $choice in
    1)
        echo ""
        echo "📋 Запуск в режиме разработки"
        echo ""
        echo "Откройте 3 терминала и выполните:"
        echo ""
        echo "Терминал 1: node src/backend/index.js"
        echo "Терминал 2: node src/bot_start.js"
        echo "Терминал 3: node src/bot_start_admin.js"
        echo ""
        ;;
    2)
        echo ""
        echo "🚀 Запуск через PM2..."
        
        # Проверка PM2
        if ! command -v pm2 > /dev/null 2>&1; then
            echo "⚠️  PM2 не установлен. Устанавливаем..."
            npm install -g pm2
        fi
        
        # Остановка старых процессов
        pm2 delete meemee-backend meemee-bot meemee-admin 2>/dev/null
        
        # Запуск
        pm2 start src/backend/index.js --name "meemee-backend"
        pm2 start src/bot_start.js --name "meemee-bot"
        pm2 start src/bot_start_admin.js --name "meemee-admin"
        
        echo ""
        echo "✅ Все сервисы запущены!"
        echo ""
        pm2 status
        echo ""
        echo "Команды:"
        echo "  pm2 logs meemee-bot    - просмотр логов"
        echo "  pm2 restart all        - перезапуск"
        echo "  pm2 stop all           - остановка"
        echo ""
        ;;
    3)
        echo ""
        echo "🔧 Запуск backend..."
        node src/backend/index.js
        ;;
    4)
        echo ""
        echo "🤖 Запуск основного бота..."
        node src/bot_start.js
        ;;
    5)
        echo ""
        echo "👨‍💼 Запуск админ бота..."
        node src/bot_start_admin.js
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac
