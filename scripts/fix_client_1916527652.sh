#!/bin/bash

# Скрипт для быстрого добавления 50 видео клиенту ID: 1916527652
# Используйте эту команду для решения проблемы

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 MeeMee Bot - Добавление видео клиенту"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверяем Redis
echo "1️⃣ Проверка Redis..."
if ! service redis-server status > /dev/null 2>&1; then
    echo "⚠️  Redis не запущен. Запускаю..."
    service redis-server start
    sleep 2
fi

redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis работает"
else
    echo "❌ Redis не отвечает. Проверьте установку."
    exit 1
fi

echo ""
echo "2️⃣ Добавление 50 видео клиенту..."
echo "   User ID: 1916527652"
echo "   Количество: 50 видео"
echo ""

cd /app/meemee_bot

# Запускаем скрипт добавления
node add_quota_manually.js 1916527652 50

echo ""
echo "3️⃣ Проверка результата..."
echo ""

# Проверяем данные пользователя
USER_DATA=$(redis-cli GET "user:1916527652")
if [ -n "$USER_DATA" ]; then
    echo "✅ Данные пользователя обновлены:"
    echo "$USER_DATA" | python3 -m json.tool | grep -E "(userId|paid_quota|free_quota)" | head -5
else
    echo "⚠️  Пользователь не найден в базе"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Готово!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
