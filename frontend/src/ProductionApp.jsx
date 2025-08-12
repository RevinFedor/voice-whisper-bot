import React from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { CustomControls } from './components/CustomControls';
import './utils/debugHelpers'; // Автоматически загружает debug функции

// Полные стили как в index-d.html
const customStyles = `
    /* Скрываем ВСЕ элементы стандартного UI */
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
    [data-testid="menu-panel"],
    .tlui-layout > div:first-child,
    .tlui-layout > div:last-child {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
    }
    
    /* Градиентный фон как в макете */
    .tl-background {
        background: 
            radial-gradient(circle at 20% 50%, #0a1a0a 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, #1a0a1a 0%, transparent 50%),
            #0a0a0a !important;
    }
    
    /* Убираем сетку */
    .tl-grid {
        display: none !important;
    }
    
    /* Основной контейнер */
    .tl-container {
        background: #0a0a0a;
    }
    
    /* Убираем все handles и UI элементы */
    .tl-handle,
    .tl-corner-handle,
    .tl-rotation-handle,
    .tl-mobile-rotate__bg,
    .tl-mobile-rotate__fg,
    .tl-selection__bg,
    .tl-selection__fg {
        opacity: 0.3 !important;
    }
    
    /* Стили для кастомных заметок */
    .custom-note {
        transition: all 0.2s ease !important;
    }
    
    .custom-note:hover {
        transform: scale(1.02);
        z-index: 100;
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

// PRODUCTION версия - полная кастомизация
export default function ProductionApp() {
    const handleMount = (editor) => {
        console.log('🚀 ProductionApp: Initializing...');
        
        // Сохраняем editor для debug функций
        window.editor = editor;
        window.saveEditor(editor);
        
        // Создаем много заметок разных типов
        setTimeout(() => {
            console.log('📝 Creating production notes...');
            
            // Голосовые заметки
            const voiceNotes = [
                { x: 100, y: 110, title: 'Утренние мысли', content: 'Планирование задач на день\nПросмотр календаря', time: '08:30', duration: '1:45' },
                { x: 350, y: 110, title: 'Начало дня', content: 'Проверка задач\nStandup meeting', time: '10:00', duration: '1:20' },
                { x: 600, y: 110, title: 'Идея для проекта', content: 'Система управления заметками\nИнтеграция с Obsidian', time: '09:15', duration: '2:14' },
                { x: 850, y: 110, title: 'Звонок клиенту', content: 'Обсуждение требований\nУточнение сроков', time: '14:00', duration: '15:30' },
            ];
            
            // Текстовые заметки
            const textNotes = [
                { x: 100, y: 300, title: 'TODO список', content: '- Позвонить клиенту\n- Проверить почту\n- Code review', time: '09:15' },
                { x: 350, y: 300, title: 'Встреча с командой', content: 'Обсуждение архитектуры\nРаспределение задач', time: '11:00' },
                { x: 600, y: 300, title: 'Код ревью', content: 'PR #42: Fix validation\nPR #43: Add features', time: '14:30' },
                { x: 850, y: 300, title: 'Заметки встречи', content: 'Важные решения:\n- Миграция на v3\n- Новый дизайн', time: '16:00' },
            ];
            
            // Коллекции
            const collections = [
                { x: 100, y: 490, title: 'Дизайн система', content: '5 заметок\nКомпоненты, цвета, типографика', time: '12:00' },
                { x: 350, y: 490, title: 'API документация', content: '12 заметок\nEndpoints, схемы, примеры', time: '13:00' },
                { x: 600, y: 490, title: 'Архитектура', content: '3 заметки\nБаза, API, Frontend', time: '11:00' },
            ];
            
            // Создаем голосовые заметки
            voiceNotes.forEach((note) => {
                const id = createShapeId();
                editor.createShape({
                    id,
                    type: 'custom-note',
                    x: note.x,
                    y: note.y,
                    props: {
                        w: 180,
                        h: 150,
                        richText: toRichText(note.title + '\n\n' + note.content),
                        noteType: 'voice',
                        time: note.time,
                        duration: note.duration,
                    },
                });
            });
            
            // Создаем текстовые заметки
            textNotes.forEach((note) => {
                const id = createShapeId();
                editor.createShape({
                    id,
                    type: 'custom-note',
                    x: note.x,
                    y: note.y,
                    props: {
                        w: 180,
                        h: 150,
                        richText: toRichText(note.title + '\n\n' + note.content),
                        noteType: 'text',
                        time: note.time,
                    },
                });
            });
            
            // Создаем коллекции
            collections.forEach((note) => {
                const id = createShapeId();
                editor.createShape({
                    id,
                    type: 'custom-note',
                    x: note.x,
                    y: note.y,
                    props: {
                        w: 180,
                        h: 150,
                        richText: toRichText(note.title + '\n\n' + note.content),
                        noteType: 'collection',
                        time: note.time,
                    },
                });
            });
            
            // Создаем даты как в макете
            const dates = [
                { date: '07', month: 'АВГ', x: 100, y: 50 },
                { date: '08', month: 'АВГ', x: 350, y: 50 },
                { date: '09', month: 'АВГ', x: 600, y: 50, isToday: true },
                { date: '10', month: 'АВГ', x: 850, y: 50 },
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
                        size: 'xl',
                        font: 'sans',
                        autoSize: true,
                        w: 50,
                        textAlign: 'middle',
                    },
                });
            });
            
            console.log('✅ Created', editor.getCurrentPageShapes().length, 'shapes');
            
            // Устанавливаем начальную позицию камеры
            editor.setCamera({ x: 0, y: 0, z: 0.8 });
            
        }, 500);
    };
    
    return (
        <>
            <style>{customStyles}</style>
            <div style={{ 
                position: 'fixed', 
                inset: 0,
                background: '#0a0a0a',
                overflow: 'hidden'
            }}>
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