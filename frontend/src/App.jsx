import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';

// Функция для преобразования обычного текста в richText формат для note shape
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

export default function App() {
    const handleMount = (editor) => {
        // Создаем заметки используя встроенный тип 'note'
        editor.createShape({
            id: createShapeId(),
            type: 'note',
            x: 100,
            y: 100,
            props: {
                richText: toRichText('Утренние мысли\n08:30\n\nПланирование задач на день...'),
                color: 'blue',
                size: 'l',
            },
        });
    };

    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <Tldraw onMount={handleMount} />
        </div>
    );
}
