# 🔧 TROUBLESHOOTING GUIDE - tldraw Custom Notes App

> **ВАЖНО**: Этот файл содержит ВСЕ проблемы с которыми мы столкнулись и их ТОЧНЫЕ решения.
> Каждое решение проверено и работает. Используй этот файл как справочник при любых проблемах.

## 📋 Содержание
1. [ValidationError: text vs richText](#1-validationerror-text-vs-richtext)
2. [React StrictMode Double Rendering](#2-react-strictmode-double-rendering)
3. [CSS display:flex Canvas Block](#3-css-displayflex-canvas-block)
4. [Missing defaultShapeUtils](#4-missing-defaultshapeutils)
5. [Canvas Not Rendering](#5-canvas-not-rendering)
6. [Custom Shapes Not Visible](#6-custom-shapes-not-visible)
7. [useCoalescedEvents Error](#7-usecoalescedevents-error)
8. [Shape Type Conflicts](#8-shape-type-conflicts)
9. [Custom Shape Clicks Not Working](#9-custom-shape-clicks-not-working)
10. [Wrong Coordinate Space in Events](#10-wrong-coordinate-space-in-events)
11. [React Closure Problems in Callbacks](#11-react-closure-problems-in-callbacks)
12. [Double Click Editing State Error](#12-double-click-editing-state-error)
13. [Note Not Found Backend Error](#13-note-not-found-backend-error)

---

## 1. ValidationError: text vs richText

### ❌ Симптомы:
```
Uncaught ValidationError: At shape(type = text).props.text: Unexpected property
```

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - tldraw v2/v3 не использует text
editor.createShape({
    type: 'text',
    props: {
        text: 'Hello World', // ❌ Ошибка!
    }
});

// ✅ ПРАВИЛЬНО - используем richText
editor.createShape({
    type: 'text',
    props: {
        richText: {
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [{
                    type: 'text',
                    text: 'Hello World'
                }]
            }]
        },
        autoSize: true,
        w: 200
    }
});

// ✅ Helper функция для конвертации
function toRichText(text) {
    const lines = text.split('\n');
    const content = lines.map((line) => {
        if (!line) {
            return { type: 'paragraph' };
        }
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
        };
    });
    return { type: 'doc', content };
}
```

### 📝 Почему это работает:
- tldraw v3 использует TipTap editor для текста
- TipTap требует JSON структуру для rich text
- Свойство `text` deprecated с версии 2.0

---

## 2. React StrictMode Double Rendering

### ❌ Симптомы:
- Shapes создаются дважды
- useEffect выполняется дважды
- Ошибки при unmount/remount
- GitHub issue: https://github.com/tldraw/tldraw/issues/5611

### ✅ Решение:
```javascript
// В main.jsx - ОТКЛЮЧАЕМ StrictMode для tldraw
const USE_STRICT_MODE = false; // Для tldraw ВСЕГДА false!

createRoot(document.getElementById('root')).render(
  USE_STRICT_MODE ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App /> // БЕЗ StrictMode для tldraw
  ),
)
```

### 📝 Почему это работает:
- StrictMode вызывает двойной рендеринг в development
- tldraw имеет внутреннее состояние которое ломается при double-mount
- Это известная проблема tldraw v3

---

## 3. CSS display:flex Canvas Block

### ❌ Симптомы:
- Canvas не отображается
- Shapes в памяти но не видны
- DOM элементы существуют но имеют 0 размер

### ✅ Решение:
```css
/* index.css - УБИРАЕМ flex с body */
body {
  margin: 0;
  /* ❌ УДАЛИТЬ ЭТИ СТРОКИ: */
  /* display: flex; */
  /* place-items: center; */
  min-width: 320px;
  min-height: 100vh;
}

/* Контейнер для tldraw ДОЛЖЕН быть fixed или absolute */
.tldraw-container {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
}
```

### 📝 Почему это работает:
- tldraw требует полный размер контейнера
- flex layout может сжимать дочерние элементы
- fixed positioning гарантирует полный viewport

---

## 4. Missing defaultShapeUtils

### ❌ Симптомы:
```
Error: No shape util found for type "text"
Error: No shape util found for type "geo"
```

### ✅ Решение:
```javascript
import { Tldraw, defaultShapeUtils } from 'tldraw';
import { CustomNoteShapeUtil } from './CustomNoteShape';

// ❌ НЕПРАВИЛЬНО - заменяет ВСЕ стандартные shapes
<Tldraw shapeUtils={[CustomNoteShapeUtil]} />

// ✅ ПРАВИЛЬНО - добавляет к стандартным
<Tldraw shapeUtils={[...defaultShapeUtils, CustomNoteShapeUtil]} />

// Или для TldrawEditor:
<TldrawEditor 
  shapeUtils={[...defaultShapeUtils, CustomNoteShapeUtil]}
  tools={defaultTools} // Тоже важно!
/>
```

### 📝 Почему это работает:
- По умолчанию кастомные shapes ЗАМЕНЯЮТ стандартные
- Нужно явно spread'ить defaultShapeUtils
- defaultTools тоже нужны для TldrawEditor

---

## 5. Canvas Not Rendering

### ❌ Симптомы:
- Белый/черный экран
- Нет элементов .tl-canvas в DOM
- Нет SVG/Canvas элементов

### ✅ Решение:
```javascript
// Проверочный скрипт в консоли
function checkCanvas() {
    console.log('Canvas:', !!document.querySelector('.tl-canvas'));
    console.log('Shapes:', !!document.querySelector('.tl-shapes'));
    console.log('SVGs:', document.querySelectorAll('svg').length);
    console.log('Container size:', 
        document.querySelector('.tl-container')?.getBoundingClientRect()
    );
}

// Минимальный рабочий пример
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css'; // КРИТИЧЕСКИ ВАЖНО!

export default function App() {
    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <Tldraw />
        </div>
    );
}
```

### 📝 Требования для canvas:
1. Импорт `tldraw/tldraw.css`
2. Контейнер с фиксированными размерами
3. Нет конфликтующих CSS правил
4. React версия совместима (18.x или 19.x)

---

## 6. Custom Shapes Not Visible

### ❌ Симптомы:
- CustomNoteShapeUtil создается но не рендерится
- Shapes в store но не в DOM
- console.log показывает shapes но экран пустой

### ✅ Решение:
```javascript
// CustomNoteShape.jsx - ПОЛНЫЙ рабочий пример
import { ShapeUtil, HTMLContainer, Rectangle2d, T } from 'tldraw';

export class CustomNoteShapeUtil extends ShapeUtil {
    static type = 'custom-note'; // НЕ 'note' - конфликт!
    
    static props = {
        w: T.number,
        h: T.number,
        richText: T.any,
        noteType: T.string,
        time: T.string,
        duration: T.string,
    };

    getDefaultProps() {
        return {
            w: 180,
            h: 150,
            richText: { type: 'doc', content: [] },
            noteType: 'text',
            time: '',
            duration: '',
        };
    }

    getGeometry(shape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    component(shape) {
        return (
            <HTMLContainer>
                <div style={{
                    width: `${shape.props.w}px`,
                    height: `${shape.props.h}px`,
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '15px',
                    color: '#e0e0e0'
                }}>
                    {/* Контент */}
                </div>
            </HTMLContainer>
        );
    }

    indicator(shape) {
        return <rect width={shape.props.w} height={shape.props.h} />;
    }
}
```

### 📝 Критические моменты:
1. НЕ используй type='note' - конфликт со встроенным
2. Всегда возвращай HTMLContainer из component()
3. getGeometry() обязателен для позиционирования
4. indicator() нужен для выделения

---

## 7. useCoalescedEvents Error

### ❌ Симптомы:
```
Cannot read properties of undefined (reading 'useCoalescedEvents')
```

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - неправильная структура компонентов
<TldrawEditor>
    <CustomControls /> // Ошибка - нет контекста!
</TldrawEditor>

// ✅ ПРАВИЛЬНО - компоненты внутри TldrawUi
<TldrawEditor>
    <TldrawUi>
        <DefaultCanvas />
        <CustomControls />
    </TldrawUi>
</TldrawEditor>

// ✅ ЕЩЕ ЛУЧШЕ - используй Tldraw компонент
<Tldraw>
    <CustomControls />
</Tldraw>
```

### 📝 Почему это работает:
- useCoalescedEvents требует контекст от TldrawUi
- DefaultCanvas обязателен для event handling
- Tldraw включает все необходимые провайдеры

---

## 8. Shape Type Conflicts

### ❌ Симптомы:
```
Error: Shape type 'note' is defined more than once
```

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - конфликт с встроенным типом
static type = 'note';

// ✅ ПРАВИЛЬНО - уникальное имя
static type = 'custom-note';
static type = 'voice-note';
static type = 'my-note';

// Проверка существующих типов
import { defaultShapeUtils } from 'tldraw';
console.log('Existing types:', defaultShapeUtils.map(u => u.type));
// ['arrow', 'bookmark', 'draw', 'embed', 'frame', 'geo', 
//  'group', 'highlight', 'image', 'line', 'note', 'text', 'video']
```

---

## 9. Custom Shape Clicks Not Working

### ❌ Симптомы:
- Клики на custom shapes не открывают модалку
- События приходят с `target: 'canvas'` вместо `target: 'shape'`
- `getShapeAtPoint()` возвращает undefined
- onClick в ShapeUtil блокирует выделение

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - onClick в ShapeUtil блокирует selection
class CustomNoteShapeUtil extends ShapeUtil {
    onClick(shape) {
        // Блокирует выделение на pointerDown!
        handleNoteClick(shape.id);
        return undefined;
    }
}

// ✅ ПРАВИЛЬНО - обработка на уровне editor
const handleMount = (editor) => {
    const handleEditorEvents = (eventInfo) => {
        if (eventInfo.name === 'pointer_down') {
            if (eventInfo.target === 'canvas') {
                // Используем currentPagePoint для hit detection
                const pagePoint = editor.inputs.currentPagePoint;
                const hitShape = editor.getShapeAtPoint(pagePoint, {
                    hitInside: true,
                    margin: 10,
                });
                
                if (hitShape && hitShape.type === 'custom-note') {
                    clickedShapeId = hitShape.id;
                }
            }
        }
        
        if (eventInfo.name === 'pointer_up') {
            if (clickedShapeId && !editor.inputs.isDragging) {
                // Это клик, не drag
                handleNoteClick(clickedShapeId);
            }
        }
    };
    
    editor.on('event', handleEditorEvents);
};
```

### 📝 Почему это работает:
- onClick в ShapeUtil нарушает стандартный flow выделения tldraw
- editor.on('event') позволяет обрабатывать события без блокировки
- editor.inputs.isDragging определяет drag после 4px движения (как в Miro)

---

## 10. Wrong Coordinate Space in Events

### ❌ Симптомы:
- `getShapeAtPoint(eventInfo.point)` всегда возвращает undefined
- Координаты клика не совпадают с позицией shapes
- Hit detection не работает

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - eventInfo.point в client space
const handleEditorEvents = (eventInfo) => {
    if (eventInfo.name === 'pointer_down') {
        const shape = editor.getShapeAtPoint(eventInfo.point); // undefined!
    }
};

// ✅ ПРАВИЛЬНО - используем currentPagePoint (page space)
const handleEditorEvents = (eventInfo) => {
    if (eventInfo.name === 'pointer_down') {
        const pagePoint = editor.inputs.currentPagePoint;
        const shape = editor.getShapeAtPoint(pagePoint); // работает!
        
        // Для логирования
        console.log('Client point:', eventInfo.point);
        console.log('Page point:', pagePoint);
        console.log('Camera:', editor.getCamera());
    }
};
```

### 📝 Разница координатных систем:
- **Client space**: координаты относительно viewport браузера
- **Page space**: координаты относительно canvas с учетом camera (zoom, pan)
- **Shape space**: координаты относительно конкретного shape

---

## 11. React Closure Problems in Callbacks

### ❌ Симптомы:
- Переменные в setTimeout/callbacks имеют старые значения
- `editor` undefined в callback функциях
- State не обновляется в event handlers
- Логи показывают: "Opening modal for: null"

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - замыкание теряет значение
let clickedShapeId = null;

if (eventInfo.name === 'pointer_up') {
    setTimeout(() => {
        console.log(clickedShapeId); // null! (уже сброшено)
        handleNoteClick(clickedShapeId);
    }, 10);
    
    clickedShapeId = null; // Сбрасываем сразу
}

// ✅ ПРАВИЛЬНО - сохраняем в локальную константу
if (eventInfo.name === 'pointer_up') {
    const shapeIdToOpen = clickedShapeId; // Сохраняем!
    
    setTimeout(() => {
        console.log(shapeIdToOpen); // Правильное значение
        handleNoteClick(shapeIdToOpen);
    }, 10);
    
    clickedShapeId = null;
}

// ✅ ЕЩЕ ЛУЧШЕ - без setTimeout (как в Miro)
if (eventInfo.name === 'pointer_up') {
    if (clickedShapeId && !editor.inputs.isDragging) {
        handleNoteClick(clickedShapeId); // Сразу!
    }
    clickedShapeId = null;
}

// ✅ ДЛЯ ДОСТУПА К EDITOR - определяем функцию внутри handleMount
const handleMount = (editor) => {
    const handleNoteModalOpen = async (shapeId) => {
        // editor доступен здесь через замыкание
        const shape = editor.getShape(shapeId);
        // ...
    };
    
    const handleEditorEvents = (eventInfo) => {
        // Используем handleNoteModalOpen с доступом к editor
        handleNoteModalOpen(shapeId);
    };
};
```

### 📝 Правила для замыканий:
1. Сохраняй значения в локальные константы перед async операциями
2. Определяй функции внутри scope где есть нужные переменные
3. Избегай setTimeout если возможно
4. Используй useCallback с правильными зависимостями

---

## 12. Double Click Editing State Error

### ❌ Симптомы:
```
Error: Entered editing state without an editing shape
    at EditingShape.onEnter (tldraw.js:100656:30)
```

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - canEdit() возвращает true для custom shapes
class CustomNoteShapeUtil extends ShapeUtil {
    canEdit() {
        return true; // tldraw пытается редактировать
    }
    
    onDoubleClick(shape) {
        handleNoteClick(shape.id);
        return undefined;
    }
}

// ✅ ПРАВИЛЬНО - отключаем редактирование
class CustomNoteShapeUtil extends ShapeUtil {
    // Удаляем canEdit() или возвращаем false
    // canEdit() { return false; }
    
    // Удаляем onDoubleClick - обрабатываем на уровне editor
}
```

### 📝 Почему это работает:
- tldraw пытается перейти в editing state при двойном клике
- Custom shapes без текстового редактора вызывают ошибку
- Лучше обрабатывать клики через editor events

---

## 13. Note Not Found Backend Error

### ❌ Симптомы:
- Backend возвращает 404: "Note not found"
- При обновлении позиции shape
- ID существует в noteIdMap но не на backend

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - используем shape ID вместо note ID
const handlePositionUpdate = (shapeId, x, y) => {
    fetch(`/api/notes/${shapeId}/position`, { // Неправильный ID!
        method: 'PATCH',
        body: JSON.stringify({ x, y })
    });
};

// ✅ ПРАВИЛЬНО - конвертируем shape ID в note ID
const handlePositionUpdate = (shapeId, x, y) => {
    // Находим note ID по shape ID
    const noteId = Array.from(noteIdMap.entries())
        .find(([nId, sId]) => sId === shapeId)?.[0];
    
    if (!noteId) {
        console.error('Note ID not found for shape:', shapeId);
        return;
    }
    
    fetch(`/api/notes/${noteId}/position`, {
        method: 'PATCH',
        body: JSON.stringify({ x, y })
    });
};

// ✅ АЛЬТЕРНАТИВА - храним dbId в shape props
editor.createShape({
    type: 'custom-note',
    props: {
        dbId: noteId, // Сохраняем ID из базы
        // ...
    }
});

// Потом используем
const noteId = shape.props.dbId;
```

### 📝 Важно помнить:
- Shape ID (tldraw) ≠ Note ID (backend)
- noteIdMap хранит соответствие
- При periodic sync noteIdMap обновляется
- Лучше хранить dbId прямо в shape.props

---

## 🔍 Диагностические команды

### Проверка в консоли браузера:
```javascript
// Полная диагностика
window.debugTldraw = () => {
    const editor = window.editor; // Если сохранили ссылку
    console.group('🔍 TLDRAW DEBUG');
    console.log('Canvas:', !!document.querySelector('.tl-canvas'));
    console.log('Shapes container:', !!document.querySelector('.tl-shapes'));
    console.log('Shape elements:', document.querySelectorAll('.tl-shape').length);
    console.log('Container size:', document.querySelector('.tl-container')?.getBoundingClientRect());
    if (editor) {
        console.log('Shapes in store:', editor.getCurrentPageShapes().length);
        console.log('Custom shapes:', editor.getCurrentPageShapes().filter(s => s.type === 'custom-note').length);
        console.log('Camera:', editor.getCamera());
        console.log('Viewport:', editor.getViewportScreenBounds());
        
        // Тест hit detection
        const testPoint = editor.inputs.currentPagePoint;
        const hitShape = editor.getShapeAtPoint(testPoint, { hitInside: true });
        console.log('Shape at current point:', hitShape);
    }
    console.groupEnd();
};

// Диагностика кликов
window.debugClicks = () => {
    const editor = window.editor;
    console.log('🎯 Click debugging started for 10 seconds...');
    
    const handler = (e) => {
        if (e.name === 'pointer_down') {
            console.group('📍 POINTER DOWN');
            console.log('Target:', e.target);
            console.log('Client point:', e.point);
            console.log('Page point:', editor.inputs.currentPagePoint);
            console.log('Shape at point:', editor.getShapeAtPoint(editor.inputs.currentPagePoint));
            console.log('isDragging:', editor.inputs.isDragging);
            console.groupEnd();
        }
        if (e.name === 'pointer_up') {
            console.log('📍 POINTER UP - isDragging:', editor.inputs.isDragging);
        }
    };
    
    editor.on('event', handler);
    setTimeout(() => {
        editor.off('event', handler);
        console.log('✅ Click debugging stopped');
    }, 10000);
};

// Запускать после загрузки
setTimeout(() => window.debugTldraw(), 2000);
```

---

## ⚠️ Частые ошибки

1. **Забыли импорт CSS**: `import 'tldraw/tldraw.css'`
2. **Неправильный контейнер**: должен быть `position: fixed/absolute`
3. **StrictMode включен**: выключите для tldraw
4. **Не spread defaultShapeUtils**: используйте `[...defaultShapeUtils, Custom]`
5. **Конфликт типов shapes**: используйте уникальные имена
6. **onClick в ShapeUtil**: блокирует selection, используйте editor.on('event')
7. **Неправильные координаты**: используйте editor.inputs.currentPagePoint
8. **Замыкания в callbacks**: сохраняйте в локальные константы
9. **setTimeout для кликов**: не нужны! Используйте editor.inputs.isDragging
10. **Shape ID vs Note ID**: храните dbId в shape.props

---

## 🎯 Главные уроки

### Обработка кликов в tldraw:
1. **НЕ используй onClick в ShapeUtil** - блокирует selection
2. **Используй editor.on('event', handler)** для обработки событий
3. **editor.inputs.isDragging** определяет drag (порог 4px как в Miro)
4. **editor.inputs.currentPagePoint** для правильных координат
5. **Никаких setTimeout** - работай синхронно как профессиональные приложения

### Отладка проблем:
1. **Сначала логи, потом теория** - логи показывают реальную проблему
2. **Добавляй console.log везде** - на входе функций, в событиях, для переменных
3. **Проверяй координатные системы** - client space ≠ page space
4. **Следи за замыканиями** - React callbacks могут терять контекст
5. **Используй debug-утилиты** - создавай их сразу при разработке

---

## 📚 Полезные ссылки

- [tldraw GitHub Issues](https://github.com/tldraw/tldraw/issues)
- [tldraw v3 Migration](https://tldraw.dev/docs/migration)
- [TipTap Rich Text Format](https://tiptap.dev/docs/editor/guide/output#json)
- [tldraw Events Documentation](https://tldraw.dev/docs/editor#events)
- [React Closures Pitfalls](https://dmitripavlutin.com/react-hooks-stale-closures/)

---

## 🚀 РЕШЕНИЕ: Задержка при отпускании (drag & drop)

### Проблема:
После отпускания заметки происходила задержка ~500мс до слияния

### Неудачные попытки:
1. **setInterval polling** - проверка `isDragging` каждые 16мс
2. **setTimeout 50мс** - думал что tldraw нужно время  
3. **onTranslateEnd в ShapeUtil** - вызывал ошибку fn2 is not a function

### Решение:
```javascript
// Прямая подписка на нативное событие
document.addEventListener('pointerup', (e) => {
    if (wasDragging) {
        performInstantMergeCheck(); // Мгновенно, без задержек!
    }
});
```

### Ключевые уроки:
1. **НЕ используй polling** - подписывайся на события напрямую
2. **НЕ добавляй искусственные задержки** - они не нужны
3. **Используй нативные события** - pointerup срабатывает мгновенно
4. **Логи с временными метками** - показывают реальные задержки
5. **Профессиональные приложения** (Miro/Notion) работают без задержек

### Измерение задержки:
```javascript
console.log(`⏱ T+${Date.now() % 100000}: EVENT_NAME`);
// Результат: все события в T+82828 - задержка 0мс!
```

---

> **Последнее обновление**: Решена проблема задержек drag & drop (0мс вместо 500мс)
> **Версия tldraw**: 3.15.1
> **React**: 19.1.1 (работает, но лучше 18.x)
> **Добавлены проблемы**: #9-13 (клики, координаты, замыкания), #14 (drag задержки)