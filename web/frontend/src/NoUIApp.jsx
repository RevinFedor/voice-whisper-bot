import React from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { CustomControls } from './components/CustomControls';

// CSS для полного скрытия UI
const hideUIStyles = `
    /* Скрываем ВСЕ элементы UI tldraw */
    .tlui-layout__top,
    .tlui-layout__bottom,
    .tlui-toolbar,
    .tlui-style-panel,
    .tlui-panel,
    .tlui-menu,
    .tlui-button,
    .tlui-help-menu,
    .tlui-minimap,
    .tlui-page-menu,
    .tlui-zoom-menu,
    .tlui-navigation-panel,
    .tlui-quick-actions,
    .tlui-actions-menu,
    .tlui-context-menu,
    .tlui-main-menu,
    .tlui-share-panel,
    .tlui-debug-panel,
    .tlui-debug-menu,
    .tlui-menu-panel,
    .tlui-helper-buttons,
    [data-testid="main-menu"],
    [data-testid="tools-panel"],
    [data-testid="toolbar"],
    [data-testid="style-panel"],
    [data-testid="page-menu"],
    [data-testid="navigation-zone"],
    [data-testid="help-menu"],
    [data-testid="menu-panel"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
    
    /* Убеждаемся что canvas видим */
    .tl-canvas {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    
    .tl-shapes {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    
    /* Градиентный фон */
    .tl-background {
        background: 
            radial-gradient(circle at 20% 50%, #0a1a0a 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, #1a0a1a 0%, transparent 50%),
            #0a0a0a !important;
    }
`;

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

// Версия без UI
export default function NoUIApp() {
    const handleMount = (editor) => {
        console.log('🚀 NoUIApp: Editor mounted');
        
        // Создаем заметки
        setTimeout(() => {
            console.log('📝 Creating notes...');
            
            const notes = [
                { x: 100, y: 110, title: 'Утренние мысли', noteType: 'voice', time: '08:30', duration: '1:45' },
                { x: 100, y: 300, title: 'TODO список', noteType: 'text', time: '09:15' },
                { x: 350, y: 110, title: 'Начало дня', noteType: 'voice', time: '10:00', duration: '1:20' },
                { x: 600, y: 110, title: 'Идея для проекта', noteType: 'voice', time: '09:15', duration: '2:14' },
                { x: 350, y: 300, title: 'Встреча с командой', noteType: 'text', time: '11:00' },
                { x: 600, y: 300, title: 'Код ревью', noteType: 'text', time: '14:30' },
            ];
            
            notes.forEach((note) => {
                const id = createShapeId();
                editor.createShape({
                    id,
                    type: 'custom-note',
                    x: note.x,
                    y: note.y,
                    props: {
                        w: 180,
                        h: 150,
                        richText: toRichText(note.title),
                        noteType: note.noteType,
                        time: note.time,
                        duration: note.duration || '',
                    },
                });
                console.log(`✅ Created ${note.noteType} note: ${note.title}`);
            });
            
            // Даты
            const dates = [
                { date: '07', month: 'АВГ', x: 100, y: 50 },
                { date: '08', month: 'АВГ', x: 350, y: 50 },
                { date: '09', month: 'АВГ', x: 600, y: 50, isToday: true },
            ];
            
            dates.forEach((dateInfo) => {
                editor.createShape({
                    id: createShapeId(),
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
            });
            
            console.log('Total shapes:', editor.getCurrentPageShapes().length);
            
            // Центрируем
            editor.setCamera({ x: 0, y: 0, z: 1 });
            
        }, 1000);
    };
    
    return (
        <>
            <style>{hideUIStyles}</style>
            <div style={{ position: 'fixed', inset: 0 }}>
                <Tldraw
                    shapeUtils={[CustomNoteShapeUtil]}
                    onMount={handleMount}
                >
                    <CustomControls />
                </Tldraw>
            </div>
        </>
    );
}