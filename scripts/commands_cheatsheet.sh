#!/bin/bash
# 🎮 Шпаргалка управления MeeMee Bot

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎮 MeeMee Bot - Команды управления"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'

═══════════════════════════════════════════════════════════════
📦 ЗАПУСК СЕРВИСОВ
═══════════════════════════════════════════════════════════════

1️⃣ Запустить Webhook сервер:
   cd /app/meemee_bot
   node src/backend/index.js > /tmp/webhook.log 2>&1 &

2️⃣ Запустить MeeMee бот:
   cd /app/meemee_bot
   node src/bot_start.js > /tmp/bot.log 2>&1 &

3️⃣ Запустить Redis:
   service redis-server start

═══════════════════════════════════════════════════════════════
📊 ПРОВЕРКА СТАТУСА
═══════════════════════════════════════════════════════════════

Проверить всё сразу:
   cd /app/meemee_bot && bash check_status.sh

Проверить webhook сервер:
   curl http://localhost:3000/health

Проверить Redis:
   redis-cli ping

Проверить процессы:
   ps aux | grep node

═══════════════════════════════════════════════════════════════
📜 ПРОСМОТР ЛОГОВ
═══════════════════════════════════════════════════════════════

Логи webhook (в реальном времени):
   tail -f /tmp/webhook.log

Логи бота (в реальном времени):
   tail -f /tmp/bot.log

Последние 50 строк webhook:
   tail -50 /tmp/webhook.log

Поиск ошибок:
   grep "ERROR\|❌" /tmp/webhook.log | tail -20

Поиск успешных платежей:
   grep "Successfully added" /tmp/webhook.log | tail -10

═══════════════════════════════════════════════════════════════
🛑 ОСТАНОВКА СЕРВИСОВ
═══════════════════════════════════════════════════════════════

Остановить webhook сервер:
   pkill -f "backend/index.js"

Остановить бот:
   pkill -f "bot_start.js"

Остановить все node процессы:
   pkill node

═══════════════════════════════════════════════════════════════
🔄 ПЕРЕЗАПУСК
═══════════════════════════════════════════════════════════════

Перезапустить webhook:
   pkill -f "backend/index.js"
   cd /app/meemee_bot
   node src/backend/index.js > /tmp/webhook.log 2>&1 &

Перезапустить бот:
   pkill -f "bot_start.js"
   cd /app/meemee_bot
   node src/bot_start.js > /tmp/bot.log 2>&1 &

═══════════════════════════════════════════════════════════════
👤 УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
═══════════════════════════════════════════════════════════════

Добавить видео клиенту:
   cd /app/meemee_bot
   node add_quota_manually.js <USER_ID> <КОЛИЧЕСТВО>

Примеры:
   node add_quota_manually.js 1916527652 50
   node add_quota_manually.js 123456789 10

Проверить данные клиента:
   redis-cli GET "user:<USER_ID>" | python3 -m json.tool

Пример:
   redis-cli GET "user:1916527652" | python3 -m json.tool

═══════════════════════════════════════════════════════════════
🔍 ДИАГНОСТИКА
═══════════════════════════════════════════════════════════════

Все webhook запросы:
   grep "webhook received" /tmp/webhook.log | tail -20

Успешные платежи:
   grep "Successfully added" /tmp/webhook.log | tail -10

Ошибки:
   grep "❌" /tmp/webhook.log | tail -20

Проверка портов:
   netstat -tulpn | grep :3000

Список пользователей в Redis:
   redis-cli SMEMBERS all_users

═══════════════════════════════════════════════════════════════
🧪 ТЕСТИРОВАНИЕ
═══════════════════════════════════════════════════════════════

Тест webhook:
   cd /app/meemee_bot
   node test_webhook_crypto.js

Health check:
   curl http://localhost:3000/health

═══════════════════════════════════════════════════════════════
📚 ДОКУМЕНТАЦИЯ
═══════════════════════════════════════════════════════════════

FINAL_REPORT.md              - Финальный отчёт
WEBHOOK_FIX_COMPLETE.md      - Анализ webhook исправлений
SOLUTION_SUMMARY.md          - Краткая сводка
MANUAL_QUOTA_ADD_GUIDE.md    - Инструкция добавления квоты

═══════════════════════════════════════════════════════════════
✅ ТЕКУЩИЙ СТАТУС СИСТЕМЫ
═══════════════════════════════════════════════════════════════
EOF

echo ""
cd /app/meemee_bot && bash check_status.sh
