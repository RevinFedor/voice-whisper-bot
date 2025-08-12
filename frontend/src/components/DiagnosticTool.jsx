import { useEffect } from 'react';
import { useEditor } from 'tldraw';

export function DiagnosticTool() {
    const editor = useEditor();
    
    useEffect(() => {
        if (!editor) return;
        
        // Создаем глобальную функцию для диагностики
        window.checkShapes = () => {
            console.log('=== DIAGNOSTIC CHECK ===');
            
            // Проверяем все shapes
            const allShapes = editor.getCurrentPageShapes();
            console.log('Total shapes on page:', allShapes.length);
            
            // Группируем по типам
            const shapesByType = {};
            allShapes.forEach(shape => {
                if (!shapesByType[shape.type]) {
                    shapesByType[shape.type] = [];
                }
                shapesByType[shape.type].push(shape);
            });
            
            console.log('Shapes by type:', shapesByType);
            
            // Детальная информация о note shapes
            if (shapesByType.note) {
                console.log('Note shapes details:');
                shapesByType.note.forEach((shape, index) => {
                    console.log(`Note ${index + 1}:`, {
                        id: shape.id,
                        x: shape.x,
                        y: shape.y,
                        props: shape.props,
                    });
                });
            }
            
            // Детальная информация о custom-note shapes
            if (shapesByType['custom-note']) {
                console.log('Custom Note shapes details:');
                shapesByType['custom-note'].forEach((shape, index) => {
                    console.log(`Custom Note ${index + 1}:`, {
                        id: shape.id,
                        x: shape.x,
                        y: shape.y,
                        props: shape.props,
                    });
                });
            }
            
            // Детальная информация о text shapes
            if (shapesByType.text) {
                console.log('Text shapes details:');
                shapesByType.text.forEach((shape, index) => {
                    console.log(`Text ${index + 1}:`, {
                        id: shape.id,
                        x: shape.x,
                        y: shape.y,
                        props: shape.props,
                    });
                });
            }
            
            // Проверяем зарегистрированные ShapeUtils
            console.log('=== SHAPE UTILS CHECK ===');
            try {
                const noteUtil = editor.getShapeUtil('note');
                console.log('Note ShapeUtil registered:', !!noteUtil);
                if (noteUtil) {
                    console.log('Note ShapeUtil class:', noteUtil.constructor.name);
                    console.log('Note ShapeUtil type:', noteUtil.type);
                }
            } catch (error) {
                console.error('Error getting note ShapeUtil:', error);
            }
            
            try {
                const customNoteUtil = editor.getShapeUtil('custom-note');
                console.log('Custom Note ShapeUtil registered:', !!customNoteUtil);
                if (customNoteUtil) {
                    console.log('Custom Note ShapeUtil class:', customNoteUtil.constructor.name);
                    console.log('Custom Note ShapeUtil type:', customNoteUtil.type);
                }
            } catch (error) {
                console.error('Error getting custom-note ShapeUtil:', error);
            }

            try {
                const customNoteUtil = editor.getShapeUtil('custom-note');
                console.log('Custom Note ShapeUtil registered:', !!customNoteUtil);
                if (customNoteUtil) {
                    console.log('Custom Note ShapeUtil class:', customNoteUtil.constructor.name);
                    console.log('Custom Note ShapeUtil type:', customNoteUtil.type);
                    console.log('Custom Note ShapeUtil static type:', customNoteUtil.constructor.type);
                }
            } catch (error) {
                console.error('Error getting custom-note ShapeUtil:', error);
            }
            
            // Проверяем текущую камеру
            const camera = editor.getCamera();
            console.log('Camera position:', camera);
            
            // Проверяем viewport bounds
            const viewportBounds = editor.getViewportScreenBounds();
            console.log('Viewport bounds:', viewportBounds);
            
            console.log('=== END DIAGNOSTIC ===');
        };
        
        // Создаем функцию для тестового создания shape
        window.testCreateShape = () => {
            console.log('Testing shape creation...');
            
            try {
                // Пробуем создать простой geo shape для теста
                const geoShape = editor.createShape({
                    type: 'geo',
                    x: 200,
                    y: 200,
                    props: {
                        geo: 'rectangle',
                        w: 100,
                        h: 100,
                        color: 'red',
                        fill: 'solid',
                    }
                });
                console.log('Created geo shape:', geoShape);
                
                // Проверяем, появился ли он
                const shapes = editor.getCurrentPageShapes();
                const foundGeo = shapes.find(s => s.type === 'geo');
                console.log('Geo shape found on page:', !!foundGeo);
                
            } catch (error) {
                console.error('Error creating test shape:', error);
            }
        };
        
        // Автоматически выполняем диагностику через 1 секунду
        setTimeout(() => {
            console.log('Running automatic diagnostic...');
            window.checkShapes();
        }, 1000);
        
        console.log('Diagnostic tools ready. Use window.checkShapes() or window.testCreateShape() in console.');
        
    }, [editor]);
    
    return null;
}

export default DiagnosticTool;