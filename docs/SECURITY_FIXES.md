# Security Fixes — ветка `security-fixes`

Правки по аудиту (`docs/security/`). Код-фиксы отделены от документации аудита (ветка `security-audit`).

## Что уже исправлено в коде (с пруфом)
| Находка | Суть фикса | Файлы |
|---|---|---|
| P0-03 | Атомарный идемпотентный claim заказа перед начислением (SET NX) | Order.service, index.js, paymentController |
| P0-01 / P0-04 | Не доверять сумме из тела вебхука / баланса адреса — начислять сумму заказа | index.js, paymentController |
| P1-07 | Пакет начисляет только генерации, депозит — только баланс | index.js, paymentController |
| P1-08 | База кешбэка в USD (`pkg.usdt`), а не в рублях; метки USDT | index.js, paymentController, Referral.service |
| P1-09 | Атомарные балансы/квоты через per-user Redis-lock | User.service |
| P1-06 | Кросс-средовой форвардинг вебхуков выключен по умолчанию | index.js |
| P2-10 | Крипто-стойкие orderId (`crypto.randomBytes`) | Order.service |
| P2-11 | `totalReferrals` инкрементируется корректно (убран `$inc`) | Referral.service |
| P2-12 | Убран hardcoded `STAGING_BOT_TOKEN` из compose | docker-compose.yml |
| P2-13 | Tron-адрес не приводится к lowercase (EVM — да) | Order.service |
| P2-14 | Секретные заголовки не логируются; аналитика под токеном | index.js |
| P2-15 | Telegram-сессии хранятся в Redis | bot_start.js |

Пруф атомарности: 13/13 concurrency-тестов на реальном Redis (claim 1/50, отсутствие двойного расхода квот/баланса, отсутствие lost-update, сохранность массивов).

## Требуются действия Рика перед включением

### 1. Подписи вебхуков (P0-01 / P0-02) — НЕ включены по умолчанию
Проверка реализована **fail-closed под флагом** `WEBHOOK_ENFORCE_AUTH=true`. Схемы подтверждены по докам провайдеров:

**0xProcessing** (payment form) — подтверждено (docs.0xprocessing.com):
`MD5(PaymentId:MerchantId:Email:Currency:WebhookPassword)`, поле подписи `Signature`.
- Секрет = **Webhook Password** из кабинета 0xProcessing (Settings → API → WebhookURL).
- Задать env `WEBHOOK_PASSWORD_PROCESSING=<webhook password>`.

**Lava.top** — HMAC-SHA256 по **сырому телу** запроса, заголовок `signature`:
- Задать секрет вебхука в кабинете Lava и продублировать в env `LAVA_WEBHOOK_SECRET=<secret>`.
- На стейдже прогнать реальный вебхук и убедиться, что валиден (сверить кодировку hex; если Lava шлёт base64 — поправить `verifyLavaSignature`).

Порядок включения:
1. Заполнить `WEBHOOK_PASSWORD_PROCESSING` и `LAVA_WEBHOOK_SECRET`.
2. Тестовый платёж крипта+карта на **стейдже** → в логах `✅ Valid`.
3. Затем `WEBHOOK_ENFORCE_AUTH=true` (сначала стейдж, потом прод).

> До включения флага риск уже снижен: сумма из заказа, начисление идемпотентно, orderId непредсказуем. Остаточный вектор — самоподделка своего заказа без оплаты; закрывается подписью.

### 2. Разделение сред (P1-05) — инфраструктурное, требует твоих секретов
- Завести **отдельные** ключи/мерчант 0xProcessing и Lava для стейджа и прод.
- Разнести `.env` по средам (сейчас `docker-compose*.yml` оба грузят один `.env`).
- **Ротировать** `STAGING_BOT_TOKEN` (он был в git-истории).

### 3. Деплой и QA
- `WEBHOOK_ENFORCE_AUTH` держать `false` до п.1.
- `ANALYTICS_TOKEN` задать (иначе аналитика отдаёт 404).
- После деплоя: тестовый платёж крипта+карта, проверка идемпотентности (двойная доставка вебхука), проверка «Проверить оплату».
