# Утилиты проекта

Эта папка содержит вспомогательные файлы и конфигурации.

## Конфигурационные файлы

- `supervisor_meemee.conf` - Конфигурация Supervisor для управления процессами
- `academy_aiviral_telegram_bot.code-workspace` - Настройки VS Code workspace

## CSV файлы

- `Chat-Bot.csv` - Данные чат-бота
- `export_all.csv` - Экспорт всех данных

## Использование

### Supervisor
Конфигурация для автоматического запуска и мониторинга бота:
```bash
supervisorctl -c utils/supervisor_meemee.conf start meemee
```

### VS Code Workspace
Откройте файл `academy_aiviral_telegram_bot.code-workspace` в VS Code для загрузки настроек проекта.

### CSV данные
Используются для импорта/экспорта пользователей и данных бота.
