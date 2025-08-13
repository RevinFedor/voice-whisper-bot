import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';

// РЕШЕНИЕ 1: Полное сохранение состояния textarea с фиксом первого клика
const ControlledTextarea = ({ value, onChange }) => {
  const textAreaRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);

  // useLayoutEffect выполняется СИНХРОННО после изменения DOM
  // но ПЕРЕД отрисовкой браузером - это критично!
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    // НЕ восстанавливаем позицию при первом взаимодействии
    if (textArea && !isFirstInteraction) {
      console.log('🔄 Восстанавливаем позицию:', { cursor, scrollTop });
      // Восстанавливаем позицию курсора
      textArea.setSelectionRange(cursor, cursor);
      // Восстанавливаем позицию скролла
      textArea.scrollTop = scrollTop;
    }
  }, [value, cursor, scrollTop, isFirstInteraction]);

  const handleChange = (e) => {
    console.log('✏️ Изменение текста, сохраняем состояние');
    // Сохраняем текущее состояние ПЕРЕД изменением
    setCursor(e.target.selectionStart);
    setScrollTop(e.target.scrollTop);
    
    // Передаем изменение наверх
    onChange && onChange(e.target.value);
  };

  const handleScroll = (e) => {
    // Сохраняем позицию скролла при прокрутке пользователем
    setScrollTop(e.target.scrollTop);
  };

  const handleSelect = (e) => {
    // Сохраняем позицию курсора при выделении
    setCursor(e.target.selectionStart);
  };

  // КРИТИЧНО: Обработка первого клика с requestAnimationFrame
  const handleClick = useCallback((e) => {
    if (isFirstInteraction) {
      console.log('🎯 Первый клик, фиксим позицию курсора');
      requestAnimationFrame(() => {
        const realPosition = e.target.selectionStart;
        if (realPosition >= 0) {
          console.log('📍 Реальная позиция курсора:', realPosition);
          e.target.setSelectionRange(realPosition, realPosition);
          setCursor(realPosition);
          setScrollTop(e.target.scrollTop);
        }
      });
      setIsFirstInteraction(false);
    } else {
      // Обычное сохранение позиции при клике
      setCursor(e.target.selectionStart);
      setScrollTop(e.target.scrollTop);
    }
  }, [isFirstInteraction]);

  // Фикс для программного фокуса
  const handleFocus = useCallback((e) => {
    if (isFirstInteraction) {
      console.log('🔍 Первый фокус на textarea');
      setTimeout(() => {
        const currentPos = e.target.selectionStart;
        setCursor(currentPos);
        setScrollTop(e.target.scrollTop);
        setIsFirstInteraction(false);
      }, 0);
    }
  }, [isFirstInteraction]);

  return (
    <div>
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        onSelect={handleSelect}
        onClick={handleClick}
        onFocus={handleFocus}
        placeholder="Начните вводить текст... Скролл и позиция курсора будут сохранены!"
        style={{
          width: '100%',
          minHeight: '400px',
          background: '#0a0a0a',
          color: '#e0e0e0',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '14px',
          fontFamily: 'monospace',
          resize: 'vertical',
          lineHeight: '1.5'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        📍 Позиция курсора: {cursor} | 📜 Скролл: {scrollTop}px
      </div>
    </div>
  );
};

export default ControlledTextarea;