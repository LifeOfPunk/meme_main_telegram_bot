# Реестр задач бэклога и Epics (Staging Telegram Bot)

Вся логика и интерфейс синхронизированы с интерактивным прототипом `https://aiviral.agency/viralapp-telegram-prototype/`.

---

## 🏛️ Структура Epic'ов и статус реализации

### EPIC-1: Навигация, клавиатуры и дизайн-система бота
*Синхронизация структуры меню и экранов Telegram-бота с веб-прототипом.*
- ✅ **TASK-01**: Очистка кнопки START на Desktop — [`TASK-01-desktop-start-button-cleanup.md`](TASK-01-desktop-start-button-cleanup.md) `[Done]`
- ✅ **TASK-07**: Реорганизация меню Профиля, баланса USDT/RUB и вывода — [`TASK-07-profile-menu-reorganization.md`](TASK-07-profile-menu-reorganization.md) `[Done]`
- ✅ **TASK-08**: Кастомные эмодзи и иконки в Telegram — [`TASK-08-telegram-custom-animated-emojis.md`](TASK-08-telegram-custom-animated-emojis.md) `[Done]`
- ✅ **TASK-14**: Инлайн-кнопки по дизайн-системе (зеленая/бесцветная логика) — [`TASK-14-colored-inline-buttons-design-system.md`](TASK-14-colored-inline-buttons-design-system.md) `[Done]`

### EPIC-2: Шаблонизатор мемов, медиа-активы и генерация
*Медиа-группа шаблона (видео-превью + статистика виральности) и валидация промптов.*
- ✅ **TASK-16**: Динамический каталог шаблонов и медиа-активов (Шаблонизатор + статы просмотров) — [`TASK-16-dynamic-templates-and-media-catalog.md`](TASK-16-dynamic-templates-and-media-catalog.md) `[Done]`
- ✅ **TASK-10**: Омниканальная лид-база и кнопка «🎁 Бесплатная генерация» — [`TASK-10-social-gift-omnichannel-lead-database.md`](TASK-10-social-gift-omnichannel-lead-database.md) `[Done]`
- 🔄 **TASK-09**: Матрица API и апгрейд качества видеомодели (нейтральное брендирование «лучшее качество») — [`TASK-09-video-ai-model-upgrade-google-omni-flash.md`](TASK-09-video-ai-model-upgrade-google-omni-flash.md) `[Ready / Economics]`

### EPIC-3: Платежные шлюзы в 1 клик (Lava Card & 0xProcessing)
*Прямой переход на оплату картой и генерация QR-кода крипты в 1 экран.*
- ✅ **TASK-04-05**: Фикс Lava Card + 1-click оплата картой + оферта и политика — [`TASK-04-05-fiat-lava-card-payment-fix-and-oneclick.md`](TASK-04-05-fiat-lava-card-payment-fix-and-oneclick.md) `[Done]`
- ✅ **TASK-02-03**: Крипта в 1 экран (TON, BEP20, SOL, BNB, Binance Pay) — [`TASK-02-03-crypto-payments-0xprocessing-binance-pay-oneclick.md`](TASK-02-03-crypto-payments-0xprocessing-binance-pay-oneclick.md) `[Done]`
- ✅ **TASK-06**: Дисклеймер комиссий крипто-бирж и минималки $0.50 — [`TASK-06-crypto-fee-disclaimer.md`](TASK-06-crypto-fee-disclaimer.md) `[Done]`
- ✅ **TASK-15**: Кошелек пользователя, авто-вывод и учет баланса в USDT/RUB — [`TASK-15-wallet-deposit-and-payout-engine.md`](TASK-15-wallet-deposit-and-payout-engine.md) `[Done]`
- ✅ **TASK-18**: Маршрутизация вебхуков Lava и 0xProcessing в Caddy (фикс 404) — [`TASK-18-payment-webhooks-caddy-routing.md`](TASK-18-payment-webhooks-caddy-routing.md) `[Done / Deployed]`

### EPIC-4: Вирусные петли, реферальная программа и шеринг
*Монетизация виральности, реферальные ссылки с бонусом 15%, авто-выгрузка.*
- ✅ **TASK-11**: Вирусный реферальный шеринг видео и инлайн-режим — [`TASK-11-viral-referral-video-share.md`](TASK-11-viral-referral-video-share.md) `[Done]`
- 🔄 **TASK-12**: Настройка Google OAuth и автовыгрузки на YouTube — [`TASK-12-youtube-oauth-and-auto-upload.md`](TASK-12-youtube-oauth-and-auto-upload.md) `[Ready]`
- ✅ **TASK-17**: Синхронизация страниц сайта (Гайд 9:16, Оферта, Политика) в репозиторий бота — [`TASK-17-site-legal-and-prompts-guide-sync.md`](TASK-17-site-legal-and-prompts-guide-sync.md) `[Done]`
- 🚀 **TASK-19**: Визуальная Админка (CMS) в прототипе с прямой кнопкой «Push to GitHub» — [`TASK-19-visual-prototype-admin-cms-github-push.md`](TASK-19-visual-prototype-admin-cms-github-push.md) `[P1 / Plan]`

---

## 🧪 Сводка автоматических тестов
Все ключевые компоненты покрыты автоматическими тестами:
1. `node scripts/check_syntax.js` — синтаксис всех 105 JS файлов валиден (0 ошибок).
2. `node test/test_meme_loader.js` — загрузка каталога, JSON-схемы, парсинг промптов.
3. `node test/test_prototype_integration.js` — сквозная проверка паритета бота и прототипа (структура меню, 1-клик оплата, оферта/политика, балансы RUB/USDT, статы просмотров).
