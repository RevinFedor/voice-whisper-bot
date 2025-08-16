# 🔧 TROUBLESHOOTING GUIDE - tldraw Custom Notes App

> **ВАЖНО**: Этот файл содержит ВСЕ проблемы с которыми мы столкнулись и их ТОЧНЫЕ решения.
> Каждое решение проверено и работает. Используй этот файл как справочник при любых проблемах.

## 📋 Содержание
1. [ValidationError: text vs richText](#1-validationerror-text-vs-richtext)
2. [React StrictMode двойной рендеринг](#2-react-strictmode-double-rendering)
3. [CSS display:flex блокирует Canvas](#3-css-displayflex-canvas-block)
4. [Отсутствуют defaultShapeUtils](#4-missing-defaultshapeutils)
5. [Canvas не рендерится](#5-canvas-not-rendering)
6. [Custom Shapes не видны](#6-custom-shapes-not-visible)
7. [Ошибка useCoalescedEvents](#7-usecoalescedevents-error)
8. [Конфликты типов Shape](#8-shape-type-conflicts)
9. [Клики на Custom Shape не работают](#9-custom-shape-clicks-not-working)
10. [Неправильная система координат в событиях](#10-wrong-coordinate-space-in-events)
11. [Проблемы замыкания React в Callbacks](#11-react-closure-problems-in-callbacks)
12. [Ошибка состояния редактирования при двойном клике](#12-double-click-editing-state-error)
13. [Ошибка Note Not Found в Backend](#13-note-not-found-backend-error)
14. [Курсор не синхронизирован с Hover](#14-cursor-not-synced-with-hover)

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

### 📝 Факт:
tldraw v3 использует TipTap с JSON структурой. Свойство `text` deprecated.

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

### 📝 Факт:
GitHub issue #5611 - StrictMode ломает tldraw v3

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

### 📝 Факт:
tldraw требует fixed/absolute контейнер с полным размером

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

### 📝 Факт:
Кастомные shapes ЗАМЕНЯЮТ стандартные. Нужен spread.

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

### 📝 Требования:
- Импорт `tldraw/tldraw.css`
- Контейнер fixed/absolute
- React 18.x или 19.x

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

### 📝 Требования:
- НЕ используй type='note' (конфликт)
- Возвращай HTMLContainer из component()
- getGeometry() обязателен
- indicator() для выделения

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

### 📝 Факт:
useCoalescedEvents требует TldrawUi контекст

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

### 📝 Факт:
onClick в ShapeUtil блокирует выделение. Используй editor.on('event').

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

### 📝 Координаты:
- Client space: viewport браузера
- Page space: canvas с учетом zoom/pan
- Shape space: относительно shape

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

### 📝 Решение:
Сохраняй значения в локальные константы перед async операциями

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

### 📝 Факт:
Custom shapes без редактора вызывают ошибку при canEdit=true

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

### 📝 Решение:
Храни dbId в shape.props вместо noteIdMap

---

## 14. Cursor Not Synced with Hover

### ❌ Симптомы:
- Зеленая рамка (hover indicator) появляется, но курсор остается стрелкой
- Курсор меняется на pointer только внутри shape, но не на краях
- CSS :hover не синхронизирован с tldraw hover detection
- `getCursor()` метод в ShapeUtil не работает

### 🔍 Причина проблемы:
tldraw НЕ вызывает автоматически метод `getCursor()` из ShapeUtil при hover. Система курсоров tldraw предназначена для инструментов (tools), а не для отдельных shapes.

### ❌ Не работает:
- CSS cursor в style 
- CSS :hover
- stopPropagation (ломает drag)
- getCursor() в ShapeUtil

### ✅ ПРАВИЛЬНОЕ решение:
```javascript
import { useEditor, useValue } from 'tldraw';

component(shape) {
    const editor = useEditor();
    
    // Реактивное определение hover состояния
    const isHovered = useValue(
        'shape hovered',
        () => editor.getHoveredShapeId() === shape.id,
        [editor, shape.id]
    );
    
    // Управление курсором через tldraw API
    React.useEffect(() => {
        if (isHovered) {
            // Устанавливаем курсор через tldraw систему
            editor.setCursor({ type: 'pointer', rotation: 0 });
        } else {
            // Проверяем не наводимся ли на другую custom-note
            const hoveredId = editor.getHoveredShapeId();
            const hoveredShape = hoveredId ? editor.getShape(hoveredId) : null;
            
            // Сбрасываем только если не на другой custom-note
            if (!hoveredShape || hoveredShape.type !== 'custom-note') {
                editor.setCursor({ type: 'default', rotation: 0 });
            }
        }
    }, [isHovered, editor, shape.id]);
    
    return (
        <HTMLContainer
            style={{
                // НЕ устанавливаем cursor здесь!
                // tldraw управляет курсором через --tl-cursor CSS переменную
                pointerEvents: 'auto', // Всегда включено для hover detection
            }}
        >
            {/* Контент */}
        </HTMLContainer>
    );
}
```


### 📝 Решение:
- Используй `editor.setCursor()`
- НЕ устанавливай CSS cursor
- useValue для реактивности

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

## 15. Selection Context Menu (как в Miro/Figma)

### ❌ Симптомы:
- Меню появляется при любом выделении (даже клике на заметку)
- Меню не исчезает при открытии модалки
- Меню появляется при перемещении заметок

### 🔍 Проблема:
tldraw не различает источник выделения - рамка (brush) или клик

### ✅ Решение - отслеживать источник выделения:
```javascript
// ❌ НЕПРАВИЛЬНО - проверяем только наличие выделения
const selectedNotes = editor.getSelectedShapes();
if (selectedNotes.length > 0) {
    showMenu(); // Появится при любом выделении!
}

// ✅ ПРАВИЛЬНО - отслеживаем был ли brush
export function SelectionContextMenu() {
    const editor = useEditor();
    const wasBrushUsedRef = React.useRef(false);
    
    // Отслеживаем активную рамку выделения
    const hasBrush = useValue(
        'has brush',
        () => editor.getInstanceState().brush !== null,
        [editor]
    );
    
    // Запоминаем если была рамка
    React.useEffect(() => {
        if (hasBrush) {
            wasBrushUsedRef.current = true;
        }
    }, [hasBrush]);
    
    // Сбрасываем флаг когда нужно
    React.useEffect(() => {
        const currentPath = editor.getPath();
        const isPointingShape = currentPath.includes('select.pointing_shape');
        const isIdle = currentPath.includes('select.idle');
        
        // Сбрасываем ТОЛЬКО когда idle и нет выделения
        if (selectedNotes.length === 0 && !hasBrush && isIdle) {
            wasBrushUsedRef.current = false;
        }
        // Или при клике на заметку после рамки
        else if (isPointingShape && wasBrushUsedRef.current) {
            wasBrushUsedRef.current = false;
        }
    }, [selectedNotes.length, currentPath, hasBrush]);
    
    // Показываем меню только если был brush
    if (!wasBrushUsedRef.current) return null;
}
```

### 📝 Состояния инструмента select:
- `select.idle` - ничего не происходит
- `select.pointing_canvas` - начало выделения на холсте
- `select.brushing` - рисуется рамка выделения
- `select.pointing_shape` - клик на shape
- `select.translating` - перемещение shapes

### 🎯 Правила для контекстного меню:
1. **Показывать только после brush** - не при клике на заметку
2. **Скрывать при translating** - не показывать при перемещении
3. **Снимать выделение при открытии модалки** - `editor.selectNone()`

---

## 16. onClick в ShapeUtil - опасный паттерн

### ❌ Проблема:
`onClick` в ShapeUtil блокирует стандартное выделение И перетаскивание

### ✅ Решение:
```javascript
// ❌ НЕПРАВИЛЬНО - блокирует перетаскивание!
class CustomNoteShapeUtil extends ShapeUtil {
    onClick(shape) {
        openModal(shape.id);
        return {}; // Предотвращает выделение НО ломает drag!
    }
}

// ✅ ПРАВИЛЬНО - снимаем выделение после открытия
// В обработчике клика (не в ShapeUtil):
const handleNoteClick = (shapeId) => {
    openModal(shapeId);
    editor.selectNone(); // Снимаем выделение, меню исчезнет
};

// НЕ используй onClick в ShapeUtil вообще!
// Обрабатывай клики через editor.on('event')
```

### 📝 Почему это важно:
- `onClick` возвращающий объект = нет выделения = нет перетаскивания
- Пользователь не может перетащить заметку без выделения рамкой
- Это нарушает стандартное UX поведение

---

## 17. ShapeUtil методы управления handles и resize

### 🎯 Методы для отключения функций редактирования:

```javascript
class CustomNoteShapeUtil extends ShapeUtil {
    // Отключить возможность изменения размера
    canResize() {
        return false; // true = можно менять размер
    }
    
    // Скрыть ручку поворота
    hideRotateHandle() {
        return true; // true = скрыть, false = показать
    }
    
    // Скрыть ручки изменения размера
    hideResizeHandles() {
        return true; // true = скрыть (8 квадратиков по углам)
    }
    
    // Блокировать соотношение сторон при resize
    isAspectRatioLocked() {
        return true; // true = сохранять пропорции
    }
    
    // Отключить возможность редактирования (двойной клик)
    canEdit() {
        return false; // true = можно редактировать текст
    }
    
    // Можно ли привязывать к этому shape
    canBind() {
        return false; // true = стрелки могут привязываться
    }
    
    // Можно ли обрезать (crop)
    canCrop() {
        return false; // true = можно обрезать
    }
    
    // Скрыть фон выделения
    hideSelectionBoundsBg() {
        return false; // true = скрыть синий фон выделения
    }
    
    // Скрыть передний план выделения
    hideSelectionBoundsFg() {
        return false; // true = скрыть рамку выделения
    }
}
```

### 📝 Когда использовать:
- **canResize = false** - для фиксированных размеров (заметки, карточки)
- **hideRotateHandle = true** - когда поворот не нужен (UI элементы)
- **hideResizeHandles = true** - визуально чище когда resize отключен
- **isAspectRatioLocked = true** - для изображений, видео
- **canEdit = false** - для кастомных shapes без текстового редактора

### ⚠️ Важно:
- Если `canResize() = false`, то `hideResizeHandles() = true` для чистоты
- `canEdit() = false` предотвращает ошибку "Entered editing state"
- В tldraw НЕТ метода `canRotate()` - только `hideRotateHandle()`

---

## 18. Отслеживание источника выделения (Brush vs Click)

### 🔍 Проблема:
tldraw не предоставляет API для определения КАК было сделано выделение

### ✅ Решение через отслеживание состояний:
```javascript
// Проверка активной рамки выделения
const hasBrush = editor.getInstanceState().brush !== null;

// Проверка пути состояния инструмента
const currentPath = editor.getPath();
const isBrushing = currentPath.includes('select.brushing');
const isPointingShape = currentPath.includes('select.pointing_shape');

// Флаг для отслеживания источника
const wasBrushUsedRef = useRef(false);

// Логика:
// 1. Если hasBrush = true → была рамка
// 2. Если isPointingShape после выделения → клик на заметку
// 3. Сбрасываем флаг только в idle без выделения
```

### 📝 Ключевые API:
- `editor.getInstanceState().brush` - активная рамка выделения (BoxModel или null)
- `editor.getPath()` - текущий путь состояния инструмента
- `editor.selectNone()` - снять всё выделение
- `editor.getSelectedShapeIds()` - массив ID выделенных shapes

---

> **Последнее обновление**: Добавлены ShapeUtil методы управления handles/resize, паттерны SelectionContextMenu
> **Версия tldraw**: 3.15.1
> **React**: 19.1.1 (работает, но лучше 18.x)
> **Добавлены проблемы**: #9-14 (клики, координаты, замыкания, cursor), #15-18 (selection menu, onClick, ShapeUtil методы, brush tracking)