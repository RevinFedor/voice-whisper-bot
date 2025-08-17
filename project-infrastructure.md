# Инфраструктура проекта

## Переменные окружения
- **2 файла в корне:** `.env.dev` и `.env.prod`
- **Загрузка:** через `dotenv-cli` в package.json
- **Никаких fallback значений** - упадет если переменной нет
- **Больше нигде настроек нет**

## Запуск
```bash
npm run dev:all   # DEV: порты 3001/5173, БД 5433
npm run prod:all  # PROD: порты 3002/8080, БД 5434
```

## Что происходит при запуске
**DEV режим:**
- Frontend: Vite dev server с hot reload
- Backend: NestJS с --watch (hot reload)
- Bot: обычный node (нет hot reload)

**PROD режим:**
1. Автоматически билдится backend (TypeScript → dist/)
2. Автоматически билдится frontend (Vite build → dist/)
3. Запускаются собранные версии

## БД
- **Docker контейнеры:** отдельные для dev/prod
- **Конфиг:** `web/backend/docker-compose.yml`
- **DEV и PROD БД не связаны** - разные данные

## Миграция DEV → PROD

### Код
```bash
git add . && git commit -m "..." && git push
npm run prod:all  # Автоматически соберет и запустит
```

### БД (если меняли схему)
```bash
# 1. Бэкап PROD данных (ОБЯЗАТЕЛЬНО!)
pg_dump -h localhost -p 5434 -U postgres voice_notes_db_prod > backup.sql

# 2. Применить миграции к PROD
cd web/backend
DATABASE_URL='postgresql://postgres:postgres@localhost:5434/voice_notes_db_prod?schema=public' npx prisma migrate deploy

# 3. Если конфликт - восстанови из бэкапа и мигрируй вручную
```

## Особенности
- **Разные Telegram боты** для dev/prod (разные токены)
- **Frontend всегда билдится** при `npm run prod:all`
- **Backend билдится** только в prod режиме
- **Hot reload** только в dev (кроме бота)

## Структура команд
```
package.json (корень)
    ├── dotenv-cli загружает .env.dev или .env.prod
    ├── concurrently запускает все 3 сервиса
    └── prod:build автоматически перед prod:all

Никаких ручных билдов не нужно - всё автоматизировано
```

## Проверка переменных
Каждый модуль при старте проверяет:
- Bot: `if (!process.env.VAR) throw Error`
- Backend: то же самое
- Frontend: `if (!import.meta.env.VITE_VAR) throw Error`

Нет переменной = приложение не запустится