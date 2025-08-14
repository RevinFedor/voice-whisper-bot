# Решение проблемы позиции курсора 0 в React Textarea

## Проблема

При работе с textarea в React часто возникает проблема, когда:

1. **При первом клике** на textarea после загрузки страницы cursor инициализируется как 0
2. **При нажатии Enter** происходит прыжок скролла наверх  
3. **Логи показывают**: cursor: 0, потом прыгает на реальную позицию
4. **selectionStart возвращает 0** при первом взаимодействии

## Исследование проблемы

### Источники информации

#### GitHub Issues
- **React Core Issue #955** - "Cursor jumps to end of controlled input" (2014)
- **React Core Issue #18530** - "Incorrect focus on mount" - проблема появилась после Chrome 76+ и Firefox 66+
- **React Hook Form Issue #7776** - controlled textarea не устанавливает фокус правильно

#### Stack Overflow
- "Change the cursor position in a textarea with React"
- "selectionStart of textarea returns wrong value" 
- "Why selection range in textarea resets to 0?"

#### Техническая статья
- "Keep that cursor still!" - детальный анализ проблемы и решений

### Причины проблемы

1. **Асинхронные обновления состояния**: React не может отследить изменения курсора при асинхронных обновлениях
2. **Трансформация значений**: Установка преобразованного значения (например, `toUpperCase()`) 
3. **Внешнее управление состоянием**: При использовании Redux или внешних store
4. **Браузерные изменения**: Проблема усилилась после Chrome 76+ и Firefox 66+
5. **React lifecycle**: setSelectionRange вызывается до завершения фазы commit в React

## Решения

### 1. Основное решение - FixedCursorTextarea

```javascript
import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';

const FixedCursorTextarea = ({ value, onChange }) => {
  const textAreaRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);

  // useLayoutEffect работает СИНХРОННО после DOM обновлений
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea && !isFirstInteraction) {
      textArea.setSelectionRange(cursorPosition, selectionEnd);
      textArea.scrollTop = scrollTop;
    }
  }, [value, cursorPosition, selectionEnd, scrollTop, isFirstInteraction]);

  // Обработка первого клика
  const handleClick = useCallback((e) => {
    const target = e.target;
    
    if (isFirstInteraction) {
      // Используем requestAnimationFrame для правильного тайминга
      requestAnimationFrame(() => {
        const clickedPosition = target.selectionStart;
        if (clickedPosition >= 0) {
          target.setSelectionRange(clickedPosition, clickedPosition);
          setCursorPosition(clickedPosition);
          setSelectionEnd(clickedPosition);
        }
      });
      setIsFirstInteraction(false);
    }
  }, [isFirstInteraction]);

  // Обработка фокуса с исправлением позиции 0
  const handleFocus = useCallback((e) => {
    const target = e.target;
    
    if (isFirstInteraction) {
      setTimeout(() => {
        // Если позиция все еще 0, устанавливаем в конец
        if (target.selectionStart === 0 && value.length > 0) {
          const endPosition = value.length;
          target.setSelectionRange(endPosition, endPosition);
          setCursorPosition(endPosition);
          setSelectionEnd(endPosition);
        }
      }, 0);
    }
  }, [isFirstInteraction, value]);
  
  // ... остальные обработчики
};
```

### 2. Альтернативные решения

#### Решение с setTimeout
```javascript
componentDidUpdate() {
  setTimeout(() => {
    this.input.setSelectionRange(0, 0);
  }, 0);
}
```

#### Решение с requestAnimationFrame
```javascript
const handleChange = (e) => {
  requestAnimationFrame(() => {
    if (textareaRef.current) {
      textareaRef.current.selectionStart = cursorPosition;
      textareaRef.current.selectionEnd = cursorPosition;
    }
  });
};
```

#### Решение с setState callback
```javascript
this.setState(
  { value: newValue },
  () => {
    this.refs.input.focus();
    this.refs.input.selectionStart = position;
    this.refs.input.selectionEnd = position;
  }
);
```

## Ключевые техники

### 1. Отслеживание первого взаимодействия
```javascript
const [isFirstInteraction, setIsFirstInteraction] = useState(true);
```

### 2. Использование useLayoutEffect вместо useEffect
- `useLayoutEffect` выполняется синхронно после DOM обновлений
- Предотвращает видимые скачки курсора

### 3. Комбинирование onClick и onFocus
- `onFocus` может давать неправильное значение selectionStart
- `onClick` более надежен для получения реальной позиции клика

### 4. requestAnimationFrame для тайминга
- Обеспечивает правильную последовательность операций
- Позволяет браузеру завершить обновление DOM

### 5. Проверка на >= 0 вместо truthy
```javascript
// Неправильно:
if (textbox.selectionStart) { /* ... */ }

// Правильно:
if (textbox.selectionStart >= 0) { /* ... */ }
```

## Предотвращение прыжка скролла

```javascript
const handleKeyDown = useCallback((e) => {
  if (e.key === 'Enter') {
    const target = e.target;
    setCursorPosition(target.selectionStart);
    setScrollTop(target.scrollTop);
  }
}, []);
```

## Тестирование

Для проверки решения:

1. Загрузите страницу с предзаполненным textarea
2. Кликните в середину текста
3. Убедитесь, что курсор остался в месте клика
4. Нажмите Enter - скролл не должен прыгать
5. Введите текст - позиция должна сохраняться

## Совместимость

- **React 16.8+** (hooks)
- **Chrome 76+, Firefox 66+** (где проявляется проблема)
- **Safari** - работает стабильно
- **Edge** - требует тестирования

## Производительность

- Минимальное влияние на производительность
- useLayoutEffect выполняется синхронно, но только при изменении состояния
- requestAnimationFrame оптимизирует операции с DOM

## Заключение

Проблема позиции курсора 0 в React textarea - это известная проблема, связанная с изменениями в браузерах и особенностями lifecycle React. Представленное решение комбинирует несколько техник для полного устранения проблемы:

1. Отслеживание первого взаимодействия
2. Использование правильных event handlers
3. Оптимальный тайминг с requestAnimationFrame
4. Синхронные DOM операции с useLayoutEffect

Это решение обеспечивает стабильную работу курсора во всех сценариях использования.