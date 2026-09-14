# P2-12 — Захардкоженный STAGING_BOT_TOKEN в compose

- **Severity:** 🟡 P2 (утечка секрета в git)
- **Area:** Инфра / секреты
- **Status:** OPEN

## Location
- `docker-compose.yml:47` — `STAGING_BOT_TOKEN=${STAGING_BOT_TOKEN:-<hardcoded token>}` (дефолт-значение с реальным токеном закоммичено).

## Problem
Значение по умолчанию содержит реальный токен Telegram-бота прямо в репозитории.

## Attack / Failure vector
Любой с доступом к репо/истории git получает контроль над стейдж-ботом.

## Impact
Компрометация стейдж-бота; токен в истории git навсегда.

## Suggested fix
- Убрать дефолт; брать токен только из секрет-стора/CI-секретов.
- **Ротировать** токен (он уже раскрыт в истории).

## References
- Связано: P1-05.
