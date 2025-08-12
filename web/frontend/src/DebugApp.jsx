import React, { useEffect } from 'react';
import { Tldraw, createShapeId, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';

// Диагностический компонент
function DebugInfo() {
    const editor = useEditor();
    
    useEffect(() => {
        if (!editor) return;
        
        const checkCanvas = () => {
            console.group('🔍 CANVAS DEBUG');
            
            // Проверяем shapes в store
            const shapes = editor.getCurrentPageShapes();
            console.log('Shapes in store:', shapes.length);
            shapes.forEach(shape => {
                console.log(`- ${shape.type} at (${shape.x}, ${shape.y})`);
            });
            
            // Проверяем canvas элементы
            const canvas = document.querySelector('.tl-canvas');
            console.log('Canvas element:', !!canvas);
            
            const shapesContainer = document.querySelector('.tl-shapes');
            console.log('Shapes container:', !!shapesContainer);
            
            if (shapesContainer) {
                const shapeElements = shapesContainer.querySelectorAll('.tl-shape');
                console.log('Shape DOM elements:', shapeElements.length);
            }
            
            // Проверяем viewport
            const viewport = editor.getViewportScreenBounds();
            console.log('Viewport:', viewport);
            
            // Проверяем камеру
            const camera = editor.getCamera();
            console.log('Camera:', camera);
            
            console.groupEnd();
        };
        
        // Проверяем каждые 2 секунды
        const interval = setInterval(checkCanvas, 2000);
        
        // Первая проверка через секунду
        setTimeout(checkCanvas, 1000);
        
        return () => clearInterval(interval);
    }, [editor]);
    
    return null;
}

// Простой тест с минимальной конфигурацией
export default function DebugApp() {
    const handleMount = (editor) => {
        console.log('🚀 DebugApp: Editor mounted');
        
        // Создаем простые shapes для теста
        setTimeout(() => {
            console.log('📦 Creating test shapes...');
            
            // 1. Простой прямоугольник
            const geoId = createShapeId();
            editor.createShape({
                id: geoId,
                type: 'geo',
                x: 100,
                y: 100,
                props: {
                    geo: 'rectangle',
                    w: 200,
                    h: 100,
                    color: 'red',
                    fill: 'solid',
                }
            });
            console.log('Created geo shape');
            
            // 2. Кастомная заметка
            const noteId = createShapeId();
            editor.createShape({
                id: noteId,
                type: 'custom-note',
                x: 350,
                y: 100,
                props: {
                    w: 180,
                    h: 150,
                    richText: {
                        type: 'doc',
                        content: [{
                            type: 'paragraph',
                            content: [{
                                type: 'text',
                                text: 'Тестовая заметка'
                            }]
                        }]
                    },
                    noteType: 'text',
                    time: '12:00'
                }
            });
            console.log('Created custom note');
            
            // Проверяем что создалось
            const shapes = editor.getCurrentPageShapes();
            console.log('Total shapes:', shapes.length);
            
            // Сбрасываем камеру
            editor.resetZoom();
            editor.setCamera({ x: 0, y: 0, z: 1 });
            
        }, 500);
    };
    
    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: '#fff'
        }}>
            <Tldraw
                shapeUtils={[CustomNoteShapeUtil]}
                onMount={handleMount}
            >
                <DebugInfo />
            </Tldraw>
            
            {/* Debug панель */}
            <div style={{
                position: 'fixed',
                top: 10,
                left: 10,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '12px',
                fontFamily: 'monospace',
                zIndex: 10000,
                maxWidth: '300px'
            }}>
                <div>🔍 DEBUG MODE</div>
                <div>Проверяйте консоль каждые 2 сек</div>
                <div>Белый фон для видимости</div>
                <div>Стандартный UI включен</div>
            </div>
        </div>
    );
}