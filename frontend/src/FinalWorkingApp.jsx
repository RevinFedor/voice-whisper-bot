import React from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import './custom-tldraw-fixed.css';
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

// ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ - используем Tldraw с hideUi
export default function FinalWorkingApp() {
    const handleMount = (editor) => {
        console.log('🚀 FinalWorkingApp: Editor mounted');
        
        // Создаем заметки через секунду для гарантии инициализации
        setTimeout(() => {
            console.log('📝 Creating custom notes...');
            
            // Создаем заметки разных типов
            const notes = [
                { 
                    x: 100, 
                    y: 110, 
                    title: 'Утренние мысли', 
                    content: 'Планирование задач на день...', 
                    noteType: 'voice', 
                    time: '08:30', 
                    duration: '1:45' 
                },
                { 
                    x: 100, 
                    y: 300, 
                    title: 'TODO список', 
                    content: '- Позвонить клиенту\n- Проверить почту', 
                    noteType: 'text', 
                    time: '09:15' 
                },
                { 
                    x: 350, 
                    y: 110, 
                    title: 'Начало дня', 
                    content: 'Проверка задач...', 
                    noteType: 'voice', 
                    time: '10:00', 
                    duration: '1:20' 
                },
                { 
                    x: 600, 
                    y: 110, 
                    title: 'Идея для проекта', 
                    content: 'Нужно создать систему управления...', 
                    noteType: 'voice', 
                    time: '09:15', 
                    duration: '2:14' 
                },
                { 
                    x: 350, 
                    y: 300, 
                    title: 'Встреча с командой', 
                    content: 'Обсуждение архитектуры проекта', 
                    noteType: 'text', 
                    time: '11:00' 
                },
                { 
                    x: 600, 
                    y: 300, 
                    title: 'Код ревью', 
                    content: 'Проверить PR #42', 
                    noteType: 'text', 
                    time: '14:30' 
                },
            ];
            
            notes.forEach((note) => {
                const id = createShapeId();
                try {
                    editor.createShape({
                        id,
                        type: 'custom-note',
                        x: note.x,
                        y: note.y,
                        props: {
                            w: 180,
                            h: 150,
                            richText: toRichText(note.title + '\n' + note.content),
                            noteType: note.noteType,
                            time: note.time,
                            duration: note.duration || '',
                        },
                    });
                    console.log(`✅ Created ${note.noteType} note: ${note.title}`);
                } catch (error) {
                    console.error(`❌ Failed to create note: ${note.title}`, error);
                }
            });
            
            // Создаем даты
            const dates = [
                { date: '07', month: 'АВГ', x: 100, y: 50 },
                { date: '08', month: 'АВГ', x: 350, y: 50 },
                { date: '09', month: 'АВГ', x: 600, y: 50, isToday: true },
                { date: '10', month: 'АВГ', x: 850, y: 50 },
            ];
            
            dates.forEach((dateInfo) => {
                const id = createShapeId();
                editor.createShape({
                    id,
                    type: 'text',
                    x: dateInfo.x,
                    y: dateInfo.y,
                    props: {
                        richText: toRichText(`${dateInfo.date}\n${dateInfo.month}`),
                        color: dateInfo.isToday ? 'green' : 'grey',
                        size: 'l',
                        font: 'sans',
                        autoSize: true,
                        w: 100,
                    },
                });
                console.log(`✅ Created date label: ${dateInfo.date}`);
            });
            
            console.log('📊 Total shapes:', editor.getCurrentPageShapes().length);
            
            // Центрируем камеру
            editor.zoomToFit();
            editor.setCamera({ x: 0, y: 0, z: 1 });
            
        }, 1000);
    };
    
    // Компоненты UI которые хотим убрать
    const components = {
        Toolbar: () => null,
        HelpMenu: () => null,
        ZoomMenu: () => null,
        MainMenu: () => null,
        Minimap: () => null,
        StylePanel: () => null,
        PageMenu: () => null,
        NavigationPanel: () => null,
        ContextMenu: () => null,
        ActionsMenu: () => null,
        QuickActions: () => null,
        HelperButtons: () => null,
        DebugPanel: () => null,
        DebugMenu: () => null,
        SharePanel: () => null,
        MenuPanel: () => null,
    };
    
    return (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }}>
            <Tldraw
                shapeUtils={[CustomNoteShapeUtil]}
                onMount={handleMount}
                hideUi={true}
                components={components}
            >
                <CustomControls />
            </Tldraw>
        </div>
    );
}