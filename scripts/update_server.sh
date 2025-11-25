#!/bin/bash

SERVER_IP="185.231.154.191"
SERVER_USER="aiviral"
SERVER_PASS="rhMH2!11KVHsK5rty4r"
REMOTE_PATH="/home/aiviral/memememe"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Обновление файлов на сервере"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверка sshpass
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass не установлен. Установите:"
    echo "   brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

echo "📤 Копирование файлов..."
echo ""

# Копируем файлы
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no \
    src/bot_start.js \
    $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/

sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no \
    src/services/PaymentCrypto.service.js \
    $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/services/

sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no \
    src/controllers/paymentController.js \
    $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/controllers/

sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no \
    src/screens/keyboards.js \
    $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/screens/

echo ""
echo "✅ Файлы скопированы!"
echo ""
echo "🔄 Перезапуск бота..."
echo ""

# Перезапускаем бота
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'EOF'
cd /home/aiviral/memememe
pm2 restart meemee_bot
pm2 restart backend
echo ""
echo "✅ Бот перезапущен!"
echo ""
pm2 list
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Обновление завершено!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
