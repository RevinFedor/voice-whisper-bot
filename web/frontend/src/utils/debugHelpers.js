/**
 * 🔍 DEBUG HELPERS - Утилиты для сбора логов
 * 
 * Используй эти функции в консоли браузера для быстрого сбора информации
 */

// Глобальная функция для полной диагностики
window.collectLogs = () => {
    const logs = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        
        // Проверка DOM элементов
        dom: {
            canvas: !!document.querySelector('.tl-canvas'),
            shapesContainer: !!document.querySelector('.tl-shapes'),
            shapeElements: document.querySelectorAll('.tl-shape').length,
            customNotes: document.querySelectorAll('.custom-note').length,
            tlContainer: document.querySelector('.tl-container')?.getBoundingClientRect(),
        },
        
        // Проверка tldraw editor (если доступен)
        editor: null,
        
        // Собираем последние ошибки из консоли
        errors: [],
        
        // Performance метрики
        performance: {
            memory: performance.memory,
            timing: performance.timing,
            navigation: performance.navigation.type
        },
        
        // React DevTools (если доступны)
        react: {
            version: window.React?.version,
            strictMode: document.querySelector('#root')?._reactRootContainer?._internalRoot?.mode === 1
        }
    };
    
    // Пытаемся получить editor
    try {
        const editor = window.editor || window.tldrawEditor;
        if (editor) {
            logs.editor = {
                shapesCount: editor.getCurrentPageShapes?.()?.length,
                camera: editor.getCamera?.(),
                viewport: editor.getViewportScreenBounds?.(),
                selectedShapes: editor.getSelectedShapeIds?.()
            };
        }
    } catch (e) {
        logs.editor = { error: e.message };
    }
    
    // Собираем ошибки (hook на console.error)
    const originalError = console.error;
    const errorLog = [];
    console.error = (...args) => {
        errorLog.push(args.join(' '));
        originalError.apply(console, args);
    };
    logs.errors = errorLog;
    
    // Копируем в буфер обмена
    const output = JSON.stringify(logs, null, 2);
    
    // Создаем временный элемент для копирования
    const textarea = document.createElement('textarea');
    textarea.value = output;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    console.log('✅ Логи скопированы в буфер обмена!');
    console.log('📋 Preview:', logs);
    
    return logs;
};

// Быстрая проверка shapes
window.checkShapes = () => {
    console.group('🎯 Quick Shapes Check');
    
    const shapesInDOM = document.querySelectorAll('.tl-shape');
    console.log('DOM shapes:', shapesInDOM.length);
    
    shapesInDOM.forEach((shape, i) => {
        const rect = shape.getBoundingClientRect();
        const styles = window.getComputedStyle(shape);
        console.log(`Shape ${i}:`, {
            type: shape.dataset.shapeType,
            visible: rect.width > 0 && rect.height > 0,
            display: styles.display,
            opacity: styles.opacity,
            position: { x: rect.x, y: rect.y }
        });
    });
    
    console.groupEnd();
};

// Проверка производительности
window.perfCheck = () => {
    console.group('⚡ Performance Check');
    
    // Измеряем FPS
    let lastTime = performance.now();
    let frames = 0;
    
    const measureFPS = () => {
        frames++;
        const currentTime = performance.now();
        
        if (currentTime >= lastTime + 1000) {
            const fps = Math.round((frames * 1000) / (currentTime - lastTime));
            console.log(`FPS: ${fps}`);
            frames = 0;
            lastTime = currentTime;
        }
        
        if (frames < 120) {
            requestAnimationFrame(measureFPS);
        }
    };
    
    measureFPS();
    
    // Memory
    if (performance.memory) {
        console.log('Memory:', {
            used: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
            total: `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
            limit: `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
        });
    }
    
    console.groupEnd();
};

// Сохранение editor в window для доступа
window.saveEditor = (editor) => {
    window.editor = editor;
    // console.log('✅ Editor saved to window.editor');
};

// Автоматический сбор логов при ошибках
window.addEventListener('error', (event) => {
    console.error('🔴 Global error caught:', event.error);
    console.log('💡 Run window.collectLogs() to gather debug info');
});

// Debug helper для клик/перетаскивание
window.debugClickDrag = () => {
    console.group('🖱️ CLICK vs DRAG DEBUG');
    console.log('📋 How it works:');
    console.log('  • Click (move < 4px) = Opens modal');
    console.log('  • Drag (move > 4px) = Moves note immediately');
    console.log('  • No delays, based on movement distance');
    
    if (window.editor) {
        const editor = window.editor;
        console.log('');
        console.log('📊 Current state:');
        console.log(`  • isDragging: ${editor.inputs.isDragging}`);
        console.log(`  • isPointing: ${editor.inputs.isPointing}`);
        console.log(`  • Selected shapes: ${editor.getSelectedShapes().length}`);
        console.log(`  • Drag threshold: 4px (mouse), 6px (touch)`);
    }
    console.groupEnd();
};

// Debug helper для функции объединения заметок
window.debugMerge = () => {
    console.group('🔀 MERGE NOTES DEBUG');
    console.log('📋 How to merge notes:');
    console.log('  1. Select a single note');
    console.log('  2. Drag it over another note');
    console.log('  3. 30% overlap triggers merge');
    console.log('  4. Yellow highlight = merge target');
    console.log('');
    console.log('📝 Merge result:');
    console.log('  • Title: "Note1 / Note2"');
    console.log('  • Content separated by: /////');
    console.log('  • Position: target note location');
    console.log('  • Type: text');
    
    if (window.editor) {
        const shapes = window.editor.getCurrentPageShapes();
        const customNotes = shapes.filter(s => s.type === 'custom-note');
        console.log('');
        console.log(`📊 Current notes: ${customNotes.length}`);
        customNotes.forEach(note => {
            const title = note.props?.richText?.content?.[0]?.content?.[0]?.text || 'Untitled';
            console.log(`  - ${note.props?.dbId}: ${title}`);
        });
    }
    console.groupEnd();
};

// Debug helper для проверки кликов
window.debugClicks = () => {
    console.group('🖱️ CLICK/DRAG DEBUG');
    console.log('📋 Current behavior:');
    console.log('  • Single click = Open modal');
    console.log('  • Drag = Move note');
    console.log('  • Double click = Also opens modal');
    console.log('');
    console.log('🔍 Check console for:');
    console.log('  • "👇 Pointer down" - when you press');
    console.log('  • "🔄 Drag started" - if drag detected');
    console.log('  • "👆 Pointer up" - when you release');
    console.log('  • "🎯 Single click" - if click detected');
    console.log('  • "🔓 Opening modal" - when modal opens');
    console.log('');
    if (window.editor) {
        console.log('✅ Editor is loaded');
        console.log('  isDragging:', window.editor.inputs.isDragging);
        console.log('  Selected shapes:', window.editor.getSelectedShapeIds());
    }
    console.groupEnd();
};

// Информация при загрузке
console.log(`
╔════════════════════════════════════════╗
║     🔍 DEBUG HELPERS LOADED            ║
╠════════════════════════════════════════╣
║ Available commands:                     ║
║                                        ║
║ window.collectLogs()  - Full diagnostic║
║ window.checkShapes()  - Quick shapes   ║
║ window.perfCheck()    - Performance    ║
║ window.debugMerge()   - Merge notes    ║
║ window.debugClickDrag() - Click/Drag   ║
║                                        ║
║ Logs auto-copy to clipboard!           ║
╚════════════════════════════════════════╝
`);