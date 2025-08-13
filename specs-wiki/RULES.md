# 🎯 РЕАЛЬНАЯ МЕТОДОЛОГИЯ РАЗРАБОТКИ - Что действительно работает

> **Это НЕ теория, а то что РЕАЛЬНО помогло после 20+ попыток**

## 📋 ПРОСТОЙ ЧЕКЛИСТ который работает

### Когда что-то не работает:

```markdown
1. [ ] Попробовал простое решение - не работает? Иди дальше
2. [ ] Запусти субагентов СКОЛЬКО НУЖНО (ресурсы не важны!)
3. [ ] Создай минимальный тест
4. [ ] СТОП! Попроси логи у пользователя
5. [ ] Найди КОНКРЕТНУЮ ошибку в логах
6. [ ] Исправь ОДНУ проблему
7. [ ] Повтори
```

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

## 📝 ПРОСТОЕ ЛОГИРОВАНИЕ которое работает

### Забудь про сложные performance метрики!

```javascript
// ВОТ ЧТО РЕАЛЬНО НУЖНО:
console.log('✅ Что сделал:', action);
console.log('📊 Состояние:', {
    domElements: document.querySelectorAll('.target').length,
    storeData: editor?.getCurrentPageShapes?.().length,
    visible: !!document.querySelector('.element')
});
console.log('❌ Ошибка:', error);

// ВСЁ! Больше не надо
```

### Команда для пользователя:
```javascript
// Просто это в консоль:
window.collectLogs()
// Автоматически скопирует всё в буфер
```

---

## 🎯 РЕАЛЬНЫЙ ПРОЦЕСС (как было на самом деле)

### Пример: Shapes не отображались

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

---

## ⚡ БЫСТРЫЕ КОМАНДЫ

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
2. [ ] 2-3 субагента запустил? (не больше!)
3. [ ] В node_modules посмотрел?
4. [ ] Минимальный тест создал?
5. [ ] Логи попросил? (window.collectLogs())
6. [ ] Нашел конкретную проблему?
7. [ ] Исправил ОДНУ вещь?
8. [ ] Проверил что работает?
9. [ ] Закоммитил?
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
- Больше субагентов > Меньше субагентов
- Простота кода > Сложность кода
- Логи > Догадки
- node_modules > Документация