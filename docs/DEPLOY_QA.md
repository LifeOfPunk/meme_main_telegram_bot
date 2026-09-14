# Deploy & QA Runbook — security-fixes

Порядок: staging → проверка → prod. Ничего не включать на проде без зелёного стейджа.

## 0. Merge
- Смёржить PR #3 (`security-fixes → staging`).

## 1. Staging deploy (флаги безопасности ВЫКЛ)
- `WEBHOOK_ENFORCE_AUTH=false`, `PEER_FORWARD_ENABLED=false`.
- Задать `ANALYTICS_TOKEN` (иначе `/webhook/analytics/clicks` отдаёт 404 — это ок).
- Поднять стейдж, дождаться `✅ Connected to Redis`.

## 2. Функциональный QA (без enforcement)
- [ ] Крипто-платёж на тестовую сумму → баланс зачислен один раз.
- [ ] Карта (Lava) на тестовый пакет → генерации зачислены, баланс НЕ задвоен.
- [ ] Кнопка «✅ Проверить оплату» после оплаты → зачисляет сумму ЗАКАЗА (не больше).
- [ ] Идемпотентность: повторно доставить тот же вебхук (провайдер-ретрай или ручной POST) → второй раз `already_processed`, баланс НЕ меняется.
- [ ] Реферальный кешбэк начислен в USDT (не в рублях), сумма адекватна.
- [ ] Сессии переживают рестарт бота (начать ввод имени → рестарт → продолжить).

## 3. Включение подписей (P0-01/P0-02) — только на стейдже
- Задать `WEBHOOK_PASSWORD_PROCESSING` (0xProcessing Webhook Password) и `LAVA_WEBHOOK_SECRET`.
- Прогнать реальный вебхук крипта+карта, в логах должно быть `✅ Valid`.
- Если `❌ Invalid`: сверить строку подписи с реальным телом (0xProcessing: пробелы/ShopId/формат Currency; Lava: hex vs base64) и поправить `verifyCryptoSignature` / `verifyLavaSignature`.
- Когда обе `✅ Valid` → `WEBHOOK_ENFORCE_AUTH=true` на стейдже, повторить тест-платёж (должен пройти), затем поддельный POST без подписи → `401/403`.

## 4. Prod
- Разнести секреты: свой `.env` (или `.env` + `.env.staging`), отдельные ключи/мерчант для стейджа.
- Ротировать `STAGING_BOT_TOKEN` (был в git-истории).
- Повторить шаги 1–3 на проде: сначала флаги ВЫКЛ, функциональный QA, затем включить `WEBHOOK_ENFORCE_AUTH=true` после `✅ Valid` в логах.

## Быстрый тест идемпотентности (curl)
```
# дважды один и тот же вебхук — второй ответ должен быть already_processed
curl -s -X POST https://<staging-host>/webhook/staging/crypto \
  -H 'content-type: application/json' \
  -d '{"BillingID":"<realOrderId>","Status":"Success","Signature":"<validSig>"}'
```
