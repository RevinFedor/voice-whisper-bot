import React, { useRef, useLayoutEffect, useMemo, useCallback } from 'react';

// РЕШЕНИЕ 4: Оптимизированное для больших текстов (5000+ символов)
const OptimizedLargeText = ({ value, onChange, debounceMs = 100 }) => {
  const textAreaRef = useRef(null);
  const stateRef = useRef({
    cursor: 0,
    scrollTop: 0,
    lastValue: '',
    updateTimeout: null,
    isLargeText: false
  });

  // Мемоизируем большие тексты для предотвращения лишних перерендеров
  const memoizedValue = useMemo(() => value, [value]);
  
  // Определяем, является ли текст большим
  const isLargeText = memoizedValue.length > 5000;

  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    const state = stateRef.current;
    
    if (!textArea || state.lastValue === memoizedValue) return;
    
    console.log(`🔄 Обновление текста (${memoizedValue.length} символов)`);
    
    // Для больших текстов используем requestAnimationFrame для плавности
    if (isLargeText) {
      console.log('🚀 Используем requestAnimationFrame для большого текста');
      requestAnimationFrame(() => {
        textArea.setSelectionRange(state.cursor, state.cursor);
        textArea.scrollTop = state.scrollTop;
      });
    } else {
      // Для небольших текстов восстанавливаем сразу
      textArea.setSelectionRange(state.cursor, state.cursor);
      textArea.scrollTop = state.scrollTop;
    }
    
    state.lastValue = memoizedValue;
    state.isLargeText = isLargeText;
  }, [memoizedValue, isLargeText]);

  const handleChange = useCallback((e) => {
    const { selectionStart, scrollTop, value: newValue } = e.target;
    const state = stateRef.current;
    
    // Сохраняем состояние
    state.cursor = selectionStart;
    state.scrollTop = scrollTop;
    
    // Для больших текстов используем debounce
    if (newValue.length > 5000 && debounceMs > 0) {
      console.log('⏱️ Debouncing для большого текста');
      
      if (state.updateTimeout) {
        clearTimeout(state.updateTimeout);
      }
      
      // Локальное обновление для мгновенной обратной связи
      if (textAreaRef.current) {
        textAreaRef.current.value = newValue;
      }
      
      state.updateTimeout = setTimeout(() => {
        console.log('📤 Отправка изменений после debounce');
        onChange && onChange(newValue);
      }, debounceMs);
    } else {
      // Для небольших текстов обновляем сразу
      onChange && onChange(newValue);
    }
  }, [onChange, debounceMs]);

  const handleScroll = useCallback((e) => {
    stateRef.current.scrollTop = e.target.scrollTop;
  }, []);

  const handleSelect = useCallback((e) => {
    stateRef.current.cursor = e.target.selectionStart;
  }, []);

  // Оптимизация: предотвращаем лишние проверки орфографии для больших текстов
  const textareaProps = isLargeText ? {
    spellCheck: false,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off'
  } : {};

  return (
    <div>
      <textarea
        ref={textAreaRef}
        defaultValue={memoizedValue}
        onChange={handleChange}
        onScroll={handleScroll}
        onSelect={handleSelect}
        placeholder="Оптимизировано для больших текстов (5000+ символов)"
        {...textareaProps}
        style={{
          width: '100%',
          minHeight: '400px',
          background: '#0a0a0a',
          color: '#e0e0e0',
          border: isLargeText ? '1px solid #f59e0b' : '1px solid #333',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '14px',
          fontFamily: 'monospace',
          resize: 'vertical',
          lineHeight: '1.5',
          // GPU ускорение для больших текстов
          willChange: isLargeText ? 'transform' : 'auto',
          transform: 'translateZ(0)'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        {isLargeText ? (
          <span style={{ color: '#f59e0b' }}>
            ⚡ Режим оптимизации активен: debounce {debounceMs}ms, requestAnimationFrame, spell check отключен
          </span>
        ) : (
          <span>📝 Стандартный режим (текст менее 5000 символов)</span>
        )}
      </div>
      <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
        Производительность: {isLargeText ? 'Оптимизирована для больших текстов' : 'Максимальная отзывчивость'}
      </div>
    </div>
  );
};

export default OptimizedLargeText;