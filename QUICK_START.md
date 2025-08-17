# 🚀 БЫСТРЫЙ СТАРТ

## Установка (один раз)
```bash
npm run install:all
```

## Запуск DEV окружения
```bash
# 1. Запустить Docker Desktop

# 2. Запустить DEV базу данных (порт 5433)
npm run db:dev:up

# 3. Запустить все сервисы
npm run dev:all
```

## Запуск PROD окружения
```bash
# 1. Запустить Docker Desktop

# 2. Запустить PROD базу данных (порт 5434)  
npm run db:prod:up

# 3. Инициализировать БД (только первый раз!)
cd web/backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/voice_notes_db_prod?schema=public" npx prisma migrate deploy

# 4. Запустить все сервисы (из корня проекта)
npm run prod:all
```

## Команды
- `npm run dev:all` - запуск всех сервисов в DEV режиме
- `npm run prod:all` - запуск всех сервисов в PROD режиме
- `npm run db:dev:up` - запуск DEV базы данных
- `npm run db:prod:up` - запуск PROD базы данных
- `npm run db:prod:init` - инициализация PROD базы данных

## ⚠️ ВАЖНО для PROD
1. Создайте нового бота в @BotFather
2. Добавьте токен в `.env.prod` в строку `TELEGRAM_TOKEN`
3. Создайте папку "Production Notes" в Obsidian

## Порты
- **DEV**: БД 5433, Backend 3001, Frontend 5173
- **PROD**: БД 5434, Backend 3002, Frontend 8080