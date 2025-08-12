import React from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import './custom-tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { CustomControls } from './components/CustomControls';

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

export default function FixedCustomApp() {
    // Используем Tldraw вместо TldrawEditor
    const handleMount = (editor) => {
        console.log('FixedCustomApp: Editor mounted');
        
        // Создаем заметки
        const notes = [
            { x: 100, y: 110, title: 'Утренние мысли', content: 'Планирование задач на день...', noteType: 'voice', time: '08:30', duration: '1:45' },
            { x: 100, y: 300, title: 'TODO список', content: '- Позвонить клиенту\n- Проверить почту', noteType: 'text', time: '09:15' },
            { x: 350, y: 110, title: 'Начало дня', content: 'Проверка задач...', noteType: 'voice', time: '10:00', duration: '1:20' },
            { x: 600, y: 110, title: 'Идея для проекта', content: 'Нужно создать систему управления...', noteType: 'voice', time: '09:15', duration: '2:14' },
        ];

        notes.forEach((note) => {
            editor.createShape({
                id: createShapeId(),
                type: 'custom-note',
                x: note.x,
                y: note.y,
                props: {
                    richText: toRichText(note.title + '\n' + note.content),
                    noteType: note.noteType,
                    time: note.time,
                    duration: note.duration || '',
                    color: 'black',
                    size: 'm',
                },
            });
        });

        // Создаем даты
        const dates = [
            { date: '07', month: 'АВГ', x: 100 },
            { date: '08', month: 'АВГ', x: 350 },
            { date: '09', month: 'АВГ', x: 600, isToday: true },
        ];

        dates.forEach((dateInfo) => {
            editor.createShape({
                id: createShapeId(),
                type: 'text',
                x: dateInfo.x,
                y: 50,
                props: {
                    text: `${dateInfo.date}\n${dateInfo.month}`,
                    color: dateInfo.isToday ? 'green' : 'grey',
                    size: 'l',
                    font: 'sans',
                },
            });
        });

        console.log('Created shapes:', editor.getCurrentPageShapes().length);
    };

    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <Tldraw 
                shapeUtils={[CustomNoteShapeUtil]}
                onMount={handleMount}
                hideUi={false}
            />
            <CustomControls />
        </div>
    );
}