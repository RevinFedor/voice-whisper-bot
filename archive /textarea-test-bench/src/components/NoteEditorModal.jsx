import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import './NoteEditorModal.css';

/**
 * Полноценный редактор заметок с фиксами всех проблем скролла и курсора
 * Готов для интеграции в основное приложение
 */
const NoteEditorModal = ({ 
  initialTitle = 'Новая заметка',
  initialContent = '',
  onSave,
  onClose 
}) => {
  // === СОСТОЯНИЕ ЗАГОЛОВКА ===
  const [title, setTitle] = useState(initialTitle);
  const [originalTitle] = useState(initialTitle); // Для отслеживания изменений
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [titleCursorPos, setTitleCursorPos] = useState(0);
  const [titleHeight, setTitleHeight] = useState(44); // Начальная высота
  
  // === СОСТОЯНИЕ КОНТЕНТА ===
  const [content, setContent] = useState(initialContent);
  const [originalContent] = useState(initialContent); // Для отслеживания изменений
  const [contentCursor, setContentCursor] = useState(0);
  const [contentScrollTop, setContentScrollTop] = useState(0);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  
  // === СОСТОЯНИЕ РЕДАКТИРОВАНИЯ И СОХРАНЕНИЯ ===
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isContentFocused, setIsContentFocused] = useState(false);
  const [titleSaveStatus, setTitleSaveStatus] = useState('idle'); // idle | saving | success
  const [contentSaveStatus, setContentSaveStatus] = useState('idle'); // idle | saving | success
  const [titleChanged, setTitleChanged] = useState(false);
  const [contentChanged, setContentChanged] = useState(false);
  const saveTimeoutRef = useRef(null);
  
  // === REFS ===
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(null);
  const modalRef = useRef(null);
  
  // === МОКОВЫЕ ДАННЫЕ ===
  const [titleHistory] = useState([
    { title: 'Текущий заголовок', time: 'текущий', current: true },
    { title: 'Архитектура системы заметок', time: '10:30', current: false },
    { title: 'Интеграция Telegram и Obsidian', time: '10:28', current: false },
    { title: 'Система управления контентом', time: '10:25', current: false }
  ]);

  // =====================================
  // АВТОСОХРАНЕНИЕ
  // =====================================
  
  const performSave = useCallback((type) => {
    // Сохраняем только измененные поля
    if (type === 'title' && titleChanged) {
      setTitleSaveStatus('saving');
      console.log('💾 Автосохранение заголовка...', { title });
      
      setTimeout(() => {
        onSave && onSave({ title, content });
        setTitleSaveStatus('success');
        setTitleChanged(false);
        
        setTimeout(() => {
          setTitleSaveStatus('idle');
        }, 500);
      }, 1000);
    } else if (type === 'content' && contentChanged) {
      setContentSaveStatus('saving');
      console.log('💾 Автосохранение контента...', { content });
      
      setTimeout(() => {
        onSave && onSave({ title, content });
        setContentSaveStatus('success');
        setContentChanged(false);
        
        setTimeout(() => {
          setContentSaveStatus('idle');
        }, 500);
      }, 1000);
    }
  }, [title, content, titleChanged, contentChanged, onSave]);
  
  // =====================================
  // ЛОГИКА ЗАГОЛОВКА (с сохранением позиции курсора)
  // =====================================
  
  // Валидация для Obsidian - убираем запрещенные символы
  const sanitizeForObsidian = (text) => {
    // Obsidian не позволяет эти символы в именах файлов
    return text.replace(/[\/\\:*?"<>|]/g, '');
  };
  
  // Auto-resize для textarea заголовка
  const adjustTitleHeight = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    const scrollHeight = element.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, 44), 120); // От 44px до 120px
    setTitleHeight(newHeight);
    element.style.height = newHeight + 'px';
    
    // Добавляем скролл если контент превышает максимальную высоту
    if (scrollHeight > 120) {
      element.style.overflowY = 'auto';
    } else {
      element.style.overflowY = 'hidden';
    }
  };
  
  const handleExpand = () => {
    if (!isExpanded && inputRef.current) {
      setTitleCursorPos(inputRef.current.selectionStart);
      // При раскрытии устанавливаем фокус на textarea
      setIsTitleFocused(true);
    } else {
      // При закрытии убираем фокус
      setIsTitleFocused(false);
    }
    setIsExpanded(!isExpanded);
    setShowHistory(false);
    setShowPrompt(false);
  };

  // Восстанавливаем позицию курсора после раскрытия
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(titleCursorPos, titleCursorPos);
      adjustTitleHeight(textareaRef.current);
    }
  }, [isExpanded, titleCursorPos]);
  
  // Закрытие раскрытого заголовка при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isExpanded && textareaRef.current && !textareaRef.current.contains(e.target)) {
        setIsExpanded(false);
        setIsTitleFocused(false);
        // Сбрасываем фокус с обычного input тоже
        if (inputRef.current) {
          inputRef.current.blur();
        }
        // Сохраняем если были изменения
        performSave('title');
      }
    };
    
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, performSave]);
  
  // Убираем фокус при клике вне всей модалки
  useEffect(() => {
    const handleClickOutsideModal = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        // Убираем фокус со всех полей
        if (inputRef.current) inputRef.current.blur();
        if (textareaRef.current) textareaRef.current.blur();
        if (contentRef.current) contentRef.current.blur();
        
        setIsTitleFocused(false);
        setIsContentFocused(false);
        setIsExpanded(false);
        
        // Сохраняем изменения
        if (titleChanged) performSave('title');
        if (contentChanged) performSave('content');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutsideModal);
    return () => document.removeEventListener('mousedown', handleClickOutsideModal);
  }, [titleChanged, contentChanged, performSave]);

  // Обработка заголовка с валидацией
  const handleTitleChange = (e) => {
    const newValue = sanitizeForObsidian(e.target.value);
    setTitle(newValue);
    // Отслеживаем изменения относительно оригинала
    setTitleChanged(newValue !== originalTitle);
    if (isExpanded) {
      adjustTitleHeight(e.target);
    }
  };

  // Обработка клавиш для заголовка
  const handleTitleKeyDown = (e) => {
    // Escape для сворачивания
    if (e.key === 'Escape' && isExpanded) {
      setIsExpanded(false);
      return;
    }
    
    // ЗАПРЕЩАЕМ Enter - заголовок не может иметь переносов строк
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log('⚠️ Enter запрещен в заголовке (Obsidian не поддерживает)');
      
      // Опционально: можно добавить пробел вместо Enter
      const pos = e.target.selectionStart;
      const newValue = title.slice(0, pos) + ' ' + title.slice(pos);
      const sanitizedValue = sanitizeForObsidian(newValue);
      setTitle(sanitizedValue);
      setTitleChanged(sanitizedValue !== originalTitle);
      
      // Устанавливаем курсор после пробела
      requestAnimationFrame(() => {
        e.target.setSelectionRange(pos + 1, pos + 1);
      });
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    setShowPrompt(false);
  };

  const togglePrompt = () => {
    setShowPrompt(!showPrompt);
    setShowHistory(false);
  };

  const useHistoryTitle = (historyItem) => {
    setTitle(historyItem.title);
    setShowHistory(false);
  };

  const applyPrompt = () => {
    const newTitles = [
      'Система управления заметками с AI',
      'Интеграция сервисов для заметок',
      'Проект: Notes Management System'
    ];
    setTitle(newTitles[Math.floor(Math.random() * newTitles.length)]);
    setPromptInput('');
    setShowPrompt(false);
  };

  // =====================================
  // ЛОГИКА КОНТЕНТА (все фиксы скролла)
  // =====================================
  
  // Восстановление позиции с защитой от циклов
  useLayoutEffect(() => {
    const textArea = contentRef.current;
    
    if (textArea && !isFirstInteraction && !isRestoringScroll) {
      const scrollDiff = Math.abs(textArea.scrollTop - contentScrollTop);
      
      if (scrollDiff > 10) {
        setIsRestoringScroll(true);
        
        textArea.setSelectionRange(contentCursor, contentCursor);
        textArea.scrollTop = contentScrollTop;
        
        requestAnimationFrame(() => {
          setIsRestoringScroll(false);
        });
      }
    }
  }, [content, contentCursor, contentScrollTop, isFirstInteraction, isRestoringScroll]);

  const handleContentChange = useCallback((e) => {
    const { selectionStart, scrollTop: currentScroll, value: newValue } = e.target;
    
    setContentCursor(selectionStart);
    setContentScrollTop(currentScroll);
    setContent(newValue);
    // Отслеживаем изменения относительно оригинала
    setContentChanged(newValue !== originalContent);
  }, [originalContent]);

  const handleContentClick = useCallback((e) => {
    if (isFirstInteraction) {
      requestAnimationFrame(() => {
        const realPosition = e.target.selectionStart;
        if (realPosition >= 0) {
          e.target.setSelectionRange(realPosition, realPosition);
          setContentCursor(realPosition);
          setContentScrollTop(e.target.scrollTop);
        }
      });
      setIsFirstInteraction(false);
    } else {
      setContentCursor(e.target.selectionStart);
      setContentScrollTop(e.target.scrollTop);
    }
  }, [isFirstInteraction]);

  const handleContentFocus = useCallback((e) => {
    if (isFirstInteraction) {
      setTimeout(() => {
        const currentPos = e.target.selectionStart;
        setContentCursor(currentPos);
        setContentScrollTop(e.target.scrollTop);
        setIsFirstInteraction(false);
      }, 0);
    }
  }, [isFirstInteraction]);

  const handleContentScroll = useCallback((e) => {
    if (!isRestoringScroll) {
      setContentScrollTop(e.target.scrollTop);
    }
  }, [isRestoringScroll]);

  const handleContentSelect = useCallback((e) => {
    setContentCursor(e.target.selectionStart);
  }, []);

  const handleContentKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const pos = e.target.selectionStart;
      const currentScrollTop = e.target.scrollTop;
      const newValue = content.slice(0, pos) + '\n' + content.slice(pos);
      
      if (isFirstInteraction) {
        setIsFirstInteraction(false);
      }
      
      setContent(newValue);
      
      requestAnimationFrame(() => {
        e.target.setSelectionRange(pos + 1, pos + 1);
        e.target.scrollTop = currentScrollTop;
        setContentCursor(pos + 1);
        setContentScrollTop(currentScrollTop);
      });
    }
  }, [content, isFirstInteraction]);

  // =====================================
  // РЕНДЕР
  // =====================================
  
  return (
    <div ref={modalRef} className="note-editor-modal" style={{ 
      width: '100%',
      maxWidth: '768px',
      borderRadius: '8px',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0'
    }}>
      {/* Заголовок компонента */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px',
        borderBottom: '1px solid #333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>✏️</span>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'white', margin: 0 }}>
            Редактирование заметки
          </h2>
        </div>
        <button 
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            backgroundColor: '#2a2a2a',
            color: '#888',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {/* ЗАГОЛОВОК */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            {/* Индикатор состояния */}
            <div style={{
              position: 'absolute',
              left: '-20px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isTitleFocused ? '#ff9500' : 
                              titleSaveStatus === 'saving' ? '#ff9500' : 
                              titleSaveStatus === 'success' ? '#30d158' : 
                              'transparent',
              animation: titleSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
              transition: 'all 0.3s ease'
            }} />
            
            <label style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#666'
            }}>
              Заголовок
            </label>
          </div>
          
          <div style={{ position: 'relative' }}>
            {/* Input с кнопками */}
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              visibility: isExpanded ? 'hidden' : 'visible' 
            }}>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={handleTitleChange}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => {
                  setIsTitleFocused(false);
                  performSave('title');
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="Заголовок заметки (без спецсимволов)"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  color: 'white',
                  backgroundColor: '#222',
                  border: isTitleFocused ? '2px solid #ff9500' : '1px solid #444',
                  boxShadow: isTitleFocused ? '0 0 8px rgba(255, 149, 0, 0.2)' : 'none',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
              
              {/* Кнопки действий */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {/* История */}
                <button
                  onClick={toggleHistory}
                  style={{
                    width: '40px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    backgroundColor: showHistory ? '#22aa44' : '#2a2a2a',
                    border: showHistory ? '1px solid #22aa44' : '1px solid #444',
                    color: showHistory ? 'white' : '#888',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                  title="История генераций"
                >
                  📜
                </button>
                
                {/* AI чат */}
                <button
                  onClick={togglePrompt}
                  style={{
                    width: '40px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    backgroundColor: showPrompt ? '#22aa44' : '#2a2a2a',
                    border: showPrompt ? '1px solid #22aa44' : '1px solid #444',
                    color: showPrompt ? 'white' : '#888',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                  title="Спросить у AI"
                >
                  ✨
                </button>
                
                {/* Раскрыть */}
                <button
                  onClick={handleExpand}
                  style={{
                    width: '40px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #444',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                  title="Развернуть"
                >
                  ↕
                </button>
              </div>
            </div>
            
            {/* История генераций */}
            {showHistory && !isExpanded && (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '8px',
                maxHeight: '144px',
                overflowY: 'auto',
                backgroundColor: '#181818',
                border: '1px solid #333'
              }}>
                {titleHistory.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => useHistoryTitle(item)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      marginBottom: '6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: '#222',
                      border: item.current ? '1px solid #22aa44' : '1px solid transparent'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '14px' }}>{item.title}</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>{item.time}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Промпт панель */}
            {showPrompt && !isExpanded && (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                border: '1px solid #333'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyPrompt()}
                    placeholder="Сделай заголовок в стиле..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '14px',
                      backgroundColor: '#222',
                      border: '1px solid #444',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={applyPrompt}
                    style={{
                      padding: '8px 16px',
                      color: 'white',
                      fontSize: '14px',
                      borderRadius: '4px',
                      backgroundColor: '#22aa44',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Применить
                  </button>
                </div>
              </div>
            )}
            
            {/* Textarea для expanded режима */}
            {isExpanded && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                left: '-8px',
                right: '-8px',
                zIndex: 10
              }}>
                <textarea
                  ref={textareaRef}
                  className="title-textarea"
                  value={title}
                  onChange={handleTitleChange}
                  onFocus={() => setIsTitleFocused(true)}
                  onBlur={() => {
                    // Обработка blur простая, так как клик вне уже обрабатывается в handleClickOutside
                    // Это сработает только при Tab или программном blur
                    setIsTitleFocused(false);
                    performSave('title');
                  }}
                  onKeyDown={handleTitleKeyDown}
                  style={{
                    width: '100%',
                    height: `${titleHeight}px`,
                    minHeight: '44px',
                    maxHeight: '120px',
                    padding: '12px',
                    borderRadius: '8px',
                    color: 'white',
                    resize: 'none',
                    backgroundColor: '#222',
                    border: '2px solid #ff9500',
                    boxShadow: '0 0 12px rgba(255, 149, 0, 0.2)',
                    fontSize: '14px',
                    outline: 'none',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#444 #222'
                  }}
                  placeholder="Esc - свернуть | Enter - пробел | Спецсимволы удаляются"
                />
                {/* Подсказка под textarea */}
                <div style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: '#666',
                  textAlign: 'right'
                }}>
                  {title.length} символов | Для Obsidian: / \ : * ? " &lt; &gt; | запрещены
                </div>
              </div>
            )}
          </div>
        </div>

        {/* СОДЕРЖИМОЕ */}
        <div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            {/* Индикатор состояния */}
            <div style={{
              position: 'absolute',
              left: '-20px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isContentFocused ? '#ff9500' : 
                              contentSaveStatus === 'saving' ? '#ff9500' : 
                              contentSaveStatus === 'success' ? '#30d158' : 
                              'transparent',
              animation: contentSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
              transition: 'all 0.3s ease'
            }} />
            
            <label style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#666'
            }}>
              Содержимое
            </label>
          </div>
          <textarea
            ref={contentRef}
            value={content}
            onChange={handleContentChange}
            onClick={handleContentClick}
            onFocus={(e) => {
              handleContentFocus(e);
              setIsContentFocused(true);
            }}
            onBlur={() => {
              setIsContentFocused(false);
              performSave('content');
            }}
            onScroll={handleContentScroll}
            onSelect={handleContentSelect}
            onKeyDown={handleContentKeyDown}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '8px',
              color: 'white',
              backgroundColor: '#222',
              border: isContentFocused ? '2px solid #ff9500' : '1px solid #444',
              boxShadow: isContentFocused ? '0 0 12px rgba(255, 149, 0, 0.2)' : 'none',
              fontSize: '14px',
              minHeight: '300px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.5',
              transition: 'all 0.2s ease'
            }}
            rows={12}
            placeholder="Содержимое заметки..."
          />
        </div>

        {/* Статус сохранения */}
        {(titleSaveStatus !== 'idle' || contentSaveStatus !== 'idle') && (
          <div style={{
            marginTop: '16px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            {titleSaveStatus !== 'idle' && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: titleSaveStatus === 'saving' ? '#ff95001a' : '#30d1581a',
                border: `1px solid ${titleSaveStatus === 'saving' ? '#ff950033' : '#30d15833'}`,
                color: titleSaveStatus === 'saving' ? '#ff9500' : '#30d158',
                fontSize: '12px',
                transition: 'all 0.3s ease'
              }}>
                {titleSaveStatus === 'saving' ? '💾 Сохранение заголовка...' : '✅ Заголовок сохранен'}
              </div>
            )}
            {contentSaveStatus !== 'idle' && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: contentSaveStatus === 'saving' ? '#ff95001a' : '#30d1581a',
                border: `1px solid ${contentSaveStatus === 'saving' ? '#ff950033' : '#30d15833'}`,
                color: contentSaveStatus === 'saving' ? '#ff9500' : '#30d158',
                fontSize: '12px',
                transition: 'all 0.3s ease'
              }}>
                {contentSaveStatus === 'saving' ? '💾 Сохранение контента...' : '✅ Контент сохранен'}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default NoteEditorModal;