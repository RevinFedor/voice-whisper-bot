# 📋 План реализации фреймов для группировки заметок

## 🏗️ Архитектурный план реализации фреймов

### Техническая архитектура

#### 1. **Использование встроенного FrameShapeUtil из tldraw**
- В tldraw уже есть полноценный тип `frame` с готовой функциональностью
- Включает автоматическую группировку через `parentId`
- Поддерживает drag&drop заметок внутрь/наружу
- Маскирование контента (clip content) работает из коробки

#### 2. **Parent-child система (уже реализована в tldraw)**
```javascript
// Основные методы API для работы с фреймами:
editor.reparentShapes(shapeIds, newParentId) // Перемещение заметок в фрейм
editor.getSortedChildIdsForParent(parentId) // Получение содержимого фрейма
editor.getShapeParent(shape) // Получение родительского фрейма
editor.hasAncestor(shape, ancestorId) // Проверка вложенности
```

#### 3. **Интеграция в существующий код**
```javascript
// В SyncedProductionApp.jsx
import { defaultShapeUtils, defaultTools, createShapeId } from 'tldraw';

// defaultShapeUtils уже включает FrameShapeUtil
<Tldraw
  shapeUtils={[
    ...defaultShapeUtils, // Включает встроенный FrameShapeUtil
    CustomNoteShapeUtil,
    StaticDateHeaderShapeUtil
  ]}
/>
```

#### 4. **UX паттерны (основано на Figma/Miro)**
- **Выделение:** Клик по границе = фрейм, клик внутри = заметка
- **Перемещение:** Фрейм двигается вместе с содержимым
- **Удаление:** При удалении фрейма содержимое остается
- **Копирование:** Копируется фрейм с его содержимым
- **Resize:** Содержимое обрезается по границам (clip content)

#### 5. **Форматирование для копирования**
```javascript
// Формат вывода для фрейма с заметками:
📁 Название фрейма
  ## Заметка 1
  Содержимое...
  #теги
  
  ## Заметка 2
  Содержимое...
  #теги
```

#### 6. **База данных (отложено на будущее)**
- На первом этапе фреймы хранятся только в памяти
- При необходимости можно добавить таблицу Frame и связь с Note

---

## 📝 План разработки

### **Этап 1: Базовая поддержка фреймов и UI кнопка** (~30 минут)

**Что реализуем:**
1. Подключение defaultShapeUtils (если еще не подключено)
2. Добавление кнопки "Создать фрейм" в UI
3. Debug функция для отслеживания parent-child связей

**Код для реализации:**
```javascript
// Кнопка создания фрейма из выделенных заметок
const createFrameFromSelection = () => {
  const selectedShapes = editor.getSelectedShapes();
  const customNotes = selectedShapes.filter(s => s.type === 'custom-note');
  
  if (customNotes.length === 0) {
    console.log('⚠️ Выберите заметки для создания фрейма');
    return;
  }
  
  const bounds = editor.getSelectionPageBounds();
  const padding = 20;
  const frameId = createShapeId();
  
  // Создаём фрейм
  editor.createShape({
    id: frameId,
    type: 'frame',
    x: bounds.x - padding,
    y: bounds.y - padding,
    props: {
      w: bounds.width + padding * 2,
      h: bounds.height + padding * 2,
      name: `Группа (${customNotes.length} заметок)`
    }
  });
  
  // Перемещаем заметки в фрейм
  editor.reparentShapes(customNotes.map(s => s.id), frameId);
  console.log('✅ Создан фрейм с', customNotes.length, 'заметками');
};

// Debug функция
window.debugFrames = () => {
  const frames = editor.getCurrentPageShapes().filter(s => s.type === 'frame');
  const notes = editor.getCurrentPageShapes().filter(s => s.type === 'custom-note');
  
  console.log('🖼 Фреймы:', frames.length);
  frames.forEach(frame => {
    const children = editor.getSortedChildIdsForParent(frame.id);
    const childNotes = children.filter(id => {
      const shape = editor.getShape(id);
      return shape?.type === 'custom-note';
    });
    console.log(`  "${frame.props.name}": ${childNotes.length} заметок`);
  });
  
  console.log('📝 Заметки с родителями:');
  notes.forEach(note => {
    if (note.parentId !== editor.getCurrentPageId()) {
      const parent = editor.getShape(note.parentId);
      console.log(`  Заметка -> фрейм "${parent?.props.name}"`);
    }
  });
};
```

**User case для проверки:**
- Выделить 2-3 заметки рамкой выделения
- Нажать кнопку "Создать фрейм" в UI
- Должен появиться фрейм вокруг заметок с названием "Группа (3 заметок)"
- Выполнить `window.debugFrames()` в консоли
- Должны увидеть созданный фрейм и заметки внутри него

---

### **Этап 2: Drag & Drop и перемещение фреймов** (~30 минут)

**Что реализуем:**
1. Логирование изменений parent-child связей
2. Проверка встроенного drag&drop в фрейм
3. Перемещение фрейма с содержимым

**Код для реализации:**
```javascript
// Отслеживание изменений parentId
const unsubscribe = editor.store.listen(({ changes }) => {
  if (changes.updated) {
    Object.entries(changes.updated).forEach(([id, [from, to]]) => {
      if (from.parentId !== to.parentId) {
        const shape = editor.getShape(id);
        const oldParent = editor.getShape(from.parentId);
        const newParent = editor.getShape(to.parentId);
        
        if (shape?.type === 'custom-note') {
          console.log('🔄 Заметка перемещена:');
          console.log(`   Из: ${oldParent?.type === 'frame' ? oldParent.props.name : 'холст'}`);
          console.log(`   В: ${newParent?.type === 'frame' ? newParent.props.name : 'холст'}`);
        }
      }
    });
  }
}, { source: 'user', scope: 'document' });
```

**User case для проверки:**
1. **Drag&drop в фрейм:**
   - Создать пустой фрейм
   - Создать заметку рядом
   - Перетащить заметку в фрейм
   - В консоли должно появиться "🔄 Заметка перемещена: Из: холст В: [название фрейма]"

2. **Перемещение фрейма:**
   - Создать фрейм с 2-3 заметками
   - Выделить фрейм (клик по границе или заголовку)
   - Перетащить фрейм в другое место
   - Все заметки должны переместиться вместе с фреймом

3. **Drag&drop из фрейма:**
   - Перетащить заметку из фрейма на холст
   - В консоли должно появиться "🔄 Заметка перемещена: Из: [название фрейма] В: холст"

---

### **Этап 3: Копирование фреймов с содержимым** (~40 минут)

**Что реализуем:**
Расширение логики копирования для поддержки фреймов

**Код для реализации:**
```javascript
// В overrides.actions для команды 'copy'
'copy': {
  ...actions['copy'],
  onSelect: async (source) => {
    const selectedShapes = editor.getSelectedShapes();
    let textToCopy = '';
    
    // Обработка фреймов
    const frames = selectedShapes.filter(s => s.type === 'frame');
    for (const frame of frames) {
      const childIds = editor.getSortedChildIdsForParent(frame.id);
      const childNotes = childIds
        .map(id => editor.getShape(id))
        .filter(s => s?.type === 'custom-note');
      
      textToCopy += `📁 ${frame.props.name}\n`;
      
      for (const note of childNotes) {
        const noteData = await fetch(`${API_URL}/notes/${note.props.dbId}`).then(r => r.json());
        textToCopy += `  ## ${noteData.title}\n`;
        textToCopy += `  ${noteData.content}\n`;
        if (noteData.tags?.length) {
          textToCopy += `  ${noteData.tags.map(t => `#${t}`).join(' ')}\n`;
        }
        textToCopy += '\n';
      }
      textToCopy += '---\n\n';
    }
    
    // Обработка отдельных заметок (не в фреймах)
    const standaloneNotes = selectedShapes
      .filter(s => s.type === 'custom-note')
      .filter(s => !frames.some(f => s.parentId === f.id));
    
    // ... форматирование отдельных заметок
    
    await navigator.clipboard.writeText(textToCopy);
    console.log('📋 Скопировано:', frames.length, 'фреймов,', standaloneNotes.length, 'заметок');
    
    // Показать toast уведомление
    showCopyToast(`Скопировано: ${frames.length} фреймов, ${standaloneNotes.length} заметок`);
  }
}
```

**User case для проверки:**
- Создать фрейм "Идеи проекта" с 2-3 заметками
- Выделить фрейм
- Нажать Cmd+C (Ctrl+C)
- Вставить в текстовый редактор
- Должен получиться форматированный текст:
  ```
  📁 Идеи проекта
    ## Заголовок заметки 1
    Содержимое заметки 1
    #тег1 #тег2
    
    ## Заголовок заметки 2
    Содержимое заметки 2
    #тег3
  ```

---

### **Этап 4: Удаление и resize фреймов** (~20 минут)

**Что реализуем:**
1. Удаление фрейма с сохранением содержимого
2. Проверка clip content при resize

**Код для реализации:**
```javascript
// Кнопка "Разгруппировать" (удалить фрейм, оставить заметки)
const ungroupFrame = () => {
  const selectedShapes = editor.getSelectedShapes();
  const frames = selectedShapes.filter(s => s.type === 'frame');
  
  if (frames.length === 0) {
    console.log('⚠️ Выберите фрейм для разгруппировки');
    return;
  }
  
  frames.forEach(frame => {
    const childIds = editor.getSortedChildIdsForParent(frame.id);
    
    // Перемещаем детей на уровень выше (на холст)
    editor.reparentShapes(childIds, editor.getCurrentPageId());
    
    // Удаляем сам фрейм
    editor.deleteShape(frame.id);
    
    console.log('✅ Разгруппирован фрейм:', frame.props.name);
  });
};

// Shortcut: Cmd+Shift+G для разгруппировки
```

**User case для проверки:**
1. **Удаление фрейма (Delete):**
   - Создать фрейм с заметками
   - Выделить только фрейм
   - Нажать Delete
   - Фрейм исчезает, заметки остаются на холсте

2. **Разгруппировка (Cmd+Shift+G):**
   - Создать фрейм с заметками
   - Выделить фрейм
   - Нажать кнопку "Разгруппировать" или Cmd+Shift+G
   - Фрейм удаляется, заметки остаются на месте

3. **Resize и clip content:**
   - Создать большой фрейм
   - Добавить заметки по краям
   - Уменьшить размер фрейма (потянуть за угол)
   - Заметки за границами должны обрезаться
   - При увеличении обратно - заметки снова видны

---

### **Этап 5: Визуальная кастомизация и финальная полировка** (~30 минут)

**Что реализуем:**
1. Стилизация фреймов для лучшей видимости
2. Автоматическое именование фреймов
3. Keyboard shortcuts

**Код для реализации:**
```css
/* Добавить в стили */
.tl-frame-heading {
  font-size: 11px !important;
  color: #666 !important;
  font-weight: 500 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

.tl-frame-body {
  background: rgba(100, 100, 100, 0.02) !important;
  border: 1px dashed #999 !important;
  border-radius: 8px !important;
}

/* Hover эффект только на границах */
.tl-frame-body:hover {
  border-color: #666 !important;
}
```

```javascript
// Автоматическое именование фреймов
const generateFrameName = (notesCount) => {
  const date = new Date().toLocaleDateString('ru-RU');
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `Группа ${date} ${time} (${notesCount})`;
};

// Keyboard shortcuts
const shortcuts = {
  'g': () => editor.setCurrentTool('frame'), // G для frame tool
  'cmd+shift+g': createFrameFromSelection,    // Создать фрейм из выделения
  'cmd+shift+u': ungroupFrame,                // Разгруппировать
};
```

**User case для проверки:**
1. **Визуальное отличие:**
   - Создать фрейм
   - Должен иметь пунктирную границу и легкий фон
   - Заголовок должен быть в верхнем регистре

2. **Автоименование:**
   - Создать фрейм из 3 заметок
   - Название должно быть "Группа 24.08.2025 14:30 (3)"

3. **Shortcuts:**
   - G - активировать инструмент фрейма
   - Cmd+Shift+G - создать фрейм из выделения
   - Cmd+Shift+U - разгруппировать

---

## 📊 Итоговая оценка

**Общее время:** ~2.5 часа

**Приоритеты:**
1. **Обязательно (MVP):** Этапы 1-3 - базовая функциональность
2. **Важно:** Этап 4 - управление фреймами
3. **Желательно:** Этап 5 - улучшения UX

**После каждого этапа:**
- Тестируем все user cases
- Фиксим найденные баги
- Коммитим рабочую версию
- Переходим к следующему этапу

**Результат:** Полноценная система группировки заметок через фреймы с минимальными усилиями благодаря использованию встроенной функциональности tldraw.