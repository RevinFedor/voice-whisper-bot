import { ShapeUtil, HTMLContainer, Rectangle2d, resizeBox, T } from 'tldraw';
import React from 'react';

// Кастомный размер для заметок
const CUSTOM_NOTE_WIDTH = 180;
const CUSTOM_NOTE_HEIGHT = 150;

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
        };
    }

    getGeometry(shape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    onResize(shape, info) {
        return resizeBox(shape, info);
    }

    component(shape) {
        const { richText, noteType, time, duration, color } = shape.props;
        
        // Извлекаем текст из richText
        let displayText = '';
        let title = '';
        if (richText && richText.content) {
            const paragraphs = richText.content
                .filter(p => p.content && p.content[0])
                .map(p => p.content[0].text);
            
            if (paragraphs.length > 0) {
                title = paragraphs[0];
                displayText = paragraphs.slice(1).join('\n');
            }
        }

        // Определяем цвет границы по типу
        const borderColor = NOTE_COLORS[noteType] || NOTE_COLORS.default;
        
        // Иконка по типу
        const typeIcon = {
            voice: '🎙️',
            text: '📝',
            collection: '📚',
        }[noteType] || '📝';

        return (
            <HTMLContainer
                style={{
                    width: shape.props.w,
                    height: shape.props.h,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderLeft: `3px solid ${borderColor}`,
                    borderRadius: '12px',
                    padding: '15px',
                    color: '#e0e0e0',
                    fontSize: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                }}
            >
                {/* Заголовок */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                }}>
                    <span style={{ fontSize: '16px' }}>{typeIcon}</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>{time}</span>
                </div>
                
                {/* Название */}
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
                    {title || 'Без заголовка'}
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
                    marginBottom: '10px',
                }}>
                    {displayText || 'Пустая заметка'}
                </div>
                
                {/* Футер */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'absolute',
                    bottom: '15px',
                    left: '15px',
                    right: '15px',
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        fontSize: '11px',
                        color: '#555',
                    }}>
                        {noteType === 'voice' && duration && <span>{duration}</span>}
                        {noteType === 'collection' && <span>Коллекция</span>}
                        {noteType === 'text' && <span>Текст</span>}
                    </div>
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