# 🎯 РЕАЛЬНАЯ МЕТОДОЛОГИЯ РАЗРАБОТКИ - Что действительно работает

> **Это НЕ теория, а то что РЕАЛЬНО помогло после 20+ попыток**

## 📋 ПРОСТОЙ ЧЕКЛИСТ который работает

### Когда что-то не работает:

```markdown
1. [ ] Попробовал простое решение - не работает? Иди дальше
2. [ ] Запусти 2-3 субагента ПАРАЛЛЕЛЬНО (не больше!)
3. [ ] Создай минимальный тест
4. [ ] СТОП! Попроси логи у пользователя
5. [ ] Найди КОНКРЕТНУЮ ошибку в логах
6. [ ] Исправь ОДНУ проблему
7. [ ] Повтори
```

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

**НЕ трать время на:**
- Reddit (не помогло)
- Discord (не искали)
- Старые туториалы (API изменилось)

---

## 🛑 КРИТИЧЕСКИЕ ТОЧКИ ОСТАНОВКИ

### ВСЕГДА останавливайся и проси логи когда:

1. **Создал новый компонент:**
```javascript
console.log('🚀 Component created');
// СТОП! Нужны логи
```

2. **Что-то не отображается:**
```javascript
console.log('Shapes in store:', editor.getCurrentPageShapes().length);
console.log('DOM elements:', document.querySelectorAll('.tl-shape').length);
// СТОП! Если числа не совпадают - нужны логи
```

3. **Есть ошибка в консоли:**
```javascript
// Любая ошибка = СТОП, нужны логи
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
// Субагент 1: node_modules
"Search in node_modules/tldraw for [ЧТО ИЩЕМ]. Find exact implementation, required imports, examples in tests"

// Субагент 2: GitHub  
"Search GitHub tldraw/tldraw issues for [ОШИБКА]. Find workarounds, official responses, similar problems"

// Субагент 3: Примеры
"Find working example of [ФУНКЦИЯ] in tldraw. Check CodeSandbox, StackBlitz, official docs"

// Больше обычно не нужно!
```

---

## 🚫 НЕ ДЕЛАЙ ЭТО

1. **НЕ запускай 10 субагентов** - 3 достаточно
2. **НЕ пиши сложные performance логи** - не используем
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

Из 20+ попыток что помогло:
- **node_modules поиск**: 5 раз нашли решение
- **GitHub issues**: 3 раза нашли баг
- **Логи от пользователя**: 10+ раз показали проблему
- **Минимальные тесты**: 4 раза изолировали баг
- **Performance метрики**: 0 раз (не использовали)
- **Reddit/Discord**: 0 раз (не искали)

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

**Помни**: Простота > Сложность. Логи > Догадки. node_modules > Документация.