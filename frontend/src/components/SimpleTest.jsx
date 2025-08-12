import React, { useEffect } from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';

export function SimpleTest() {
    const handleMount = (editor) => {
        console.log('SimpleTest: Editor mounted');
        
        // Создаем простой geo shape
        const geoId = createShapeId();
        editor.createShape({
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
        
        console.log('SimpleTest: Created geo shape');
        
        // Создаем text shape
        const textId = createShapeId();
        editor.createShape({
            id: textId,
            type: 'text',
            x: 250,
            y: 250,
            props: {
                text: 'TEST TEXT',
                color: 'black',
                size: 'xl',
                font: 'sans',
            }
        });
        
        console.log('SimpleTest: Created text shape');
        
        // Проверяем shapes
        const shapes = editor.getCurrentPageShapes();
        console.log('SimpleTest: Total shapes:', shapes.length);
        shapes.forEach(shape => {
            console.log('Shape:', shape.type, shape.id, shape.x, shape.y);
        });
    };
    
    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <Tldraw onMount={handleMount} />
        </div>
    );
}

export default SimpleTest;