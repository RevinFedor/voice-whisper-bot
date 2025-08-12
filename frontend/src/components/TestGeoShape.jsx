import { useEffect } from 'react';
import { useEditor, createShapeId } from 'tldraw';

export function TestGeoShape() {
    const editor = useEditor();
    
    useEffect(() => {
        if (!editor) return;
        
        // Создаем функцию для тестового создания встроенного geo shape
        window.testGeoShape = () => {
            console.log('=== Creating test geo shape ===');
            
            try {
                const id = createShapeId();
                const result = editor.createShape({
                    id,
                    type: 'geo',
                    x: 400,
                    y: 400,
                    props: {
                        geo: 'rectangle',
                        w: 200,
                        h: 150,
                        color: 'red',
                        fill: 'solid',
                    }
                });
                
                console.log('Geo shape created:', result);
                
                // Проверяем создание
                const createdShape = editor.getShape(id);
                if (createdShape) {
                    console.log('✓ Geo shape verified:', createdShape);
                } else {
                    console.error('✗ Geo shape NOT found!');
                }
                
                // Проверяем видимость
                const allShapes = editor.getCurrentPageShapes();
                const geoShapes = allShapes.filter(s => s.type === 'geo');
                console.log('Total geo shapes:', geoShapes.length);
                
                return id;
            } catch (error) {
                console.error('Error creating geo shape:', error);
            }
        };
        
        // Автоматически создаем тестовый geo shape
        setTimeout(() => {
            console.log('Creating automatic test geo shape...');
            const id = window.testGeoShape();
            if (id) {
                console.log('Test geo shape created with ID:', id);
            }
        }, 2000);
        
        console.log('Test geo shape function ready. Use window.testGeoShape() to create a test shape.');
        
    }, [editor]);
    
    return null;
}

export default TestGeoShape;