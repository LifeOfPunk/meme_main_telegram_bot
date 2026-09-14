# P2-10 — Предсказуемые orderId

- **Severity:** 🟡 P2 (hardening, усиливает P0)
- **Area:** Платежи / заказы
- **Status:** OPEN

## Location
- `src/services/Order.service.js:161-165` — `generateOrderId`: префикс-дата + `Math.floor(1000000000 + Math.random()*9000000000)`.

## Problem
ID заказа основан на дате и `Math.random()` (не крипто-стойкий, узкое пространство). В связке с неаутентифицированными вебхуками (P0-01) заказы перебираемы.

## Attack / Failure vector
Перебор `CRYPTO-YYYYMMDD-<10 цифр>` для нахождения валидных заказов и последующей подделки вебхука.

## Impact
Снижает стоимость атак P0-01/P0-02.

## Suggested fix
- `crypto.randomUUID()` или `crypto.randomBytes` для непредсказуемой части.

## References
- Связано: P0-01, P0-02.
