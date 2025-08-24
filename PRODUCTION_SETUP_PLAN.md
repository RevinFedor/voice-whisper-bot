# ФИНАЛЬНЫЙ ПЛАН НАСТРОЙКИ PROD ОКРУЖЕНИЯ

## ШАГ 1: Создание файлов окружения

### Создать `.env.development`:
```
TELEGRAM_TOKEN=****************************************
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/voice_notes_db
PORT=3001
FRONTEND_URL=http://localhost:5173
OBSIDIAN_FOLDER=Telegram Voice Notes
OPENAI_KEY=sk-proj-****************************************
OBSIDIAN_API_KEY=****************************************
OBSIDIAN_HOST=127.0.0.1
OBSIDIAN_PORT=27123
```

### Создать `.env.production`:
```
TELEGRAM_TOKEN=[НОВЫЙ_ТОКЕН_ОТ_BOTFATHER]
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/voice_notes_db_prod
PORT=3002
FRONTEND_URL=http://localhost:8080
OBSIDIAN_FOLDER=Production Notes
OPENAI_KEY=sk-proj-****************************************
OBSIDIAN_API_KEY=****************************************
OBSIDIAN_HOST=127.0.0.1
OBSIDIAN_PORT=27123
```

---

## ШАГ 2: Docker контейнер для PROD базы

### Создать `docker-compose.prod.yml`:
- Копия существующего docker-compose
- Изменить порт: 5434:5432
- Изменить имя контейнера: postgres-prod
- Изменить volume: voice_notes_data_prod

```yaml
version: '3.8'

services:
  postgres-prod:
    image: postgres:14-alpine
    container_name: postgres-prod
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: voice_notes_db_prod
    ports:
      - "5434:5432"
    volumes:
      - voice_notes_data_prod:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - voice-notes-network-prod

volumes:
  voice_notes_data_prod:
    name: voice_notes_data_prod

networks:
  voice-notes-network-prod:
    driver: bridge
```

---

## ШАГ 3: Инициализация PROD базы данных

### Запустить контейнер:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Применить схему Prisma:
```bash
cd web/backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/voice_notes_db_prod" npx prisma migrate deploy
```

---

## ШАГ 4: Команды запуска

### DEV окружение:
1. Запустить Docker Desktop
2. Запустить postgres контейнер (порт 5433)
3. Загрузить переменные из `.env.development`
4. Запустить 3 процесса:
   - `telegram-bot`: nodemon index.js
   - `backend`: npm run start:dev
   - `frontend`: npm run dev

### PROD окружение:
1. Запустить Docker Desktop
2. Запустить postgres-prod контейнер (порт 5434)
3. Билд backend: `npm run build`
4. Билд frontend: `npm run build`
5. Загрузить переменные из `.env.production`
6. Запустить 3 процесса:
   - `telegram-bot`: node index.js
   - `backend`: node dist/main
   - `frontend`: serve -s dist -p 8080

---

## ШАГ 5: Миграция данных между БД

### Первичная загрузка DEV → PROD:
```bash
pg_dump -h localhost -p 5433 -U postgres voice_notes_db > backup.sql
psql -h localhost -p 5434 -U postgres voice_notes_db_prod < backup.sql
```

### Регулярная синхронизация PROD → DEV (для тестирования с реальными данными):
```bash
pg_dump -h localhost -p 5434 -U postgres voice_notes_db_prod > prod_backup.sql
psql -h localhost -p 5433 -U postgres voice_notes_db < prod_backup.sql
```

---

## ШАГ 6: Процесс деплоя изменений

### Когда нужна миграция БД:
- При изменении `schema.prisma`
- Сначала тестируем в DEV
- Потом применяем к PROD

### Команды миграции для DEV:
```bash
cd web/backend
npm run prisma:migrate  # создает и применяет миграцию
```

### Команды миграции для PROD:
```bash
cd web/backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/voice_notes_db_prod" npx prisma migrate deploy
```

---

## ШАГ 7: Чек-лист перед запуском PROD

1. ✅ Создать нового бота в @BotFather
2. ✅ Записать токен в `.env.production`
3. ✅ Создать папку "Production Notes" в Obsidian
4. ✅ Запустить docker-compose.prod.yml
5. ✅ Применить миграции к prod БД
6. ✅ Выполнить билд backend и frontend
7. ✅ Запустить prod окружение

---

## ИТОГОВАЯ СТРУКТУРА:

```
/voice-whisper-bot/
├── .env.development        # DEV переменные
├── .env.production        # PROD переменные  
├── docker-compose.prod.yml # PROD база данных
├── telegram-bot/          # Читает NODE_ENV
├── web/
│   ├── backend/           
│   │   ├── dist/         # Билд для PROD
│   │   └── docker-compose.yml # DEV база
│   └── frontend/
│       └── dist/         # Билд для PROD
```

### Переключение между окружениями:
- **DEV**: NODE_ENV=development + порты 5433/3001/5173
- **PROD**: NODE_ENV=production + порты 5434/3002/8080

---

## Команды в package.json (корневой)

### Для удобства можно добавить в корневой package.json:

```json
{
  "scripts": {
    "dev": "concurrently -n \"BOT,BACKEND,FRONTEND\" -c \"green,yellow,cyan\" \"cd telegram-bot && npm run dev\" \"cd web/backend && npm run start:dev\" \"cd web/frontend && npm run dev\"",
    "prod:build": "cd web/backend && npm run build && cd ../frontend && npm run build",
    "prod": "npm run prod:build && concurrently -n \"BOT-PROD,BACKEND-PROD,FRONTEND-PROD\" -c \"red,magenta,blue\" \"NODE_ENV=production node telegram-bot/index.js\" \"NODE_ENV=production node web/backend/dist/main\" \"cd web/frontend && npx serve -s dist -p 8080\""
  }
}
```

Это позволит запускать:
- `npm run dev` - для разработки
- `npm run prod` - для production