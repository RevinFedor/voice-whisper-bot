import { ShapeUtil, HTMLContainer, Rectangle2d, resizeBox, T } from 'tldraw';
import React from 'react';
 
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

    // Override cursor behavior for this shape type
    getCursor() {
        return 'pointer';
    }

    // Клики обрабатываются на уровне editor в SyncedProductionApp
    // onClick, canEdit и onDoubleClick убраны чтобы не блокировать выделение

    component(shape) {
        const { richText, noteType, time, duration, color, manuallyPositioned } = shape.props;
        const [isMergeTarget, setIsMergeTarget] = React.useState(false);
        
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
            <HTMLContainer
                ref={(el) => {
                    // Override tldraw's pointer-events: none to enable cursor changes
                    if (el) {
                        el.style.pointerEvents = 'all';
                        el.style.cursor = 'pointer';
                    }
                }}
                data-shape={shape.id}
                className={isMergeTarget ? 'merge-target' : ''}
                style={{
                    width: shape.props.w,
                    height: shape.props.h,
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
                    {/* Заголовок с tooltip */}
                    <div 
                        style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            position: 'relative', // For tooltip positioning if needed
                        }}
                        title={title || 'Без заголовка'} // Always show tooltip with full title
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
            </HTMLContainer>
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