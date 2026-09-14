# P0-02 — Обход проверки подписи Lava (фиат)

- **Severity:** 🔴 P0 (подделка оплаты)
- **Area:** Платежи / вебхуки (Lava)
- **Status:** OPEN

## Location
- `src/backend/index.js:152` — `if (signature && process.env.WEBHOOK_PASSWORD_PROCESSING) { ... }`.
- `src/backend/index.js:159-161` — ветка `else`: проверка просто пропускается (лог-варнинг).
- `src/backend/index.js:136` — Basic-Auth проверяется только если заданы обе env-переменные.
- `src/backend/index.js:40-47` — `verifyLavaSignature`: `md5(JSON.stringify(data) + secret)`.

## Problem
Проверка подписи выполняется, только если клиент сам прислал заголовок `x-signature`/`x-lava-signature`. Если заголовок опустить — проверка пропускается полностью. Basic-Auth тоже условный: если `LAVA_WEBHOOK_USER/PASSWORD` не заданы, аутентификации нет вообще.

## Attack / Failure vector
POST на `/webhook/lava` **без** заголовка подписи с телом успешного платежа → заказ помечается оплаченным, начисляется пакет/баланс. Подделать заказ тривиально.

## Impact
Бесплатные пакеты и пополнение баланса без оплаты через фиат-канал.

## Suggested fix
- Fail-closed: если операция ведёт к начислению — подпись/Basic-Auth **обязательны**, отсутствие = `401/403`.
- Не использовать `md5`; применять документированную Lava схему подписи и сравнение constant-time.
- `JSON.stringify(data)` чувствителен к порядку ключей — подписывать canonical-представление, согласованное с провайдером.

## References
- Связано: P0-03 (гонки), P1-05 (общий секрет между средами).
