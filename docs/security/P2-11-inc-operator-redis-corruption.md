# P2-11 — `$inc` пишется как ключ в Redis (счётчик не растёт)

- **Severity:** 🟡 P2 (корректность данных)
- **Area:** Рефералка
- **Status:** OPEN

## Location
- `src/services/Referral.service.js:55` и `:108` — `updateUser(id, { referredUsers, $inc: { totalReferrals: 1 } })`.
- `src/services/User.service.js:67-77` — `updateUser` просто разворачивает объект в JSON (не Mongo).

## Problem
`$inc` — оператор MongoDB, но хранилище Redis-JSON. `updateUser` кладёт литеральный ключ `$inc: {totalReferrals:1}` в объект пользователя. Поле `totalReferrals` никогда не инкрементируется, а объект засоряется мусорным ключом.

## Attack / Failure vector
Не эксплойт — функциональный баг: счётчик рефералов сломан, данные загрязнены.

## Impact
Неверная реферальная статистика; мусор в объекте пользователя.

## Suggested fix
- Инкрементировать явно: прочитать `totalReferrals`, `+1`, записать числом (или атомарно `HINCRBY`, см. P1-09).

## References
- Связано: P1-09.
