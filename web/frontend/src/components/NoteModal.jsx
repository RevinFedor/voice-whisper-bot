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
    
    // === СОСТОЯНИЕ UI ===
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [titleCursorPos, setTitleCursorPos] = useState(0);
    const [titleHeight, setTitleHeight] = useState(44);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newlyGeneratedId, setNewlyGeneratedId] = useState(null);
    
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
    const prevNoteIdRef = useRef(note?.id); // Для отслеживания смены заметки
    
    // === ХУКИ ДЛЯ TEXTAREA ===
    const contentTextarea = useScrollPreservingTextarea();
    
    // === ИСТОРИЯ ЗАГОЛОВКОВ ===
    const [titleHistory, setTitleHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Обновляем локальное состояние при изменении заметки
    useEffect(() => {
        // Если это та же заметка (только обновился заголовок/контент), не сбрасываем UI состояния
        if (prevNoteIdRef.current === note?.id && note?.id) {
            setLocalTitle(note.title || '');
            setLocalContent(note.content || '');
            setServerTitle(note.title || '');
            setServerContent(note.content || '');
            setTitleChanged(false);
            setContentChanged(false);
        } else {
            // Если заметка сменилась, сбрасываем все
            setLocalTitle(note.title || '');
            setLocalContent(note.content || '');
            setServerTitle(note.title || '');
            setServerContent(note.content || '');
            setTitleChanged(false);
            setContentChanged(false);
            // Сбрасываем историю при смене заметки
            setTitleHistory([]);
            setShowHistory(false);
            setShowPrompt(false);
            prevNoteIdRef.current = note?.id;
        }
    }, [note]);
    
    // Загрузка истории заголовков
    const loadTitleHistory = useCallback(async () => {
        if (!note?.id) return;
        
        setHistoryLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/ai-titles/history/${note.id}`, {
                headers: {
                    'user-id': 'test-user-id'
                }
            });
            
            if (response.ok) {
                const history = await response.json();
                setTitleHistory(history);
            }
        } catch (error) {
            console.error('Failed to load title history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, [note?.id]);
    
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
            // Но не вызываем если значение не изменилось (чтобы избежать лишних рендеров)
            if (onNoteUpdate && updatedNote[field] !== note[field]) {
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
            // Не устанавливаем фокус здесь - textarea сам установит при фокусе
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
            setIsTitleFocused(true); // Устанавливаем фокус для раскрытого textarea
        }
    }, [isExpanded, titleCursorPos]);
    
    // Закрытие раскрытого заголовка при клике вне
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isExpanded && textareaRef.current && !textareaRef.current.contains(e.target)) {
                setIsExpanded(false);
                setIsTitleFocused(false);
                // Не вызываем blur на скрытом input - он и так скрыт
                // Сохраняем при закрытии раскрывающегося заголовка
                if (localTitle !== serverTitle) {
                    saveToServer('title', localTitle);
                }
            }
        };
        
        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isExpanded, saveToServer, localTitle, serverTitle]);
    
    // === ОБРАБОТЧИКИ ===
    const handleTitleChange = (e) => {
        const newValue = sanitizeForObsidian(e.target.value);
        setLocalTitle(newValue);
        setTitleChanged(newValue !== serverTitle);
        // Убираем автосохранение - сохраняем только на blur
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
            setTitleChanged(sanitizedValue !== serverTitle);
            
            requestAnimationFrame(() => {
                e.target.setSelectionRange(pos + 1, pos + 1);
            });
        }
    };
    
    const handleContentChange = (e) => {
        const newValue = e.target.value;
        setLocalContent(newValue);
        setContentChanged(newValue !== serverContent);
        // Убираем автосохранение - сохраняем только на blur
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
    
    // === AI ГЕНЕРАЦИЯ ===
    const generateAITitle = useCallback(async (customPrompt = null) => {
        if (!note?.id || isGenerating) return;
        
        setIsGenerating(true);
        
        // Сохраняем текущий заголовок в историю если он не пустой
        if (localTitle && localTitle.trim()) {
            try {
                await fetch(`http://localhost:3001/api/ai-titles/save-current/${note.id}`, {
                    method: 'POST',
                    headers: {
                        'user-id': 'test-user-id'
                    }
                });
            } catch (error) {
                console.error('Failed to save current title:', error);
            }
        }
        
        try {
            const response = await fetch('http://localhost:3001/api/ai-titles/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id'
                },
                body: JSON.stringify({
                    noteId: note.id,
                    prompt: customPrompt
                })
            });
            
            if (response.ok) {
                const generatedTitle = await response.json();
                
                // Закрываем панель промпта и сворачиваем заголовок если он раскрыт
                setShowPrompt(false);
                setPromptInput('');
                setIsExpanded(false); // Важно: сворачиваем заголовок чтобы была видна история
                
                // Обновляем локальный заголовок сразу
                setLocalTitle(generatedTitle.title);
                setServerTitle(generatedTitle.title);
                setTitleChanged(false);
                
                // Загружаем обновленную историю
                await loadTitleHistory();
                
                // ВАЖНО: Открываем вкладку истории с анимацией
                setShowHistory(true);
                setNewlyGeneratedId(generatedTitle.id);
                
                // Убираем подсветку через 1 секунду
                setTimeout(() => {
                    setNewlyGeneratedId(null);
                }, 1000);
                
                // Вызываем callback обновления если есть
                if (onNoteUpdate) {
                    onNoteUpdate({ ...note, title: generatedTitle.title });
                }
            }
        } catch (error) {
            console.error('Failed to generate title:', error);
        } finally {
            setIsGenerating(false);
        }
    }, [note, localTitle, serverTitle, isGenerating, loadTitleHistory, onNoteUpdate]);
    
    const toggleHistory = async () => {
        const newShowHistory = !showHistory;
        setShowHistory(newShowHistory);
        setShowPrompt(false);
        
        // Загружаем историю при открытии
        if (newShowHistory && titleHistory.length === 0) {
            await loadTitleHistory();
        }
    };
    
    const togglePrompt = () => {
        setShowPrompt(!showPrompt);
        setShowHistory(false);
    };
    
    const useHistoryTitle = (historyItem) => {
        setLocalTitle(historyItem.title);
        setTitleChanged(historyItem.title !== serverTitle);
        // НЕ закрываем историю согласно требованиям
        // Сохраняем при выборе из истории
        if (historyItem.title !== serverTitle) {
            saveToServer('title', historyItem.title);
        }
    };
    
    const deleteFromHistory = async (historyId, e) => {
        e.stopPropagation(); // Предотвращаем выбор элемента
        
        try {
            const response = await fetch(`http://localhost:3001/api/ai-titles/history/${historyId}`, {
                method: 'DELETE',
                headers: {
                    'user-id': 'test-user-id'
                }
            });
            
            if (response.ok) {
                // Удаляем из локального состояния с анимацией
                setTitleHistory(prev => prev.filter(item => item.id !== historyId));
            }
        } catch (error) {
            console.error('Failed to delete from history:', error);
        }
    };
    
    const applyPrompt = () => {
        if (promptInput.trim()) {
            generateAITitle(promptInput.trim());
        } else {
            // Default prompt
            generateAITitle();
        }
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
                overflow: 'auto'
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
                    overflowY: 'visible',
                    color: '#e0e0e0',
                    display: 'flex',
                    flexDirection: 'column'
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
                                    onFocus={() => !isExpanded && setIsTitleFocused(true)}
                                    onBlur={() => !isExpanded && handleTitleBlur()}
                                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    placeholder="Заголовок заметки (без спецсимволов)"
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        color: 'white',
                                        backgroundColor: '#222',
                                        // Не показываем оранжевую рамку когда input скрыт
                                        border: isTitleFocused && !isExpanded ? '2px solid #ff9500' : '1px solid #444',
                                        boxShadow: isTitleFocused && !isExpanded ? '0 0 8px rgba(255, 149, 0, 0.2)' : 'none',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box'
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
                                    maxHeight: '250px',
                                    overflowY: 'auto',
                                    backgroundColor: '#181818',
                                    border: '1px solid #333'
                                }}>
                                    {historyLoading ? (
                                        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                            Загрузка...
                                        </div>
                                    ) : titleHistory.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                            История пуста. Сгенерируйте первые варианты!
                                        </div>
                                    ) : (
                                        titleHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => useHistoryTitle(item)}
                                                onMouseEnter={(e) => e.currentTarget.querySelector('.delete-btn').style.opacity = '1'}
                                                onMouseLeave={(e) => e.currentTarget.querySelector('.delete-btn').style.opacity = '0'}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    marginBottom: '6px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    backgroundColor: newlyGeneratedId === item.id ? '#1a3d1a' : '#222',
                                                    border: newlyGeneratedId === item.id ? '1px solid #22aa44' : '1px solid transparent',
                                                    transition: 'all 0.3s ease',
                                                    animation: newlyGeneratedId === item.id ? 'fadeIn 0.3s ease' : 'none',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: '14px' }}>
                                                        {item.type === 'ai' ? '✨' : '✋'}
                                                    </span>
                                                    <span 
                                                        style={{ 
                                                            color: 'white', 
                                                            fontSize: '14px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1
                                                        }}
                                                        title={item.title.length > 40 ? item.title : undefined}
                                                    >
                                                        {item.title}
                                                    </span>
                                                </div>
                                                <button
                                                    className="delete-btn"
                                                    onClick={(e) => deleteFromHistory(item.id, e)}
                                                    style={{
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#ff4444',
                                                        fontSize: '20px',
                                                        cursor: 'pointer',
                                                        padding: '4px 8px',
                                                        marginLeft: '8px',
                                                        lineHeight: '1',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))
                                    )}
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
                                            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && applyPrompt()}
                                            placeholder="Опишите стиль заголовка..."
                                            disabled={isGenerating}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: '4px',
                                                color: 'white',
                                                fontSize: '14px',
                                                backgroundColor: '#222',
                                                border: '1px solid #444',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                opacity: isGenerating ? 0.5 : 1
                                            }}
                                        />
                                        <button
                                            onClick={applyPrompt}
                                            disabled={isGenerating}
                                            style={{
                                                padding: '8px 16px',
                                                color: 'white',
                                                fontSize: '14px',
                                                borderRadius: '4px',
                                                backgroundColor: promptInput.trim() ? '#22aa44' : '#666',
                                                border: 'none',
                                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                                opacity: isGenerating ? 0.5 : 1,
                                                minWidth: '100px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                            title={!promptInput.trim() ? 'Использовать стандартную генерацию' : undefined}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: '12px',
                                                        height: '12px',
                                                        border: '2px solid #ffffff30',
                                                        borderTopColor: 'white',
                                                        borderRadius: '50%',
                                                        animation: 'spin 0.6s linear infinite'
                                                    }}></span>
                                                    <span>Генерирую...</span>
                                                </>
                                            ) : (
                                                <span>{promptInput.trim() ? 'Применить' : 'Default'}</span>
                                            )}
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
                                            if (localTitle !== serverTitle) {
                                                saveToServer('title', localTitle);
                                            }
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
                                            scrollbarColor: '#444 #222',
                                            boxSizing: 'border-box'
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                // Сначала обновляем позицию через хук
                                contentTextarea.handlers.onChange(e);
                                // Затем обновляем состояние и триггерим сохранение
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
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const pos = e.target.selectionStart;
                                    const newValue = localContent.slice(0, pos) + '\n' + localContent.slice(pos);
                                    // Используем handleContentChange для правильного обновления всех состояний
                                    handleContentChange({ target: { value: newValue }});
                                    
                                    requestAnimationFrame(() => {
                                        e.target.setSelectionRange(pos + 1, pos + 1);
                                        e.target.scrollTop = e.target.scrollTop;
                                    });
                                } else {
                                    contentTextarea.handlers.onKeyDown(e, localContent, setLocalContent);
                                }
                            }}
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
                                resize: 'none',
                                outline: 'none',
                                lineHeight: '1.5',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
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
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
                
                .delete-btn {
                    transition: opacity 0.2s ease;
                }
                
                /* Скроллбар для истории */
                div::-webkit-scrollbar {
                    width: 6px;
                }
                
                div::-webkit-scrollbar-track {
                    background: #1a1a1a;
                    border-radius: 3px;
                }
                
                div::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 3px;
                }
                
                div::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}</style>
        </>
    );
};

export default NoteModal;