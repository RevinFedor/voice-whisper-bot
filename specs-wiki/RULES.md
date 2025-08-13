# 🔧 ОТЛАДКА И ИСПРАВЛЕНИЕ ПРОБЛЕМ

> **Этот файл - для ОТЛАДКИ когда что-то НЕ РАБОТАЕТ. Для новых фич смотри NEW_FEATURE_DEVELOPMENT.md**
> **Это НЕ теория, а то что РЕАЛЬНО помогло после 20+ попыток**

## 📋 ПРОСТОЙ ЧЕКЛИСТ который работает

### Когда что-то не работает:

```markdown
1. [ ] Попробовал простое решение - не работает? Иди дальше
2. [ ] СРАЗУ добавь console.log в критические места
3. [ ] Попроси логи у пользователя (это ВАЖНЕЕ субагентов!)
4. [ ] Проанализируй логи - нашел конкретную проблему?
5. [ ] ТЕПЕРЬ запусти субагентов для КОНКРЕТНОЙ проблемы
6. [ ] Исправь ОДНУ проблему
7. [ ] Снова попроси логи
8. [ ] Повтори пока не заработает
```

### 🔥 НОВОЕ ПРАВИЛО: Логи > Субагенты

**ПРАВИЛЬНЫЙ порядок:**
1. Добавить логирование → Получить логи → Понять проблему → Запустить субагентов для конкретного решения

**НЕПРАВИЛЬНЫЙ порядок (медленно!):**
1. Запустить субагентов вслепую → Теоретизировать → Писать код → Только потом логи

### 📊 Сколько субагентов запускать?

Решай по ситуации:
- Знакомая проблема? Начни с нескольких
- Новая технология? Запускай больше  
- Все сломалось? Запускай СКОЛЬКО НУЖНО
- Не нашел решение? Добавь еще субагентов

> **Правило:** Ресурсы не важны. Лучше запустить больше и найти решение!

---

## 🔍 ЧТО РЕАЛЬНО ИСКАТЬ (и где)

### 1. node_modules - ЗОЛОТАЯ ЖИЛА
```bash
# Это работает ВСЕГДА:
grep -r "ИМЯ_ФУНКЦИИ" node_modules/БИБЛИОТЕКА --include="*.js"

# Найти примеры:
find node_modules/БИБЛИОТЕКА -name "*.test.js" -o -name "*.example.js"

# Найти типы:
cat node_modules/БИБЛИОТЕКА/dist/index.d.ts | grep "export"
```

**Что мы нашли там:**
- `defaultShapeUtils` - без этого ничего не работало
- Правильную структуру `richText`
- Разницу между `Tldraw` и `TldrawEditor`

### 2. GitHub Issues - СПАСЕНИЕ
Ищи ТОЧНОЕ сообщение об ошибке:
```
site:github.com/tldraw/tldraw "ТОЧНЫЙ ТЕКСТ ОШИБКИ"
```

**Что мы нашли:**
- React StrictMode баг (#5611)
- Canvas не рендерится с flex

### 3. Простые примеры - CodeSandbox/StackBlitz
Ищи:
```
"tldraw" site:codesandbox.io OR site:stackblitz.com
```

### 4. ДОПОЛНИТЕЛЬНЫЕ источники (мы не использовали, но МОЖНО!)

**Stack Overflow:**
```
site:stackoverflow.com "tldraw" [ПРОБЛЕМА]
```

**Reddit (r/reactjs, r/webdev):**
```
site:reddit.com/r/reactjs OR site:reddit.com/r/webdev "tldraw"
```

**Discord/Slack сообщества:**
- tldraw Discord
- React Discord (#help канал)
- Webdev сообщества

**YouTube (для визуальных проблем):**
```
"tldraw tutorial" после:[ТЕКУЩИЙ ГОД]
```

> **Примечание:** Мы их не использовали в этом проекте, но это не значит что они бесполезны! 
> Если первые 3 источника не помогли - используй ВСЕ!

---

## 🛑 КОГДА ДЕЛАТЬ CHECKPOINT

### Основной цикл:

```markdown
1. RESEARCH PHASE (субагенты исследуют)
     ↓
2. IMPLEMENTATION PHASE (пишем код)
     ↓
3. CHECKPOINT (останавливаемся)
     ↓
4. USER: запускает, смотрит логи, скидывает
     ↓
5. AI: анализирует → Работает? → Продолжаем
                   → Не работает? → Debug
```

### ОБЯЗАТЕЛЬНО checkpoint когда:

**Завершил логическую единицу:**
- Новая фича реализована полностью
- Интеграция компонента завершена
- Крупный рефакторинг закончен

**Проверяешь гипотезу:**
- "Думаю проблема в X" → изменил X → CHECKPOINT
- Неуверен в решении → CHECKPOINT

**Критические изменения:**
- Архитектурные изменения
- Замена core зависимостей
- Первый запуск после больших изменений

### НЕ НУЖЕН checkpoint после:
- CSS изменений
- Комментариев
- Мелких правок
- Очевидных исправлений

### Что писать при CHECKPOINT:

```markdown
## 🛑 CHECKPOINT: [Что сделал]

**Изменения:**
- Список что изменил

**Проверить:**
- Что должно работать

**Команда:**
window.collectLogs()
```

---

## 📝 КРИТИЧЕСКИ ВАЖНОЕ ЛОГИРОВАНИЕ

### 🎯 ЧТО ЛОГИРОВАТЬ (из реального опыта с кликами):

```javascript
// 1. СОБЫТИЯ - показывают что происходит
console.log('📡 EVENT:', eventName, target, data);

// 2. ПЕРЕМЕННЫЕ - показывают текущее состояние
console.log('🔍 Clicked shape:', shapeId);
console.log('📊 Has editor:', !!editor);

// 3. ТОЧКИ ВХОДА В ФУНКЦИИ - показывают что вызывается
console.log('📱 handleNoteClick called with:', params);

// 4. РЕЗУЛЬТАТЫ ОПЕРАЦИЙ - показывают что получилось
console.log('✅ Shape found:', shape);
console.log('❌ No shape at point');

// 5. КРИТИЧЕСКИЕ ДАННЫЕ - что именно используется
console.log('🔑 DB ID:', dbId);
console.log('📍 Click coordinates:', { pagePoint, clientPoint });
```

### 🚀 ГОТОВЫЕ DEBUG-УТИЛИТЫ (добавь в проект СРАЗУ):

```javascript
// Автоматический сбор логов при клике
window.debugClick = () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
    };
    
    setTimeout(() => {
        console.log = originalLog;
        // Фильтруем только важное
        const filtered = logs.filter(log => 
            log.includes('EVENT') || 
            log.includes('CLICK') || 
            log.includes('ERROR') ||
            log.includes('shape:')
        );
        navigator.clipboard.writeText(filtered.join('\n'));
        console.log('📋 Logs copied! Paste to AI');
    }, 3000);
    
    console.log('🎯 Click tracking for 3 seconds...');
};

// Быстрая диагностика состояния
window.getState = () => ({
    shapes: editor?.getCurrentPageShapes?.().filter(s => s.type === 'custom-note').length,
    modalOpen: !!document.querySelector('.modal-overlay'),
    selectedShapes: editor?.getSelectedShapeIds?.(),
    camera: editor?.getCamera?.()
});
```

### ⚠️ РЕАЛЬНЫЕ ПРИМЕРЫ что помогло найти проблему:

```javascript
// Этот лог показал что события приходят с неправильным target
console.log('EVENT:', eventInfo.name, eventInfo.target); 
// Вывод: "EVENT: pointer_down canvas" вместо "shape"

// Этот лог показал проблему с координатами
console.log('Shape at point:', editor.getShapeAtPoint(point));
// Вывод: undefined (неправильные координаты!)

// Этот лог показал проблему с замыканием
console.log('Opening modal for:', shapeId);
// Вывод: "Opening modal for: null" (переменная сбросилась!)

// Этот лог показал проблему с доступом к editor
console.log('Has editor:', !!editor);
// Вывод: false (editor недоступен в замыкании!)
```

---

## 🎯 РЕАЛЬНЫЙ ПРОЦЕСС (как было на самом деле)

### Пример 1: Shapes не отображались

```markdown
1. Попытка 1: Создал CustomNoteShape
   → Не работает
   
2. Запустил 3 субагента:
   - "find CustomShapeUtil examples in node_modules"
   - "search GitHub: shapes not rendering tldraw"
   - "find richText format tldraw"
   
3. Нашли:
   - нужен defaultShapeUtils
   - text заменен на richText
   - StrictMode ломает tldraw
   
4. Создал SimpleTest.jsx:
   - Только Tldraw и один shape
   - БЕЗ кастомизации
   
5. Попросил логи:
   "Shapes in store: 10, DOM elements: 0"
   → Проблема в рендеринге!
   
6. Проверил CSS:
   - display: flex на body
   → Убрал, заработало!
```

### Пример 2: Клики на заметки не работали (ВАЖНЫЙ УРОК!)

```markdown
1. НЕПРАВИЛЬНО (5 попыток, много субагентов):
   - Запустил субагентов про Miro/Notion паттерны
   - Теоретизировал про onClick vs onPointerDown
   - Пробовал Group2d, разные геометрии
   - Менял методы ShapeUtil
   → ВСЁ ВСЛЕПУЮ! Не работало!

2. ПРАВИЛЬНО (решено за 2 итерации с логами):
   
   Итерация 1:
   - Добавил: console.log('EVENT:', target, shape)
   - Получил логи: "EVENT: canvas undefined"
   - ПОНЯЛ: события приходят с target='canvas' вместо 'shape'
   - Добавил: console.log('Shape at point:', getShapeAtPoint())
   - Получил: undefined
   - ПОНЯЛ: неправильные координаты (client vs page space)
   - ИСПРАВИЛ: использовал editor.inputs.currentPagePoint
   
   Итерация 2:
   - Получил логи: "Opening modal for: null"
   - ПОНЯЛ: проблема с замыканием в setTimeout
   - ИСПРАВИЛ: сохранил ID в локальную переменную
   - Получил логи: "Has editor: false"
   - ПОНЯЛ: проблема с доступом к editor в callback
   - ИСПРАВИЛ: вынес функцию внутрь handleMount
   
   → ЗАРАБОТАЛО! За 15 минут вместо 2 часов!
```

**ВЫВОД:** Логи показали КОНКРЕТНЫЕ проблемы. Без них - гадание вслепую!

---

## ⚡ БЫСТРЫЕ КОМАНДЫ

### 🔥 КОМАНДЫ ДЛЯ БЫСТРОГО СБОРА ЛОГОВ (копируй пользователю):

```javascript
// При проблемах с кликами:
window.debugClick && window.debugClick() || console.log('Run: window.debugClick = () => { /* paste debug code */ }')

// При проблемах с рендерингом:
console.log('Shapes:', editor.getCurrentPageShapes().length, 'DOM:', document.querySelectorAll('[data-shape-type]').length)

// При проблемах с состоянием:
console.log(window.getState && window.getState() || { editor: !!window.editor, shapes: 'run getState' })

// Универсальная диагностика:
(() => {
    const logs = [];
    const captureLog = console.log;
    console.log = (...args) => { logs.push(args); captureLog(...args); };
    setTimeout(() => {
        console.log = captureLog;
        console.log('📋 Captured logs:', logs);
        navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    }, 3000);
    console.log('🎯 Logging for 3 seconds... Do your action now!');
})();
```

### Запуск субагентов - копируй и используй:

```javascript
// ОСНОВНЫЕ (запускай всегда):
"Search in node_modules/tldraw for [ЧТО ИЩЕМ]. Find exact implementation, required imports, examples in tests"
"Search GitHub tldraw/tldraw issues for [ОШИБКА]. Find workarounds, official responses, similar problems"
"Find working example of [ФУНКЦИЯ] in tldraw. Check CodeSandbox, StackBlitz, official docs"

// ДОПОЛНИТЕЛЬНЫЕ (если нужно больше):
"Search Stack Overflow for [ПРОБЛЕМА] with tldraw React. Find solutions, workarounds"
"Search Reddit r/reactjs and r/webdev for tldraw [ПРОБЛЕМА]. Find community solutions"
"Find YouTube tutorials for tldraw [ФУНКЦИЯ] from last year. Get visual explanation"
"Search Discord/Slack archives for [ОШИБКА]. Find real-time discussions"
"Check npm registry for alternative packages that solve [ПРОБЛЕМА]"
"Search dev.to and medium.com for tldraw tutorials about [ФУНКЦИЯ]"
"Find similar libraries to tldraw and how they implement [ФУНКЦИЯ]"

// Запускай СКОЛЬКО НУЖНО параллельно!
```

---

## 🚫 НЕ ДЕЛАЙ ЭТО

1. **НЕ экономь на субагентах** - лучше 20 чем 2 если нужно
2. **НЕ пиши сложные performance логи** - простой console.log работает
3. **НЕ гадай решение** - проверь в node_modules
4. **НЕ делай больше 1 изменения** без логов
5. **НЕ игнорируй StrictMode** с tldraw

---

## ✅ ДЕЛАЙ ЭТО

1. **console.log после каждого действия**
2. **Проси логи через window.collectLogs()**
3. **Ищи в node_modules СНАЧАЛА**
4. **Создавай минимальные тесты**
5. **Коммить после каждого успеха**

---

## 📊 РЕАЛЬНАЯ СТАТИСТИКА

Из 20+ попыток что помогло В ЭТОМ ПРОЕКТЕ:
- **node_modules поиск**: 5 раз нашли решение ✅
- **GitHub issues**: 3 раза нашли баг ✅
- **Логи от пользователя**: 10+ раз показали проблему ✅
- **Минимальные тесты**: 4 раза изолировали баг ✅
- **Performance метрики**: 0 раз (не использовали) ❌
- **Reddit/Discord**: 0 раз (НЕ ИСКАЛИ - но могли бы!) ⚠️
- **Stack Overflow**: 0 раз (НЕ ИСКАЛИ - но могли бы!) ⚠️
- **YouTube**: 0 раз (НЕ ИСКАЛИ - но могли бы!) ⚠️

> **Важно:** То что мы не использовали Reddit/SO/YouTube в ЭТОМ проекте не значит что они бесполезны!
> В следующем проекте они могут быть КРИТИЧЕСКИ важны!

---

## 🎯 ФИНАЛЬНЫЙ ЧЕКЛИСТ

```markdown
Проблема: [ОПИСАНИЕ]

1. [ ] Простое решение попробовал?
2. [ ] console.log добавил в критические места?
3. [ ] ЛОГИ ПОЛУЧИЛ? ← ЭТО КРИТИЧЕСКИ ВАЖНО!
4. [ ] Проанализировал логи, понял конкретную проблему?
5. [ ] Только ТЕПЕРЬ запустил субагентов для этой проблемы?
6. [ ] Исправил ОДНУ вещь?
7. [ ] Снова логи получил и проверил?
8. [ ] Работает? Если нет - вернись к п.2
9. [ ] Закоммитил?

⚠️ ПОМНИ: Без логов ты работаешь ВСЛЕПУЮ!
```

---

## 💭 ФИНАЛЬНАЯ МЫСЛЬ О СУБАГЕНТАХ

```markdown
В этом проекте хватило 3 субагентов? ДА
Значит всегда хватит 3? НЕТ!

Следующий проект может требовать 20 субагентов.
Или 50. Или 100.

РЕСУРСЫ НЕ ВАЖНЫ = используй СКОЛЬКО НУЖНО!
```

**Помни**: 
- **ЛОГИ > ВСЁ ОСТАЛЬНОЕ** (это главный урок!)
- Логи показывают РЕАЛЬНУЮ проблему, а не догадки
- Субагенты полезны ПОСЛЕ анализа логов, не до
- Простота кода > Сложность кода
- node_modules > Документация

**🔥 ГЛАВНОЕ ПРАВИЛО:**
```
Нет логов = Работаешь вслепую = Тратишь часы впустую
Есть логи = Видишь проблему = Решаешь за минуты
```