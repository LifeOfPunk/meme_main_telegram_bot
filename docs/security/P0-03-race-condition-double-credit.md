# P0-03 — Race condition (TOCTOU) → многократное начисление

- **Severity:** 🔴 P0 (умножение средств)
- **Area:** Платежи (все 3 пути начисления)
- **Status:** OPEN

## Location
- Lava webhook: `src/backend/index.js:184` (проверка `isPaid`) → `:210` (`markAsPaid`).
- Crypto webhook: `src/backend/index.js:342` → `:365`.
- Ручная проверка: `src/controllers/paymentController.js:628` → `:637`.
- Неатомарность: `src/services/Order.service.js:65-78` (`updateOrder` = get→set) и `:112-118` (`markAsPaid`).

## Problem
Между чтением `order.isPaid === false` и вызовом `markAsPaid` нет атомарной блокировки. `markAsPaid` — это read-modify-write в Redis без `WATCH`/`SET NX`/Lua. Два параллельных запроса оба проходят проверку и оба начисляют.

## Attack / Failure vector
- Провайдер шлёт ретраи вебхука (частая практика) → дубли начисления.
- Пользователь спамит кнопку «✅ Проверить оплату» параллельно (`check_payment_<orderId>`) → N-кратное зачисление одного заказа.
- Гонка вебхук × ручная проверка одновременно.

## Impact
Один платёж → многократное начисление баланса/квоты. Легко воспроизводимо (кнопку жмёт сам пользователь).

## Suggested fix
- Атомарный «claim» заказа перед начислением: `SET order:<id>:claimed 1 NX` (или Lua/`WATCH`+`MULTI`), и начислять только владельцу claim.
- Идемпотентность по внешнему `paymentId`.

## References
- Связано: P0-01, P0-02, P0-04 (все три пути начисления).
