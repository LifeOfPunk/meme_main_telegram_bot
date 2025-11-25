#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Деплой исправлений на сервер"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVER="aiviral@185.231.154.191"
REMOTE_DIR="/home/aiviral/memememe"
PASSWORD="rhMH2!11KVHsK5rty4r"

echo ""
echo "📦 Копирование исправленных файлов на сервер..."
echo ""

# Копируем исправленные файлы
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no src/bot_start.js $SERVER:$REMOTE_DIR/src/
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no src/services/PaymentCrypto.service.js $SERVER:$REMOTE_DIR/src/services/
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no src/controllers/paymentController.js $SERVER:$REMOTE_DIR/src/controllers/
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no src/screens/keyboards.js $SERVER:$REMOTE_DIR/src/screens/

echo ""
echo "✅ Файлы скопированы!"
echo ""
echo "🔄 Перезапуск бота на сервере..."
echo ""

# Перезапускаем бота
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER << 'EOF'
cd /home/aiviral/memememe
pm2 restart meemee_bot
pm2 restart backend
pm2 save
echo ""
echo "✅ Бот перезапущен!"
echo ""
pm2 list
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Деплой завершен!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
