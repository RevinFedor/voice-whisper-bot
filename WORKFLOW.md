# 🚀 DEV → PROD WORKFLOW

## 📝 ЕЖЕДНЕВНАЯ РАБОТА (DEV)

### Запуск DEV окружения:
```bash
# 1. Запустить БД
npm run db:dev:up

# 2. Запустить все сервисы
npm run dev:all
```

**Работаешь на портах:**
- Frontend: http://localhost:5173 (hot reload)
- Backend: http://localhost:3001
- Database: localhost:5433

## 🎯 ДЕПЛОЙ В PRODUCTION

### Когда готов выкатить изменения в prod:

```bash
# 1. Остановить DEV
Ctrl+C

# 2. Запустить PROD БД
npm run db:prod:up

# 3. Инициализация PROD БД (только первый раз!)
npm run db:prod:init

# 4. Билд и запуск PROD
npm run prod:all
```

**Теперь работает PROD на портах:**
- Frontend: http://localhost:8080 (статика из dist)
- Backend: http://localhost:3002
- Database: localhost:5434

## 📦 ЧТО ПРОИСХОДИТ ПРИ `npm run prod:all`:

1. **Автоматический билд** (новое!):
   - Backend компилируется в `web/backend/dist`
   - Frontend собирается в `web/frontend/dist`

2. **Запуск из собранных файлов**:
   - Backend: `node dist/main` (оптимизированный)
   - Frontend: `serve dist` (статичные файлы)
   - Bot: production режим

## 🔄 ПЕРЕНОС ДАННЫХ DEV → PROD

```bash
# Ручной перенос данных (когда нужно)
pg_dump -h localhost -p 5433 -U postgres voice_notes_db > backup.sql
psql -h localhost -p 5434 -U postgres voice_notes_db_prod < backup.sql
```

## ⚠️ ВАЖНО ПОМНИТЬ:

1. **DEV = горячая перезагрузка** (редактируешь код - сразу видишь)
2. **PROD = статичные файлы** (нужен билд после изменений)
3. **Два разных бота** (разные токены в .env.dev и .env.prod)
4. **Две разные БД** (dev на 5433, prod на 5434)

## 🎯 ПРОСТАЯ СХЕМА:

```
РАЗРАБОТКА:
Код → Сохранил → Сразу работает (hot reload)

ПРОДАКШН:
Код → Сохранил → npm run prod:all → Билд → Работает новая версия
```

## ✅ КОМАНДЫ-ШПАРГАЛКА:

| Что делаешь | Команда |
|------------|---------|
| Разработка | `npm run dev:all` |
| Выкатить в прод | `npm run prod:all` |
| Только билд | `npm run prod:build` |
| Проверить БД | `docker ps` |