import React, { useEffect, useState, useCallback } from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { CustomControls } from './components/CustomControls';
import './utils/debugHelpers';

// API configuration
const API_URL = 'http://localhost:3001/api';
const USER_ID = 'test-user-id';

// Custom styles
const customStyles = `
    /* Hide all standard UI elements */
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
    }
    
    /* Gradient background */
    .tl-background {
        background: 
            radial-gradient(circle at 20% 50%, #0a1a0a 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, #1a0a1a 0%, transparent 50%),
            #0a0a0a !important;
    }
    
    .tl-grid {
        display: none !important;
    }
    
    .tl-container {
        background: #0a0a0a;
    }
    
    .tl-handle,
    .tl-corner-handle,
    .tl-rotation-handle,
    .tl-mobile-rotate__bg,
    .tl-mobile-rotate__fg,
    .tl-selection__bg,
    .tl-selection__fg {
        opacity: 0.3 !important;
    }
    
    .custom-note {
        transition: all 0.2s ease !important;
    }
    
    .custom-note:hover {
        transform: scale(1.02);
        z-index: 100;
    }
`;

// Helper function to convert text to richText format
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

// Custom controls with Add Note button
function SyncedControls({ onAddNote, isSyncing }) {
    return (
        <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            gap: '10px',
        }}>
            <button
                onClick={onAddNote}
                style={{
                    padding: '10px 20px',
                    background: '#2a4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                ➕ Добавить заметку
            </button>
            
            {isSyncing && (
                <div style={{
                    padding: '10px',
                    background: '#333',
                    color: '#4a9eff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                }}>
                    🔄 Синхронизация...
                </div>
            )}
        </div>
    );
}

export default function SyncedProductionApp() {
    const [editor, setEditor] = useState(null);
    const [notes, setNotes] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [noteIdMap, setNoteIdMap] = useState(new Map()); // Map DB ID to Shape ID
    
    // Load notes from backend
    const loadNotes = useCallback(async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(`${API_URL}/notes`, {
                headers: {
                    'user-id': USER_ID,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch notes');
            }
            
            const data = await response.json();
            setNotes(data);
            console.log('📊 Loaded notes from backend:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error loading notes:', error);
            return [];
        } finally {
            setIsSyncing(false);
        }
    }, []);
    
    // Create shapes from notes
    const createShapesFromNotes = useCallback((notesData, editor) => {
        if (!editor || !notesData.length) return;
        
        console.log('🎨 Creating shapes from notes:', notesData.length);
        
        // Clear existing shapes
        const existingShapes = editor.getCurrentPageShapes();
        editor.deleteShapes(existingShapes.map(s => s.id));
        
        // Create new ID map
        const newNoteIdMap = new Map();
        
        // Create shapes for each note
        notesData.forEach(note => {
            const shapeId = createShapeId();
            newNoteIdMap.set(note.id, shapeId);
            
            editor.createShape({
                id: shapeId,
                type: 'custom-note',
                x: note.x,
                y: note.y,
                props: {
                    w: 180,
                    h: 150,
                    richText: toRichText(note.title + '\n\n' + (note.content || '')),
                    noteType: note.type,
                    time: new Date(note.createdAt).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }),
                    duration: note.voiceDuration ? 
                        `${Math.floor(note.voiceDuration / 60)}:${(note.voiceDuration % 60).toString().padStart(2, '0')}` : 
                        '',
                },
            });
        });
        
        // Create date headers
        const uniqueDates = [...new Set(notesData.map(n => n.date))];
        const sortedDates = uniqueDates.sort((a, b) => new Date(a) - new Date(b));
        
        sortedDates.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
            
            // Calculate X position based on column index
            const columnX = 100 + (index * 230); // 180 width + 50 spacing
            
            editor.createShape({
                id: createShapeId(),
                type: 'text',
                x: columnX + 65, // Center the date
                y: 50,
                props: {
                    richText: toRichText(`${day}\n${month}`),
                    color: index === sortedDates.length - 1 ? 'green' : 'grey',
                    size: 'xl',
                    font: 'sans',
                    autoSize: true,
                    w: 50,
                    textAlign: 'middle',
                },
            });
        });
        
        setNoteIdMap(newNoteIdMap);
        
        // Set camera
        editor.setCamera({ x: 0, y: 0, z: 0.8 });
    }, []);
    
    // Handle editor mount
    const handleMount = useCallback(async (editor) => {
        console.log('🚀 SyncedProductionApp: Editor mounted');
        setEditor(editor);
        window.editor = editor;
        window.saveEditor(editor);
        
        // Initial load
        const notesData = await loadNotes();
        
        // Initialize demo data if no notes
        if (notesData.length === 0) {
            console.log('📝 Initializing demo data...');
            await fetch(`${API_URL}/notes/initialize`, {
                method: 'POST',
                headers: {
                    'user-id': USER_ID,
                },
            });
            const newNotes = await loadNotes();
            createShapesFromNotes(newNotes, editor);
        } else {
            createShapesFromNotes(notesData, editor);
        }
        
        // Subscribe to shape position changes
        const unsubscribe = editor.store.listen(async (change) => {
            // Handle position updates
            for (const [from, to] of Object.values(change.changes.updated)) {
                if (from.typeName === 'shape' && to.typeName === 'shape') {
                    if (from.x !== to.x || from.y !== to.y) {
                        // Find the DB ID for this shape
                        const dbId = [...noteIdMap.entries()].find(([_, shapeId]) => shapeId === to.id)?.[0];
                        
                        if (dbId) {
                            console.log(`📍 Updating position for note ${dbId}`);
                            
                            // Update position in backend
                            try {
                                await fetch(`${API_URL}/notes/${dbId}/position`, {
                                    method: 'PATCH',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'user-id': USER_ID,
                                    },
                                    body: JSON.stringify({
                                        x: to.x,
                                        y: to.y,
                                    }),
                                });
                            } catch (error) {
                                console.error('❌ Error updating position:', error);
                            }
                        }
                    }
                }
            }
        }, { source: 'user', scope: 'document' });
        
        return () => unsubscribe();
    }, [loadNotes, createShapesFromNotes, noteIdMap]);
    
    // Add random note
    const handleAddNote = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(`${API_URL}/notes/random`, {
                method: 'POST',
                headers: {
                    'user-id': USER_ID,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to create note');
            }
            
            const newNote = await response.json();
            console.log('✨ Created new note:', newNote);
            
            // Reload all notes to get proper positioning
            const allNotes = await loadNotes();
            createShapesFromNotes(allNotes, editor);
            
        } catch (error) {
            console.error('❌ Error creating note:', error);
        } finally {
            setIsSyncing(false);
        }
    };
    
    // Periodic sync
    useEffect(() => {
        if (!editor) return;
        
        const interval = setInterval(async () => {
            console.log('🔄 Periodic sync...');
            const notesData = await loadNotes();
            createShapesFromNotes(notesData, editor);
        }, 30000); // Every 30 seconds
        
        return () => clearInterval(interval);
    }, [editor, loadNotes, createShapesFromNotes]);
    
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
                    <SyncedControls 
                        onAddNote={handleAddNote}
                        isSyncing={isSyncing}
                    />
                </Tldraw>
            </div>
        </>
    );
}