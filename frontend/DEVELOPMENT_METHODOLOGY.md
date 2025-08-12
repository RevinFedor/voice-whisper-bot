# 🚀 DEVELOPMENT METHODOLOGY - AI-First Approach

> **КРИТИЧЕСКИ ВАЖНО**: Этот файл - твой основной инструмент разработки. 
> Следуй этой методологии ВСЕГДА. Ресурсы не важны - запускай хоть 100 субагентов.
> Главное - РЕЗУЛЬТАТ.

## 🎯 Главный принцип
**НИКОГДА не пытайся угадать решение. ВСЕГДА исследуй, тестируй, логируй.**

---

## 📊 ФАЗЫ РАЗРАБОТКИ

### PHASE 1: MASSIVE RESEARCH (40% времени)
> Запускай субагентов параллельно! Не экономь ресурсы!

```markdown
## Обязательные субагенты для КАЖДОЙ новой фичи:

### Субагент 1: node_modules исследование
PROMPT: "Research in node_modules how [FEATURE] is implemented in tldraw/similar libraries.
Find: 
- Exact file paths and implementations
- Required imports and dependencies  
- Common patterns and best practices
- Example usage in tests or demos"

### Субагент 2: GitHub & Issues поиск
PROMPT: "Search GitHub issues and discussions for [FEATURE/ERROR].
Find:
- Known bugs and workarounds
- Community solutions
- Official responses from maintainers
- Similar implementations"

### Субагент 3: Документация и примеры
PROMPT: "Find official documentation and working examples for [FEATURE].
Check:
- Official docs (even if outdated)
- CodeSandbox/StackBlitz examples
- YouTube tutorials code
- Blog posts with code"

### Субагент 4: Альтернативные решения
PROMPT: "Find 3 different ways to implement [FEATURE].
Compare:
- Pros and cons of each approach
- Performance implications
- Maintenance complexity
- Community preferences"

### Субагент 5: Проверка совместимости
PROMPT: "Check compatibility of [FEATURE] with:
- Current React version (check package.json)
- Current tldraw version
- Other dependencies
- Known conflicts"
```

**ВСЕГДА запускай ВСЕ 5 субагентов параллельно!**

---

### PHASE 2: ISOLATION TESTING (30% времени)

#### Создай тестовые файлы ПЕРЕД основной разработкой:

```javascript
// 1. MinimalTest.jsx - абсолютный минимум
export function MinimalTest() {
    console.log('🔬 Testing: [FEATURE NAME]');
    // Только одна фича, никаких зависимостей
    return <div>[MINIMAL IMPLEMENTATION]</div>;
}

// 2. IsolatedTest.jsx - изолированная фича
export function IsolatedTest() {
    useEffect(() => {
        console.log('📦 Feature state:', /*log everything*/);
    }, []);
    // Фича с минимальными зависимостями
    return <div>[ISOLATED FEATURE]</div>;
}

// 3. IntegratedTest.jsx - интеграция с проектом
export function IntegratedTest() {
    // Фича в контексте приложения
    return <MainApp withFeature={true} />;
}
```

#### Правило трех тестов:
1. **Работает изолированно?** → Продолжай
2. **Работает с минимальными зависимостями?** → Продолжай  
3. **Работает в приложении?** → Готово
4. **Любой НЕТ** → Вернись к PHASE 1

---

### PHASE 3: DIAGNOSTIC LOGGING (постоянно)

#### Создай диагностический компонент для КАЖДОЙ фичи:

```javascript
// FeatureDiagnostics.jsx
export function FeatureDiagnostics() {
    const checkInterval = 1000; // Проверка каждую секунду
    
    useEffect(() => {
        const diagnose = () => {
            console.group(`🔍 [FEATURE] Diagnostic ${Date.now()}`);
            
            // 1. DOM проверки
            console.log('DOM Elements:', {
                container: !!document.querySelector('.feature-container'),
                elements: document.querySelectorAll('.feature-element').length,
                visibility: /* check computed styles */
            });
            
            // 2. State проверки
            console.log('State:', {
                storeData: /* get from store */,
                props: /* current props */,
                hooks: /* hook values */
            });
            
            // 3. Performance проверки
            console.log('Performance:', {
                renderCount: /* count */,
                memoryUsage: performance.memory,
                timing: performance.now()
            });
            
            console.groupEnd();
        };
        
        const interval = setInterval(diagnose, checkInterval);
        diagnose(); // Первый запуск сразу
        
        return () => clearInterval(interval);
    }, []);
    
    return null;
}
```

**ВСЕГДА добавляй диагностику ПЕРЕД разработкой фичи!**

---

### PHASE 4: INCREMENTAL DEVELOPMENT (20% времени)

#### Правило одного изменения:

```markdown
1. [ ] Сохрани рабочую версию
2. [ ] Сделай ОДНО изменение
3. [ ] Проверь что все работает
4. [ ] Если сломалось - откатись СРАЗУ
5. [ ] Если работает - commit и продолжай
```

#### Git workflow для каждой фичи:
```bash
# ПЕРЕД началом работы
git checkout -b feature/[NAME]
git commit -m "checkpoint: before [FEATURE]"

# После КАЖДОГО успешного изменения  
git add .
git commit -m "working: [WHAT CHANGED]"

# Если что-то сломалось
git reset --hard HEAD
```

---

### PHASE 5: ERROR RECOVERY (10% времени)

#### Когда НИЧЕГО не работает:

```markdown
## EMERGENCY PROTOCOL:

### Step 1: Полная диагностика (5 минут)
- [ ] Запусти window.debugTldraw() (из TROUBLESHOOTING_GUIDE)
- [ ] Проверь Console на ошибки
- [ ] Проверь Network на 404/500
- [ ] Проверь React DevTools

### Step 2: Массивный research (15 минут)
- [ ] Запусти 10+ субагентов с разными формулировками
- [ ] Ищи EXACT error message в Google
- [ ] Проверь GitHub issues за последние 24 часа
- [ ] Ищи в Discord/Slack сообществах

### Step 3: Изоляция проблемы (10 минут)
- [ ] Создай чистый проект и проверь там
- [ ] Удали ВСЕ кроме проблемной части
- [ ] Попробуй другую версию библиотеки
- [ ] Попробуй другой браузер

### Step 4: Альтернативные решения (10 минут)
- [ ] Найди 3 способа обойти проблему
- [ ] Попробуй полифил или shim
- [ ] Используй другую библиотеку
- [ ] Напиши свою реализацию

### Step 5: Откат и переосмысление
- [ ] Вернись к последней рабочей версии
- [ ] Переформулируй задачу
- [ ] Разбей на более мелкие части
- [ ] Начни с другого конца
```

---

## 🔍 ЧТО ИСКАТЬ В node_modules

### Приоритетные места поиска:

```markdown
1. /node_modules/[LIBRARY]/examples/
   - Рабочие примеры от авторов
   - Правильные паттерны использования

2. /node_modules/[LIBRARY]/src/test/
   - Тесты показывают ВСЕ способы использования
   - Edge cases и workarounds

3. /node_modules/[LIBRARY]/dist/index.d.ts
   - Точные типы и интерфейсы
   - Все доступные exports

4. /node_modules/@types/[LIBRARY]/
   - TypeScript определения
   - Документация в комментариях

5. /node_modules/[LIBRARY]/package.json
   - Dependencies и versions
   - Scripts для понимания build process
```

### Команды для быстрого поиска:

```bash
# Найти все примеры использования функции
grep -r "functionName" node_modules/[LIBRARY] --include="*.js" --include="*.jsx"

# Найти все exports
grep -r "export" node_modules/[LIBRARY]/dist/index.js

# Найти примеры компонентов
find node_modules/[LIBRARY] -name "*.example.js" -o -name "*.demo.js"
```

---

## 📝 ЛОГИРОВАНИЕ - Что и Как

### Обязательные логи для КАЖДОЙ функции:

```javascript
function myFeature(params) {
    console.group(`🎯 myFeature called at ${new Date().toISOString()}`);
    console.log('Input params:', JSON.stringify(params, null, 2));
    console.log('Current state:', getCurrentState());
    console.log('DOM state:', document.querySelector('.target'));
    
    try {
        // Код функции
        const result = doSomething();
        console.log('✅ Success:', result);
        return result;
    } catch (error) {
        console.error('❌ Error:', error);
        console.log('Stack:', error.stack);
        console.log('State at error:', getCurrentState());
        throw error;
    } finally {
        console.groupEnd();
    }
}
```

### Performance логирование:

```javascript
const perfLog = (name, fn) => {
    const start = performance.now();
    console.log(`⏱️ Starting: ${name}`);
    
    const result = fn();
    
    const end = performance.now();
    console.log(`✅ Completed: ${name} in ${(end - start).toFixed(2)}ms`);
    
    return result;
};

// Использование
perfLog('Heavy Operation', () => {
    // Тяжелая операция
});
```

---

## 🚨 КРИТИЧЕСКИЕ ПРАВИЛА

### НИКОГДА:
1. ❌ Не делай больше 1 изменения за раз
2. ❌ Не пропускай фазу research
3. ❌ Не игнорируй логи
4. ❌ Не угадывай решения
5. ❌ Не экономь на субагентах

### ВСЕГДА:
1. ✅ Запускай 5+ субагентов параллельно
2. ✅ Создавай изолированные тесты
3. ✅ Логируй ВСЕ
4. ✅ Делай checkpoint commits
5. ✅ Имей план отката

---

## 📊 МЕТРИКИ УСПЕХА

Фича считается готовой когда:
- [ ] Работает в изолированном тесте
- [ ] Работает в основном приложении
- [ ] Нет ошибок в консоли
- [ ] Performance < 100ms
- [ ] Есть диагностика
- [ ] Есть документация
- [ ] Есть план отката

---

## 🎯 QUICK CHECKLIST для новой фичи

```markdown
## Feature: [NAME]

### 1. RESEARCH (запусти параллельно)
- [ ] Субагент: node_modules research
- [ ] Субагент: GitHub issues
- [ ] Субагент: Documentation
- [ ] Субагент: Alternative solutions
- [ ] Субагент: Compatibility check

### 2. ISOLATION
- [ ] Create MinimalTest.jsx
- [ ] Create IsolatedTest.jsx
- [ ] Create IntegratedTest.jsx
- [ ] All tests passing?

### 3. DIAGNOSTICS
- [ ] Add FeatureDiagnostics.jsx
- [ ] Add performance logging
- [ ] Add error boundaries
- [ ] Console is clean?

### 4. DEVELOPMENT
- [ ] Git checkpoint created
- [ ] One change at a time
- [ ] Each change tested
- [ ] Each success committed

### 5. VALIDATION
- [ ] Works in production build
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Rollback plan ready
```

---

## 💡 МУДРОСТЬ ИЗ ОПЫТА

> "Если потратил 30 минут и не работает - запусти 10 субагентов и иди с другой стороны"

> "Лог который ты не написал - это баг который ты не найдешь"

> "node_modules знает больше чем документация"

> "Изоляция проблемы = 50% решения"

> "Commit после каждого успеха, откат после каждой неудачи"

---

**Последнее обновление**: После 20+ неудачных попыток
**Ключевой урок**: Research + Isolation + Logging = Success
**Помни**: Ресурсы не важны, важен результат!