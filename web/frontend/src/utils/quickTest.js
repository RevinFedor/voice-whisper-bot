// Quick test script for checking shape click detection
// Run in browser console: window.testClicks()

window.testClicks = () => {
    console.log('🧪 QUICK CLICK TEST');
    console.log('Click on any custom note...');
    
    const testHandler = (e) => {
        if (e.name === 'pointer_down') {
            console.log('\n📍 Click detected:');
            console.log('  Target:', e.target);
            if (e.shape) {
                console.log('  ✅ Shape:', e.shape.type, e.shape.id);
            } else {
                console.log('  ❌ No shape in event');
                // Try manual detection
                const shape = window.editor.getShapeAtPoint(e.point, {
                    hitInside: true,
                    margin: 10
                });
                if (shape) {
                    console.log('  🔍 Found manually:', shape.type, shape.id);
                } else {
                    console.log('  ❌ No shape at point');
                }
            }
        }
    };
    
    window.editor.on('event', testHandler);
    
    // Auto cleanup after 10 seconds
    setTimeout(() => {
        window.editor.off('event', testHandler);
        console.log('✅ Test completed');
    }, 10000);
};

// Auto-run if editor exists
// if (window.editor) {
//     window.testClicks();
// }