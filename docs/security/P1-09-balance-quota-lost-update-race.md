# P1-09 — Lost-update гонки по балансу/квотам

- **Severity:** 🟠 P1 (утечка генераций / рассинхрон баланса)
- **Area:** Балансы / квоты
- **Status:** OPEN

## Location
- `src/services/User.service.js:67-98` — `updateUser` перезаписывает объект целиком (`{...user, ...data}`).
- `src/services/User.service.js:109-165` — `deductFreeQuota/deductPaidQuota/deductWalletBalance/addWalletBalance`: read-modify-write.
- `src/services/User.service.js:262-281` — `addPaidQuota/addFreeQuota`: то же.
- Нет `INCR`/`HINCRBYFLOAT`/`WATCH`.

## Problem
Баланс и квоты хранятся как JSON-объект пользователя и меняются через get→merge→set. Параллельные операции читают одно состояние и затирают изменения друг друга (lost update).

## Attack / Failure vector
- Два быстрых клика «Создать» читают `free_quota = 1` и оба списывают до 0 → 2 генерации за 1 квоту.
- Вебхук-начисление и списание за генерацию затирают поля друг друга.

## Impact
Утечка бесплатных/платных генераций, рассинхрон баланса.

## Suggested fix
- Хранить баланс/квоты числовыми полями Redis-хэша и менять атомарно (`HINCRBYFLOAT`, `HINCRBY`) либо `WATCH`+`MULTI`/Lua.
- Идемпотентная блокировка на пользователя при списании.

## References
- Связано: P0-03 (тот же класс гонок в платежах).
