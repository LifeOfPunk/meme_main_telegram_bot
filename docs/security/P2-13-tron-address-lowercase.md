# P2-13 — Tron-адрес приводится к lowercase

- **Severity:** 🟡 P2 (корректность сопоставления заказов)
- **Area:** Платежи / заказы
- **Status:** OPEN

## Location
- `src/services/Order.service.js:28` — `address_to_order:${outputAddress.toLowerCase()}`.
- `src/services/Order.service.js:53` — `getOrderByAddress` тоже применяет `.toLowerCase()`.

## Problem
EVM-адреса регистронезависимы, но Tron (base58, `T...`) — **регистрозависим**. Приведение к lowercase меняет адрес и может ломать сопоставление TRC-20 заказов или давать ложные совпадения.

## Attack / Failure vector
Сбой: TRC-20 вебхук/проверка не находит заказ или матчит не тот.

## Impact
Незачисление или неверное сопоставление для Tron-платежей.

## Suggested fix
- Не нормализовать регистр для не-EVM адресов; ключевать по сети (`chain:address`), lowercase применять только к EVM.

## References
- Связано: P0-04.
