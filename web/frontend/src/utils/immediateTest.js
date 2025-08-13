// СКОПИРУЙТЕ ВСЁ ЭТО В КОНСОЛЬ БРАУЗЕРА

// 1. Проверка что shapes существуют
console.log('=== ПРОВЕРКА 1: Shapes на странице ===');
const shapes = window.editor.getCurrentPageShapes();
console.log('Всего shapes:', shapes.length);
const customNotes = shapes.filter(s => s.type === 'custom-note');
console.log('Custom notes:', customNotes.length);

if (customNotes.length > 0) {
    console.log('Первая заметка:', customNotes[0]);
    console.log('Позиция:', { x: customNotes[0].x, y: customNotes[0].y });
    console.log('Размер:', { w: customNotes[0].props.w, h: customNotes[0].props.h });
}

// 2. Проверка ShapeUtil
console.log('\n=== ПРОВЕРКА 2: ShapeUtil ===');
const shapeUtil = window.editor.getShapeUtil('custom-note');
console.log('ShapeUtil зарегистрирован:', !!shapeUtil);

if (shapeUtil && customNotes.length > 0) {
    try {
        const geom = shapeUtil.getGeometry(customNotes[0]);
        console.log('Геометрия создана:', geom);
        console.log('Тип геометрии:', geom.constructor.name);
        console.log('isFilled:', geom.isFilled);
        console.log('bounds:', geom.bounds);
        
        if (geom.children) {
            console.log('Children:', geom.children.length);
        }
    } catch (e) {
        console.error('Ошибка при создании геометрии:', e);
    }
}

// 3. Проверка viewport и camera
console.log('\n=== ПРОВЕРКА 3: Viewport ===');
const camera = window.editor.getCamera();
console.log('Camera:', camera);
const viewport = window.editor.getViewportPageBounds();
console.log('Viewport bounds:', viewport);

// 4. Тест hit detection с конкретной точкой
if (customNotes.length > 0) {
    console.log('\n=== ПРОВЕРКА 4: Hit Detection ===');
    const testShape = customNotes[0];
    const testPoint = {
        x: testShape.x + testShape.props.w / 2,
        y: testShape.y + testShape.props.h / 2
    };
    
    console.log('Тестовая точка (центр первой заметки):', testPoint);
    
    // Разные варианты поиска
    const hit1 = window.editor.getShapeAtPoint(testPoint, {
        hitInside: true,
        margin: 0
    });
    console.log('getShapeAtPoint (hitInside: true, margin: 0):', hit1);
    
    const hit2 = window.editor.getShapeAtPoint(testPoint, {
        hitInside: false,
        margin: 10
    });
    console.log('getShapeAtPoint (hitInside: false, margin: 10):', hit2);
    
    const hit3 = window.editor.getShapeAtPoint(testPoint);
    console.log('getShapeAtPoint (default options):', hit3);
    
    // Проверка всех shapes на странице
    const allShapesAtPoint = window.editor.getShapesAtPoint(testPoint);
    console.log('getShapesAtPoint (все shapes в точке):', allShapesAtPoint);
}

// 5. Проверка регистрации shape utils
console.log('\n=== ПРОВЕРКА 5: Все зарегистрированные ShapeUtils ===');
const allShapeTypes = ['arrow', 'bookmark', 'draw', 'embed', 'frame', 'geo', 'group', 'highlight', 'image', 'line', 'note', 'text', 'video', 'custom-note'];
allShapeTypes.forEach(type => {
    try {
        const util = window.editor.getShapeUtil(type);
        console.log(`${type}:`, util ? '✅ зарегистрирован' : '❌ не найден');
    } catch (e) {
        console.log(`${type}: ❌ ошибка`, e.message);
    }
});

// 6. DOM проверка
console.log('\n=== ПРОВЕРКА 6: DOM элементы ===');
const domShapes = document.querySelectorAll('[data-shape-type="custom-note"]');
console.log('DOM элементов custom-note:', domShapes.length);
const allDomShapes = document.querySelectorAll('[data-shape-type]');
console.log('Всего DOM shape элементов:', allDomShapes.length);

console.log('\n✅ Диагностика завершена. Скопируйте весь вывод.');