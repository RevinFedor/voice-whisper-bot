import React from 'react';
import ReactDOM from 'react-dom';
import { useEditor, useValue } from '@tldraw/editor';
import { useModalEscape } from '../contexts/ModalStackContext';
import { useToast } from '../hooks/useToast';

export function SelectionContextMenu() {
    const editor = useEditor();
    const { showToast } = useToast();
    
    // Состояние для модалок
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [showAITagsConfirm, setShowAITagsConfirm] = React.useState(false);
    const [notesForAI, setNotesForAI] = React.useState([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    
    // Состояние для управления видимостью с задержкой
    const [isVisible, setIsVisible] = React.useState(false);
    const delayTimerRef = React.useRef(null);
    
    // Отслеживаем была ли использована рамка выделения (brush)
    const wasBrushUsedRef = React.useRef(false);
    const prevSelectedCountRef = React.useRef(0);
    
    // Отслеживаем выделенные custom-note заметки
    const selectedNotes = useValue(
        'selected notes',
        () => {
            const shapes = editor.getSelectedShapes();
            // Фильтруем только custom-note shapes
            return shapes.filter(shape => shape.type === 'custom-note');
        },
        [editor]
    );
    
    // Отслеживаем состояние камеры (скрываем меню при движении)
    const cameraState = useValue(
        'camera state',
        () => editor.getCameraState(),
        [editor]
    );
    
    // Отслеживаем активную рамку выделения (brush)
    const hasBrush = useValue(
        'has brush',
        () => editor.getInstanceState().brush !== null,
        [editor]
    );
    
    // Отслеживаем текущее состояние инструмента
    const currentPath = useValue(
        'current path',
        () => editor.getPath(),
        [editor]
    );
    
    // Если есть активная рамка - запоминаем это
    React.useEffect(() => {
        if (hasBrush) {
            console.log('🎯 Brush detected, setting wasBrushUsedRef = true');
            wasBrushUsedRef.current = true;
        }
    }, [hasBrush]);
    
    // Сбрасываем флаг когда выделение снимается или меняется на клик
    React.useEffect(() => {
        const isPointingShape = currentPath.includes('select.pointing_shape');
        const isBrushing = currentPath.includes('select.brushing');
        const isIdle = currentPath.includes('select.idle');
        
        console.log('📊 Selection change:', {
            selectedCount: selectedNotes.length,
            currentPath,
            isPointingShape,
            isBrushing,
            isIdle,
            wasBrushUsed: wasBrushUsedRef.current
        });
        
        // Сбрасываем флаг ТОЛЬКО когда:
        // 1. Нет выделения И не идет brushing И в idle состоянии
        if (selectedNotes.length === 0 && !isBrushing && !hasBrush && isIdle) {
            console.log('🔄 No selection and idle, resetting wasBrushUsedRef');
            wasBrushUsedRef.current = false;
            prevSelectedCountRef.current = 0;
        }
        // 2. Клик на заметку после выделения рамкой
        else if (isPointingShape && wasBrushUsedRef.current) {
            console.log('🔄 Click after brush, resetting wasBrushUsedRef');
            wasBrushUsedRef.current = false;
        }
        
        prevSelectedCountRef.current = selectedNotes.length;
    }, [selectedNotes.length, currentPath, hasBrush]);
    
    // Отслеживаем предыдущее состояние камеры для определения задержки
    const prevCameraStateRef = React.useRef(cameraState);
    
    // Управление видимостью с задержкой
    React.useEffect(() => {
        // Очищаем предыдущий таймер
        if (delayTimerRef.current) {
            clearTimeout(delayTimerRef.current);
            delayTimerRef.current = null;
        }
        
        // Проверяем текущее состояние
        const isTranslating = currentPath.includes('select.translating');
        const isPointingShape = currentPath.includes('select.pointing_shape');
        const isBrushing = currentPath.includes('select.brushing');
        
     
        
        // НЕ показываем меню если:
        // 1. Нет выделенных заметок
        // 2. Не была использована рамка выделения
        // 3. Идет перемещение (translating)
        // 4. Идет активное выделение рамкой
        if (selectedNotes.length === 0 || 
            !wasBrushUsedRef.current ||
            isTranslating ||
            isBrushing ||
            hasBrush) {
           
            setIsVisible(false);
            prevCameraStateRef.current = cameraState;
            return;
        }
        
        // Камера движется - скрываем
        if (cameraState !== 'idle') {
            setIsVisible(false);
            prevCameraStateRef.current = cameraState;
            return;
        }
        
        // Показываем меню только если:
        // - Есть выделенные заметки
        // - Была использована рамка выделения
        // - Не идет перемещение
        // - Камера не движется
        const wasCameraMoving = prevCameraStateRef.current !== 'idle';
        
        if (wasCameraMoving) {
            // Камера только что остановилась - задержка 300ms
            const delay = window.menuDelay || 300;
            delayTimerRef.current = setTimeout(() => {
                setIsVisible(true);
            }, delay);
        } else {
            // Выделение рамкой завершилось - показываем сразу
            setIsVisible(true);
        }
        
        prevCameraStateRef.current = cameraState;
        
        // Cleanup - ВСЕГДА очищаем таймер при размонтировании или изменении зависимостей
        return () => {
            if (delayTimerRef.current) {
                clearTimeout(delayTimerRef.current);
                delayTimerRef.current = null;
            }
        };
    }, [selectedNotes.length, cameraState, hasBrush, currentPath]);
    
    // Вычисляем позицию меню
    const menuPosition = useValue(
        'menu position',
        () => {
            // Не вычисляем позицию если меню не должно быть видимо
            if (selectedNotes.length === 0) return null;
            
            // Получаем границы выделения в экранных координатах
            const screenBounds = editor.getSelectionRotatedScreenBounds();
            if (!screenBounds) return null;
            
            // Фиксированный отступ в пикселях экрана
            // getSelectionRotatedScreenBounds() УЖЕ дает экранные координаты!
            const fixedOffset = 70; // Всегда 50px на экране
            
            // Позиционируем меню по центру над выделением
            return {
                x: screenBounds.x + screenBounds.width / 2,
                y: screenBounds.y - fixedOffset,
            };
        },
        [selectedNotes, editor]
    );
    
    // Рендерим модалки всегда, но меню только когда видимо
    const shouldShowMenu = isVisible && menuPosition && selectedNotes.length > 0;
    
    // Обработчики для кнопок
    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };
    
    const handleDeleteConfirm = async () => {
        try {
            setIsProcessing(true);
            const noteIds = selectedNotes.map(note => note.props?.dbId).filter(Boolean);
            
            // Удаляем на бэкенде
            const response = await fetch('http://localhost:3001/api/notes/bulk', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': 'test-user-id'
                },
                body: JSON.stringify({ noteIds })
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete notes');
            }
            
            // Удаляем из tldraw
            const shapeIds = selectedNotes.map(note => note.id);
            editor.deleteShapes(shapeIds);
            
            showToast(`Удалено заметок: ${selectedNotes.length}`, 'success');
            setShowDeleteConfirm(false);
        } catch (error) {
            console.error('Error deleting notes:', error);
            showToast('Ошибка при удалении заметок', 'error');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleExportToObsidian = async () => {
        // Проверяем заметки без тегов
        const notesWithoutTags = selectedNotes.filter(note => {
            const tags = note.props?.tags || [];
            return tags.length === 0;
        });
        
        if (notesWithoutTags.length > 0) {
            setNotesForAI(notesWithoutTags);
            setShowAITagsConfirm(true);
        } else {
            await exportNotesToObsidian(selectedNotes);
        }
    };
    
    const exportNotesToObsidian = async (notes, generateAI = false) => {
        try {
            setIsProcessing(true);
            const exportedShapeIds = [];
            
            for (const note of notes) {
                const dbId = note.props?.dbId;
                if (!dbId) continue;
                
                // Генерируем AI-теги если нужно И если у заметки нет тегов
                if (generateAI && (!note.props?.tags || note.props.tags.length === 0)) {
                    console.log(`Generating AI tags for note ${dbId}`);
                    const tagResponse = await fetch('http://localhost:3001/api/tags/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'user-id': 'test-user-id'
                        },
                        body: JSON.stringify({ noteId: dbId })
                    });
                    
                    if (tagResponse.ok) {
                        const result = await tagResponse.json();
                        
                        // Применяем сгенерированные AI-теги к основному полю tags
                        if (result.tags && result.tags.length > 0) {
                            const tagsToApply = result.tags.map(tag => 
                                typeof tag === 'string' ? tag.replace(/^#/, '') : tag.text.replace(/^#/, '')
                            );
                            
                            console.log(`Applying AI tags to note ${dbId}:`, tagsToApply);
                            
                            // Обновляем основное поле tags
                            const updateResponse = await fetch(`http://localhost:3001/api/tags/update/${dbId}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'user-id': 'test-user-id'
                                },
                                body: JSON.stringify({ tags: tagsToApply })
                            });
                            
                            if (!updateResponse.ok) {
                                console.error(`Failed to apply tags to note ${dbId}`);
                            }
                        }
                    } else {
                        console.error(`Failed to generate tags for note ${dbId}`);
                    }
                }
                
                // Экспортируем в Obsidian
                const response = await fetch('http://localhost:3001/api/obsidian/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': 'test-user-id'
                    },
                    body: JSON.stringify({ noteId: dbId })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to export note ${dbId}`);
                }
                
                // Запоминаем ID shape для удаления
                exportedShapeIds.push(note.id);
            }
            
            // Удаляем экспортированные заметки с холста
            if (exportedShapeIds.length > 0) {
                editor.deleteShapes(exportedShapeIds);
            }
            
            showToast(`Экспортировано заметок: ${notes.length}`, 'success');
        } catch (error) {
            console.error('Error exporting to Obsidian:', error);
            showToast('Ошибка при экспорте в Obsidian', 'error');
        } finally {
            setIsProcessing(false);
            setShowAITagsConfirm(false);
            setNotesForAI([]);
        }
    };
    
    
    // Рендерим через portal для фиксированного размера (не масштабируется с canvas)
    return (
        <>
            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteConfirm}
                count={selectedNotes.length}
                isProcessing={isProcessing}
            />
            
            <AITagsConfirmModal
                isOpen={showAITagsConfirm}
                onClose={() => {
                    setShowAITagsConfirm(false);
                    setNotesForAI([]);
                }}
                onConfirm={async (generateAI) => {
                    // Всегда экспортируем ВСЕ выбранные заметки, 
                    // но генерируем AI-теги только для тех, у кого их нет
                    await exportNotesToObsidian(selectedNotes, generateAI);
                }}
                count={notesForAI.length}
                isProcessing={isProcessing}
            />
            
            {shouldShowMenu && ReactDOM.createPortal(
        <div 
            className="selection-context-menu"
            style={{
                position: 'fixed',
                left: menuPosition.x,
                top: menuPosition.y,
                transform: 'translateX(-50%)',
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                zIndex: 10000,
                pointerEvents: 'auto',
                opacity: 1,
                transition: 'opacity 0.15s ease-out', // Плавное появление без анимации позиции
                display: 'flex',
                flexDirection: 'row', // Горизонтальное расположение
                alignItems: 'center',
                gap: '4px',
            }}
        >
            {/* Счетчик выделенных заметок */}
            <div style={{
                fontSize: '11px',
                color: '#888',
                padding: '4px 8px',
                borderRight: '1px solid #444',
                whiteSpace: 'nowrap',
            }}>
                {selectedNotes.length}
            </div>
            
            {/* Кнопки действий в ряд */}
            <MenuButton 
                onClick={handleExportToObsidian}
                icon="📤"
                tooltip="Экспорт в Obsidian"
                compact
            />
            
            <MenuButton 
                onClick={handleDeleteClick}
                icon="🗑️"
                tooltip="Удалить"
                danger
                compact
            />
        </div>,
        document.body
            )}
        </>
    );
}

// Модалка подтверждения удаления
function DeleteConfirmModal({ isOpen, onClose, onConfirm, count, isProcessing }) {
    useModalEscape(
        'delete-confirm-modal',
        () => { 
            if (!isProcessing) {
                onClose(); 
                return true;
            }
            return false;
        },
        isOpen ? 200 : -1
    );
    
    if (!isOpen) return null;
    
    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}>
            <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '400px',
                border: '1px solid #444'
            }}>
                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#fff',
                    marginBottom: '16px'
                }}>
                    Удалить заметки?
                </h3>
                <p style={{
                    color: '#999',
                    marginBottom: '24px'
                }}>
                    Вы уверены, что хотите удалить {count} {count === 1 ? 'заметку' : count < 5 ? 'заметки' : 'заметок'}?
                </p>
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            padding: '8px 16px',
                            color: '#999',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                    >
                        {isProcessing ? 'Удаление...' : 'Удалить'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Модалка для AI-генерации тегов при экспорте
function AITagsConfirmModal({ isOpen, onClose, onConfirm, count, isProcessing }) {
    useModalEscape(
        'ai-tags-confirm-modal',
        () => { 
            if (!isProcessing) {
                onClose(); 
                return true;
            }
            return false;
        },
        isOpen ? 200 : -1
    );
    
    if (!isOpen) return null;
    
    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}>
            <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '450px',
                border: '1px solid #444'
            }}>
                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#fff',
                    marginBottom: '16px'
                }}>
                    Добавить AI-теги?
                </h3>
                <p style={{
                    color: '#999',
                    marginBottom: '24px',
                    lineHeight: '1.5'
                }}>
                    У {count} {count === 1 ? 'заметки' : count < 5 ? 'заметок' : 'заметок'} отсутствуют теги. 
                    Хотите добавить AI-рекомендации перед экспортом в Obsidian?
                </p>
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={() => onConfirm(false)}
                        disabled={isProcessing}
                        style={{
                            padding: '8px 16px',
                            color: '#999',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                    >
                        Экспортировать без тегов
                    </button>
                    <button
                        onClick={() => onConfirm(true)}
                        disabled={isProcessing}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                    >
                        {isProcessing ? 'Обработка...' : 'Добавить AI-теги'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Компонент кнопки меню
function MenuButton({ onClick, icon, text, tooltip, danger = false, secondary = false, compact = false }) {
    const [isHovered, setIsHovered] = React.useState(false);
    
    const handleClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onClick) {
            onClick();
        }
    };
    
    return (
        <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={tooltip || text} // Показываем tooltip при наведении
            style={{
                padding: compact ? '4px 8px' : '6px 8px',
                background: isHovered 
                    ? (danger ? '#4a1a1a' : secondary ? '#2a2a2a' : '#3a3a3a')
                    : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: danger ? '#ff6b6b' : secondary ? '#888' : '#fff',
                fontSize: compact ? '16px' : '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: compact ? '0' : '8px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ fontSize: compact ? '18px' : '16px' }}>{icon}</span>
            {!compact && text && <span>{text}</span>}
        </button>
    );
}