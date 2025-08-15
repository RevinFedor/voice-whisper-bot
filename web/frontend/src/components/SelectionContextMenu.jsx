import React from 'react';
import ReactDOM from 'react-dom';
import { useEditor, useValue } from '@tldraw/editor';

export function SelectionContextMenu() {
    const editor = useEditor();
    
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
    
    // Вычисляем позицию меню с динамическим отступом
    const menuPosition = useValue(
        'menu position',
        () => {
            // Не показываем если нет выделенных заметок
            if (selectedNotes.length === 0) return null;
            
            // Скрываем при движении камеры (как в Miro)
            if (cameraState !== 'idle') return null;
            
            // Получаем границы выделения в экранных координатах
            const screenBounds = editor.getSelectionRotatedScreenBounds();
            if (!screenBounds) return null;
            
            // Текущий уровень масштабирования
            const zoom = editor.getZoomLevel();
            
            // Динамический отступ: больше при отдалении, меньше при приближении
            // При zoom 0.5 (отдалено) → отступ 120px
            // При zoom 1 (нормально) → отступ 60px
            // При zoom 2 (приближено) → отступ 30px
            const baseOffset = 60;
            const dynamicOffset = baseOffset / Math.max(zoom, 0.5);
            
            // Позиционируем меню по центру над выделением
            return {
                x: screenBounds.x + screenBounds.width / 2,
                y: screenBounds.y - dynamicOffset,
            };
        },
        [selectedNotes, editor, cameraState]
    );
    
    // Не рендерим если нет позиции или заметок
    if (!menuPosition || selectedNotes.length === 0) return null;
    
    // Обработчики для кнопок
    const handleDelete = () => {
        console.log('🗑️ Удаление заметок:');
        const ids = selectedNotes.map(note => note.id);
        editor.deleteShapes(ids);
    };
    
    const handleExportToObsidian = () => {
        console.log('📤 Экспорт в Obsidian:');
        selectedNotes.forEach((note, index) => {
            const dbId = note.props?.dbId || 'No DB ID';
            const title = note.props?.richText?.content?.[0]?.content?.[0]?.text || 'Без заголовка';
            console.log(`  ${index + 1}. ${title} (${dbId})`);
        });
        // TODO: Реализовать экспорт в Obsidian
    };
    
    const handleDuplicate = () => {
        console.log('📋 Дублирование заметок');
        const ids = selectedNotes.map(note => note.id);
        editor.duplicateShapes(ids, { x: 20, y: 20 }); // Смещаем дубликаты
    };
    
    const handleLogIds = () => {
        console.log('🆔 Selected Note IDs:');
        console.log('='.repeat(40));
        
        selectedNotes.forEach((note, index) => {
            const dbId = note.props?.dbId || 'No DB ID';
            const title = note.props?.richText?.content?.[0]?.content?.[0]?.text || 'Без заголовка';
            
            console.log(`  ${index + 1}. Shape ID: ${note.id}`);
            console.log(`     DB ID: ${dbId}`);
            console.log(`     Title: "${title.substring(0, 30)}${title.length > 30 ? '...' : ''}"`);
        });
        
        console.log('='.repeat(40));
        console.log(`Total selected: ${selectedNotes.length} note(s)`);
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
                animation: 'fadeIn 0.15s ease-out',
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
            
            {/* Вертикальный разделитель */}
            <div style={{ 
                width: '1px', 
                height: '20px',
                background: '#444', 
                margin: '0 2px' 
            }} />
            
            {/* Debug кнопка */}
            <MenuButton 
                onClick={handleLogIds}
                icon="🆔"
                tooltip="Log IDs"
                secondary
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