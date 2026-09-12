# TASK-10: Omnichannel Lead Database & «🎁 Подписывайся за подарок!»

## 1. Проблема
В текущем боте кнопка проверки подписки привязана только к каналу Telegram (@aiviral_media). 
Бизнес-цель: конвертировать аудиторию бота в подписчиков ключевых соцсетей проекта (Instagram @aiviral.agency, YouTube @aiviral-media, TikTok @aiviral.media) и собирать лид-базу профилей пользователей с привязкой к их Telegram ID.

## 2. Требования
1. **Новая кнопка меню/профиля**:
   - «🎁 Подписывайся за подарок!» (заменяет старый текст «Подписаться на канал»).
2. **Экран с социальными ссылками**:
   - При клике выдавать красивое сообщение со ссылками на соцсети проекта:
     - 📸 Instagram: https://instagram.com/aiviral.agency
     - 🎥 YouTube: https://youtube.com/@aiviral-media
     - 🎵 TikTok: https://tiktok.com/@aiviral.media
     - 📢 Telegram: https://t.me/aiviral_media
3. **Сбор лид-данных (Lead Capture Flow)**:
   - Кнопка «✅ Я подписался, забрать подарок».
   - FSM-диалог (шаг за шагом) с предложением указать свой ник в Instagram / YouTube для начисления бонуса (+X бесплатных генераций).
   - Сохранение в базу данных:
     - telegram_id
     - username
     - first_name
     - instagram_handle
     - youtube_handle
     - tiktok_handle
     - claimed_gift_at (timestamp, защита от повторного абуза)
4. **Хранилище**:
   - Сохранение в Redis / PostgreSQL модель лидов с возможностью экспорта в CSV/Admin Panel.

## 3. Файлы для изменения
- src/handlers/user_handlers/user_menu.js (обновление текста кнопки и роутинга)
- src/handlers/user_handlers/social_gift_handler.js (новый FSM-обработчик ввода соцсетей)
- src/services/User.service.js (сохранение профилей соцсетей и начисление бонуса)
- src/config/redisKeys.js (ключи отслеживания заявок на подарок)

## 4. Критерии приемки (DoD)
- Нажатие на «🎁 Подписывайся за подарок!» открывает список всех 4 соцсетей.
- Пользователь может ввести свой ник и получить бонус.
- Повторный ввод блокируется (защита от накрутки).
- Все данные надежно сохранены в базе и видны по Telegram ID.
