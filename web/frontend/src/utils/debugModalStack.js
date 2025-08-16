// Debug utilities for testing Modal Stack Escape handling

// Добавляем команды в window для удобного тестирования
if (typeof window !== 'undefined') {
    
    // Тестовые сценарии для проверки Escape
    window.testModalEscape = {
        
        // Инструкция по тестированию
        help: () => {
            console.log('🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ ESCAPE В МОДАЛКАХ');
            console.log('=========================================');
            console.log('');
            console.log('📋 ДОСТУПНЫЕ КОМАНДЫ:');
            console.log('  testModalEscape.scenario1() - Тест заголовка');
            console.log('  testModalEscape.scenario2() - Тест AI генерации');
            console.log('  testModalEscape.scenario3() - Тест тегов');
            console.log('  testModalEscape.scenario4() - Комбинированный тест');
            console.log('  testModalEscape.checkStack() - Показать текущий стек');
            console.log('');
            console.log('⌨️ ГОРЯЧИЕ КЛАВИШИ:');
            console.log('  Esc - закрыть текущий активный слой');
            console.log('');
        },
        
        // Сценарий 1: Работа с заголовком
        scenario1: () => {
            console.log('📝 СЦЕНАРИЙ 1: Работа с заголовком');
            console.log('-----------------------------------');
            console.log('1. Откройте заметку (кликните на любую)');
            console.log('2. Нажмите кнопку ↕ рядом с заголовком для раскрытия');
            console.log('3. Нажмите Esc → заголовок должен свернуться');
            console.log('4. Нажмите Esc еще раз → модалка должна закрыться');
            console.log('');
            console.log('✅ Ожидаемый результат:');
            console.log('   - Первый Esc сворачивает textarea');
            console.log('   - Второй Esc закрывает модалку');
        },
        
        // Сценарий 2: AI генерация заголовка
        scenario2: () => {
            console.log('🤖 СЦЕНАРИЙ 2: AI генерация заголовка');
            console.log('---------------------------------------');
            console.log('1. Откройте заметку');
            console.log('2. Нажмите ✨ (AI чат) рядом с заголовком');
            console.log('3. Введите любой текст в поле промпта');
            console.log('4. Нажмите Esc → панель чата должна закрыться');
            console.log('5. Нажмите 📜 (История)');
            console.log('6. Нажмите Esc → панель истории должна закрыться');
            console.log('7. Нажмите Esc → модалка должна закрыться');
            console.log('');
            console.log('✅ Ожидаемый результат:');
            console.log('   - Каждый Esc закрывает одну панель');
            console.log('   - Последний Esc закрывает модалку');
        },
        
        // Сценарий 3: Работа с тегами
        scenario3: () => {
            console.log('🏷️ СЦЕНАРИЙ 3: Работа с тегами');
            console.log('--------------------------------');
            console.log('1. Откройте заметку');
            console.log('2. Нажмите "+ Добавить" в блоке тегов');
            console.log('3. Введите название тега');
            console.log('4. Нажмите Esc → input должен закрыться без сохранения');
            console.log('5. Нажмите ✨ в блоке тегов (AI генерация)');
            console.log('6. Нажмите Esc → панель AI должна закрыться');
            console.log('7. Нажмите 🏷️ (Obsidian теги)');
            console.log('8. Нажмите Esc → панель должна закрыться');
            console.log('9. Нажмите Esc → модалка должна закрыться');
            console.log('');
            console.log('✅ Ожидаемый результат:');
            console.log('   - Esc отменяет ввод тега');
            console.log('   - Esc закрывает панели по очереди');
        },
        
        // Сценарий 4: Комбинированный
        scenario4: () => {
            console.log('🔄 СЦЕНАРИЙ 4: Комбинированный тест');
            console.log('-------------------------------------');
            console.log('1. Откройте заметку');
            console.log('2. Раскройте заголовок (↕)');
            console.log('3. Нажмите Esc → заголовок свернется');
            console.log('4. Откройте AI чат заголовков (✨)');
            console.log('5. Перейдите к тегам и нажмите "+ Добавить"');
            console.log('6. Нажмите Esc → input тегов закроется');
            console.log('7. Нажмите Esc → AI чат закроется');
            console.log('8. Нажмите Esc → модалка закроется');
            console.log('');
            console.log('✅ Ожидаемый результат:');
            console.log('   - Закрытие происходит в обратном порядке открытия');
            console.log('   - LIFO (Last In, First Out) принцип');
        },
        
        // Проверка текущего стека
        checkStack: () => {
            console.log('📚 ПРОВЕРКА СТЕКА МОДАЛОК');
            console.log('-------------------------');
            console.log('Откройте любую модалку и вызовите эту команду снова');
            console.log('');
            console.log('Для просмотра стека в реальном времени:');
            console.log('1. Откройте консоль разработчика');
            console.log('2. Откройте модалку с заметкой');
            console.log('3. Взаимодействуйте с элементами');
            console.log('4. Смотрите логи с префиксом 📚 и 📌');
        }
    };
    
    // Автоматически показываем help при загрузке
    console.log('💡 Система Escape для модалок загружена!');
    console.log('   Введите: testModalEscape.help() для инструкций');
    console.log('   Введите: testModalEscape.checkStack() для проверки стека');
}

// Тест DatePickerModal
window.testDatePicker = () => {
    console.log('📅 ТЕСТ DatePickerModal');
    console.log('------------------------');
    console.log('1. Нажмите кнопку "➕ Добавить заметку"');
    console.log('2. Откроется DatePickerModal');
    console.log('3. Нажмите Esc → модалка должна закрыться');
    console.log('');
    console.log('✅ Ожидаемый результат:');
    console.log('   - Esc закрывает выбор даты без сохранения');
};

// Проверка приоритетов
window.checkPriorities = () => {
    console.log('🎯 СИСТЕМА ПРИОРИТЕТОВ');
    console.log('----------------------');
    console.log('DROPDOWN: 1000 (высший)');
    console.log('AUTOCOMPLETE: 900');
    console.log('EXPANDED_INPUT: 800');
    console.log('TAG_INPUT: 700');
    console.log('PROMPT_PANEL: 600');
    console.log('TAG_PANELS: 500');
    console.log('NOTE_MODAL: 100');
    console.log('DATE_PICKER: 100');
    console.log('BACKDROP: 10 (низший)');
    console.log('');
    console.log('Чем выше приоритет, тем первее закрывается при Esc');
};

// Экспорт для использования в других модулях
export const modalStackDebug = {
    testScenarios: window.testModalEscape,
    checkPriorities: window.checkPriorities,
    testDatePicker: window.testDatePicker
};