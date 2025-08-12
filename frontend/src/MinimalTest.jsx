import React, { useEffect } from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

/**
 * МИНИМАЛЬНЫЙ ТЕСТ TLDRAW
 * Без кастомизации, без shapes, без StrictMode
 * Только чистый компонент Tldraw
 */
export function MinimalTest() {
    useEffect(() => {
        console.log('🔬 MinimalTest mounted');
        
        // Проверяем наличие canvas элементов через 1 секунду
        setTimeout(() => {
            console.log('🔍 Checking for canvas elements...');
            
            const tlContainer = document.querySelector('.tl-container');
            console.log('tl-container found:', !!tlContainer);
            
            const tlCanvas = document.querySelector('.tl-canvas');
            console.log('tl-canvas found:', !!tlCanvas);
            
            const svgs = document.querySelectorAll('svg');
            console.log('SVG elements found:', svgs.length);
            
            const canvases = document.querySelectorAll('canvas');
            console.log('Canvas elements found:', canvases.length);
            
            // Проверяем основные классы tldraw
            const classes = [
                '.tl-shapes',
                '.tl-background',
                '.tl-overlays',
                '.tlui-layout'
            ];
            
            classes.forEach(cls => {
                const el = document.querySelector(cls);
                console.log(`${cls}: ${el ? '✅ FOUND' : '❌ NOT FOUND'}`);
            });
            
        }, 1000);
    }, []);
    
    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0,
            width: '100vw',
            height: '100vh'
        }}>
            <Tldraw />
        </div>
    );
}

export default MinimalTest;