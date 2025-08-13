// Debug script for testing shape hit detection
// Run this in browser console to diagnose click detection issues

window.debugShapeDetection = () => {
    const editor = window.editor;
    if (!editor) {
        console.error('❌ Editor not found! Make sure tldraw is loaded.');
        return;
    }

    console.log('🔍 SHAPE DETECTION DEBUG');
    console.log('========================');
    
    // 1. Check if custom shapes are registered
    const shapes = editor.getCurrentPageShapes();
    const customNotes = shapes.filter(s => s.type === 'custom-note');
    
    console.log('📊 Total shapes:', shapes.length);
    console.log('📝 Custom notes:', customNotes.length);
    
    if (customNotes.length === 0) {
        console.warn('⚠️ No custom-note shapes found on the page!');
        return;
    }
    
    // 2. Test shape utilities
    console.log('\n🔧 SHAPE UTILITIES CHECK:');
    const shapeUtil = editor.getShapeUtil('custom-note');
    console.log('✅ ShapeUtil registered:', !!shapeUtil);
    
    if (shapeUtil) {
        const testShape = customNotes[0];
        console.log('📐 Test shape:', testShape.id);
        
        // Test geometry
        try {
            const geometry = shapeUtil.getGeometry(testShape);
            console.log('✅ Geometry created:', geometry);
            console.log('  - Type:', geometry.constructor.name);
            console.log('  - isFilled:', geometry.isFilled);
            console.log('  - bounds:', geometry.bounds);
            
            if (geometry.children) {
                console.log('  - Children:', geometry.children.length);
                geometry.children.forEach((child, i) => {
                    console.log(`    Child ${i}:`, child.constructor.name, 
                        'isFilled:', child.isFilled);
                });
            }
        } catch (e) {
            console.error('❌ Geometry error:', e);
        }
    }
    
    // 3. Test hit detection manually
    console.log('\n🎯 HIT DETECTION TEST:');
    console.log('Click on a custom note shape and check the output below...');
    
    // Add temporary event listener
    const testHandler = (eventInfo) => {
        if (eventInfo.name === 'pointer_down') {
            console.log('\n🖱️ POINTER DOWN EVENT:');
            console.log('  - Target:', eventInfo.target);
            console.log('  - Shape:', eventInfo.shape);
            console.log('  - Point:', eventInfo.point);
            
            // Test getShapeAtPoint
            const shape = editor.getShapeAtPoint(eventInfo.point, {
                hitInside: true,
                margin: 0,
            });
            console.log('  - getShapeAtPoint result:', shape);
            
            if (shape && shape.type === 'custom-note') {
                console.log('✅ CUSTOM NOTE DETECTED!');
            } else if (shape) {
                console.log('⚠️ Different shape detected:', shape.type);
            } else {
                console.log('❌ No shape detected at point');
                
                // Try with different options
                const shapeWithMargin = editor.getShapeAtPoint(eventInfo.point, {
                    hitInside: false,
                    margin: 10,
                });
                console.log('  - With margin 10:', shapeWithMargin);
                
                const selectedShape = editor.getSelectedShapeAtPoint(eventInfo.point);
                console.log('  - Selected shape at point:', selectedShape);
            }
        }
    };
    
    editor.on('event', testHandler);
    
    // Clean up after 30 seconds
    setTimeout(() => {
        editor.off('event', testHandler);
        console.log('🛑 Debug event listener removed');
    }, 30000);
    
    // 4. Display current shapes info
    console.log('\n📋 CURRENT SHAPES INFO:');
    customNotes.slice(0, 3).forEach(shape => {
        console.log(`Shape ${shape.id}:`, {
            x: shape.x,
            y: shape.y,
            width: shape.props.w,
            height: shape.props.h,
            type: shape.type,
            noteType: shape.props.noteType,
        });
    });
    
    // 5. Test specific point
    if (customNotes.length > 0) {
        const testShape = customNotes[0];
        const testPoint = {
            x: testShape.x + testShape.props.w / 2,
            y: testShape.y + testShape.props.h / 2,
        };
        
        console.log('\n🔬 TESTING SPECIFIC POINT:');
        console.log('  Testing center of shape:', testShape.id);
        console.log('  Point:', testPoint);
        
        const hitShape = editor.getShapeAtPoint(testPoint, {
            hitInside: true,
            margin: 0,
        });
        
        if (hitShape && hitShape.id === testShape.id) {
            console.log('✅ Hit detection working correctly!');
        } else {
            console.log('❌ Hit detection failed!');
            console.log('  Expected:', testShape.id);
            console.log('  Got:', hitShape?.id || 'null');
        }
    }
    
    console.log('\n💡 TIP: Click on any shape to see detailed hit detection info');
    console.log('Debug listener will auto-remove in 30 seconds');
};

// Auto-run on load
if (window.editor) {
    console.log('🚀 Running shape detection debug...');
    window.debugShapeDetection();
} else {
    console.log('⏳ Editor not ready. Run window.debugShapeDetection() when ready.');
}