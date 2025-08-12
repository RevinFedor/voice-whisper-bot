import { useEffect } from 'react';
import { useEditor, createShapeId } from 'tldraw';

// Функция для преобразования текста в richText формат
function toRichText(text) {
    const lines = text.split('\n');
    const content = lines.map((line) => {
        if (!line) {
            return { type: 'paragraph' };
        }
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
        };
    });
    return { type: 'doc', content };
}

// Функция для создания заметок на сетке по датам
function createNotesGrid(editor) {
    console.log('Creating notes grid...');
    
    const dates = [
        { date: '07', month: 'АВГ', x: 100 },
        { date: '08', month: 'АВГ', x: 350 },
        { date: '09', month: 'АВГ', x: 600, isToday: true },
        { date: '10', month: 'АВГ', x: 850 },
    ];

    const notes = [
        // 7 августа
        {
            x: 100, y: 110,
            noteType: 'voice',
            title: 'Утренние мысли',
            content: 'Планирование задач на день...',
            time: '08:30',
            duration: '1:45',
        },
        {
            x: 100, y: 300,
            noteType: 'text',
            title: 'TODO список',
            content: '- Позвонить клиенту\n- Проверить почту',
            time: '09:15',
        },
        {
            x: 100, y: 490,
            noteType: 'voice',
            title: 'Встреча с командой',
            content: 'Обсудили новые фичи, нужно...',
            time: '11:20',
            duration: '3:30',
        },
        {
            x: 100, y: 680,
            noteType: 'collection',
            title: 'Дневная сессия',
            content: '5 заметок про архитектуру',
            time: '14:00',
        },
        // 8 августа
        {
            x: 350, y: 110,
            noteType: 'voice',
            title: 'Начало дня',
            content: 'Проверка задач...',
            time: '10:00',
            duration: '1:20',
        },
        {
            x: 350, y: 300,
            noteType: 'text',
            title: 'Обед мысли',
            content: 'Надо переделать компонент...',
            time: '12:30',
        },
        // 9 августа (сегодня)
        {
            x: 600, y: 110,
            noteType: 'voice',
            title: 'Идея для проекта',
            content: 'Нужно создать систему управления...',
            time: '09:15',
            duration: '2:14',
        },
        {
            x: 600, y: 300,
            noteType: 'text',
            title: 'Быстрая заметка',
            content: 'Не забыть добавить drag&drop',
            time: '10:30',
        },
        {
            x: 600, y: 490,
            noteType: 'collection',
            title: 'Архитектура системы',
            content: '3 заметки: База, API, Frontend',
            time: '11:00',
        },
    ];

    // Создаем заметки
    notes.forEach((note) => {
        const richTextContent = toRichText(note.title + '\n' + note.content);
        
        try {
            editor.createShape({
                id: createShapeId(),
                type: 'note',
                x: note.x,
                y: note.y,
                props: {
                    richText: richTextContent,
                    noteType: note.noteType,
                    time: note.time,
                    duration: note.duration || '',
                    color: 'black',
                    size: 'm',
                },
            });
            console.log('Created note:', note.title);
        } catch (error) {
            console.error('Error creating note:', error);
        }
    });

    // Создаем текстовые метки для дат
    dates.forEach((dateInfo) => {
        try {
            editor.createShape({
                id: createShapeId(),
                type: 'text',
                x: dateInfo.x,
                y: 50,
                props: {
                    richText: toRichText(`${dateInfo.date}\n${dateInfo.month}`),
                    color: dateInfo.isToday ? 'green' : 'grey',
                    size: 'l',
                    font: 'sans',
                    textAlign: 'middle',
                    autoSize: true,
                    w: 100,
                },
            });
            console.log('Created date label:', dateInfo.date);
        } catch (error) {
            console.error('Error creating date label:', error);
        }
    });

    console.log('Notes grid created successfully');
}

export function ShapeInitializer() {
    const editor = useEditor();
    
    useEffect(() => {
        if (editor) {
            console.log('Editor is ready, initializing shapes...');
            
            // Небольшая задержка для завершения инициализации
            setTimeout(() => {
                createNotesGrid(editor);
                
                // Настройка камеры
                editor.setCamera({
                    x: 0,
                    y: 0,
                    z: 1,
                });
                
                console.log('Initialization complete');
            }, 100);
        }
    }, [editor]);
    
    return null;
}

export default ShapeInitializer;