#!/bin/bash

echo "🔍 Проверка работы бота..."
echo ""

# Проверка процессов
echo "1️⃣ Проверка процессов PM2:"
pm2 list | grep meemee

echo ""
echo "2️⃣ Последние логи бота:"
pm2 logs meemee-bot --lines 10 --nostream | tail -10

echo ""
echo "3️⃣ Проверка Redis:"
redis-cli ping

echo ""
echo "4️⃣ Проверка ngrok:"
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | cut -d'"' -f4

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Если все пункты ОК - бот должен отвечать на /start"
echo "❌ Если бот не отвечает - напиши /start еще раз"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
