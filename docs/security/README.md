# 🔐 Security Audit — meme_main_telegram_bot

Аудит проведён по ветке `staging` (2026-09-14). Область: платежи и вебхуки, роутинг/стейты бота, балансы/квоты, разделение сред (staging/prod).

Каждая находка — отдельный файл + отдельный коммит, чтобы ревьюить их независимо (в т.ч. второй нейронкой прямо в PR на GitHub).

## Формат каждого файла
`Severity` · `Location (file:line)` · `Problem` · `Attack/Failure vector` · `Impact` · `Suggested fix` · `Status`

## Легенда критичности
- **P0** — прямая кража средств/генераций или неаутентифицированное начисление. Блокирует прод.
- **P1** — утечка между средами, финансовые расхождения, гонки.
- **P2** — hardening, корректность данных, латентные риски.

## Индекс находок

| ID | Severity | Заголовок | Файл |
|----|----------|-----------|------|
| P0-01 | 🔴 P0 | Крипто-вебхук без проверки подписи, сумма из тела запроса | [P0-01](P0-01-crypto-webhook-no-signature.md) |
| P0-02 | 🔴 P0 | Обход проверки подписи Lava | [P0-02](P0-02-lava-signature-bypass.md) |
| P0-03 | 🔴 P0 | Race condition (TOCTOU) → многократное начисление | [P0-03](P0-03-race-condition-double-credit.md) |
| P0-04 | 🔴 P0 | «Проверить оплату» зачисляет весь баланс адреса | [P0-04](P0-04-check-payment-credits-full-address-balance.md) |
| P1-05 | 🟠 P1 | Общий `.env` между prod и staging | [P1-05](P1-05-shared-env-prod-staging.md) |
| P1-06 | 🟠 P1 | Форвардинг вебхука между контурами кредитует соседний | [P1-06](P1-06-cross-env-webhook-forwarding.md) |
| P1-07 | 🟠 P1 | Крипто-пакеты начисляют и генерации, и баланс | [P1-07](P1-07-crypto-package-double-credit.md) |
| P1-08 | 🟠 P1 | Смешение валют в кешбэке (RUB считается как USDT) | [P1-08](P1-08-cashback-currency-mixing.md) |
| P1-09 | 🟠 P1 | Lost-update гонки по балансу/квотам | [P1-09](P1-09-balance-quota-lost-update-race.md) |
| P2-10 | 🟡 P2 | Предсказуемые orderId | [P2-10](P2-10-predictable-order-ids.md) |
| P2-11 | 🟡 P2 | `$inc` пишется как ключ в Redis (счётчик не растёт) | [P2-11](P2-11-inc-operator-redis-corruption.md) |
| P2-12 | 🟡 P2 | Захардкоженный STAGING_BOT_TOKEN в compose | [P2-12](P2-12-hardcoded-staging-bot-token.md) |
| P2-13 | 🟡 P2 | Tron-адрес приводится к lowercase | [P2-13](P2-13-tron-address-lowercase.md) |
| P2-14 | 🟡 P2 | Публичная аналитика + логирование секретов | [P2-14](P2-14-public-analytics-and-secret-logging.md) |
| P2-15 | 🟡 P2 | Состояние диалога в памяти процесса | [P2-15](P2-15-in-memory-session-state.md) |

## Статусы
Все находки: **OPEN** (не исправлено). Правки в этой ветке не вносились — только документация.
