import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';

// РЕШЕНИЕ: Полное устранение проблемы курсора на позиции 0 при первом клике
const FixedCursorTextarea = ({ value, onChange }) => {
  const textAreaRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);

  // useLayoutEffect работает СИНХРОННО после DOM обновлений, но ПЕРЕД отрисовкой
  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea && !isFirstInteraction) {
      console.log('🔄 Восстанавливаем позицию:', { 
        cursor: cursorPosition, 
        selectionEnd, 
        scrollTop 
      });
      
      // Восстанавливаем курсор и выделение
      textArea.setSelectionRange(cursorPosition, selectionEnd);
      // Восстанавливаем скролл
      textArea.scrollTop = scrollTop;
    }
  }, [value, cursorPosition, selectionEnd, scrollTop, isFirstInteraction]);

  // Обработка изменения текста
  const handleChange = useCallback((e) => {
    console.log('✏️ Изменение текста');
    const target = e.target;
    
    // Сохраняем позицию курсора ПЕРЕД изменением
    setCursorPosition(target.selectionStart);
    setSelectionEnd(target.selectionEnd);
    setScrollTop(target.scrollTop);
    
    // Помечаем что было взаимодействие
    setIsFirstInteraction(false);
    
    // Передаем изменение наверх
    onChange && onChange(target.value);
  }, [onChange]);

  // Обработка скролла
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
    console.log('📜 Скролл:', e.target.scrollTop);
  }, []);

  // Обработка выделения текста
  const handleSelect = useCallback((e) => {
    const target = e.target;
    setCursorPosition(target.selectionStart);
    setSelectionEnd(target.selectionEnd);
    console.log('🎯 Выделение:', { 
      start: target.selectionStart, 
      end: target.selectionEnd 
    });
  }, []);

  // КРИТИЧНО: обработка первого клика/фокуса
  const handleClick = useCallback((e) => {
    const target = e.target;
    
    if (isFirstInteraction) {
      console.log('👆 Первый клик - исправляем позицию курсора');
      
      // Используем requestAnimationFrame для правильного тайминга
      requestAnimationFrame(() => {
        // Получаем реальную позицию где кликнул пользователь
        const clickedPosition = target.selectionStart;
        
        console.log('📍 Реальная позиция клика:', clickedPosition);
        
        // Устанавливаем курсор в правильную позицию
        if (clickedPosition >= 0) {
          target.setSelectionRange(clickedPosition, clickedPosition);
          setCursorPosition(clickedPosition);
          setSelectionEnd(clickedPosition);
        }
      });
      
      setIsFirstInteraction(false);
    } else {
      // Обычная обработка клика
      setCursorPosition(target.selectionStart);
      setSelectionEnd(target.selectionEnd);
    }
  }, [isFirstInteraction]);

  // Обработка фокуса
  const handleFocus = useCallback((e) => {
    const target = e.target;
    
    if (isFirstInteraction) {
      console.log('🎯 Первый фокус - проверяем позицию');
      
      // Используем setTimeout для обхода проблемы с браузером
      setTimeout(() => {
        // Если позиция все еще 0, устанавливаем в конец текста
        if (target.selectionStart === 0 && value.length > 0) {
          const endPosition = value.length;
          target.setSelectionRange(endPosition, endPosition);
          setCursorPosition(endPosition);
          setSelectionEnd(endPosition);
          console.log('🔧 Исправили позицию курсора на:', endPosition);
        }
      }, 0);
    }
  }, [isFirstInteraction, value]);

  // Обработка нажатия клавиш
  const handleKeyDown = useCallback((e) => {
    // Сохраняем позицию при нажатии Enter для предотвращения прыжка скролла
    if (e.key === 'Enter') {
      const target = e.target;
      setCursorPosition(target.selectionStart);
      setSelectionEnd(target.selectionEnd);
      setScrollTop(target.scrollTop);
      console.log('⏎ Enter нажат, позиция:', target.selectionStart);
    }
  }, []);

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
        onKeyDown={handleKeyDown}
        placeholder="Кликните в любое место текста - курсор останется там, где вы кликнули!"
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
      <div style={{ 
        marginTop: '10px', 
        fontSize: '12px', 
        color: '#666',
        display: 'flex',
        gap: '20px'
      }}>
        <span>📍 Позиция курсора: {cursorPosition}</span>
        <span>📝 Выделение: {selectionEnd}</span>
        <span>📜 Скролл: {scrollTop}px</span>
        <span>🔄 Первое взаимодействие: {isFirstInteraction ? 'Да' : 'Нет'}</span>
      </div>
      
      <div style={{ 
        marginTop: '10px', 
        padding: '10px',
        background: '#1a1a1a',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#888'
      }}>
        <strong>🔧 Исправления:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Отслеживание первого взаимодействия для корректировки позиции курсора</li>
          <li>Использование requestAnimationFrame для правильного тайминга</li>
          <li>Обработка onClick вместе с onFocus для точного позиционирования</li>
          <li>Сохранение позиции выделения, не только курсора</li>
          <li>Предотвращение прыжка скролла при нажатии Enter</li>
        </ul>
      </div>
    </div>
  );
};

export default FixedCursorTextarea;