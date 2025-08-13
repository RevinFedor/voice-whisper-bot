# 🤖 ПЛАН AI СЕССИЙ - Voice Notes Canvas

> Каждая сессия = отдельный чат с AI  
> Каждая сессия запускает множество субагентов  
> Используем REAL_DEVELOPMENT_METHODOLOGY.md

---

## 📁 ПОДГОТОВКА: Реструктуризация папок

**Текущая структура:**
```
voice-whisper-bot/
  frontend/        <-- переименовать в web
  telegram-bot/
```

**Новая структура:**
```
voice-whisper-bot/
  web/
    frontend/      <-- текущий tldraw проект
    backend/       <-- новый NestJS
  telegram-bot/
```

**Команды:**
```bash
cd /Users/fedor/Desktop/vs-code/voice‑whisper‑bot
mv frontend web
cd web
# В следующей сессии создадим backend
```

---

## 🎯 СЕССИЯ 1: Backend + База данных + Автодаты

### Промпт для новой сессии:

```markdown
При разработке используй REAL_DEVELOPMENT_METHODOLOGY.md для процесса работы и TROUBLESHOOTING_GUIDE.md для решения проблем. Запускай субагентов согласно методологии.

## Контекст
У нас есть tldraw canvas для отображения заметок из Telegram. Frontend готов (ProductionApp.jsx), нужен backend.

## Задача
Создать NestJS backend с PostgreSQL для хранения заметок и автоматической генерации дат.

## Требования

### 1. Структура проекта
- Монорепо: web/frontend и web/backend
- Docker Compose для PostgreSQL
- NestJS + Prisma ORM

### 2. Схема БД
```typescript
model Note {
  id          String   @id @default(uuid())
  text        String
  title       String?
  type        NoteType // enum: VOICE, TEXT, COLLECTION
  date        DateTime
  positionX   Float    // вычисляется автоматически
  positionY   Float    // вычисляется автоматически
  mergedFrom  String[] // UUID заметок
  duration    String?  // для voice
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  isEditing   Boolean  @default(false)
  sentToObsidian Boolean @default(false)
}
```

### 3. API Endpoints
- GET /api/notes - все заметки с автопозиционированием
- POST /api/notes - создать заметку (позиция вычисляется)
- POST /api/notes/merge - объединить заметки
- POST /api/telegram/simulate - эмуляция Telegram webhook

### 4. Автоматическое позиционирование
При GET /api/notes:
1. Получить все уникальные даты
2. Отсортировать по дате
3. Для каждой даты:
   - X = dateIndex * 250 + 100
   - Y = 110 + (noteIndexInDay * 170)
4. Вернуть заметки с позициями

### 5. Что НЕ делаем
- Реальная интеграция с Telegram
- WebSocket/real-time
- Сложная синхронизация

## Файлы для reference
- /web/frontend/src/ProductionApp.jsx - как выглядят заметки
- /web/frontend/src/components/CustomNoteShape.jsx - структура заметки
- PROJECT_PLAN.md - общий план

## Ожидаемый результат
1. Backend запущен на localhost:3000
2. PostgreSQL в Docker
3. Можно создавать заметки через API
4. Frontend подключен и отображает заметки из БД
```

---

## 🎯 СЕССИЯ 2: Drag-n-Drop объединение заметок

### Промпт для новой сессии:

```markdown
При разработке используй REAL_DEVELOPMENT_METHODOLOGY.md для процесса работы и TROUBLESHOOTING_GUIDE.md для решения проблем с tldraw. Запускай субагентов согласно методологии.

## Контекст
- tldraw canvas с заметками (ProductionApp.jsx)
- Backend с API для merge операций готов
- Нужно реализовать drag-n-drop объединение

## Задача
Реализовать перетаскивание одной заметки на другую для объединения.

## Требования

### 1. Логика объединения
- Перетаскиваем заметку A на заметку B
- При отпускании над B создается новая заметка C
- C содержит текст обеих заметок
- A и B скрываются
- Отправляется запрос на backend

### 2. Research необходим для:
- tldraw drag events (onDragEnd, onDrop?)
- Collision detection между shapes
- Определение overlap между shapes
- Визуальный feedback при hovering

### 3. API интеграция
POST /api/notes/merge
{
  sourceId: "uuid-a",
  targetId: "uuid-b"
}

### 4. Визуальный feedback
- При наведении заметки на другую - подсветка
- Анимация объединения
- Индикатор что заметки можно объединить

## Файлы для reference
- /web/frontend/src/components/CustomNoteShape.jsx
- /web/frontend/node_modules/tldraw - искать примеры drag-n-drop

## Ожидаемый результат
Можно перетащить одну заметку на другую и они объединятся
```

---

## 🎯 СЕССИЯ 3: Модалка редактирования

### Промпт для новой сессии:

```markdown
При разработке используй REAL_DEVELOPMENT_METHODOLOGY.md для процесса работы. Запускай субагентов согласно методологии.

## Контекст
- tldraw canvas с заметками
- Backend готов
- Нужна модалка для редактирования

## Задача
Создать модальное окно для просмотра и редактирования заметок.

## Требования

### 1. Открытие модалки
- Клик на заметку открывает модалку
- Блокируется взаимодействие с canvas

### 2. Содержимое модалки
- Заголовок (если есть)
- Полный текст заметки
- Метаданные (время, тип, длительность)
- Кнопка "В Obsidian"
- Кнопка "Закрыть"

### 3. Research необходим для:
- React Portal vs tldraw Dialog
- Блокировка canvas при открытой модалке
- Позиционирование модалки

### 4. НЕ делаем сейчас
- Редактирование текста
- AI генерация заголовков
- Сложные формы

## Файлы для reference
- /web/frontend/src/components/CustomNoteShape.jsx
- Искать в node_modules/tldraw примеры Dialog

## Ожидаемый результат
При клике на заметку открывается модалка с текстом
```

---

## 🎯 СЕССИЯ 4: Интеграция с Telegram (эмуляция)

### Промпт для новой сессии:

```markdown
При разработке используй REAL_DEVELOPMENT_METHODOLOGY.md для процесса работы. Запускай субагентов согласно методологии.

## Контекст
- Backend с endpoint /api/telegram/simulate
- Нужно эмулировать приход сообщений из Telegram

## Задача
Создать UI кнопку и логику для симуляции Telegram сообщений.

## Требования

### 1. Кнопка "Simulate Telegram"
- Добавить в CustomControls
- При клике отправляет POST на backend
- Генерирует случайный текст

### 2. Формат сообщения (как из Telegram)
{
  text: "Сгенерированный текст заметки",
  type: "voice",
  duration: "1:23",
  userId: "test_user",
  timestamp: Date.now()
}

### 3. После отправки
- Заметка появляется на canvas
- Под сегодняшней датой
- В самом низу колонки

## Ожидаемый результат
Кнопка симулирует приход заметки из Telegram
```

---

## 📊 ОЦЕНКА ВРЕМЕНИ

| Сессия | Время | Сложность | Субагентов |
|--------|-------|-----------|------------|
| Backend + БД | 3-4 часа | Высокая | 5-10 |
| Drag-n-Drop | 2-3 часа | Очень высокая | 10-15 |
| Модалка | 1-2 часа | Средняя | 3-5 |
| Telegram эмуляция | 1 час | Низкая | 2-3 |

**Итого:** 7-10 часов активной работы

---

## ⚠️ КРИТИЧЕСКИЕ МОМЕНТЫ

### Сессия 1 (Backend)
- Правильная схема БД сразу
- Автопозиционирование - ключевая логика
- CORS настройки для frontend

### Сессия 2 (Drag-n-Drop)
- Самая сложная часть
- Может потребовать изучения исходников tldraw
- Возможно придется делать workaround

### Сессия 3 (Модалка)
- Конфликты z-index с tldraw
- Блокировка событий canvas

### Сессия 4 (Telegram)
- Простая, но важная для тестирования

---

## 🚀 НАЧИНАЕМ С:

**СЕССИЯ 1: Backend + БД + Автодаты**

Это фундамент для всего остального. Без этого нельзя делать drag-n-drop и остальное.

---

**Последнее обновление:** 2025-08-13

---

## 📊 ТЕКУЩИЙ СТАТУС

### ✅ Что уже реализовано:
1. **Frontend база** - ProductionApp.jsx работает
2. **Автосортировка заметок** - автоматическое позиционирование под датами
3. **Drag-n-drop объединение** - перетаскивание заметок друг на друга
4. **Рандомное добавление** - тестовый контент для заметок

### 🚧 Следующая задача:
**СЕССИЯ 2: Модалка редактирования с решением scroll проблем**
- Файл готов: SESSION_2_MODAL_EDITING.md
- Проблема: скролл сбрасывается в textarea при редактировании длинных текстов
- Нужен research через субагентов