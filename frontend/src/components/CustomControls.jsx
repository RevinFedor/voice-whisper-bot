import React, { useState } from 'react';
import { useEditor, createShapeId } from 'tldraw';

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

export function CustomControls() {
    const editor = useEditor();
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(100);

    const handleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        if (isSelectMode) {
            editor.setCurrentTool('select');
        }
    };

    const handleGroupSelected = () => {
        const selected = editor.getSelectedShapeIds();
        if (selected.length < 2) {
            alert('Выберите минимум 2 заметки для объединения');
            return;
        }
        // Логика объединения заметок
        console.log('Объединение заметок:', selected);
    };

    const handleSendToObsidian = () => {
        const selected = editor.getSelectedShapeIds();
        if (selected.length === 0) {
            alert('Выберите заметки для отправки');
            return;
        }
        console.log('Отправка в Obsidian:', selected);
    };

    const handleZoomIn = () => {
        const camera = editor.getCamera();
        editor.setCamera({
            x: camera.x,
            y: camera.y,
            z: Math.min(camera.z * 1.2, 3),
        });
        setCurrentZoom(Math.round(editor.getCamera().z * 100));
    };

    const handleZoomOut = () => {
        const camera = editor.getCamera();
        editor.setCamera({
            x: camera.x,
            y: camera.y,
            z: Math.max(camera.z / 1.2, 0.3),
        });
        setCurrentZoom(Math.round(editor.getCamera().z * 100));
    };

    const handleResetZoom = () => {
        editor.resetZoom();
        setCurrentZoom(100);
    };

    const handleToggleView = () => {
        // Переключение между видами
        console.log('Переключение вида');
    };

    const handleAddNote = () => {
        // Добавление новой заметки
        const id = createShapeId();
        editor.createShape({
            id,
            type: 'note',
            x: 100 + Math.random() * 500,
            y: 100 + Math.random() * 300,
            props: {
                richText: toRichText('Новая заметка\nНажмите для редактирования...'),
                noteType: 'text',
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                color: 'black',
                size: 'm',
            }
        });
    };

    return (
        <>
            {/* Верхняя панель управления */}
            <div style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(26, 26, 26, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '10px 20px',
                display: 'flex',
                gap: '15px',
                alignItems: 'center',
                zIndex: 1000,
            }}>
                <button 
                    onClick={handleSelectMode}
                    style={{
                        padding: '8px 16px',
                        background: isSelectMode ? '#2a4' : '#222',
                        border: '1px solid #444',
                        color: isSelectMode ? 'white' : '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    ☑️ Выбрать
                </button>
                
                <button 
                    onClick={handleGroupSelected}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    📚 Объединить
                </button>
                
                <button 
                    onClick={handleSendToObsidian}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    📤 В Obsidian
                </button>
                
                <div style={{ borderLeft: '1px solid #333', height: '20px' }} />
                
                <button 
                    onClick={handleZoomIn}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    🔍+
                </button>
                
                <button 
                    onClick={handleZoomOut}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    🔍-
                </button>
                
                <button 
                    onClick={handleResetZoom}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    🔄 100%
                </button>
                
                <div style={{ borderLeft: '1px solid #333', height: '20px' }} />
                
                <button 
                    onClick={handleToggleView}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    📊 Вид
                </button>
                
                <button 
                    onClick={handleAddNote}
                    style={{
                        padding: '8px 16px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#888',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                    }}
                >
                    ➕ Добавить
                </button>
            </div>

            {/* Индикатор масштаба */}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: 'rgba(26, 26, 26, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '8px 15px',
                fontSize: '12px',
                color: '#888',
                zIndex: 1000,
            }}>
                {currentZoom}%
            </div>

            {/* Статистика */}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                background: 'rgba(26, 26, 26, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '15px',
                fontSize: '12px',
                color: '#888',
                zIndex: 1000,
            }}>
                <div style={{ marginBottom: '5px' }}>
                    <strong style={{ color: '#fff' }}>17</strong> заметок
                </div>
                <div style={{ marginBottom: '5px' }}>
                    <strong style={{ color: '#fff' }}>12</strong> ожидают
                </div>
                <div style={{ marginBottom: '5px' }}>
                    <strong style={{ color: '#fff' }}>5</strong> в Obsidian
                </div>
                <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid #333',
                }}>
                    <div><strong style={{ color: '#fff' }}>7 авг:</strong> 7 заметок</div>
                    <div><strong style={{ color: '#fff' }}>8 авг:</strong> 4 заметки</div>
                    <div><strong style={{ color: '#2a4' }}>9 авг:</strong> 6 заметок</div>
                </div>
            </div>
        </>
    );
}

export default CustomControls;