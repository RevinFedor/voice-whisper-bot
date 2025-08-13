import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';

/**
 * ФИНАЛЬНОЕ РЕШЕНИЕ для textarea с сохранением позиции скролла и курсора
 * Решает все известные проблемы:
 * - Сброс скролла при изменении текста
 * - Позиция курсора 0 при первом клике
 * - Прыжок при нажатии Enter
 * - Работа с большими текстами (5000+ символов)
 */
const FinalTextareaSolution = ({ value, onChange, placeholder = "Введите текст..." }) => {
  const textAreaRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  const isLargeText = value?.length > 5000;

  // Синхронное восстановление позиции после обновления DOM
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    
    // НЕ восстанавливаем при первом взаимодействии или во время восстановления
    if (textArea && !isFirstInteraction && !isRestoringScroll) {
      const scrollDiff = Math.abs(textArea.scrollTop - scrollTop);
      
      // Восстанавливаем только если разница значительная
      if (scrollDiff > 10) {
        console.log('📐 Восстановление позиции');
        setIsRestoringScroll(true);
        
        textArea.setSelectionRange(cursor, cursor);
        textArea.scrollTop = scrollTop;
        
        // Сбрасываем флаг после восстановления
        requestAnimationFrame(() => {
          setIsRestoringScroll(false);
        });
      }
    }
  }, [value, cursor, scrollTop, isFirstInteraction, isRestoringScroll]);

  // Обработка изменения текста
  const handleChange = useCallback((e) => {
    const { selectionStart, scrollTop: currentScroll, value: newValue } = e.target;
    
    // Сохраняем состояние
    setCursor(selectionStart);
    setScrollTop(currentScroll);
    
    // Вызываем onChange
    onChange && onChange(newValue);
  }, [onChange]);

  // Обработка первого клика - фикс позиции курсора 0
  const handleClick = useCallback((e) => {
    if (isFirstInteraction) {
      console.log('🎯 Первый клик');
      // Используем requestAnimationFrame для корректного получения позиции
      requestAnimationFrame(() => {
        const realPosition = e.target.selectionStart;
        console.log('📍 Позиция после RAF:', realPosition);
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

  // Обработка программного фокуса
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

  // Обработка скролла
  const handleScroll = useCallback((e) => {
    // Игнорируем события скролла во время восстановления позиции
    if (!isRestoringScroll) {
      setScrollTop(e.target.scrollTop);
    }
  }, [isRestoringScroll]);

  // Обработка выделения текста
  const handleSelect = useCallback((e) => {
    setCursor(e.target.selectionStart);
  }, []);

  // Специальная обработка Enter для предотвращения прыжков
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // ВСЕГДА предотвращаем автоскролл браузера
      
      const pos = e.target.selectionStart;
      const currentScrollTop = e.target.scrollTop;
      const newValue = value.slice(0, pos) + '\n' + value.slice(pos);
      
      if (isFirstInteraction) {
        setIsFirstInteraction(false);
      }
      
      onChange && onChange(newValue);
      
      // Восстанавливаем позицию без автоскролла браузера
      requestAnimationFrame(() => {
        e.target.setSelectionRange(pos + 1, pos + 1);
        e.target.scrollTop = currentScrollTop; // Сохраняем тот же скролл
        setCursor(pos + 1);
        setScrollTop(currentScrollTop);
      });
    }
  }, [value, onChange, isFirstInteraction]);

  // Оптимизации для больших текстов
  const textareaProps = isLargeText ? {
    spellCheck: false,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off'
  } : {};

  return (
    <textarea
      ref={textAreaRef}
      value={value}
      onChange={handleChange}
      onClick={handleClick}
      onFocus={handleFocus}
      onScroll={handleScroll}
      onSelect={handleSelect}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...textareaProps}
      style={{
        width: '100%',
        minHeight: '400px',
        padding: '12px',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical',
        // GPU ускорение для больших текстов
        ...(isLargeText && {
          willChange: 'transform',
          transform: 'translateZ(0)'
        })
      }}
    />
  );
};

export default FinalTextareaSolution;

// Хук для удобного использования
export const useScrollPreservingTextarea = (initialValue = '') => {
  const [value, setValue] = useState(initialValue);
  
  return {
    value,
    setValue,
    textareaProps: {
      value,
      onChange: setValue
    },
    TextareaComponent: (props) => (
      <FinalTextareaSolution 
        value={value} 
        onChange={setValue} 
        {...props} 
      />
    )
  };
};