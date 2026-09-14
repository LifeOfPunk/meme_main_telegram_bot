# P1-08 — Смешение валют в кешбэке (RUB считается как USDT)

- **Severity:** 🟠 P1 (финансовое расхождение, раздутые обязательства)
- **Area:** Рефералка / кешбэк
- **Status:** OPEN

## Location
- `src/backend/index.js:231` — `cashbackBase = depositUsd > 0 ? depositUsd : order.amount` (для фиат-пакета `depositUsd = 0`, `order.amount` — в RUB).
- `src/backend/index.js:103-104` — уведомление эксперта в **USDT**.
- `src/services/Referral.service.js:171` — `cashback1 = (amount * 25) / 100`.
- `src/services/Referral.service.js:193` — лог в **₽**.

## Problem
Для фиат-пакета база кешбэка — сумма в рублях (`order.amount`), но начисляется в `totalCashback` и показывается пользователю/эксперту как USDT. Валюты перепутаны (логи в ₽, уведомления в USDT).

## Attack / Failure vector
Эксперт переначисляется примерно в (курс RUB→USDT) раз: напр. заказ 500 ₽ → 125 «USDT» кешбэка вместо ~1.5 USDT.

## Impact
Раздутые обязательства по кешбэку и неверная статистика. Выплата — ручная через менеджера (`src/handlers/user_handlers/user_menu.js:70-96`), что частично сдерживает прямой ущерб, но цифры и UX неверны.

## Suggested fix
- Приводить базу кешбэка к единой валюте (USD): для фиата конвертировать RUB→USD перед процентом.
- Согласовать валютные метки во всех логах/уведомлениях.

## References
- Связано: P1-07.
