import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useScrollPreservingTextarea } from '../hooks/useScrollPreservingTextarea';

const NoteModal = ({ isOpen, onClose, note, onNoteUpdate }) => {
    if (!isOpen || !note) return null;
    
    // === ЛОКАЛЬНОЕ СОСТОЯНИЕ (для мгновенного UI) ===
    const [localTitle, setLocalTitle] = useState(note.title || '');
    const [localContent, setLocalContent] = useState(note.content || '');
    
    // === СЕРВЕРНОЕ СОСТОЯНИЕ (для отслеживания синхронизации) ===
    const [serverTitle, setServerTitle] = useState(note.title || '');
    const [serverContent, setServerContent] = useState(note.content || '');
    const [originalTitle] = useState(note.title || '');
    const [originalContent] = useState(note.content || '');
    
    // === СОСТОЯНИЕ UI ===
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [titleCursorPos, setTitleCursorPos] = useState(0);
    const [titleHeight, setTitleHeight] = useState(44);
    
    // === СОСТОЯНИЕ ФОКУСА ===
    const [isTitleFocused, setIsTitleFocused] = useState(false);
    const [isContentFocused, setIsContentFocused] = useState(false);
    
    // === СОСТОЯНИЕ СОХРАНЕНИЯ ===
    const [titleSaveStatus, setTitleSaveStatus] = useState('idle'); // idle | saving | success | error
    const [contentSaveStatus, setContentSaveStatus] = useState('idle');
    const [titleChanged, setTitleChanged] = useState(false);
    const [contentChanged, setContentChanged] = useState(false);
    
    // === REFS ===
    const inputRef = useRef(null);
    const textareaRef = useRef(null);
    const modalRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    
    // === ХУКИ ДЛЯ TEXTAREA ===
    const contentTextarea = useScrollPreservingTextarea();
    
    // === МОКОВЫЕ ДАННЫЕ ДЛЯ ИСТОРИИ ===
    const [titleHistory] = useState([
        { title: localTitle || 'Текущий заголовок', time: 'текущий', current: true },
        { title: 'Архитектура системы заметок', time: '10:30', current: false },
        { title: 'Интеграция Telegram и Obsidian', time: '10:28', current: false },
        { title: 'Система управления контентом', time: '10:25', current: false }
    ]);
    
    // Обновляем локальное состояние при изменении заметки
    useEffect(() => {
        setLocalTitle(note.title || '');
        setLocalContent(note.content || '');
        setServerTitle(note.title || '');
        setServerContent(note.content || '');
    }, [note]);
    
    // === ОПТИМИСТИЧНЫЕ ОБНОВЛЕНИЯ ===
    const saveToServer = useCallback(async (field, value) => {
        const statusSetter = field === 'title' ? setTitleSaveStatus : setContentSaveStatus;
        const serverSetter = field === 'title' ? setServerTitle : setServerContent;
        
        statusSetter('saving');
        
        try {
            const response = await fetch(`http://localhost:3001/api/notes/${note.id}`, {
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
            
            // Сбрасываем флаг изменений
            if (field === 'title') setTitleChanged(false);
            else setContentChanged(false);
            
            // Вызываем callback для обновления списка заметок
            if (onNoteUpdate) {
                onNoteUpdate(updatedNote);
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
    }, [note, serverTitle, serverContent, onNoteUpdate]);
    
    // Автосохранение с debouncing
    const performSave = useCallback((type) => {
        if (type === 'title' && titleChanged) {
            saveToServer('title', localTitle);
        } else if (type === 'content' && contentChanged) {
            saveToServer('content', localContent);
        }
    }, [localTitle, localContent, titleChanged, contentChanged, saveToServer]);
    
    // Debounced автосохранение
    const debouncedSave = useCallback((field, value) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
            const serverValue = field === 'title' ? serverTitle : serverContent;
            if (value !== serverValue) {
                saveToServer(field, value);
            }
        }, 1000);
    }, [serverTitle, serverContent, saveToServer]);
    
    // === ЛОГИКА ЗАГОЛОВКА ===
    
    // Валидация для Obsidian
    const sanitizeForObsidian = (text) => {
        return text.replace(/[\/\\:*?"<>|]/g, '');
    };
    
    // Auto-resize для textarea заголовка
    const adjustTitleHeight = (element) => {
        if (!element) return;
        element.style.height = 'auto';
        const scrollHeight = element.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 44), 120);
        setTitleHeight(newHeight);
        element.style.height = newHeight + 'px';
        
        if (scrollHeight > 120) {
            element.style.overflowY = 'auto';
        } else {
            element.style.overflowY = 'hidden';
        }
    };
    
    const handleExpand = () => {
        if (!isExpanded && inputRef.current) {
            setTitleCursorPos(inputRef.current.selectionStart);
            setIsTitleFocused(true);
        } else {
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
                if (inputRef.current) {
                    inputRef.current.blur();
                }
                performSave('title');
            }
        };
        
        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isExpanded, performSave]);
    
    // === ОБРАБОТЧИКИ ===
    const handleTitleChange = (e) => {
        const newValue = sanitizeForObsidian(e.target.value);
        setLocalTitle(newValue);
        setTitleChanged(newValue !== originalTitle);
        debouncedSave('title', newValue);
        if (isExpanded) {
            adjustTitleHeight(e.target);
        }
    };
    
    const handleTitleKeyDown = (e) => {
        if (e.key === 'Escape' && isExpanded) {
            setIsExpanded(false);
            return;
        }
        
        if (e.key === 'Enter') {
            e.preventDefault();
            const pos = e.target.selectionStart;
            const newValue = localTitle.slice(0, pos) + ' ' + localTitle.slice(pos);
            const sanitizedValue = sanitizeForObsidian(newValue);
            setLocalTitle(sanitizedValue);
            setTitleChanged(sanitizedValue !== originalTitle);
            
            requestAnimationFrame(() => {
                e.target.setSelectionRange(pos + 1, pos + 1);
            });
        }
    };
    
    const handleContentChange = (e) => {
        const newValue = e.target.value;
        setLocalContent(newValue);
        setContentChanged(newValue !== originalContent);
        debouncedSave('content', newValue);
    };
    
    const handleTitleBlur = () => {
        setIsTitleFocused(false);
        if (localTitle !== serverTitle) {
            saveToServer('title', localTitle);
        }
    };
    
    const handleContentBlur = () => {
        setIsContentFocused(false);
        if (localContent !== serverContent) {
            saveToServer('content', localContent);
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
        setLocalTitle(historyItem.title);
        setTitleChanged(historyItem.title !== originalTitle);
        setShowHistory(false);
        debouncedSave('title', historyItem.title);
    };
    
    const applyPrompt = () => {
        const newTitles = [
            'Система управления заметками с AI',
            'Интеграция сервисов для заметок',
            'Проект: Notes Management System'
        ];
        const newTitle = newTitles[Math.floor(Math.random() * newTitles.length)];
        setLocalTitle(newTitle);
        setTitleChanged(newTitle !== originalTitle);
        setPromptInput('');
        setShowPrompt(false);
        debouncedSave('title', newTitle);
    };
    
    // Восстановление позиции для контента
    useLayoutEffect(() => {
        contentTextarea.restorePosition();
    }, [localContent, contentTextarea]);
    
    // Format dates for display
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };
    
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Get type icon
    const getTypeIcon = (type) => {
        const icons = {
            voice: '🎙️',
            text: '📝',
            collection: '📚'
        };
        return icons[type] || '📝';
    };
    
    // Get type label
    const getTypeLabel = (type) => {
        const labels = {
            voice: 'Голосовая заметка',
            text: 'Текстовая заметка',
            collection: 'Коллекция'
        };
        return labels[type] || 'Заметка';
    };
    
    return (
        <>
            {/* Backdrop */}
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 9998,
                    cursor: 'pointer'
                }}
                onClick={onClose}
            />
            
            {/* Modal */}
            <div ref={modalRef} style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                maxWidth: '800px',
                maxHeight: '80vh',
                backgroundColor: '#1a1a1a',
                borderRadius: '16px',
                border: '1px solid #333',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>
                            {getTypeIcon(note.type)}
                        </span>
                        <span style={{
                            color: '#888',
                            fontSize: '14px',
                            padding: '4px 12px',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '12px'
                        }}>
                            {getTypeLabel(note.type)}
                        </span>
                        {note.manuallyPositioned && (
                            <span style={{
                                fontSize: '16px',
                                color: '#ff9500',
                                title: 'Перемещена вручную'
                            }}>
                                📍
                            </span>
                        )}
                    </div>
                    
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: '1',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#fff'}
                        onMouseLeave={(e) => e.target.style.color = '#666'}
                    >
                        ×
                    </button>
                </div>
                
                {/* Content */}
                <div style={{
                    flex: 1,
                    padding: '24px 32px',
                    overflowY: 'auto',
                    color: '#e0e0e0'
                }}>
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
                                    value={localTitle}
                                    onChange={handleTitleChange}
                                    onFocus={() => setIsTitleFocused(true)}
                                    onBlur={handleTitleBlur}
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
                                        value={localTitle}
                                        onChange={handleTitleChange}
                                        onFocus={() => setIsTitleFocused(true)}
                                        onBlur={() => {
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
                                        {localTitle.length} символов | Для Obsidian: / \ : * ? " &lt; &gt; | запрещены
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
                    
                    {/* Voice duration */}
                    {note.type === 'voice' && note.voiceDuration && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ fontSize: '14px' }}>⏱️</span>
                            <span style={{ fontSize: '14px', color: '#888' }}>
                                Длительность: {Math.floor(note.voiceDuration / 60)}:{(note.voiceDuration % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    
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
                                    backgroundColor: titleSaveStatus === 'saving' ? '#ff95001a' : 
                                                   titleSaveStatus === 'success' ? '#30d1581a' : '#ff3b301a',
                                    border: `1px solid ${titleSaveStatus === 'saving' ? '#ff950033' : 
                                                        titleSaveStatus === 'success' ? '#30d15833' : '#ff3b3033'}`,
                                    color: titleSaveStatus === 'saving' ? '#ff9500' : 
                                          titleSaveStatus === 'success' ? '#30d158' : '#ff3b30',
                                    fontSize: '12px',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {titleSaveStatus === 'saving' ? '💾 Сохранение заголовка...' : 
                                     titleSaveStatus === 'success' ? '✅ Заголовок сохранен' : '❌ Ошибка сохранения'}
                                </div>
                            )}
                            {contentSaveStatus !== 'idle' && (
                                <div style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: contentSaveStatus === 'saving' ? '#ff95001a' : 
                                                   contentSaveStatus === 'success' ? '#30d1581a' : '#ff3b301a',
                                    border: `1px solid ${contentSaveStatus === 'saving' ? '#ff950033' : 
                                                        contentSaveStatus === 'success' ? '#30d15833' : '#ff3b3033'}`,
                                    color: contentSaveStatus === 'saving' ? '#ff9500' : 
                                          contentSaveStatus === 'success' ? '#30d158' : '#ff3b30',
                                    fontSize: '12px',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {contentSaveStatus === 'saving' ? '💾 Сохранение контента...' : 
                                     contentSaveStatus === 'success' ? '✅ Контент сохранен' : '❌ Ошибка сохранения'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Metadata Footer */}
                <div style={{
                    padding: '16px 32px',
                    borderTop: '1px solid #2a2a2a',
                    backgroundColor: '#161616',
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '20px'
                }}>
                    <div>
                        <span style={{ color: '#555' }}>ID:</span>{' '}
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                            {note.id}
                        </span>
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Дата:</span>{' '}
                        {formatDate(note.date)}
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Создано:</span>{' '}
                        {formatDateTime(note.createdAt)}
                    </div>
                    {note.updatedAt && note.updatedAt !== note.createdAt && (
                        <div>
                            <span style={{ color: '#555' }}>Обновлено:</span>{' '}
                            {formatDateTime(note.updatedAt)}
                        </div>
                    )}
                    <div>
                        <span style={{ color: '#555' }}>Позиция:</span>{' '}
                        ({Math.round(note.x)}, {Math.round(note.y)})
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Перемещена:</span>{' '}
                        <span style={{ color: note.manuallyPositioned ? '#ff9500' : '#666' }}>
                            {note.manuallyPositioned ? 'Да' : 'Нет'}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* CSS для анимации */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </>
    );
};

export default NoteModal;