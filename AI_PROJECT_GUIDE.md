# 🤖 AI Assistant Project Analysis Guide

## ⚠️ ВАЖНО: Это инструкция для AI-ассистента
Этот документ предназначен для быстрого понимания архитектуры проекта. НЕ описывает конкретный функционал, а объясняет КАК изучать проект.
Этот файл обновляется редко. Всегда проверяй актуальный код!

## 🏗️ Архитектура проекта

### Структура директорий
```
voice-whisper-bot/
├── telegram-bot/        # Telegram бот для приема голосовых/текстовых сообщений
├── web/                 # Веб-приложение
│   ├── frontend/       # React + Tldraw canvas
│   └── backend/        # NestJS API + Prisma ORM
└── shared/             # Общие типы и константы (если есть)
```



## 📋 Порядок анализа проекта

### 1️⃣ НАЧНИ С БАЗЫ ДАННЫХ
```bash
# Схема данных - это фундамент всего
web/backend/prisma/schema.prisma
```
**Что искать:**
- Модели данных (Note, TitleHistory, TagHistory и т.д.)
- Связи между моделями
- Поля и их типы
- Индексы и ограничения

**Почему важно:** Понимание структуры данных покажет, какие сущности существуют и как они связаны.

### 2️⃣ ИЗУЧИ BACKEND API
```bash
# Точка входа
web/backend/src/main.ts

# Основные модули - смотри в каждом:
# - *.module.ts (регистрация)
# - *.controller.ts (endpoints)
# - *.service.ts (бизнес-логика)
# - dto/*.dto.ts (форматы данных)

web/backend/src/
├── notes/          # Основная логика заметок
├── ai-tags/        # AI генерация тегов
├── ai-titles/      # AI генерация заголовков
├── obsidian/       # Интеграция с Obsidian
└── mock-data/      # Генерация тестовых данных
```

**Анализ каждого модуля:**
1. Открой `*.controller.ts` - посмотри какие endpoints есть
2. Для каждого endpoint найди метод в `*.service.ts`
3. Проследи flow данных от контроллера до БД

**Ключевые паттерны:**
- `@Headers('user-id')` - идентификация источника (сейчас всегда 'test-user-id')
- Позиционирование: x=0 означает "вычислить на frontend", y - позиция в столбце
- `manuallyPositioned` - флаг ручного перемещения заметки

### 3️⃣ ИЗУЧИ FRONTEND

#### Точка входа и главный компонент
```bash
web/frontend/src/main.jsx                    # Точка входа
web/frontend/src/SyncedProductionApp.jsx     # Главный компонент с canvas
```

#### Ключевые компоненты
```bash
web/frontend/src/components/
├── CustomNoteShape.jsx       # Как рендерятся заметки на canvas
├── NoteModal.jsx            # Модалка редактирования заметки
├── DatePickerModal.jsx      # Выбор даты для новой заметки
├── ExportToast.jsx          # Уведомления об экспорте
└── StaticDateHeaderShape.jsx # Заголовки дат на canvas
```

**Что искать в SyncedProductionApp.jsx:**
- `calculateColumnX()` - вычисление X позиции для столбцов дат
- `loadNotes()` - загрузка заметок с backend
- `handleMount()` - инициализация canvas и загрузка данных
- Event handlers для взаимодействия с заметками

**Система координат:**
- TODAY (сегодня) = X: 5000px
- Каждый день = +/- 230px от TODAY
- Y позиции заполняются сверху вниз с учетом gaps

### 4️⃣ ИЗУЧИ TELEGRAM БОТ
```bash
telegram-bot/index.js        # Весь функционал в одном файле
telegram-bot/index.js.archive # Старая версия с полным функционалом
```

**Ключевые функции:**
- `transcribeAudio()` - расшифровка через Whisper API
- `generateTitle()` - генерация заголовка через GPT
- `saveNoteToDatabase()` - отправка в backend
- Handlers: `bot.on('voice')`, `bot.on('text')`, `bot.on('audio')`, `bot.on('video')`

**Важно:** Бот НЕ отправляет координаты, backend сам позиционирует.

## 🔗 Связи между компонентами

### Flow создания заметки из Telegram:
1. **Telegram Bot** → получает сообщение
2. **Whisper API** → расшифровка (если голосовое)
3. **OpenAI API** → генерация заголовка
4. **Backend API** → POST /api/notes (без координат)
5. **Backend** → вычисляет позицию в столбце даты
6. **Database** → сохранение с x=0, calculated y
7. **Frontend** → при загрузке вычисляет реальную X через `calculateColumnX()`

### Flow редактирования в веб-приложении:
1. **Canvas Click** → открытие NoteModal
2. **NoteModal** → редактирование title/content/tags
3. **Backend API** → PATCH /api/notes/:id
4. **Database** → обновление
5. **Canvas** → обновление shape через onNoteUpdate callback

## 🛠️ Конфигурация и переменные окружения

### 🎯 ВАЖНО: Централизованная конфигурация
**ВСЕ переменные окружения в корневых файлах:**
```bash
/.env.dev   # Для разработки (порты 3001, 5433)
/.env.prod  # Для продакшена (порты 3002, 5434)
```

### Архитектура переменных окружения
```
Корневые .env файлы
        ↓
    dotenv-cli (в package.json)
        ↓
    process.env для всех модулей
        ↓
 ┌──────┴──────┬──────────┐
 Bot      Backend     Frontend
```

### Как это работает:
- **npm run dev:all** → dotenv загружает .env.dev → все модули получают переменные
- **npm run prod:all** → dotenv загружает .env.prod → все модули получают переменные
- **БЕЗ FALLBACK значений** - если переменная не найдена, приложение выбросит ошибку

### Ключевые переменные:
```bash
# Backend & Bot
OPENAI_KEY=...
TELEGRAM_TOKEN=...
API_URL=http://localhost:3001/api  # или 3002 для prod
PORT=3001  # или 3002 для prod
DATABASE_URL=postgresql://...

# Obsidian интеграция
OBSIDIAN_HOST=127.0.0.1
OBSIDIAN_PORT=27123
OBSIDIAN_API_KEY=...
OBSIDIAN_FOLDER=...
OBSIDIAN_VAULT_NAME=...

# Frontend (Vite)
VITE_API_URL=http://localhost:3001/api  # или 3002 для prod
```

### ⚠️ НЕТ hardcoded значений!
- Все URL, порты, ключи - строго из .env файлов
- Проверки при запуске: `if (!process.env.VAR) throw Error(...)`
- Frontend компоненты проверяют: `if (!import.meta.env.VITE_API_URL) throw Error(...)`

## 📝 Паттерны и соглашения

### API Паттерны
- Все endpoints под `/api/*`
- Headers: `user-id` для идентификации (сейчас игнорируется)
- Response: всегда JSON
- Errors: стандартные HTTP коды

### Позиционирование заметок
- **Column notes** (из telegram/кнопки): x=0, y=calculated, manuallyPositioned=false
- **Manually moved**: сохраняется точная позиция, manuallyPositioned=true
- **Merged notes**: приходят с готовыми координатами

### Работа с датами
- Все даты нормализуются до 00:00:00
- Сравнение дат для определения столбца
- `date` field в Note - дата для группировки

## 🔍 Как анализировать новый функционал

### Если нужно понять существующую фичу:
1. Найди UI элемент в frontend компонентах
2. Найди обработчик события (onClick, onSubmit и т.д.)
3. Проследи API вызов (fetch/axios)
4. Найди endpoint в backend controller
5. Изучи service метод и работу с БД
6. Проверь схему Prisma для понимания данных

### Если нужно добавить новую фичу:
1. Определи какие данные нужны → обнови schema.prisma
2. Создай migration: `npx prisma migrate dev`
3. Добавь service методы в backend
4. Создай/обнови endpoints в controller
5. Добавь UI в frontend
6. Свяжи frontend с API

## ⚠️ Особенности и подводные камни

### Переменные окружения
- **Строгая проверка!** Нет fallback значений - приложение упадет если переменная не найдена
- **dotenv-cli** загружает .env файлы из корня проекта
- **Два режима:** .env.dev (порты 3001/5433) и .env.prod (порты 3002/5434)
- **Frontend:** Vite переменные должны начинаться с VITE_
- Изменил переменную? Перезапусти сервисы!

### User Management
- **НЕТ системы пользователей!** Все работает локально
- `userId` - просто строковый идентификатор источника
- Все заметки видны на одном canvas

### Координаты
- Frontend ВСЕГДА пересчитывает X для column notes
- Backend НИКОГДА не знает реальную X позицию столбцов
- Y позиции могут иметь gaps (дыры) - это нормально

### Tldraw особенности
- Shapes имеют свои ID (отличные от Note.id)
- noteIdMap связывает Note.id ↔ Shape.id
- Canvas использует собственную систему координат

### Prisma
- Изменения схемы требуют миграции
- `npx prisma generate` после изменений
- `npx prisma studio` для визуального просмотра БД

## 🚀 Быстрый старт для анализа

### Запуск проекта
```bash
# 1. Установка зависимостей (один раз)
npm run install:all

# 2. Запуск БД Docker контейнеров
npm run db:dev:up   # DEV: PostgreSQL на порту 5433
npm run db:prod:up  # PROD: PostgreSQL на порту 5434

# 3. Запуск всех сервисов
npm run dev:all   # DEV режим: все на портах 3001/5173
npm run prod:all  # PROD режим: все на портах 3002/8080
```

### Анализ кода
```bash
# 1. Посмотри что есть в БД
cat web/backend/prisma/schema.prisma

# 2. Найди основные endpoints
grep -r "@Post\|@Get\|@Patch\|@Delete" web/backend/src --include="*.controller.ts"

# 3. Найди все компоненты React
ls web/frontend/src/components/

# 4. Найди API вызовы из frontend (теперь через переменные!)
grep -r "API_URL" web/frontend/src --include="*.jsx"

# 5. Проверь переменные окружения
cat .env.dev   # Для DEV режима
cat .env.prod  # Для PROD режима

# 6. Проверь какие процессы должны быть запущены
ps aux | grep -E "node|npm|nest|prisma"
```

## 💡 Философия проекта

1. **Простота превыше всего** - нет лишних абстракций
2. **Все локально** - нет облака, нет пользователей
3. **Canvas как основа** - все крутится вокруг Tldraw
4. **Telegram как input** - просто способ добавить заметки
5. **Obsidian как output** - экспорт для долгосрочного хранения

---

## 📌 НЕ ЗАБУДЬ

- Читай логи в консоли - там много отладочной информации
- Проверяй Network tab в браузере для понимания API
- Используй `console.log` обильно при отладке
- Backend логи покажут flow данных
- Frontend логи покажут взаимодействие с canvas

 обрати внимание на web/dev-rules-coverd.md - там собраны основые ошибки и методы их решения
 обращай внимание на файлы  dev-rules-....md - там правила разработки для конректных тем типа работа с апи и т.д.


**Этот файл НЕ описывает функционал, а учит КАК его найти и понять!**