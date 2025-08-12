# История проекта и требования

## Изначальный план от пользователя

### Главная цель
Базовый user case с записью заметок, наложением, редактированием заголовка/тегов и сохранением в Obsidian.

### Ключевые требования
1. **Редактирование текста заметки в раскрывающейся модалке как в n8n**
2. **Наложение заметок друг на друга = объединение** (не в группу, а в одну новую заметку)
3. **При объединении заметок между ними будет черта "///////"**
4. **Использовать tldraw для canvas** (критически важно!)
5. **Y.js критически важна для синхронизации без конфликтов между Telegram**

## Техническая архитектура (указанная пользователем)

### Frontend
- **React + tldraw** (обязательно tldraw, не vanilla JS!)
- Throttle для позиции (300ms)
- Debounce для финальной позиции (1000ms)
- Polling новых заметок каждые 5 сек

### Backend  
- **NestJS + Prisma + PostgreSQL**
- PostgreSQL в Docker
- REST API endpoints

### База данных (схема от пользователя)
```prisma
model Note {
  id            String   @id @default(uuid())
  telegramId    String?  @unique
  title         String
  content       String   @db.Text
  tags          String[]
  positionX     Float    @default(0)
  positionY     Float    @default(0)
  type          String   // "voice", "text", "collection"
  duration      String?
  savedToObsidian Boolean @default(false)
  obsidianPath    String?
  pendingCommands Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  mergedFrom    String[]
}
```

### Процесс объединения (от пользователя)
1. Берем заметки A и B
2. Создаем новую C с content = A.content + "\n///////\n" + B.content
3. В C.mergedFrom = [A.id, B.id]
4. Удаляем A и B с холста (или помечаем как archived)

### API endpoints (от пользователя)
- GET /notes - все несохраненные
- POST /notes/merge - объединить
- PUT /notes/:id - редактировать
- POST /notes/:id/obsidian - отправить в Obsidian

## Важные указания от пользователя

### Тестирование
- Тесты должны быть для AI (с логами и скриншотами)
- Playwright в headless режиме
- После каждого блока запускать и проверять через Playwright

### Источник данных
- **Сейчас**: создание заметок через curl (НЕ из Telegram)
- **Потом**: подключение реального Telegram бота

## Что было сделано

### ✅ Backend (полностью работает)
- Docker с PostgreSQL
- NestJS с Prisma
- Все API endpoints работают
- Объединение с разделителем "///////

### ❌ Frontend (проблема)
- tldraw установлен, но не работает с кастомными shapes
- Ошибка "Shape type 'note' is defined more than once"
- Базовый tldraw работает, но это инструмент рисования, а не управления заметками

## Текущая проблема

**tldraw не подходит для задачи**, потому что:
1. Это инструмент для рисования, а не для управления заметками
2. Сложно добавить кастомные shapes для заметок
3. Нет встроенной логики для объединения при наложении

## Что нужно сделать

1. **Найти способ использовать tldraw для заметок** (как требует пользователь)
2. **Реализовать drag & drop заметок**
3. **Реализовать объединение при наложении**
4. **Подключить к backend API**
5. **Добавить polling для обновлений**

## Альтернативы (которые пользователь НЕ хочет)
- ❌ Vanilla JS (хотя уже есть работающий интерфейс)
- ❌ Другие canvas библиотеки
- ✅ Только tldraw (по требованию пользователя)