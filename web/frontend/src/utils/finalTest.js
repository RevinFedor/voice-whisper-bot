// ФИНАЛЬНЫЙ ТЕСТ КЛИКОВ
// Запустите в консоли: window.finalTest()

window.finalTest = () => {
    console.log('🚀 ФИНАЛЬНЫЙ ТЕСТ КЛИКОВ');
    console.log('=========================');
    console.log('Кликните на любую заметку...\n');
    
    let testActive = true;
    
    const testHandler = (e) => {
        if (!testActive) return;
        
        if (e.name === 'pointer_down') {
            console.log('\n📍 КЛИК ЗАРЕГИСТРИРОВАН:');
            console.log('  Event target:', e.target);
            console.log('  Page point:', window.editor.inputs.currentPagePoint);
            
            // Проверяем hit detection
            const shape = window.editor.getShapeAtPoint(
                window.editor.inputs.currentPagePoint, 
                { hitInside: true, margin: 10 }
            );
            
            if (shape) {
                console.log('  ✅ Shape найден:', shape.type, shape.id);
                if (shape.type === 'custom-note') {
                    console.log('  🎯 ЭТО CUSTOM NOTE!');
                    console.log('  📝 Note data:', shape.props);
                }
            } else {
                console.log('  ❌ Shape не найден в этой точке');
            }
        }
        
        if (e.name === 'pointer_up') {
            // Проверяем открылась ли модалка
            setTimeout(() => {
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    console.log('  ✅ МОДАЛКА ОТКРЫЛАСЬ!');
                } else {
                    console.log('  ⚠️ Модалка не открылась');
                }
            }, 100);
        }
    };
    
    window.editor.on('event', testHandler);
    
    // Останавливаем тест через 15 секунд
    setTimeout(() => {
        testActive = false;
        window.editor.off('event', testHandler);
        console.log('\n✅ Тест завершен');
    }, 15000);
};

// Автозапуск если editor готов
// if (window.editor) {
//     console.log('💡 Запустите window.finalTest() для тестирования кликов');
// }