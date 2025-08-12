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
        console.log('Camera:', editor.getCamera());
        console.log('Viewport:', editor.getViewportScreenBounds());
    }
    console.groupEnd();
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

---

## 📚 Полезные ссылки

- [tldraw GitHub Issues](https://github.com/tldraw/tldraw/issues)
- [tldraw v3 Migration](https://tldraw.dev/docs/migration)
- [TipTap Rich Text Format](https://tiptap.dev/docs/editor/guide/output#json)

---

> **Последнее обновление**: После 20+ попыток все заработало!
> **Версия tldraw**: 3.15.1
> **React**: 19.1.1 (работает, но лучше 18.x)