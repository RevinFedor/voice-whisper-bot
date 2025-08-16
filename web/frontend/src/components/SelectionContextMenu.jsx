import React from 'react';
import ReactDOM from 'react-dom';
import { useEditor, useValue } from '@tldraw/editor';

export function SelectionContextMenu() {
    const editor = useEditor();
    
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
        
        console.log('🎨 Menu visibility check:', {
            selectedCount: selectedNotes.length,
            wasBrushUsed: wasBrushUsedRef.current,
            isTranslating,
            isBrushing,
            hasBrush,
            cameraState,
            currentPath
        });
        
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
            console.log('❌ Menu hidden, reason:', 
                selectedNotes.length === 0 ? 'no selection' :
                !wasBrushUsedRef.current ? 'no brush used' :
                isTranslating ? 'translating' :
                isBrushing ? 'brushing' :
                'has active brush'
            );
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
    
    // Не рендерим если меню не должно быть видимо или нет позиции
    if (!isVisible || !menuPosition || selectedNotes.length === 0) return null;
    
    // Обработчики для кнопок
    const handleDelete = () => {
        const ids = selectedNotes.map(note => note.id);
        editor.deleteShapes(ids);
    };
    
    const handleExportToObsidian = () => {
        // TODO: Реализовать экспорт в Obsidian
        selectedNotes.forEach((note) => {
            const dbId = note.props?.dbId || 'No DB ID';
            const title = note.props?.richText?.content?.[0]?.content?.[0]?.text || 'Без заголовка';
            // Export logic here
        });
    };
    
    const handleDuplicate = () => {
        const ids = selectedNotes.map(note => note.id);
        editor.duplicateShapes(ids, { x: 20, y: 20 }); // Смещаем дубликаты
    };
    
    
    // Рендерим через portal для фиксированного размера (не масштабируется с canvas)
    return ReactDOM.createPortal(
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
                onClick={handleDuplicate}
                icon="📋"
                tooltip="Дублировать"
                compact
            />
            
            <MenuButton 
                onClick={handleExportToObsidian}
                icon="📤"
                tooltip="Экспорт в Obsidian"
                compact
            />
            
            <MenuButton 
                onClick={handleDelete}
                icon="🗑️"
                tooltip="Удалить"
                danger
                compact
            />
        </div>,
        document.body
    );
}

// Компонент кнопки меню
function MenuButton({ onClick, icon, text, tooltip, danger = false, secondary = false, compact = false }) {
    const [isHovered, setIsHovered] = React.useState(false);
    
    return (
        <button
            onClick={onClick}
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