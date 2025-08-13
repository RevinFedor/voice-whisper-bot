import React, { useRef, useLayoutEffect, useState } from 'react';

// РЕШЕНИЕ 1: Полное сохранение состояния textarea
const ControlledTextarea = ({ value, onChange }) => {
  const textAreaRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // useLayoutEffect выполняется СИНХРОННО после изменения DOM
  // но ПЕРЕД отрисовкой браузером - это критично!
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      console.log('🔄 Восстанавливаем позицию:', { cursor, scrollTop });
      // Восстанавливаем позицию курсора
      textArea.setSelectionRange(cursor, cursor);
      // Восстанавливаем позицию скролла
      textArea.scrollTop = scrollTop;
    }
  }, [value, cursor, scrollTop]);

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

  return (
    <div>
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        onSelect={handleSelect}
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