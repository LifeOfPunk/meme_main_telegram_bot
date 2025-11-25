# Скрипты проекта

Эта папка содержит все скрипты для управления и обслуживания бота.

## Скрипты запуска и управления

### Основные
- `start.sh` - Запуск бота
- `stop.sh` - Остановка бота
- `run.sh` - Запуск в режиме разработки
- `start_all.sh` - Запуск всех сервисов
- `check_and_start.sh` - Проверка и запуск

### Деплой
- `deploy_fixes.sh` - Деплой исправлений
- `update_server.sh` - Обновление сервера
- `fix_bot.sh` - Исправление бота

### Мониторинг
- `check_status.sh` - Проверка статуса
- `view_logs.sh` - Просмотр логов
- `watch_crypto_logs.sh` - Мониторинг крипто-логов
- `watch_inline_logs.sh` - Мониторинг inline логов

### Утилиты
- `setup_ngrok.sh` - Настройка ngrok
- `commands_cheatsheet.sh` - Шпаргалка по командам

## Скрипты управления данными

### Пользователи
- `add_quota_manually.js` - Ручное добавление квоты
- `add_single_user.js` - Добавление одного пользователя
- `add_user_583561687.js` - Добавление конкретного пользователя
- `add_users_by_ids.js` - Добавление пользователей по ID
- `import_users_from_csv.js` - Импорт пользователей из CSV
- `update_user_names.js` - Обновление имен пользователей
- `fix_user_balance.js` - Исправление баланса пользователя
- `fix_user_service.js` - Исправление сервиса пользователей
- `fix_client_1916527652.sh` - Исправление конкретного клиента

### Проверки
- `check_buttons.js` - Проверка кнопок
- `check_config.js` - Проверка конфигурации
- `check_last_generation.js` - Проверка последней генерации
- `check_recent_generations.js` - Проверка недавних генераций
- `check_user.js` - Проверка пользователя
- `check_user_1048912079.js` - Проверка конкретного пользователя
- `check_user_orders.js` - Проверка заказов пользователя
- `check_video_settings.js` - Проверка настроек видео
- `check_webhook_ready.js` - Проверка готовности webhook

### Миграция и данные
- `migrate_all_data.js` - Миграция всех данных
- `migrate_redis_data.js` - Миграция данных Redis
- `clear_errors.js` - Очистка ошибок

### Генерация и отправка
- `retry_generation.js` - Повтор генерации
- `send_video_to_user.js` - Отправка видео пользователю

### Платежи
- `get_lava_offers.js` - Получение предложений Lava
- `update_lava_offers.js` - Обновление предложений Lava
- `comparison_payment.js` - Сравнение платежей

## Использование

### Запуск бота
```bash
./scripts/start.sh
```

### Остановка бота
```bash
./scripts/stop.sh
```

### Проверка статуса
```bash
./scripts/check_status.sh
```

### Просмотр логов
```bash
./scripts/view_logs.sh
```

### Добавление квоты пользователю
```bash
node scripts/add_quota_manually.js <userId> <amount>
```

### Импорт пользователей
```bash
node scripts/import_users_from_csv.js <path_to_csv>
```
