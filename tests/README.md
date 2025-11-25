# Тесты проекта

Эта папка содержит все тестовые файлы для проверки функциональности бота.

## Структура тестов

### Основные тесты
- `test_full_system.js` - Полное тестирование системы
- `test_basic_logic.js` - Тестирование базовой логики

### Реферальная система
- `test_referral_flow.js` - Тест обычных рефералов
- `test_expert_referral_flow.js` - Тест экспертных рефералов
- `test_referral_system.js` - Общий тест реферальной системы

### Платежи
- `test_crypto_payment.js` - Тест крипто-платежей
- `test_crypto_fix.js` - Тест исправлений крипто-платежей
- `test_payment_flow.js` - Тест потока платежей
- `test_payment_fix.js` - Тест исправлений платежей
- `test_solana_payment.js` - Тест Solana платежей
- `test_solana_support.js` - Тест поддержки Solana
- `test_simulate_payment.js` - Симуляция платежа
- `test_simulate_real_payment.js` - Симуляция реального платежа
- `test_mark_paid.js` - Тест пометки оплаченным

### API и интеграции
- `test_0xprocessing_api.js` - Тест 0xProcessing API
- `test_0xprocessing_api2.js` - Тест 0xProcessing API v2
- `test_kie_ai.js` - Тест Kie.ai API
- `test_kie_ai_fixed.js` - Тест исправленного Kie.ai API

### Генерация видео
- `test_mama_taxi.js` - Тест мема "Мама такси"
- `test_mama_taxi_girl.js` - Тест мема "Мама такси" (девочка)
- `test_query_task.js` - Тест задач генерации
- `test_query_v2.js` - Тест генерации v2

### Функциональность бота
- `test_inline_mode.js` - Тест inline режима
- `test_share_button.js` - Тест кнопки "Поделиться"
- `test_free_generation_button.js` - Тест кнопки бесплатной генерации
- `test_menu_with_quota.js` - Тест меню с квотой
- `test_quota_management.js` - Тест управления квотой

### Webhook и уведомления
- `test_webhook_crypto.js` - Тест webhook для крипто
- `test_webhook_generation.js` - Тест webhook для генерации
- `test_admin_notifications.js` - Тест уведомлений админа

### Парсинг и валидация
- `test_callback_parsing.js` - Тест парсинга callback
- `test_callback_parsing_debug.js` - Отладка парсинга callback
- `test_regex_fix.js` - Тест исправлений regex
- `test_all_urls.js` - Тест всех URL

### Утилиты
- `test_redis.js` - Тест Redis
- `test_error_logger.js` - Тест логгера ошибок
- `test_quick.js` - Быстрый тест
- `test_send_to_user.js` - Тест отправки пользователю

### Проверки
- `test_buttons.js` → `check_buttons.js`
- `test_config.js` → `check_config.js`
- `test_user.js` → `check_user.js`
- `test_video_settings.js` → `check_video_settings.js`
- `test_webhook_ready.js` → `check_webhook_ready.js`

## Запуск тестов

### Основные тесты
```bash
# Полное тестирование
node tests/test_full_system.js

# Реферальная система
node tests/test_referral_flow.js
node tests/test_expert_referral_flow.js
```

### Тесты платежей
```bash
node tests/test_crypto_payment.js
node tests/test_payment_flow.js
```

### Тесты генерации
```bash
node tests/test_mama_taxi.js
node tests/test_query_v2.js
```
