import { ShapeUtil, HTMLContainer, Rectangle2d, resizeBox, T, useEditor, useValue } from 'tldraw';
import React from 'react';
import ReactDOM from 'react-dom';
 
// Кастомный размер для заметок
const CUSTOM_NOTE_WIDTH = 180;
const CUSTOM_NOTE_HEIGHT = 50; // Уменьшено в 3 раза для компактности

// Функция для преобразования текста в richText формат
function toRichText(text) {
    const lines = text.split('\n');
    const content = lines.map((line) => {
        if (!line) {
            return { type: 'paragraph' };
        }
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
        };
    });
    return { type: 'doc', content };
}

// Цвета для разных типов заметок
const NOTE_COLORS = {
    voice: '#4a9eff',    // голубой
    text: '#4aff4a',     // зеленый
    collection: '#2a4',   // темно-зеленый
    default: '#666'       // серый
};

// Кастомный NoteShapeUtil
export class CustomNoteShapeUtil extends ShapeUtil {
    static type = 'custom-note';
    
    static props = {
        w: T.number,
        h: T.number,
        color: T.string,
        labelColor: T.string,
        size: T.string,
        font: T.string,
        fontSizeAdjustment: T.number,
        align: T.string,
        verticalAlign: T.string,
        growY: T.number,
        url: T.string,
        richText: T.any,
        scale: T.number,
        noteType: T.string, // добавляем тип заметки
        time: T.string,     // время создания
        duration: T.string, // длительность для голосовых
        manuallyPositioned: T.boolean, // флаг перетаскивания
        dbId: T.string,     // ID из базы данных
    };

    getDefaultProps() {
        return {
            w: CUSTOM_NOTE_WIDTH,
            h: CUSTOM_NOTE_HEIGHT,
            color: 'black',
            richText: toRichText(''),
            size: 'm',
            font: 'sans',
            align: 'start',
            verticalAlign: 'start',
            labelColor: 'black',
            growY: 0,
            fontSizeAdjustment: 0,
            url: '',
            scale: 1,
            noteType: 'text',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            duration: '',
            manuallyPositioned: false,
            dbId: '',
        };
    }

    getGeometry(shape) {
        // Simple Rectangle2d for hit detection
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    onResize(shape, info) {
        return resizeBox(shape, info);
    }

    // Override cursor behavior for this shape type - synced with tldraw hover
    getCursor() {
        // This method is called by tldraw when determining cursor
        // It should be in sync with green border (indicator)
        return 'pointer';
    }

    // Клики обрабатываются на уровне editor в SyncedProductionApp
    // onClick, canEdit и onDoubleClick убраны чтобы не блокировать выделение

    component(shape) {
        const editor = useEditor();
        
        // Reactive hover detection - synced with tldraw's green border
        const isHovered = useValue(
            'note hovered',
            () => {
                const hoveredId = editor.getHoveredShapeId();
                const result = hoveredId === shape.id;
                
                // Debug logging for hover state
                if (window.DEBUG_HOVER && result) {
                    console.log(`🔸 Component: Shape ${shape.id.substring(0,8)} isHovered=${result}`);
                }
                
                return result;
            },
            [editor, shape.id]
        );
        
        const isSelected = useValue(
            'note selected',
            () => editor.getSelectedShapeIds().includes(shape.id),
            [editor, shape.id]
        );
        
        // Set tldraw cursor based on hover state
        React.useEffect(() => {
            if (isHovered) {
                // Set pointer cursor through tldraw's cursor system
                editor.setCursor({ type: 'pointer', rotation: 0 });
                if (window.DEBUG_HOVER) {
                    console.log(`🎯 Setting tldraw cursor to pointer for ${shape.id.substring(0,8)}`);
                }
            } else {
                // Let tldraw handle default cursor
                // Don't set to 'default' here as it might interfere with other shapes
            }
        }, [isHovered, editor, shape.id]);
        
        const { richText, noteType, time, duration, color, manuallyPositioned } = shape.props;
        const [isMergeTarget, setIsMergeTarget] = React.useState(false);
        const [showTooltip, setShowTooltip] = React.useState(false);
        const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
        
        // Listen for merge target highlighting
        React.useEffect(() => {
            const checkMergeTarget = () => {
                const element = document.querySelector(`[data-shape="${shape.id}"]`);
                if (element && element.classList.contains('merge-target')) {
                    setIsMergeTarget(true);
                } else {
                    setIsMergeTarget(false);
                }
            };
            
            // Check initially and on mutations
            checkMergeTarget();
            const observer = new MutationObserver(checkMergeTarget);
            const element = document.querySelector(`[data-shape="${shape.id}"]`);
            if (element) {
                observer.observe(element, { attributes: true, attributeFilter: ['class'] });
            }
            
            return () => observer.disconnect();
        }, [shape.id]);
        
        // Извлекаем заголовок из richText
        let title = '';
        if (richText && richText.content) {
            const paragraphs = richText.content
                .filter(p => p.content && p.content[0])
                .map(p => p.content[0].text);
            
            if (paragraphs.length > 0) {
                title = paragraphs[0];
            }
        }

        // Определяем цвет границы по типу и статусу
        let borderColor = NOTE_COLORS[noteType] || NOTE_COLORS.default;
        // Если заметка перетащена, делаем границу оранжевой
        if (manuallyPositioned) {
            borderColor = '#ff9500';
        }
        // Если это цель для слияния, делаем границу желтой
        if (isMergeTarget) {
            borderColor = '#ffc800';
        }

        // Форматируем дату - получаем только день и месяц
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'short' 
            }).replace('.', '');
        };

        return (
            <>
            <HTMLContainer
                data-shape={shape.id}
                className={isMergeTarget ? 'merge-target' : ''}
                style={{
                    width: shape.props.w,
                    height: shape.props.h,
                    position: 'relative',  // For absolute positioning of inner content
                    // Make container fully transparent to fill geometry bounds
                    background: 'transparent',
                    // Don't set cursor here - let tldraw handle it via editor.setCursor()
                    pointerEvents: 'auto',
            }}
                // Remove stopPropagation to preserve drag functionality
                // tldraw will handle click vs drag detection internally
            >
            {/* Inner container with visual styles */}
            <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#1a1a1a',
                    border: isMergeTarget ? `3px solid ${borderColor}` : '1px solid #333',
                    borderLeft: `3px solid ${borderColor}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#e0e0e0',
                    fontSize: '12px',
                    overflow: 'hidden',
                    boxShadow: isMergeTarget 
                        ? '0 0 20px rgba(255, 200, 0, 0.8)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.3)',
                    transform: isMergeTarget ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    boxSizing: 'border-box',  // Ensure padding is included in dimensions
            }}
            >
                {/* Левая часть - заголовок */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: 0, // Важно для text-overflow
                }}>
                    {/* Заголовок с мгновенным tooltip */}
                    <div 
                        style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                            // Показываем tooltip только если текст обрезан
                            const element = e.currentTarget;
                            if (element.scrollWidth > element.clientWidth && title) {
                                const rect = element.getBoundingClientRect();
                                setTooltipPosition({ 
                                    x: rect.left + rect.width / 2, // Центрируем по горизонтали
                                    y: rect.top - 10 // Небольшой отступ от верха элемента
                                });
                                setShowTooltip(true);
                            }
                        }}
                        onMouseLeave={() => {
                            setShowTooltip(false);
                        }}
                    >
                        {title || 'Без заголовка'}
                    </div>
                </div>
                
                {/* Правая часть - время */}
                <div style={{
                    fontSize: '11px',
                    color: '#666',
                    flexShrink: 0,
                }}>
                    {time}
                </div>
            </div>
            </HTMLContainer>
            
            {/* Мгновенный кастомный tooltip через Portal */}
            {showTooltip && title && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: tooltipPosition.x,
                        top: tooltipPosition.y - 8, // Дополнительный отступ для стрелки
                        transform: 'translate(-50%, -100%)', // Центрируем по X и прикрепляем низ к точке
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: '#fff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        zIndex: 10000,
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                        maxWidth: '300px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        animation: 'fadeIn 0.1s ease-in',
                    }}
                >
                    {title}
                    {/* Треугольник-указатель */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid rgba(0, 0, 0, 0.9)',
                        }}
                    />
                </div>,
                document.body
            )}
            </>
        );
    }

    indicator(shape) {
        return (
            <rect 
                width={shape.props.w} 
                height={shape.props.h}
                style={{
                    fill: 'transparent',
                    stroke: '#2a4',
                    strokeWidth: 2,
                    rx: 12,
                    ry: 12,
                }}
            />
        );
    }
}