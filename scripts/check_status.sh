#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 MeeMee Bot - Проверка статуса системы"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Redis
echo "1️⃣ Redis:"
if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Работает"
else
    echo "   ❌ Не запущен"
fi
echo ""

# Бот
echo "2️⃣ MeeMee Bot:"
if ps aux | grep -v grep | grep "bot_start.js" > /dev/null; then
    echo "   ✅ Запущен"
else
    echo "   ⚠️  Не запущен"
fi
echo ""

# Webhook
echo "3️⃣ Webhook сервер:"
if ps aux | grep -v grep | grep "backend/index.js" > /dev/null; then
    echo "   ✅ Запущен"
else
    echo "   ⚠️  Не запущен"
fi
echo ""

# Клиент 1916527652
echo "4️⃣ Клиент 1916527652:"
USER_DATA=$(redis-cli GET "user:1916527652" 2>/dev/null)
if [ -n "$USER_DATA" ]; then
    PAID_QUOTA=$(echo "$USER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('paid_quota', 0))" 2>/dev/null)
    echo "   ✅ Найден в базе"
    echo "   📊 Платных видео: $PAID_QUOTA"
else
    echo "   ❌ Не найден в базе"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
