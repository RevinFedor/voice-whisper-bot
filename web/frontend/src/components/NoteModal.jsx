import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useScrollPreservingTextarea } from '../hooks/useScrollPreservingTextarea';
import { useModalEscape, MODAL_PRIORITIES } from '../contexts/ModalStackContext';
import obsidianIcon from '../assets/obsidian-icon.svg';

const NoteModal = ({ isOpen, onClose, note, onNoteUpdate, onExportSuccess }) => {
    // Уникальный ID для этого экземпляра модалки
    const modalId = useRef(`note-modal-${Date.now()}`).current;
    
    // === ЛОКАЛЬНОЕ СОСТОЯНИЕ (для мгновенного UI) ===
    const [localTitle, setLocalTitle] = useState(note?.title || '');
    const [localContent, setLocalContent] = useState(note?.content || '');
    
    // === СЕРВЕРНОЕ СОСТОЯНИЕ (для отслеживания синхронизации) ===
    const [serverTitle, setServerTitle] = useState(note?.title || '');
    const [serverContent, setServerContent] = useState(note?.content || '');
    
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
    
    // === СОСТОЯНИЕ ТЕГОВ ===
    const [localTags, setLocalTags] = useState(note?.tags || []);
    const [aiSuggestions, setAiSuggestions] = useState(note?.aiSuggestedTags || []);
    const [showTagChat, setShowTagChat] = useState(false);
    const [showTagHistory, setShowTagHistory] = useState(false);
    const [tagPromptInput, setTagPromptInput] = useState('');
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);
    const [tagHistory, setTagHistory] = useState([]);
    const [tagHistoryLoading, setTagHistoryLoading] = useState(false);
    const [showAddTagInput, setShowAddTagInput] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [obsidianTags, setObsidianTags] = useState([]);
    const [showObsidianTags, setShowObsidianTags] = useState(false);
    const [aiSuggestionsKey, setAiSuggestionsKey] = useState(0); // Ключ для перезапуска анимации
    
    // === СОСТОЯНИЕ ЭКСПОРТА ===
    const [isExporting, setIsExporting] = useState(false);
    
    // === ESCAPE ОБРАБОТКА ===
    // Основная модалка
    useModalEscape(
        modalId,
        () => {
            // Проверяем, нет ли открытых вложенных элементов
            if (isExpanded || showHistory || showPrompt || showTagChat || showAddTagInput || showTagHistory || showObsidianTags) {
                return false; // Не закрываем основную модалку, есть вложенные элементы
            }
            onClose();
            return true;
        },
        isOpen ? MODAL_PRIORITIES.NOTE_MODAL : -1 // Активно только когда модалка открыта
    );
    
    // Раскрытый заголовок
    useModalEscape(
        `${modalId}-expanded-title`,
        () => {
            if (isExpanded) {
                setIsExpanded(false);
                setIsTitleFocused(false);
                // Сохраняем при закрытии раскрывающегося заголовка
                if (localTitle !== serverTitle) {
                    saveToServer('title', localTitle);
                }
                return true;
            }
            return false;
        },
        isExpanded ? MODAL_PRIORITIES.EXPANDED_INPUT : -1
    );
    
    // Input для тегов
    useModalEscape(
        `${modalId}-tag-input`,
        () => {
            if (showAddTagInput) {
                setNewTagInput('');
                setShowAddTagInput(false);
                return true;
            }
            return false;
        },
        showAddTagInput ? MODAL_PRIORITIES.TAG_INPUT : -1
    );
    
    // AI панели заголовков (история и промпт)
    useModalEscape(
        `${modalId}-title-panels`,
        () => {
            if (showPrompt || showHistory) {
                setShowPrompt(false);
                setShowHistory(false);
                setPromptInput('');
                return true;
            }
            return false;
        },
        (showPrompt || showHistory) ? MODAL_PRIORITIES.PROMPT_PANEL : -1,
        { group: 'PANELS_GROUP', exclusive: true }
    );
    
    // AI панели тегов
    useModalEscape(
        `${modalId}-tag-panels`,
        () => {
            if (showTagChat || showTagHistory || showObsidianTags) {
                setShowTagChat(false);
                setShowTagHistory(false);
                setShowObsidianTags(false);
                setTagPromptInput('');
                return true;
            }
            return false;
        },
        (showTagChat || showTagHistory || showObsidianTags) ? MODAL_PRIORITIES.TAG_PANELS : -1,
        { group: 'PANELS_GROUP', exclusive: true }
    );
    
    // Обновляем локальное состояние при изменении заметки
    useEffect(() => {
        // Если это та же заметка (только обновился заголовок/контент), не сбрасываем UI состояния
        if (prevNoteIdRef.current === note?.id && note?.id) {
            setLocalTitle(note?.title || '');
            setLocalContent(note?.content || '');
            setServerTitle(note?.title || '');
            setServerContent(note?.content || '');
            setTitleChanged(false);
            setContentChanged(false);
            setLocalTags(note?.tags || []);
            setAiSuggestions(note?.aiSuggestedTags || []);
        } else {
            // Если заметка сменилась, сбрасываем все
            setLocalTitle(note?.title || '');
            setLocalContent(note?.content || '');
            setServerTitle(note?.title || '');
            setServerContent(note?.content || '');
            setTitleChanged(false);
            setContentChanged(false);
            // Сбрасываем историю при смене заметки
            setTitleHistory([]);
            setShowHistory(false);
            setShowPrompt(false);
            // Сбрасываем состояния тегов
            setLocalTags(note?.tags || []);
            setAiSuggestions(note?.aiSuggestedTags || []);
            setAiSuggestionsKey(0); // Сбрасываем ключ анимации
            setShowTagChat(false);
            setShowTagHistory(false);
            setTagPromptInput('');
            setTagHistory([]);
            prevNoteIdRef.current = note?.id;
        }
    }, [note]);
    
    // Загрузка истории заголовков
    const loadTitleHistory = useCallback(async () => {
        if (!note?.id) return;
        
        setHistoryLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/ai-titles/history/${note?.id}`, {
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
            const response = await fetch(`http://localhost:3001/api/notes/${note?.id}`, {
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
        // Убрали обработку Escape - теперь это делает useModalEscape
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
                await fetch(`http://localhost:3001/api/ai-titles/save-current/${note?.id}`, {
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
                    noteId: note?.id,
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
        // Закрываем ВСЕ остальные панели
        setShowPrompt(false);
        setShowTagChat(false);
        setShowTagHistory(false);
        setShowObsidianTags(false);
        
        // Загружаем историю при открытии
        if (newShowHistory && titleHistory.length === 0) {
            await loadTitleHistory();
        }
    };
    
    const togglePrompt = () => {
        const newShowPrompt = !showPrompt;
        setShowPrompt(newShowPrompt);
        // Закрываем ВСЕ остальные панели
        setShowHistory(false);
        setShowTagChat(false);
        setShowTagHistory(false);
        setShowObsidianTags(false);
        // Очищаем промпт при закрытии
        if (!newShowPrompt) {
            setPromptInput('');
        }
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
    
    // === ФУНКЦИИ ДЛЯ ТЕГОВ ===
    
    // Загрузка тегов из Obsidian
    const loadObsidianTags = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3001/api/tags/obsidian', {
                headers: {
                    'user-id': 'test-user-id'
                }
            });
            
            if (response.ok) {
                const tags = await response.json();
                setObsidianTags(tags);
            }
        } catch (error) {
            console.error('Failed to load Obsidian tags:', error);
        }
    }, []);
    
    // Загрузка истории тегов
    const loadTagHistory = useCallback(async () => {
        if (!note?.id) return;
        
        setTagHistoryLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/tags/history/${note?.id}`, {
                headers: {
                    'user-id': 'test-user-id'
                }
            });
            
            if (response.ok) {
                const history = await response.json();
                setTagHistory(history);
            }
        } catch (error) {
            console.error('Failed to load tag history:', error);
        } finally {
            setTagHistoryLoading(false);
        }
    }, [note?.id]);
    
    // Генерация AI тегов
    const generateAITags = useCallback(async (customPrompt = null) => {
        if (!note?.id || isGeneratingTags) return;
        
        setIsGeneratingTags(true);
        
        try {
            const response = await fetch('http://localhost:3001/api/tags/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id'
                },
                body: JSON.stringify({
                    noteId: note?.id,
                    prompt: customPrompt
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Перезатираем предложения новыми (не накапливаем)
                setAiSuggestions(result.tags);
                // Увеличиваем ключ для перезапуска анимации
                setAiSuggestionsKey(prev => prev + 1);
                
                // Если был кастомный промпт, загружаем историю (но не открываем)
                if (customPrompt) {
                    await loadTagHistory();
                    // НЕ открываем историю автоматически
                    // setShowTagHistory(true);
                }
                
                // НЕ закрываем чат панель после генерации
                // setShowTagChat(false);
                // Очищаем только input
                setTagPromptInput('');
            }
        } catch (error) {
            console.error('Failed to generate tags:', error);
        } finally {
            setIsGeneratingTags(false);
        }
    }, [note, isGeneratingTags, aiSuggestions, loadTagHistory]);
    
    // Добавить тег из AI предложений
    const addTagFromSuggestion = useCallback(async (tag) => {
        const tagText = tag.text.replace(/^#/, '');
        if (!localTags.includes(tagText)) {
            const newTags = [...localTags, tagText];
            setLocalTags(newTags);
            
            // Удаляем из предложений
            const newSuggestions = aiSuggestions.filter(s => s.text !== tag.text);
            setAiSuggestions(newSuggestions);
            
            // Сохраняем на сервер
            try {
                await fetch(`http://localhost:3001/api/tags/update/${note?.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': 'test-user-id'
                    },
                    body: JSON.stringify({ tags: newTags })
                });
                
                // Обновляем AI предложения на сервере
                await fetch(`http://localhost:3001/api/tags/update-suggestions/${note?.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': 'test-user-id'
                    },
                    body: JSON.stringify({ aiSuggestions: newSuggestions })
                });
                
                // Обновляем заметку с новыми тегами и AI предложениями
                onNoteUpdate({ ...note, tags: newTags, aiSuggestedTags: newSuggestions });
            } catch (error) {
                console.error('Failed to update tags:', error);
            }
        }
    }, [localTags, aiSuggestions, note, onNoteUpdate]);
    
    // Удалить тег
    const removeTag = useCallback(async (tagToRemove) => {
        const newTags = localTags.filter(tag => tag !== tagToRemove);
        setLocalTags(newTags);
        
        // Сохраняем на сервер
        try {
            await fetch(`http://localhost:3001/api/tags/update/${note?.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id'
                },
                body: JSON.stringify({ tags: newTags })
            });
            
            // Обновляем заметку
            onNoteUpdate({ ...note, tags: newTags });
        } catch (error) {
            console.error('Failed to update tags:', error);
        }
    }, [localTags, note, onNoteUpdate]);
    
    // Добавить новый тег вручную
    const addManualTag = useCallback(async (tagText) => {
        let cleanTag = tagText.trim();
        if (!cleanTag) return;
        
        // Добавляем # если его нет
        if (!cleanTag.startsWith('#')) {
            cleanTag = cleanTag;
        } else {
            cleanTag = cleanTag.replace(/^#/, '');
        }
        
        if (!localTags.includes(cleanTag)) {
            const newTags = [...localTags, cleanTag];
            setLocalTags(newTags);
            
            // Сохраняем на сервер
            try {
                await fetch(`http://localhost:3001/api/tags/update/${note?.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': 'test-user-id'
                    },
                    body: JSON.stringify({ tags: newTags })
                });
                
                // Обновляем заметку
                onNoteUpdate({ ...note, tags: newTags });
            } catch (error) {
                console.error('Failed to update tags:', error);
            }
        }
        
        setNewTagInput('');
        setShowAddTagInput(false);
    }, [localTags, note, onNoteUpdate]);
    
    // Очистить историю тегов
    const clearTagHistory = async () => {
        try {
            await fetch(`http://localhost:3001/api/tags/history/${note?.id}`, {
                method: 'DELETE',
                headers: {
                    'user-id': 'test-user-id'
                }
            });
            setTagHistory([]);
        } catch (error) {
            console.error('Failed to clear tag history:', error);
        }
    };
    
    // Применить промпт для тегов
    const applyTagPrompt = () => {
        if (tagPromptInput.trim()) {
            generateAITags(tagPromptInput.trim());
        } else {
            // Default prompt
            generateAITags();
        }
    };
    
    // Переключение чата для тегов
    const toggleTagChat = () => {
        const newShowTagChat = !showTagChat;
        setShowTagChat(newShowTagChat);
        // Закрываем ВСЕ остальные панели
        setShowHistory(false);
        setShowPrompt(false);
        setShowTagHistory(false);
        setShowObsidianTags(false);
        // Очищаем промпт при закрытии
        if (!newShowTagChat) {
            setTagPromptInput('');
        }
    };
    
    // Переключение истории для тегов
    const toggleTagHistory = async () => {
        const newShowHistory = !showTagHistory;
        setShowTagHistory(newShowHistory);
        // Закрываем ВСЕ остальные панели
        setShowHistory(false);
        setShowPrompt(false);
        setShowTagChat(false);
        setShowObsidianTags(false);
        
        // Загружаем историю при открытии
        if (newShowHistory && tagHistory.length === 0) {
            await loadTagHistory();
        }
    };
    
    // Переключение тегов Obsidian
    const toggleObsidianTags = () => {
        setShowObsidianTags(!showObsidianTags);
        // Закрываем ВСЕ остальные панели
        setShowHistory(false);
        setShowPrompt(false);
        setShowTagChat(false);
        setShowTagHistory(false);
    };
    
    // Загрузка тегов Obsidian при монтировании
    useEffect(() => {
        if (isOpen) {
            loadObsidianTags();
        }
    }, [isOpen, loadObsidianTags]);
    
    // Экспорт заметки в Obsidian
    const handleExportToObsidian = useCallback(async () => {
        if (!note?.id || isExporting) return;
        
        setIsExporting(true);
        
        try {
            // Сначала сохраним последние изменения если они есть
            if (titleChanged) {
                await saveToServer('title', localTitle);
            }
            if (contentChanged) {
                await saveToServer('content', localContent);
            }
            
            const response = await fetch('http://localhost:3001/api/obsidian/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id'
                },
                body: JSON.stringify({
                    noteId: note?.id
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    // Вызываем callback с данными для toast
                    if (onExportSuccess) {
                        onExportSuccess({
                            noteId: note?.id,
                            noteTitle: localTitle,
                            folderPath: result.filepath,
                            obsidianUrl: result.obsidianUrl
                        });
                    } else {
                        // Fallback если callback не передан
                        onClose();
                    }
                } else {
                    alert('Ошибка экспорта: ' + (result.error || 'Неизвестная ошибка'));
                }
            } else {
                alert('Не удалось экспортировать заметку');
            }
        } catch (error) {
            console.error('Failed to export note:', error);
            alert('Ошибка при экспорте заметки');
        } finally {
            setIsExporting(false);
        }
    }, [note, isExporting, localTitle, localContent, titleChanged, contentChanged, saveToServer, onClose, onExportSuccess]);
    
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
    

    
    // Get type label
    const getTypeLabel = (type) => {
        const labels = {
            voice: 'Голосовая заметка',
            text: 'Текстовая заметка',
            collection: 'Коллекция'
        };
        return labels[type] || 'Заметка';
    };
    
    // Условный рендеринг вместо early return
    if (!isOpen || !note) return null;
    
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
                    cursor: 'pointer',
                }}
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                style={{
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
                    overflow: 'auto',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '16px 32px',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '18px' }}>✏️</span>
                        <span
                            style={{
                                fontSize: '20px',
                                color: '#e0e0e0',
                                fontWeight: '800',
                            }}
                        >
                            Редактирование заметки
                        </span>
                        {note?.manuallyPositioned && (
                            <span
                                style={{
                                    fontSize: '14px',
                                    color: '#ff9500',
                                    title: 'Перемещена вручную',
                                }}
                            >
                                📍
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Export to Obsidian button */}
                        <button
                            onClick={handleExportToObsidian}
                            disabled={isExporting}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '4px',
                                cursor: isExporting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'opacity 0.2s',
                                opacity: isExporting ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!isExporting) {
                                    e.currentTarget.style.opacity = '0.8';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isExporting) {
                                    e.currentTarget.style.opacity = '1';
                                }
                            }}
                            title="Экспортировать в Obsidian"
                        >
                            {isExporting ? (
                                <>
                                    <div
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            border: '2px solid transparent',
                                            borderTopColor: '#999',
                                            borderRadius: '50%',
                                            animation: 'spin 0.6s linear infinite',
                                        }}
                                    />
                                    <style>{`
                                        @keyframes spin {
                                            to { transform: rotate(360deg); }
                                        }
                                    `}</style>
                                </>
                            ) : (
                                <img
                                    src={obsidianIcon}
                                    alt="Obsidian"
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                    }}
                                />
                            )}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        padding: '24px 32px',
                        overflowY: 'visible',
                        color: '#e0e0e0',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* ЗАГОЛОВОК */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            {/* Индикатор состояния */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '-20px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: isTitleFocused
                                        ? '#ff9500'
                                        : titleSaveStatus === 'saving'
                                        ? '#ff9500'
                                        : titleSaveStatus === 'success'
                                        ? '#30d158'
                                        : 'transparent',
                                    animation: titleSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
                                    transition: 'all 0.3s ease',
                                }}
                            />

                            <label
                                style={{
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    color: '#888',
                                    fontWeight: '600',
                                }}
                            >
                                Заголовок
                            </label>
                        </div>

                        <div style={{ position: 'relative' }}>
                            {/* Input с кнопками */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '8px',
                                    visibility: isExpanded ? 'hidden' : 'visible',
                                }}
                            >
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
                                        fontSize: '16px',
                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box',
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
                                            fontSize: '16px',
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
                                            fontSize: '16px',
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
                                            fontSize: '16px',
                                        }}
                                        title="Развернуть"
                                    >
                                        ↕
                                    </button>
                                </div>
                            </div>

                            {/* История генераций */}
                            {showHistory && !isExpanded && (
                                <div
                                    style={{
                                        marginTop: '10px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        maxHeight: '250px',
                                        overflowY: 'auto',
                                        backgroundColor: '#181818',
                                        border: '1px solid #333',
                                    }}
                                >
                                    {historyLoading ? (
                                        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Загрузка...</div>
                                    ) : titleHistory.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                            История пуста. Сгенерируйте первые варианты!
                                        </div>
                                    ) : (
                                        titleHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => useHistoryTitle(item)}
                                                onMouseEnter={(e) => (e.currentTarget.querySelector('.delete-btn').style.opacity = '1')}
                                                onMouseLeave={(e) => (e.currentTarget.querySelector('.delete-btn').style.opacity = '0')}
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
                                                    position: 'relative',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: '14px' }}>{item.type === 'ai' ? '✨' : '✋'}</span>
                                                    <span
                                                        style={{
                                                            color: 'white',
                                                            fontSize: '14px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1,
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
                                                        fontWeight: 'bold',
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
                                <div
                                    style={{
                                        marginTop: '10px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        backgroundColor: '#181818',
                                        border: '1px solid #333',
                                    }}
                                >
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
                                                opacity: isGenerating ? 0.5 : 1,
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
                                                gap: '6px',
                                            }}
                                            title={!promptInput.trim() ? 'Использовать стандартную генерацию' : undefined}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '12px',
                                                            height: '12px',
                                                            border: '2px solid #ffffff30',
                                                            borderTopColor: 'white',
                                                            borderRadius: '50%',
                                                            animation: 'spin 0.6s linear infinite',
                                                        }}
                                                    ></span>
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
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        left: '-8px',
                                        right: '-8px',
                                        zIndex: 10,
                                    }}
                                >
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
                                            fontSize: '16px',
                                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                                            outline: 'none',
                                            overflowY: 'auto',
                                            overflowX: 'hidden',
                                            lineHeight: '1.4',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            scrollbarWidth: 'thin',
                                            scrollbarColor: '#444 #222',
                                            boxSizing: 'border-box',
                                        }}
                                        placeholder="Esc - свернуть | Enter - пробел | Спецсимволы удаляются"
                                    />
                                    {/* Подсказка под textarea */}
                                    <div
                                        style={{
                                            marginTop: '4px',
                                            fontSize: '11px',
                                            color: '#666',
                                            textAlign: 'right',
                                        }}
                                    >
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
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '-20px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: isContentFocused
                                        ? '#ff9500'
                                        : contentSaveStatus === 'saving'
                                        ? '#ff9500'
                                        : contentSaveStatus === 'success'
                                        ? '#30d158'
                                        : 'transparent',
                                    animation: contentSaveStatus === 'saving' ? 'pulse 1s infinite' : 'none',
                                    transition: 'all 0.3s ease',
                                }}
                            />

                            <label
                                style={{
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    color: '#888',
                                    fontWeight: '600',
                                }}
                            >
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
                                    handleContentChange({ target: { value: newValue } });

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
                                fontSize: '16px',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                                minHeight: '300px',
                                resize: 'none',
                                outline: 'none',
                                lineHeight: '1.5',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box',
                            }}
                            rows={12}
                            placeholder="Содержимое заметки..."
                        />
                    </div>

                    {/* Теги */}
                    <div style={{ marginTop: '24px' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '12px',
                            }}
                        >
                            <label
                                style={{
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    color: '#888',
                                    fontWeight: '600',
                                }}
                            >
                                Теги
                            </label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {/* Кнопка истории */}
                                <button
                                    onClick={toggleTagHistory}
                                    title="История генераций"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        backgroundColor: showTagHistory ? '#22aa44' : '#2a2a2a',
                                        border: '1px solid',
                                        borderColor: showTagHistory ? '#22aa44' : '#444',
                                        borderRadius: '6px',
                                        color: showTagHistory ? 'white' : '#888',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    📜
                                </button>
                                {/* Кнопка чата */}
                                <button
                                    onClick={toggleTagChat}
                                    title="AI чат для тегов"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        backgroundColor: showTagChat ? '#22aa44' : '#2a2a2a',
                                        border: '1px solid',
                                        borderColor: showTagChat ? '#22aa44' : '#444',
                                        borderRadius: '6px',
                                        color: showTagChat ? 'white' : '#888',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    ✨
                                </button>
                                {/* Кнопка тегов Obsidian */}
                                <button
                                    onClick={toggleObsidianTags}
                                    title="Все теги Obsidian"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        backgroundColor: showObsidianTags ? '#22aa44' : '#2a2a2a',
                                        border: '1px solid',
                                        borderColor: showObsidianTags ? '#22aa44' : '#444',
                                        borderRadius: '6px',
                                        color: showObsidianTags ? 'white' : '#888',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    🏷️
                                </button>
                            </div>
                        </div>

                        {/* Блок с тегами */}
                        <div
                            style={{
                                padding: '12px',
                                backgroundColor: '#222',
                                border: '1px solid #444',
                                borderRadius: '8px',
                            }}
                        >
                            {/* Текущие теги */}
                            <div style={{ marginBottom: '16px' }}>
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}
                                >
                                    Текущие теги
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px',
                                        minHeight: '32px',
                                    }}
                                >
                                    {localTags.map((tag, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 12px',
                                                backgroundColor: '#2a2a2a',
                                                border: '1px solid #444',
                                                borderRadius: '16px',
                                                fontSize: '14px',
                                                cursor: 'default',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#333';
                                                e.currentTarget.style.borderColor = '#555';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#2a2a2a';
                                                e.currentTarget.style.borderColor = '#444';
                                            }}
                                        >
                                            #{tag}
                                            <span
                                                onClick={() => removeTag(tag)}
                                                style={{
                                                    color: '#666',
                                                    cursor: 'pointer',
                                                    fontSize: '16px',
                                                    lineHeight: '1',
                                                    marginLeft: '4px',
                                                    fontWeight: 'bold',
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
                                                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
                                            >
                                                ×
                                            </span>
                                        </div>
                                    ))}

                                    {/* Кнопка добавить */}
                                    {!showAddTagInput ? (
                                        <button
                                            onClick={() => setShowAddTagInput(true)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: 'transparent',
                                                border: '1px dashed #666',
                                                borderRadius: '16px',
                                                color: '#888',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#2a2a2a';
                                                e.currentTarget.style.borderColor = '#888';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.borderColor = '#666';
                                                e.currentTarget.style.color = '#888';
                                            }}
                                        >
                                            + Добавить
                                        </button>
                                    ) : (
                                        <input
                                            type="text"
                                            value={newTagInput}
                                            onChange={(e) => setNewTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addManualTag(newTagInput);
                                                }
                                                // Убрали обработку Escape - теперь это делает useModalEscape
                                            }}
                                            onBlur={() => {
                                                if (!newTagInput) {
                                                    setShowAddTagInput(false);
                                                }
                                            }}
                                            placeholder="Введите тег..."
                                            autoFocus
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#222',
                                                border: '1px solid #ff9500',
                                                borderRadius: '16px',
                                                color: 'white',
                                                fontSize: '14px',
                                                outline: 'none',
                                                width: '150px',
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* AI предложения */}
                            <div>
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}
                                >
                                  AI предложения
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px',
                                        minHeight: '32px',
                                    }}
                                >
                                    {aiSuggestions.length > 0 ? (
                                        aiSuggestions.map((tag, index) => (
                                            <div
                                                key={`${aiSuggestionsKey}-${index}`}
                                                onClick={() => addTagFromSuggestion(tag)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '6px 12px',
                                                    backgroundColor: tag.isNew ? '#1a3d1a' : '#1a2d3d',
                                                    border: '1px solid',
                                                    borderColor: tag.isNew ? '#22aa44' : '#2288aa',
                                                    borderRadius: '16px',
                                                    fontSize: '14px',
                                                    color: tag.isNew ? '#4ec74e' : '#4ec7e7',
                                                    cursor: 'pointer',
                                                    opacity: 0.9,
                                                    transition: 'all 0.2s ease',
                                                    animation: `fadeInUp 0.4s ease ${index * 0.1}s backwards`,
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                    e.currentTarget.style.transform = 'scale(1.05)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.opacity = '0.9';
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                            >
                                                {tag.text}
                                            </div>
                                        ))
                                    ) : (
                                        <div
                                            style={{
                                                color: '#666',
                                                fontSize: '13px',
                                                fontStyle: 'italic',
                                                marginLeft : '2px'
                                            }}
                                        >
                                            Используйте чат ✨ для генерации предложений
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* AI Chat панель */}
                        {showTagChat && (
                            <div
                                style={{
                                    marginTop: '12px',
                                    padding: '12px',
                                    backgroundColor: '#181818',
                                    border: '1px solid #333',
                                    borderRadius: '8px',
                                }}
                            >
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={tagPromptInput}
                                        onChange={(e) => setTagPromptInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyTagPrompt();
                                            }
                                        }}
                                        placeholder="Опишите стиль тегов..."
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            backgroundColor: '#222',
                                            border: '1px solid #444',
                                            borderRadius: '4px',
                                            color: 'white',
                                            fontSize: '14px',
                                            outline: 'none',
                                        }}
                                        onFocus={(e) => (e.currentTarget.style.borderColor = '#ff9500')}
                                        onBlur={(e) => (e.currentTarget.style.borderColor = '#444')}
                                    />
                                    <button
                                        onClick={applyTagPrompt}
                                        disabled={isGeneratingTags}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: '6px',
                                            border: '1px solid',
                                            borderColor: tagPromptInput.trim() ? '#22aa44' : '#444',
                                            backgroundColor: tagPromptInput.trim() ? '#22aa44' : '#2a2a2a',
                                            color: tagPromptInput.trim() ? 'white' : '#888',
                                            cursor: isGeneratingTags ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            opacity: isGeneratingTags ? '0.5' : '1',
                                        }}
                                        title={tagPromptInput.trim() ? '' : 'Использовать стандартную генерацию'}
                                    >
                                        {isGeneratingTags && (
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: '12px',
                                                    height: '12px',
                                                    border: '2px solid #ffffff30',
                                                    borderTopColor: 'white',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.6s linear infinite',
                                                }}
                                            />
                                        )}
                                        <span>{isGeneratingTags ? 'Генерирую...' : tagPromptInput.trim() ? 'Генерировать' : 'Default'}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* История тегов */}
                        {showTagHistory && (
                            <div
                                style={{
                                    marginTop: '12px',
                                    maxHeight: '250px',
                                    overflowY: 'auto',
                                    padding: '12px',
                                    backgroundColor: '#181818',
                                    border: '1px solid #333',
                                    borderRadius: '8px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '12px',
                                        padding: '8px',
                                        backgroundColor: '#222',
                                        borderRadius: '4px',
                                    }}
                                >
                                    <span style={{ color: '#888', fontSize: '14px' }}>📜 История генераций</span>
                                    <button
                                        onClick={clearTagHistory}
                                        style={{
                                            fontSize: '12px',
                                            padding: '4px 8px',
                                            backgroundColor: '#aa2222',
                                            border: '1px solid #aa2222',
                                            borderRadius: '4px',
                                            color: 'white',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cc3333')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#aa2222')}
                                    >
                                        Очистить
                                    </button>
                                </div>

                                {tagHistoryLoading ? (
                                    <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Загрузка...</div>
                                ) : tagHistory.length > 0 ? (
                                    <div>
                                        {tagHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    marginBottom: '12px',
                                                    padding: '8px',
                                                    backgroundColor: '#222',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '8px',
                                                        fontSize: '12px',
                                                        color: '#666',
                                                    }}
                                                >
                                                    <span>✨ Кастомная генерация</span>
                                                    <span>
                                                        {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                                {item.prompt && (
                                                    <div
                                                        style={{
                                                            color: '#888',
                                                            fontSize: '13px',
                                                            marginBottom: '8px',
                                                            fontStyle: 'italic',
                                                        }}
                                                    >
                                                        "{item.prompt}"
                                                    </div>
                                                )}
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: '6px',
                                                    }}
                                                >
                                                    {item.tags.map((tag, idx) => (
                                                        <div
                                                            key={idx}
                                                            style={{
                                                                fontSize: '12px',
                                                                padding: '4px 8px',
                                                                backgroundColor: tag.isNew ? '#1a3d1a' : '#1a2d3d',
                                                                border: '1px solid',
                                                                borderColor: tag.isNew ? '#22aa44' : '#2288aa',
                                                                borderRadius: '12px',
                                                                color: tag.isNew ? '#4ec74e' : '#4ec7e7',
                                                            }}
                                                        >
                                                            {tag.text}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            padding: '20px',
                                            color: '#666',
                                            fontSize: '14px',
                                        }}
                                    >
                                        История пуста
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Панель тегов Obsidian */}
                        {showObsidianTags && (
                            <div
                                style={{
                                    marginTop: '12px',
                                    maxHeight: '250px',
                                    overflowY: 'auto',
                                    padding: '12px',
                                    backgroundColor: '#181818',
                                    border: '1px solid #333',
                                    borderRadius: '8px',
                                }}
                            >
                                

                                {obsidianTags.length > 0 ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                        }}
                                    >
                                        {obsidianTags.map((tag, index) => {
                                            const isUsed = localTags.includes(tag.replace(/^#/, ''));
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => !isUsed && addManualTag(tag.replace(/^#/, ''))}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '2px 8px',
                                                        backgroundColor: isUsed ? '#2a2a2a' : '#1a2d3d',
                                                        border: '1px solid',
                                                        borderColor: isUsed ? '#444' : '#2288aa',
                                                        borderRadius: '16px',
                                                        fontSize: '14px',
                                                        color: isUsed ? '#666' : '#4ec7e7',
                                                        cursor: isUsed ? 'default' : 'pointer',
                                                        opacity: isUsed ? 0.6 : 0.9,
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isUsed) {
                                                            e.currentTarget.style.opacity = '1';
                                                            e.currentTarget.style.transform = 'scale(1.05)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isUsed) {
                                                            e.currentTarget.style.opacity = '0.9';
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                        }
                                                    }}
                                                    title={isUsed ? 'Тег уже добавлен' : 'Нажмите чтобы добавить'}
                                                >
                                                    {tag}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            padding: '20px',
                                            color: '#666',
                                            fontSize: '14px',
                                        }}
                                    >
                                        Загрузка тегов из Obsidian...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Metadata Footer */}
                <div
                    style={{
                        padding: '16px 32px',
                        borderTop: '1px solid #2a2a2a',
                        backgroundColor: '#161616',
                        fontSize: '12px',
                        color: '#666',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '20px',
                    }}
                >
                    <div>
                        <span style={{ color: '#555' }}>ID:</span> <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{note?.id || 'N/A'}</span>
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Тип:</span> <span style={{ color: '#888' }}>{getTypeLabel(note?.type)}</span>
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Дата:</span> {formatDate(note?.date)}
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Создано:</span> {formatDateTime(note?.createdAt)}
                    </div>
                    {note?.updatedAt && note?.updatedAt !== note?.createdAt && (
                        <div>
                            <span style={{ color: '#555' }}>Обновлено:</span> {formatDateTime(note?.updatedAt)}
                        </div>
                    )}
                    <div>
                        <span style={{ color: '#555' }}>Позиция:</span> ({Math.round(note?.x || 0)}, {Math.round(note?.y || 0)})
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Перемещена:</span>{' '}
                        <span style={{ color: note?.manuallyPositioned ? '#ff9500' : '#666' }}>{note?.manuallyPositioned ? 'Да' : 'Нет'}</span>
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
                
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 0.9;
                        transform: translateY(0) scale(1);
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