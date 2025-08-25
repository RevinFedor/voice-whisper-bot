// Debug navigation with arrow keys
window.debugNavigation = () => {
    console.log('🧭 Navigation Debug Tool');
    console.log('=' .repeat(50));
    
    // Check if modal is open
    const modalOpen = document.querySelector('[style*="z-index: 9999"]');
    if (!modalOpen) {
        console.log('❌ Note modal is not open. Open a note first!');
        return;
    }
    
    console.log('✅ Modal is open');
    
    // Simulate arrow key press
    window.testArrowUp = () => {
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            code: 'ArrowUp',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
        console.log('⬆️ Sent ArrowUp event');
    };
    
    window.testArrowDown = () => {
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            code: 'ArrowDown',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
        console.log('⬇️ Sent ArrowDown event');
    };
    
    window.testW = () => {
        const event = new KeyboardEvent('keydown', {
            key: 'w',
            code: 'KeyW',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
        console.log('⬆️ Sent W key event');
    };
    
    window.testS = () => {
        const event = new KeyboardEvent('keydown', {
            key: 's',
            code: 'KeyS',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
        console.log('⬇️ Sent S key event');
    };
    
    console.log('\n📝 Instructions:');
    console.log('1. Open a note in a column with multiple notes');
    console.log('2. Make sure no input/textarea is focused');
    console.log('3. Navigation keys:');
    console.log('   • ↑ or W = Previous note (up)');
    console.log('   • ↓ or S = Next note (down)');
    console.log('4. Test functions:');
    console.log('   • window.testArrowUp() / window.testArrowDown()');
    console.log('   • window.testW() / window.testS()');
    console.log('\n🔍 Watch console for navigation logs');
};

// Auto-register on load
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.log('💡 Navigation debug ready! Use window.debugNavigation()');
    }, 1000);
}