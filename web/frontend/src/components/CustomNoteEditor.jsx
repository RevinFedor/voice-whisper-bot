import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useScrollPreservingTextarea } from '../hooks/useScrollPreservingTextarea';

/**
 * Редактор заметок с правильными оптимистичными обновлениями
 * Локальный state для мгновенного отображения + синхронизация с сервером
 */
const CustomNoteEditor = ({ 
  shape,
  editor,
  initialTitle = '',
  initialContent = '',
  dbId
}) => {
  // === ЛОКАЛЬНОЕ СОСТОЯНИЕ (для мгновенного отображения) ===
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState(initialContent);
  
  // === СЕРВЕРНОЕ СОСТОЯНИЕ (для отслеживания синхронизации) ===
  const [serverTitle, setServerTitle] = useState(initialTitle);
  const [serverContent, setServerContent] = useState(initialContent);
  
  // === СОСТОЯНИЕ РЕДАКТИРОВАНИЯ ===
  const [isEditing, setIsEditing] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isContentFocused, setIsContentFocused] = useState(false);
  
  // === СОСТОЯНИЕ СОХРАНЕНИЯ ===
  const [titleSaveStatus, setTitleSaveStatus] = useState('idle'); // idle | saving | success | error
  const [contentSaveStatus, setContentSaveStatus] = useState('idle');
  
  // === REFS ===
  const titleInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  
  // === ХУКИ ДЛЯ TEXTAREA ===
  const contentTextarea = useScrollPreservingTextarea();
  
  // Обновляем локальное состояние при изменении props
  useEffect(() => {
    setLocalTitle(initialTitle);
    setLocalContent(initialContent);
    setServerTitle(initialTitle);
    setServerContent(initialContent);
  }, [initialTitle, initialContent]);
  
  // Функция сохранения на сервер с оптимистичными обновлениями
  const saveToServer = useCallback(async (field, value) => {
    const statusSetter = field === 'title' ? setTitleSaveStatus : setContentSaveStatus;
    const serverSetter = field === 'title' ? setServerTitle : setServerContent;
    
    statusSetter('saving');
    
    try {
      const response = await fetch(`http://localhost:3001/api/notes/${dbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'user-id': 'test-user-id'
        },
        body: JSON.stringify({
          [field]: value
        })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      const updatedNote = await response.json();
      
      // Обновляем серверное состояние
      serverSetter(value);
      
      // Обновляем shape в tldraw после успешного сохранения
      if (editor && shape) {
        const richText = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: field === 'title' ? value : localTitle }]
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: field === 'content' ? value : localContent }]
            }
          ]
        };
        
        editor.updateShape({
          id: shape.id,
          type: 'custom-note',
          props: { richText }
        });
      }
      
      statusSetter('success');
      setTimeout(() => statusSetter('idle'), 500);
      
    } catch (error) {
      console.error('Save failed:', error);
      statusSetter('error');
      
      // При ошибке откатываем локальное состояние к серверному
      if (field === 'title') {
        setLocalTitle(serverTitle);
      } else {
        setLocalContent(serverContent);
      }
      
      setTimeout(() => statusSetter('idle'), 2000);
    }
  }, [dbId, editor, shape, localTitle, localContent, serverTitle, serverContent]);
  
  // Debounced автосохранение
  const debouncedSave = useCallback((field, value) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      // Сохраняем только если значение отличается от серверного
      const serverValue = field === 'title' ? serverTitle : serverContent;
      if (value !== serverValue) {
        saveToServer(field, value);
      }
    }, 1000);
  }, [serverTitle, serverContent, saveToServer]);
  
  // Обработчики изменений с оптимистичными обновлениями
  const handleTitleChange = (e) => {
    const newValue = e.target.value;
    setLocalTitle(newValue); // Мгновенное обновление UI
    debouncedSave('title', newValue); // Отложенное сохранение на сервер
  };
  
  const handleContentChange = (e) => {
    const newValue = e.target.value;
    setLocalContent(newValue); // Мгновенное обновление UI
    debouncedSave('content', newValue); // Отложенное сохранение на сервер
  };
  
  // Обработка фокуса/блюра
  const handleTitleBlur = () => {
    setIsTitleFocused(false);
    // Форсируем сохранение при потере фокуса
    if (localTitle !== serverTitle) {
      saveToServer('title', localTitle);
    }
  };
  
  const handleContentBlur = () => {
    setIsContentFocused(false);
    // Форсируем сохранение при потере фокуса
    if (localContent !== serverContent) {
      saveToServer('content', localContent);
    }
  };
  
  // Восстановление позиции для контента
  useLayoutEffect(() => {
    contentTextarea.restorePosition();
  }, [localContent, contentTextarea]);
  
  // Переключение в режим редактирования
  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 50);
  };
  
  // Закрытие редактора при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isEditing && containerRef.current && !containerRef.current.contains(e.target)) {
        setIsEditing(false);
        handleTitleBlur();
        handleContentBlur();
      }
    };
    
    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing]);
  
  // Режим просмотра
  if (!isEditing) {
    return (
      <div 
        ref={containerRef}
        onClick={startEditing}  // Изменено: одинарный клик вместо двойного
        style={{ cursor: 'pointer', width: '100%', height: '100%' }}
      >
        {/* Заголовок */}
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '8px',
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {localTitle || 'Без заголовка'}
        </div>
        
        {/* Превью текста */}
        <div style={{
          fontSize: '12px',
          color: '#888',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.4',
        }}>
          {localContent || 'Пустая заметка'}
        </div>
        
        {/* Подсказка */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          right: '5px',
          fontSize: '10px',
          color: '#555',
          opacity: 0.5
        }}>
          Клик для редактирования
        </div>
      </div>
    );
  }
  
  // Режим редактирования
  return (
    <div 
      ref={containerRef}
      style={{
        padding: '10px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {/* Индикаторы состояния */}
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '5px',
        display: 'flex',
        gap: '4px'
      }}>
        {/* Индикатор заголовка */}
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isTitleFocused ? '#ff9500' : 
                          titleSaveStatus === 'saving' ? '#ff9500' :
                          titleSaveStatus === 'success' ? '#30d158' :
                          titleSaveStatus === 'error' ? '#ff3b30' :
                          'transparent',
          animation: titleSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
        }} />
        
        {/* Индикатор контента */}
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isContentFocused ? '#ff9500' :
                          contentSaveStatus === 'saving' ? '#ff9500' :
                          contentSaveStatus === 'success' ? '#30d158' :
                          contentSaveStatus === 'error' ? '#ff3b30' :
                          'transparent',
          animation: contentSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
        }} />
      </div>
      
      {/* Заголовок */}
      <input
        ref={titleInputRef}
        type="text"
        value={localTitle}
        onChange={handleTitleChange}
        onFocus={() => setIsTitleFocused(true)}
        onBlur={handleTitleBlur}
        placeholder="Заголовок..."
        style={{
          width: '100%',
          padding: '4px',
          fontSize: '13px',
          fontWeight: '600',
          backgroundColor: '#222',
          color: '#fff',
          border: isTitleFocused ? '1px solid #ff9500' : '1px solid #444',
          borderRadius: '4px',
          outline: 'none',
        }}
      />
      
      {/* Контент */}
      <textarea
        ref={contentTextarea.textAreaRef}
        value={localContent}
        onChange={(e) => {
          contentTextarea.handlers.onChange(e);
          handleContentChange(e);
        }}
        onFocus={(e) => {
          contentTextarea.handlers.onFocus(e);
          setIsContentFocused(true);
        }}
        onBlur={handleContentBlur}
        onClick={contentTextarea.handlers.onClick}
        onScroll={contentTextarea.handlers.onScroll}
        onSelect={contentTextarea.handlers.onSelect}
        onKeyDown={(e) => contentTextarea.handlers.onKeyDown(e, localContent, setLocalContent)}
        placeholder="Содержимое..."
        style={{
          flex: 1,
          width: '100%',
          padding: '4px',
          fontSize: '11px',
          backgroundColor: '#222',
          color: '#e0e0e0',
          border: isContentFocused ? '1px solid #ff9500' : '1px solid #444',
          borderRadius: '4px',
          outline: 'none',
          resize: 'none',
          minHeight: '60px',
        }}
      />
      
      {/* Статус */}
      {(titleSaveStatus !== 'idle' || contentSaveStatus !== 'idle') && (
        <div style={{
          fontSize: '10px',
          color: titleSaveStatus === 'error' || contentSaveStatus === 'error' ? '#ff3b30' : '#666',
          textAlign: 'center'
        }}>
          {titleSaveStatus === 'error' || contentSaveStatus === 'error' 
            ? '❌ Ошибка сохранения'
            : titleSaveStatus === 'saving' || contentSaveStatus === 'saving'
            ? '💾 Сохранение...'
            : '✅ Сохранено'}
        </div>
      )}
    </div>
  );
};

// CSS для анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(style);

export default CustomNoteEditor;