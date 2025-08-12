import React, { useEffect, useState } from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';

function toRichText(text) {
    const lines = text.split('\n');
    const content = lines.map((line) => {
        if (!line) return { type: 'paragraph' };
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
        };
    });
    return { type: 'doc', content };
}

// Date-based layout manager
class DateLayoutManager {
    constructor(config = {}) {
        this.config = {
            columnWidth: 180,
            columnSpacing: 50,
            rowHeight: 150,
            rowSpacing: 30,
            startX: 100,
            startY: 120,
            headerY: 50,
            ...config
        };
        this.occupancyMap = new Map();
    }
    
    getColumnX(date, baseDate) {
        const daysDiff = Math.floor((date - baseDate) / (24 * 60 * 60 * 1000));
        return this.config.startX + (daysDiff * (this.config.columnWidth + this.config.columnSpacing));
    }
    
    getNextAvailableY(columnX, preferredY = this.config.startY) {
        const columnKey = `col_${columnX}`;
        if (!this.occupancyMap.has(columnKey)) {
            this.occupancyMap.set(columnKey, []);
        }
        
        const occupiedSlots = this.occupancyMap.get(columnKey);
        let y = preferredY;
        
        // Find next available slot
        while (occupiedSlots.some(slot => 
            y < slot.y + slot.height && y + this.config.rowHeight > slot.y
        )) {
            y += this.config.rowHeight + this.config.rowSpacing;
        }
        
        // Register this slot as occupied
        occupiedSlots.push({ y, height: this.config.rowHeight });
        occupiedSlots.sort((a, b) => a.y - b.y);
        
        return y;
    }
    
    calculatePosition(note, baseDate) {
        const date = new Date(note.date);
        const x = this.getColumnX(date, baseDate);
        
        // Calculate preferred Y based on time
        let preferredY = this.config.startY;
        if (note.time) {
            const [hours, minutes] = note.time.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes;
            const minutesSince8AM = Math.max(0, totalMinutes - (8 * 60));
            const hourSlots = Math.floor(minutesSince8AM / 60);
            preferredY = this.config.startY + (hourSlots * 40);
        }
        
        const y = this.getNextAvailableY(x, preferredY);
        
        return { x, y };
    }
    
    reset() {
        this.occupancyMap.clear();
    }
}

export default function TestDateLayout() {
    const [editor, setEditor] = useState(null);
    const [layoutManager] = useState(new DateLayoutManager());
    const [notes, setNotes] = useState([]);
    
    const handleMount = (editor) => {
        console.log('🚀 TestDateLayout: Editor mounted');
        setEditor(editor);
        window.dateEditor = editor;
        
        // Initial test data
        const testNotes = [
            { date: '2024-08-07', time: '08:30', title: 'Morning standup', type: 'voice' },
            { date: '2024-08-07', time: '09:15', title: 'Code review', type: 'text' },
            { date: '2024-08-07', time: '10:00', title: 'Team meeting', type: 'voice' },
            { date: '2024-08-07', time: '14:00', title: 'Client call', type: 'voice' },
            { date: '2024-08-08', time: '09:00', title: 'Planning session', type: 'text' },
            { date: '2024-08-08', time: '11:00', title: 'Documentation', type: 'text' },
            { date: '2024-08-08', time: '15:00', title: 'Sprint review', type: 'voice' },
            { date: '2024-08-09', time: '08:00', title: 'Early meeting', type: 'voice' },
            { date: '2024-08-09', time: '10:30', title: 'Architecture discussion', type: 'text' },
            { date: '2024-08-09', time: '14:00', title: 'One-on-one', type: 'voice' },
        ];
        
        setNotes(testNotes);
        createShapesFromNotes(testNotes);
    };
    
    const createShapesFromNotes = (notesToCreate) => {
        if (!editor) return;
        
        // Clear existing shapes
        const existingShapes = editor.getCurrentPageShapes();
        editor.deleteShapes(existingShapes.map(s => s.id));
        
        // Reset layout manager
        layoutManager.reset();
        
        const baseDate = new Date('2024-08-07');
        const dateColumns = new Map();
        
        // Group notes by date
        notesToCreate.forEach(note => {
            const dateKey = note.date;
            if (!dateColumns.has(dateKey)) {
                dateColumns.set(dateKey, []);
            }
            dateColumns.get(dateKey).push(note);
        });
        
        // Create date headers
        let columnIndex = 0;
        dateColumns.forEach((notes, dateStr) => {
            const date = new Date(dateStr);
            const columnX = layoutManager.getColumnX(date, baseDate);
            
            // Create date header
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
            
            editor.createShape({
                id: createShapeId(),
                type: 'text',
                x: columnX + layoutManager.config.columnWidth / 2 - 25,
                y: layoutManager.config.headerY,
                props: {
                    richText: toRichText(`${day}\n${month}`),
                    color: columnIndex === 0 ? 'green' : 'grey',
                    size: 'xl',
                    font: 'sans',
                    autoSize: true,
                    w: 50,
                    textAlign: 'middle',
                },
            });
            
            columnIndex++;
        });
        
        // Create note shapes
        notesToCreate.forEach(note => {
            const position = layoutManager.calculatePosition(note, baseDate);
            
            editor.createShape({
                id: createShapeId(),
                type: 'custom-note',
                x: position.x,
                y: position.y,
                props: {
                    w: layoutManager.config.columnWidth,
                    h: layoutManager.config.rowHeight,
                    richText: toRichText(`${note.title}\n\n${note.type === 'voice' ? '🎙️ Voice note' : '📝 Text note'}`),
                    noteType: note.type,
                    time: note.time,
                    duration: note.type === 'voice' ? `${Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}` : '',
                },
            });
        });
        
        // Center camera on shapes
        editor.setCamera({ x: 0, y: 0, z: 0.8 });
    };
    
    const addRandomNote = () => {
        const dates = ['2024-08-07', '2024-08-08', '2024-08-09', '2024-08-10'];
        const types = ['voice', 'text'];
        const titles = [
            'Quick note', 'Important idea', 'Meeting notes', 'Action items',
            'Follow-up', 'Reminder', 'Decision', 'Question', 'Task'
        ];
        
        const newNote = {
            date: dates[Math.floor(Math.random() * dates.length)],
            time: `${8 + Math.floor(Math.random() * 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
            title: titles[Math.floor(Math.random() * titles.length)],
            type: types[Math.floor(Math.random() * types.length)],
        };
        
        const updatedNotes = [...notes, newNote];
        setNotes(updatedNotes);
        createShapesFromNotes(updatedNotes);
        
        console.log('➕ Added note:', newNote);
    };
    
    const simulateFromDatabase = () => {
        // Simulate notes coming from database with different dates/times
        const dbNotes = [
            { date: '2024-08-06', time: '16:00', title: 'Yesterday\'s summary', type: 'text' },
            { date: '2024-08-07', time: '07:00', title: 'Early morning thoughts', type: 'voice' },
            { date: '2024-08-07', time: '12:00', title: 'Lunch ideas', type: 'text' },
            { date: '2024-08-07', time: '18:00', title: 'End of day review', type: 'voice' },
            { date: '2024-08-08', time: '13:00', title: 'Afternoon tasks', type: 'text' },
            { date: '2024-08-09', time: '09:30', title: 'Weekend planning', type: 'voice' },
            { date: '2024-08-10', time: '10:00', title: 'Future meeting', type: 'text' },
        ];
        
        setNotes(dbNotes);
        createShapesFromNotes(dbNotes);
        console.log('📊 Loaded from database:', dbNotes.length, 'notes');
    };
    
    const testCollisionAvoidance = () => {
        // Create many notes at the same time to test collision avoidance
        const collisionNotes = [];
        for (let i = 0; i < 5; i++) {
            collisionNotes.push({
                date: '2024-08-08',
                time: '10:00', // Same time!
                title: `Collision test ${i + 1}`,
                type: i % 2 === 0 ? 'voice' : 'text',
            });
        }
        
        setNotes(collisionNotes);
        createShapesFromNotes(collisionNotes);
        console.log('💥 Testing collision avoidance with', collisionNotes.length, 'notes at same time');
    };
    
    return (
        <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <Tldraw
                    shapeUtils={[CustomNoteShapeUtil]}
                    onMount={handleMount}
                />
            </div>
            
            <div style={{ 
                width: '350px', 
                background: '#1a1a1a', 
                color: '#e0e0e0',
                padding: '20px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
            }}>
                <h3>📅 Date-Based Layout Test</h3>
                
                <div style={{ marginBottom: '20px' }}>
                    <h4>Test Actions:</h4>
                    <button onClick={addRandomNote} style={buttonStyle}>
                        Add Random Note ➕
                    </button>
                    <button onClick={simulateFromDatabase} style={buttonStyle}>
                        Load from DB 📊
                    </button>
                    <button onClick={testCollisionAvoidance} style={buttonStyle}>
                        Test Collisions 💥
                    </button>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <h4>Layout Config:</h4>
                    <pre style={{ 
                        background: '#2a2a2a', 
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                    }}>
{JSON.stringify(layoutManager.config, null, 2)}
                    </pre>
                </div>
                
                <div>
                    <h4>Current Notes ({notes.length}):</h4>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {notes.map((note, i) => (
                            <div key={i} style={{ 
                                marginBottom: '10px',
                                padding: '10px',
                                background: '#2a2a2a',
                                borderRadius: '4px',
                                borderLeft: `3px solid ${note.type === 'voice' ? '#4a9eff' : '#4aff4a'}`,
                            }}>
                                <div style={{ fontWeight: 'bold' }}>
                                    {note.title}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                                    📅 {note.date} | ⏰ {note.time} | {note.type === 'voice' ? '🎙️' : '📝'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                    <h4>How it works:</h4>
                    <ul style={{ fontSize: '11px', color: '#888', paddingLeft: '20px' }}>
                        <li>Notes are grouped by date into columns</li>
                        <li>Within columns, notes are positioned by time</li>
                        <li>Collision detection prevents overlapping</li>
                        <li>Automatic spacing and alignment</li>
                        <li>Responsive to new notes from DB</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

const buttonStyle = {
    display: 'block',
    width: '100%',
    padding: '10px',
    margin: '5px 0',
    background: '#2a4',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
};