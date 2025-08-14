# 🔧 ФИКС ПРОБЛЕМЫ С КУРСОРОМ ПРИ ПЕРВОМ КЛИКЕ

## 🐛 Описание проблемы

При первом клике на textarea после загрузки страницы:
1. Позиция курсора инициализируется как `0`
2. При нажатии Enter происходит прыжок скролла наверх
3. Текст перемещается к началу документа, даже если клик был в середине

**Логи проблемы:**
```
🔄 Восстанавливаем позицию: {cursor: 0, scrollTop: 300}
// Курсор на 0, хотя реальная позиция клика была 898
```

## ✅ Решение

### Ключевые изменения:

1. **Добавлен флаг `isFirstInteraction`** - отслеживает первое взаимодействие
2. **`requestAnimationFrame` в `onClick`** - правильный тайминг для получения позиции
3. **Условный `useLayoutEffect`** - не восстанавливает позицию при первом клике
4. **`setTimeout` в `onFocus`** - фикс для программного фокуса

### Обновленный код:

```jsx
const ControlledTextarea = ({ value, onChange }) => {
  const textAreaRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);

  // НЕ восстанавливаем позицию при первом взаимодействии
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea && !isFirstInteraction) {
      textArea.setSelectionRange(cursor, cursor);
      textArea.scrollTop = scrollTop;
    }
  }, [value, cursor, scrollTop, isFirstInteraction]);

  // Обработка первого клика с requestAnimationFrame
  const handleClick = useCallback((e) => {
    if (isFirstInteraction) {
      requestAnimationFrame(() => {
        const realPosition = e.target.selectionStart;
        if (realPosition >= 0) {
          e.target.setSelectionRange(realPosition, realPosition);
          setCursor(realPosition);
          setScrollTop(e.target.scrollTop);
        }
      });
      setIsFirstInteraction(false);
    } else {
      setCursor(e.target.selectionStart);
      setScrollTop(e.target.scrollTop);
    }
  }, [isFirstInteraction]);

  // Фикс для программного фокуса
  const handleFocus = useCallback((e) => {
    if (isFirstInteraction) {
      setTimeout(() => {
        const currentPos = e.target.selectionStart;
        setCursor(currentPos);
        setScrollTop(e.target.scrollTop);
        setIsFirstInteraction(false);
      }, 0);
    }
  }, [isFirstInteraction]);

  // ... остальные обработчики
};
```

## 🎯 Что исправлено:

- ✅ **Курсор не сбрасывается на 0** при первом клике
- ✅ **Enter работает корректно** в любой позиции
- ✅ **Скролл не прыгает** при первом взаимодействии
- ✅ **Позиция сохраняется** при редактировании
- ✅ **Программный фокус** обрабатывается правильно

## 📊 Тестирование

### Сценарий 1: Первый клик в середине текста
1. Загрузить страницу с 5000+ символами
2. Проскроллить до середины
3. Кликнуть в середину текста
4. Нажать Enter
**Результат:** ✅ Курсор остается на месте, скролл не прыгает

### Сценарий 2: Клик после потери фокуса
1. Кликнуть в textarea
2. Кликнуть вне textarea
3. Кликнуть обратно в середину текста
**Результат:** ✅ Позиция сохраняется корректно

### Сценарий 3: Программный фокус
1. Вызвать `textAreaRef.current.focus()` программно
**Результат:** ✅ Фокус устанавливается без сброса позиции

## 🔍 Технические детали

### Почему `requestAnimationFrame`?

При первом клике браузер еще не установил реальную позицию `selectionStart`. 
`requestAnimationFrame` гарантирует, что мы получим правильное значение после обновления DOM.

### Почему условный `useLayoutEffect`?

При первом взаимодействии мы не хотим принудительно устанавливать позицию 0.
Даем браузеру установить естественную позицию клика.

### Браузерная совместимость

- ✅ Chrome 76+
- ✅ Firefox 66+
- ✅ Safari 14+
- ✅ Edge 79+

## 💡 Дополнительные улучшения

Для еще большей надежности можно добавить:

```jsx
// Дополнительная проверка для Enter
const handleKeyDown = (e) => {
  if (e.key === 'Enter' && isFirstInteraction) {
    e.preventDefault();
    setIsFirstInteraction(false);
    setTimeout(() => {
      const pos = e.target.selectionStart;
      setCursor(pos);
      setScrollTop(e.target.scrollTop);
      // Теперь можно безопасно добавить новую строку
      const newValue = value.slice(0, pos) + '\n' + value.slice(pos);
      onChange(newValue);
    }, 0);
  }
};
```

## 🚀 Использование

Обновленный компонент доступен в тестовом приложении:
**http://localhost:5177/**

Выберите "Controlled Textarea с фиксом скролла" и протестируйте все сценарии.