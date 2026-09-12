# TASK-18: Настройка маршрутизации вебхуков платежей (Lava & 0xProcessing) в Caddy

## 📌 Проблема и бизнес-контекст
Пользовательские оплаты картой (Lava) и криптовалютой (0xProcessing) создаются корректно, но после оплаты не зачисляются на баланс бота, а заказы остаются в статусе неоплаченных.

### Причина сбоя
В `Caddyfile` домен `aiviral.agency` настроен исключительно как статический `file_server` (`root * /srv/site`). Эндпоинты `/webhook/lava` и `/webhook/crypto` возвращают `HTTP 404 Not Found`. Из-за этого входящие POST-колбэки от платежных систем не доходят до Node.js бэкенда (`viralapp-staging-backend:3005`).

---

## 🛠️ План решения

1. **Маршрутизация в Caddyfile:**
   Добавить блок `handle /webhook/*` для домена `aiviral.agency`, проксирующий запросы в контейнер бэкенда:
   ```caddy
   aiviral.agency, www.aiviral.agency {
       encode gzip
       
       handle /webhook/* {
           reverse_proxy viralapp-staging-backend:3005
       }
       
       handle {
           root * /srv/site
           file_server
       }
   }
   ```

2. **Проверка обработчиков в `src/backend/index.js`:**
   - Верификация парсинга сигнатур Lava и статусов (`payment.success`, `paid`, `completed`).
   - Верификация парсинга 0xProcessing (`billingID`, `status: paid`).
   - Автоматическое начисление пакета генераций в `OrderService.markAsPaid` и отправка уведомления пользователю в Telegram.

3. **Сквозное тестирование (Definition of Done):**
   - [ ] `curl -i -X POST https://aiviral.agency/webhook/lava` возвращает ответ бэкенда (не 404).
   - [ ] `curl -i -X POST https://aiviral.agency/webhook/crypto` возвращает статус готовности `{"status":"ready"}` (не 404).
   - [ ] Симуляция боевого колбэка успешно пополняет квоту тестового пользователя и присылает сообщение в `@meemee_official_bot`.
