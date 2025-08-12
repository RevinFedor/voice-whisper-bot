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

export default function TestPositionSync() {
    const [editor, setEditor] = useState(null);
    const [shapePositions, setShapePositions] = useState([]);
    const [changeLog, setChangeLog] = useState([]);
    
    const handleMount = (editor) => {
        console.log('🚀 TestPositionSync: Editor mounted');
        setEditor(editor);
        window.testEditor = editor;
        
        // Create test shapes
        const shapes = [
            { id: createShapeId(), x: 100, y: 100, title: 'Shape 1' },
            { id: createShapeId(), x: 300, y: 100, title: 'Shape 2' },
            { id: createShapeId(), x: 500, y: 100, title: 'Shape 3' },
        ];
        
        shapes.forEach(shape => {
            editor.createShape({
                id: shape.id,
                type: 'custom-note',
                x: shape.x,
                y: shape.y,
                props: {
                    w: 150,
                    h: 120,
                    richText: toRichText(shape.title),
                    noteType: 'text',
                    time: new Date().toLocaleTimeString(),
                },
            });
        });
        
        // Subscribe to shape position changes
        const unsubscribe = editor.store.listen((change) => {
            const log = [];
            
            // Track position changes
            for (const [from, to] of Object.values(change.changes.updated)) {
                if (from.typeName === 'shape' && to.typeName === 'shape') {
                    if (from.x !== to.x || from.y !== to.y) {
                        const logEntry = {
                            id: to.id,
                            type: 'moved',
                            from: { x: from.x, y: from.y },
                            to: { x: to.x, y: to.y },
                            timestamp: new Date().toISOString(),
                        };
                        log.push(logEntry);
                        console.log('📍 Position change:', logEntry);
                    }
                }
            }
            
            // Track new shapes
            for (const record of Object.values(change.changes.added)) {
                if (record.typeName === 'shape') {
                    const logEntry = {
                        id: record.id,
                        type: 'created',
                        position: { x: record.x, y: record.y },
                        timestamp: new Date().toISOString(),
                    };
                    log.push(logEntry);
                    console.log('➕ Shape created:', logEntry);
                }
            }
            
            // Track deleted shapes
            for (const record of Object.values(change.changes.removed)) {
                if (record.typeName === 'shape') {
                    const logEntry = {
                        id: record.id,
                        type: 'deleted',
                        timestamp: new Date().toISOString(),
                    };
                    log.push(logEntry);
                    console.log('❌ Shape deleted:', logEntry);
                }
            }
            
            if (log.length > 0) {
                setChangeLog(prev => [...prev, ...log]);
            }
            
            // Update current positions
            const currentShapes = editor.getCurrentPageShapes()
                .filter(s => s.type === 'custom-note')
                .map(s => ({
                    id: s.id,
                    x: Math.round(s.x),
                    y: Math.round(s.y),
                    type: s.type,
                }));
            setShapePositions(currentShapes);
        }, { source: 'user', scope: 'document' });
        
        // Initial positions
        const initialShapes = editor.getCurrentPageShapes()
            .filter(s => s.type === 'custom-note')
            .map(s => ({
                id: s.id,
                x: Math.round(s.x),
                y: Math.round(s.y),
                type: s.type,
            }));
        setShapePositions(initialShapes);
        
        return () => unsubscribe();
    };
    
    // Test functions
    const moveAllShapesRight = () => {
        if (!editor) return;
        
        const shapes = editor.getCurrentPageShapes().filter(s => s.type === 'custom-note');
        const updates = shapes.map(shape => ({
            id: shape.id,
            type: shape.type,
            x: shape.x + 50,
            y: shape.y,
        }));
        
        editor.updateShapes(updates);
        console.log('➡️ Moved all shapes 50px right');
    };
    
    const autoArrangeShapes = () => {
        if (!editor) return;
        
        const shapes = editor.getCurrentPageShapes().filter(s => s.type === 'custom-note');
        const updates = shapes.map((shape, index) => ({
            id: shape.id,
            type: shape.type,
            x: 100 + (index * 200),
            y: 200,
        }));
        
        editor.updateShapes(updates);
        console.log('📐 Auto-arranged shapes in a row');
    };
    
    const createNewShape = () => {
        if (!editor) return;
        
        const id = createShapeId();
        const x = 100 + Math.random() * 500;
        const y = 300 + Math.random() * 200;
        
        editor.createShape({
            id,
            type: 'custom-note',
            x,
            y,
            props: {
                w: 150,
                h: 120,
                richText: toRichText(`New Shape\n${new Date().toLocaleTimeString()}`),
                noteType: 'voice',
                time: new Date().toLocaleTimeString(),
                duration: '0:45',
            },
        });
        
        console.log(`✨ Created new shape at (${Math.round(x)}, ${Math.round(y)})`);
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
                width: '400px', 
                background: '#1a1a1a', 
                color: '#e0e0e0',
                padding: '20px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
            }}>
                <h3>Position Sync Test</h3>
                
                <div style={{ marginBottom: '20px' }}>
                    <button onClick={moveAllShapesRight} style={buttonStyle}>
                        Move All Right →
                    </button>
                    <button onClick={autoArrangeShapes} style={buttonStyle}>
                        Auto Arrange 📐
                    </button>
                    <button onClick={createNewShape} style={buttonStyle}>
                        Create Shape ✨
                    </button>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <h4>Current Positions:</h4>
                    {shapePositions.map(shape => (
                        <div key={shape.id} style={{ marginBottom: '5px' }}>
                            {shape.id.slice(-6)}: ({shape.x}, {shape.y})
                        </div>
                    ))}
                </div>
                
                <div>
                    <h4>Change Log:</h4>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {changeLog.slice(-20).reverse().map((log, i) => (
                            <div key={i} style={{ 
                                marginBottom: '10px',
                                padding: '5px',
                                background: '#2a2a2a',
                                borderRadius: '4px',
                            }}>
                                <div style={{ color: getLogColor(log.type) }}>
                                    {log.type.toUpperCase()}
                                </div>
                                <div style={{ fontSize: '10px', color: '#666' }}>
                                    {log.id.slice(-6)}
                                </div>
                                {log.from && log.to && (
                                    <div style={{ fontSize: '11px' }}>
                                        ({log.from.x}, {log.from.y}) → ({log.to.x}, {log.to.y})
                                    </div>
                                )}
                                {log.position && (
                                    <div style={{ fontSize: '11px' }}>
                                        at ({log.position.x}, {log.position.y})
                                    </div>
                                )}
                                <div style={{ fontSize: '9px', color: '#555' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const buttonStyle = {
    padding: '8px 16px',
    margin: '5px',
    background: '#2a4',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
};

function getLogColor(type) {
    switch(type) {
        case 'moved': return '#4a9eff';
        case 'created': return '#4aff4a';
        case 'deleted': return '#ff4a4a';
        default: return '#999';
    }
}