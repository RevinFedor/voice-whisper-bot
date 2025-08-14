import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';

// РЕШЕНИЕ 2: ContentEditable с управлением состояния
const ContentEditableEditor = ({ value, onChange }) => {
  const contentRef = useRef(null);
  const [localValue, setLocalValue] = useState(value);
  const selectionRef = useRef({ start: 0, end: 0 });
  const scrollRef = useRef(0);

  // Синхронизация внешнего value с локальным
  useLayoutEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  // Восстановление позиции курсора и скролла
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    // Восстанавливаем текст
    if (element.innerText !== localValue) {
      element.innerText = localValue;
    }

    // Восстанавливаем скролл
    element.scrollTop = scrollRef.current;

    // Восстанавливаем позицию курсора (сложнее чем в textarea)
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      
      if (element.firstChild) {
        const textNode = element.firstChild;
        const maxLength = textNode.textContent.length;
        const position = Math.min(selectionRef.current.start, maxLength);
        
        range.setStart(textNode, position);
        range.setEnd(textNode, position);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (e) {
      console.warn('Не удалось восстановить позицию курсора:', e);
    }
  }, [localValue]);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const element = contentRef.current;
      
      if (element && element.contains(range.commonAncestorContainer)) {
        // Упрощенный подсчет позиции
        const text = element.innerText;
        const beforeRange = range.cloneRange();
        beforeRange.selectNodeContents(element);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        
        const beforeText = beforeRange.toString();
        selectionRef.current = {
          start: beforeText.length,
          end: beforeText.length
        };
      }
    }
  }, []);

  const handleInput = useCallback((e) => {
    const element = contentRef.current;
    if (!element) return;

    console.log('📝 ContentEditable изменение');
    
    // Сохраняем позицию курсора и скролла
    saveSelection();
    scrollRef.current = element.scrollTop;
    
    // Получаем чистый текст (без HTML)
    const newText = element.innerText;
    setLocalValue(newText);
    
    // Вызываем внешний onChange
    onChange && onChange(newText);
  }, [onChange, saveSelection]);

  const handleScroll = (e) => {
    scrollRef.current = e.target.scrollTop;
  };

  const handlePaste = (e) => {
    // Предотвращаем вставку форматированного текста
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div>
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onScroll={handleScroll}
        onPaste={handlePaste}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className="contenteditable"
        style={{
          width: '100%',
          minHeight: '400px',
          maxHeight: '600px',
          overflow: 'auto',
          background: '#0a0a0a',
          color: '#e0e0e0',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '14px',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          outline: 'none'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        ⚠️ ContentEditable: медленнее textarea, но больше возможностей стилизации
      </div>
    </div>
  );
};

export default ContentEditableEditor;