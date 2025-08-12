# 📊 TLDraw Position & Database Sync - Research Findings

## 🎯 Executive Summary

После глубокого исследования архитектуры tldraw и анализа требований проекта, рекомендую **гибридный подход** к хранению позиций:
- Хранить в БД: `date`, `time`, `order_in_column` 
- Вычислять на лету: `x`, `y` координаты
- Синхронизация: One-way (БД → tldraw) с локальным кешем позиций

## 📋 Детальные Findings

### 1. Как tldraw работает с позициями

#### Структура хранения позиций
```typescript
// Позиции - это top-level свойства каждого shape
interface TLBaseShape {
  x: number;        // Абсолютная X координата
  y: number;        // Абсолютная Y координата  
  rotation: number; // Ротация в радианах
  // ... другие свойства
}
```

**Ключевые находки:**
- `x` и `y` - **обязательные числовые поля** на верхнем уровне shape
- Позиции хранятся как **абсолютные координаты** на странице
- Дефолтные значения: `x: 0, y: 0`
- Валидация типов встроена в систему

#### Методы работы с позициями
```javascript
// Обновление одного shape
editor.updateShape({ id, type, x: newX, y: newY })

// Обновление множества shapes
editor.updateShapes([
  { id: shape1Id, type: 'custom-note', x: 100, y: 200 },
  { id: shape2Id, type: 'custom-note', x: 300, y: 200 }
])

// Получение всех shapes с позициями
const shapes = editor.getCurrentPageShapes()
```

### 2. События и подписки на изменения

#### Основной метод подписки
```javascript
const unsubscribe = editor.store.listen((change) => {
  // Отслеживание изменений позиций
  for (const [from, to] of Object.values(change.changes.updated)) {
    if (from.typeName === 'shape' && to.typeName === 'shape') {
      if (from.x !== to.x || from.y !== to.y) {
        console.log(`Shape moved from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`)
      }
    }
  }
}, { source: 'user', scope: 'document' })
```

**Доступные события:**
- `change.changes.added` - новые shapes
- `change.changes.updated` - измененные shapes  
- `change.changes.removed` - удаленные shapes

### 3. Алгоритм автоматического позиционирования по датам

#### Рекомендуемый алгоритм
```javascript
class DateLayoutManager {
  constructor(config) {
    this.config = {
      columnWidth: 180,    // Ширина колонки (заметки)
      columnSpacing: 50,   // Отступ между колонками
      rowHeight: 150,      // Высота строки (заметки)
      rowSpacing: 30,      // Отступ между строками
      startX: 100,         // Начальная X позиция
      startY: 120,         // Начальная Y позиция
    }
  }
  
  // Вычисление X позиции по дате
  getColumnX(date, baseDate) {
    const daysDiff = Math.floor((date - baseDate) / (24 * 60 * 60 * 1000))
    return this.config.startX + (daysDiff * (this.config.columnWidth + this.config.columnSpacing))
  }
  
  // Вычисление Y позиции с учетом времени и коллизий
  getRowY(timeString, columnNotes) {
    const [hours, minutes] = timeString.split(':').map(Number)
    const baseY = this.config.startY + ((hours - 8) * 40) // 8:00 как база
    
    // Проверка коллизий и сдвиг если нужно
    let y = baseY
    while (columnNotes.some(note => Math.abs(note.y - y) < this.config.rowHeight)) {
      y += this.config.rowHeight + this.config.rowSpacing
    }
    
    return y
  }
}
```

## 🗄️ Рекомендуемая структура БД

### Вариант A: Минимальный (РЕКОМЕНДУЮ) ✅

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Основные данные
  title TEXT NOT NULL,
  content TEXT,
  type VARCHAR(20) NOT NULL, -- 'voice', 'text', 'collection'
  
  -- Временные метки для позиционирования
  date DATE NOT NULL,        -- Дата для определения колонки
  time TIME,                  -- Время создания (для сортировки)
  order_in_column INTEGER,    -- Порядок в колонке (для ручной сортировки)
  
  -- Метаданные
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  voice_duration INTEGER,     -- Длительность в секундах для voice
  
  -- Системные поля
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Индексы
  INDEX idx_date_order (date, order_in_column),
  INDEX idx_user_date (telegram_user_id, date)
);
```

**Преимущества:**
- Простая структура
- Легко вычислять позиции на лету
- Нет проблем с синхронизацией координат
- Автоматическая перестройка при изменении layout

### Вариант B: С кешированием позиций

```sql
CREATE TABLE notes (
  -- ... все поля из варианта A ...
  
  -- Кешированные позиции (опционально)
  cached_x FLOAT,
  cached_y FLOAT,
  cache_updated_at TIMESTAMP
);

-- Отдельная таблица для истории позиций
CREATE TABLE note_position_history (
  id UUID PRIMARY KEY,
  note_id UUID REFERENCES notes(id),
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(20) -- 'auto', 'user', 'system'
);
```

**Когда использовать:**
- При большом количестве заметок (>1000)
- Если нужна история перемещений
- Для оптимизации производительности

### Вариант C: Для коллекций и связей

```sql
-- Таблица для группировки заметок
CREATE TABLE note_collections (
  id UUID PRIMARY KEY,
  parent_note_id UUID REFERENCES notes(id),
  child_note_id UUID REFERENCES notes(id),
  position_in_collection INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для связей между заметками
CREATE TABLE note_relations (
  id UUID PRIMARY KEY,
  from_note_id UUID REFERENCES notes(id),
  to_note_id UUID REFERENCES notes(id),
  relation_type VARCHAR(20), -- 'follows', 'references', 'replies_to'
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 План синхронизации

### Рекомендуемая архитектура: One-way sync (БД → tldraw)

```javascript
// 1. Загрузка заметок из БД
async function loadNotesFromDB() {
  const notes = await fetch('/api/notes').then(r => r.json())
  return notes
}

// 2. Вычисление позиций
function calculatePositions(notes) {
  const layoutManager = new DateLayoutManager()
  const baseDate = getEarliestDate(notes)
  
  return notes.map(note => ({
    ...note,
    x: layoutManager.getColumnX(new Date(note.date), baseDate),
    y: layoutManager.getRowY(note.time, getColumnNotes(notes, note.date))
  }))
}

// 3. Создание shapes в tldraw
function createShapesFromNotes(editor, notesWithPositions) {
  const shapes = notesWithPositions.map(note => ({
    id: createShapeId(note.id), // Используем ID из БД
    type: 'custom-note',
    x: note.x,
    y: note.y,
    props: {
      w: 180,
      h: 150,
      richText: toRichText(note.title + '\n' + note.content),
      noteType: note.type,
      time: note.time,
      dbId: note.id // Сохраняем связь с БД
    }
  }))
  
  editor.createShapes(shapes)
}

// 4. Периодическая синхронизация
setInterval(async () => {
  const freshNotes = await loadNotesFromDB()
  updateShapesFromNotes(editor, freshNotes)
}, 30000) // Каждые 30 секунд
```

### Обработка изменений от пользователя

```javascript
// Опциональная двухсторонняя синхронизация позиций
editor.store.listen(async (change) => {
  const movedShapes = []
  
  for (const [from, to] of Object.values(change.changes.updated)) {
    if (from.x !== to.x || from.y !== to.y) {
      movedShapes.push({
        dbId: to.props.dbId,
        x: to.x,
        y: to.y
      })
    }
  }
  
  if (movedShapes.length > 0) {
    // Опционально: сохранить новые позиции в БД
    await fetch('/api/notes/positions', {
      method: 'PATCH',
      body: JSON.stringify(movedShapes)
    })
  }
}, { source: 'user' })
```

## ⚠️ Важные ограничения и риски

### Проблемы двухсторонней синхронизации
1. **Race conditions** при одновременных изменениях
2. **Конфликты** между auto-layout и ручными позициями
3. **Сложность** отката изменений

### Рекомендации по митигации
1. Использовать **optimistic updates** с rollback
2. Добавить **debounce** для сохранения позиций (300-500ms)
3. Хранить **source** изменения ('auto', 'user', 'system')
4. Реализовать **conflict resolution** стратегию

## 📊 Сравнение подходов

| Критерий | Хранить x,y в БД | Вычислять x,y | Гибрид |
|----------|------------------|---------------|---------|
| Простота реализации | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Производительность | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Гибкость layout | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Синхронизация | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Масштабируемость | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

## 🚀 Финальные рекомендации

### Для MVP (Начать с этого!)
1. **БД**: Хранить только `date`, `time`, `order_in_column`
2. **Frontend**: Вычислять позиции при загрузке
3. **Sync**: One-way (БД → tldraw)
4. **Updates**: Polling каждые 30 секунд

### Для Production
1. Добавить кеширование позиций
2. Реализовать WebSocket для real-time sync
3. Добавить optimistic updates
4. Реализовать conflict resolution

### Код для быстрого старта

```javascript
// backend/api/notes.js
app.get('/api/notes', async (req, res) => {
  const notes = await db.query(`
    SELECT id, title, content, type, date, time, order_in_column
    FROM notes
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY date DESC, order_in_column, time
  `)
  res.json(notes)
})

// frontend/src/hooks/useNotesSync.js
export function useNotesSync(editor) {
  useEffect(() => {
    if (!editor) return
    
    const syncNotes = async () => {
      const notes = await fetch('/api/notes').then(r => r.json())
      const layoutManager = new DateLayoutManager()
      
      // Очистить старые shapes
      editor.deleteShapes(editor.getCurrentPageShapes().map(s => s.id))
      
      // Создать новые с вычисленными позициями
      notes.forEach(note => {
        const position = layoutManager.calculatePosition(note, baseDate)
        editor.createShape({
          type: 'custom-note',
          x: position.x,
          y: position.y,
          props: { ...note }
        })
      })
    }
    
    syncNotes() // Initial load
    const interval = setInterval(syncNotes, 30000) // Periodic sync
    
    return () => clearInterval(interval)
  }, [editor])
}
```

## 📝 Контрольный чеклист

- [ ] Определить базовую дату для позиционирования
- [ ] Реализовать DateLayoutManager
- [ ] Создать API endpoints для notes
- [ ] Добавить поле dbId в CustomNoteShape props
- [ ] Реализовать загрузку из БД при mount
- [ ] Добавить периодическую синхронизацию
- [ ] Протестировать с большим количеством заметок
- [ ] Добавить обработку ошибок
- [ ] Реализовать оптимистичные обновления
- [ ] Добавить индикатор синхронизации