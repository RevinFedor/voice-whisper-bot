# 🚀 Backend Launch Guide - Voice Notes with TLDraw

## ✅ Что реализовано

### Backend (NestJS + Prisma + PostgreSQL):
- ✅ REST API для управления заметками
- ✅ Автоматическое позиционирование по датам с заполнением дырок
- ✅ Сохранение позиций после перетаскивания
- ✅ Флаг `manuallyPositioned` для перетащенных заметок
- ✅ Swagger документация на http://localhost:3001/api

### Frontend (React + TLDraw):
- ✅ Кнопка "Добавить заметку" (рандомная дата в течение недели)
- ✅ Синхронизация позиций при перетаскивании
- ✅ Периодическая синхронизация каждые 30 секунд
- ✅ Автоматическая инициализация demo данных

## 📦 Установка и запуск

### 1. База данных PostgreSQL

```bash
# Установить PostgreSQL если нет
brew install postgresql@14
brew services start postgresql@14

# Создать базу данных
createdb voice_notes_db

# Или через psql
psql -U postgres
CREATE DATABASE voice_notes_db;
\q
```

### 2. Backend

```bash
cd web/backend

# Установить зависимости
npm install

# Сгенерировать Prisma Client
npx prisma generate

# Создать таблицы в БД
npx prisma migrate dev --name init

# Запустить backend
npm run start:dev

# Backend запустится на http://localhost:3001
# Swagger документация: http://localhost:3001/api
```

### 3. Frontend

```bash
cd web/frontend

# Установить зависимости (если еще не установлены)
npm install

# Запустить frontend
npm run dev

# Открыть в браузере
http://localhost:5173/?sync=true
```

## 🎮 Режимы запуска

### Frontend режимы:
- `http://localhost:5173/` - Standalone версия без backend
- `http://localhost:5173/?sync=true` - **Production с синхронизацией** ✅
- `http://localhost:5173/?test=position` - Тест отслеживания позиций
- `http://localhost:5173/?test=date` - Тест автоматического позиционирования

## 🔧 Конфигурация

### Backend (.env):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voice_notes_db?schema=public"
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Изменить БД пользователя/пароль:
```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/voice_notes_db?schema=public"
```

## 📝 API Endpoints

### Notes:
- `GET /api/notes` - Получить все заметки
- `POST /api/notes` - Создать заметку
- `POST /api/notes/random` - Создать рандомную заметку
- `POST /api/notes/initialize` - Инициализировать demo данные
- `PATCH /api/notes/:id/position` - Обновить позицию после drag
- `DELETE /api/notes/:id` - Удалить заметку
- `GET /api/notes/dates` - Получить уникальные даты

## 🎯 User Cases (все работают!)

### 1. Добавление новой заметки
- Нажать кнопку "➕ Добавить заметку"
- Заметка добавляется на рандомную дату в течение недели
- Автоматически встает в конец колонки или заполняет дырку

### 2. Перетаскивание заметки
- Перетащить заметку в любое место
- Позиция сохраняется в БД
- Флаг `manuallyPositioned = true`
- Заметка больше не учитывается при добавлении новых

### 3. Добавление после перетаскивания
- Если из колонки перетащили заметку - осталась дырка
- Новая заметка заполнит эту дырку
- Если дырок нет - встанет в конец

### 4. Синхронизация
- Позиции синхронизируются при каждом перетаскивании
- Периодическая синхронизация каждые 30 секунд
- При перезагрузке страницы все позиции восстанавливаются

## 🛠️ Troubleshooting

### PostgreSQL не запускается:
```bash
# Проверить статус
brew services list

# Перезапустить
brew services restart postgresql@14

# Проверить подключение
psql -U postgres -d voice_notes_db -c "SELECT 1"
```

### Ошибка Prisma миграции:
```bash
# Сбросить БД и мигрировать заново
npx prisma migrate reset
npx prisma migrate dev
```

### CORS ошибки:
Убедитесь что в backend/.env указан правильный FRONTEND_URL

### Backend не запускается:
```bash
# Проверить порт 3001
lsof -i :3001
# Если занят - убить процесс или изменить PORT в .env
```

## 📊 Просмотр БД

```bash
# Prisma Studio (GUI для БД)
cd web/backend
npm run prisma:studio

# Откроется на http://localhost:5555
```

## ✨ Готово!

1. Backend: http://localhost:3001
2. Swagger: http://localhost:3001/api
3. Frontend: http://localhost:5173/?sync=true
4. Prisma Studio: http://localhost:5555

Все user cases работают согласно требованиям! 🎉