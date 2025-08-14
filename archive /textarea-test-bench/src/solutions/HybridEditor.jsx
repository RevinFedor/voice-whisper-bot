import React, { useState, useRef, useLayoutEffect } from 'react';

// РЕШЕНИЕ 3: Гибридный подход с режимами View/Edit
const HybridEditor = ({ value, onChange }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textAreaRef = useRef(null);
  const viewRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Синхронизация с внешним value
  useLayoutEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  // Восстановление позиции при переключении в режим редактирования
  useLayoutEffect(() => {
    if (isEditMode && textAreaRef.current) {
      console.log('🔄 Переход в режим редактирования');
      const textArea = textAreaRef.current;
      
      // Фокусируемся на textarea
      textArea.focus();
      
      // Восстанавливаем позицию курсора
      textArea.setSelectionRange(cursor, cursor);
      
      // Восстанавливаем скролл
      textArea.scrollTop = scrollTop;
    }
  }, [isEditMode, cursor, scrollTop]);

  const handleEditClick = () => {
    // Сохраняем позицию скролла из view режима
    if (viewRef.current) {
      setScrollTop(viewRef.current.scrollTop);
    }
    setIsEditMode(true);
  };

  const handleSave = () => {
    console.log('💾 Сохранение и переход в режим просмотра');
    onChange && onChange(localValue);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    console.log('❌ Отмена изменений');
    setLocalValue(value);
    setIsEditMode(false);
  };

  const handleTextChange = (e) => {
    setCursor(e.target.selectionStart);
    setScrollTop(e.target.scrollTop);
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Ctrl+S для сохранения
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Escape для отмены
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditMode) {
    // VIEW MODE
    return (
      <div>
        <div style={{ marginBottom: '10px' }}>
          <button onClick={handleEditClick} style={{ marginRight: '10px' }}>
            ✏️ Редактировать
          </button>
          <span style={{ fontSize: '12px', color: '#666' }}>
            Режим просмотра - кликните для редактирования
          </span>
        </div>
        <div
          ref={viewRef}
          onClick={handleEditClick}
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
            cursor: 'pointer'
          }}
        >
          {localValue || <span style={{ color: '#666' }}>Кликните для добавления текста...</span>}
        </div>
      </div>
    );
  }

  // EDIT MODE
  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleSave} style={{ marginRight: '10px' }}>
          💾 Сохранить
        </button>
        <button onClick={handleCancel} className="secondary" style={{ marginRight: '10px' }}>
          ❌ Отменить
        </button>
        <span style={{ fontSize: '12px', color: '#666' }}>
          Режим редактирования - Ctrl+S для сохранения, Esc для отмены
        </span>
      </div>
      <textarea
        ref={textAreaRef}
        value={localValue}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '400px',
          background: '#0a0a0a',
          color: '#e0e0e0',
          border: '2px solid #2563eb',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '14px',
          fontFamily: 'monospace',
          resize: 'vertical',
          lineHeight: '1.5',
          outline: 'none'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        ✅ В режиме редактирования нет проблем со скроллом!
      </div>
    </div>
  );
};

export default HybridEditor;