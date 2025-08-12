import React from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { DOMInspector } from './components/DOMInspector';

// Минимальный CSS только для фона
const minimalStyles = `
    .tl-background {
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%) !important;
    }
`;

export function BasicWorkingTest() {
    const handleMount = (editor) => {
        console.log('🚀 BasicWorkingTest: Editor mounted');
        
        // Создаем различные типы shapes для тестирования
        setTimeout(() => {
            console.log('📦 Creating test shapes...');
            
            // 1. Geo shape (красный прямоугольник)
            const geoId = createShapeId();
            const geoResult = editor.createShape({
                id: geoId,
                type: 'geo',
                x: 200,
                y: 200,
                props: {
                    geo: 'rectangle',
                    w: 300,
                    h: 200,
                    color: 'red',
                    fill: 'solid',
                }
            });
            console.log('✅ Geo shape created:', geoId);
            
            // 2. Text shape (используем richText для tldraw v2+)
            const textId = createShapeId();
            const textResult = editor.createShape({
                id: textId,
                type: 'text',
                x: 250,
                y: 250,
                props: {
                    richText: {
                        type: 'doc',
                        content: [{
                            type: 'paragraph',
                            content: [{
                                type: 'text',
                                text: 'ТЕСТ ВИДИМОСТИ'
                            }]
                        }]
                    },
                    color: 'blue',
                    size: 'xl',
                    font: 'sans',
                    autoSize: true,
                    w: 200
                }
            });
            console.log('✅ Text shape created:', textId);
            
            // 3. Arrow shape
            const arrowId = createShapeId();
            const arrowResult = editor.createShape({
                id: arrowId,
                type: 'arrow',
                x: 500,
                y: 300,
                props: {
                    start: { x: 0, y: 0 },
                    end: { x: 200, y: 100 },
                    color: 'green',
                }
            });
            console.log('✅ Arrow shape created:', arrowId);
            
            // 4. Note shape (встроенный, используем richText)
            const noteId = createShapeId();
            const noteResult = editor.createShape({
                id: noteId,
                type: 'note',
                x: 600,
                y: 100,
                props: {
                    richText: {
                        type: 'doc',
                        content: [{
                            type: 'paragraph',
                            content: [{
                                type: 'text',
                                text: 'Встроенная заметка tldraw'
                            }]
                        }]
                    },
                    color: 'yellow',
                    size: 'm',
                }
            });
            console.log('✅ Note shape created:', noteId);
            
            // Проверяем что создалось
            const allShapes = editor.getCurrentPageShapes();
            console.log('📊 Total shapes created:', allShapes.length);
            console.log('📋 Shapes list:', allShapes.map(s => ({
                type: s.type,
                id: s.id,
                x: s.x,
                y: s.y
            })));
            
            // Центрируем камеру на shapes
            editor.zoomToFit();
            console.log('🎥 Camera centered on shapes');
            
        }, 1000);
    };
    
    return (
        <>
            <style>{minimalStyles}</style>
            <div style={{ 
                position: 'fixed', 
                inset: 0,
                width: '100vw',
                height: '100vh',
                overflow: 'hidden'
            }}>
                <Tldraw 
                    onMount={handleMount}
                    hideUi={false}
                >
                    <DOMInspector autoRun={true} logInterval={0} />
                </Tldraw>
            </div>
            
            {/* Debug панель */}
            <div style={{
                position: 'fixed',
                top: 10,
                right: 10,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '12px',
                fontFamily: 'monospace',
                zIndex: 10000,
            }}>
                <div>🔍 BasicWorkingTest</div>
                <div>✅ Стандартный Tldraw UI</div>
                <div>✅ Минимальные стили</div>
                <button 
                    onClick={() => window.domInspector?.runFullDiagnostic()}
                    style={{
                        marginTop: '5px',
                        padding: '5px 10px',
                        background: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        cursor: 'pointer'
                    }}
                >
                    Run DOM Diagnostic
                </button>
            </div>
        </>
    );
}

export default BasicWorkingTest;