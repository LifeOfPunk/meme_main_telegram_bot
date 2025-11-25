#!/bin/bash

# Простой скрипт для симуляции оплаты через curl
# Использование: ./test_mark_paid_simple.sh <orderId>

ORDER_ID=$1

if [ -z "$ORDER_ID" ]; then
    echo "❌ Ошибка: Не указан orderId"
    echo ""
    echo "Использование:"
    echo "  ./test_mark_paid_simple.sh <orderId>"
    echo ""
    echo "Пример:"
    echo "  ./test_mark_paid_simple.sh CRYPTO-20251120-1234567890"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Симуляция оплаты через webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Order ID: $ORDER_ID"
echo ""

# Генерируем случайный txHash
TX_HASH="0x$(openssl rand -hex 32)"

# Отправляем webhook
curl -X POST http://localhost:3000/webhook/crypto \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"status\": \"success\",
    \"amount\": \"10.00\",
    \"currency\": \"USDT\",
    \"txHash\": \"$TX_HASH\",
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"
  }"

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Webhook отправлен!"
echo "💡 Проверьте бота - пользователь должен получить уведомление"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
