import React, { useEffect, useState, useCallback } from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import DatePickerModal from './components/DatePickerModal';
import NoteModal from './components/NoteModal';
import './utils/debugHelpers';
import './utils/debugShapes';
import './utils/quickTest';
import './utils/finalTest';

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
    
    .merge-target {
        box-shadow: 0 0 20px rgba(255, 200, 0, 0.8) !important;
        border-color: #ffc800 !important;
        border-width: 3px !important;
        animation: pulse 0.5s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.03); }
        100% { transform: scale(1); }
    }
    
    /* Fix z-index for dragging shapes */
    .tl-dragging-from-the-canvas .tl-shape.selected {
        z-index: 999 !important;
    }
    
    .tl-shape[data-shape-type="custom-note"].selected {
        z-index: 998 !important;
    }
    
    /* Ensure dragged shape is always on top */
    .tl-dragging {
        z-index: 1000 !important;
    }
    
    .tl-shape-indicator[data-shape-type="custom-note"] {
        z-index: 997 !important;
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
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    
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
            // console.log('📊 Loaded notes from backend:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error loading notes:', error);
            return [];
        } finally {
            setIsSyncing(false);
        }
    }, []);
    
    // Calculate X position based on TODAY = 5000
    const calculateColumnX = (dateStr) => {
        const TODAY_X = 5000;
        const COLUMN_SPACING = 230;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const noteDate = new Date(dateStr);
        noteDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((noteDate - today) / (24 * 60 * 60 * 1000));
        return TODAY_X + (daysDiff * COLUMN_SPACING);
    };
    
    // Generate date headers for visible range
    const generateDateHeaders = useCallback((editor) => {
        if (!editor) return;
        
        // Remove existing date headers
        const existingTextShapes = editor.getCurrentPageShapes().filter(s => s.type === 'text');
        editor.deleteShapes(existingTextShapes.map(s => s.id));
        
        const TODAY_X = 5000;
        const COLUMN_SPACING = 230;
        const DAYS_BACK = 7; // Show 7 days back
        const DAYS_FORWARD = 0; // Don't show future dates
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = -DAYS_BACK; i <= DAYS_FORWARD; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            
            const x = TODAY_X + (i * COLUMN_SPACING);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase();
            const isToday = i === 0;
            
            editor.createShape({
                id: createShapeId(),
                type: 'text',
                x: x + 65, // Center the date
                y: 50,
                props: {
                    richText: toRichText(`${day}\n${month}`),
                    color: isToday ? 'green' : 'grey',
                    size: 'xl',
                    font: 'sans',
                    autoSize: true,
                    w: 50,
                    textAlign: 'middle',
                },
            });
        }
        
        // console.log(`📅 Generated date headers for ${DAYS_BACK} days back`);
    }, []);
    
    // Create shapes from notes
    const createShapesFromNotes = useCallback((notesData, editor, preserveCamera = false) => {
        if (!editor) return;
        
        // console.log('🎨 Creating shapes from notes:', notesData.length);
        
        // Save current camera position if needed
        let savedCamera = null;
        if (preserveCamera) {
            savedCamera = editor.getCamera();
            // console.log('📸 Saved camera position:', savedCamera);
        }
        
        // Clear existing shapes
        const existingShapes = editor.getCurrentPageShapes();
        editor.deleteShapes(existingShapes.map(s => s.id));
        
        // Create new ID map
        const newNoteIdMap = new Map();
        
        // Create shapes for each note
        notesData.forEach(note => {
            const shapeId = createShapeId();
            newNoteIdMap.set(note.id, shapeId);
            
            // Calculate X position for column notes, use saved X for manually positioned
            const x = note.manuallyPositioned ? note.x : calculateColumnX(note.date);
            
            const shapeData = {
                id: shapeId,
                type: 'custom-note',
                x: x,
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
                    manuallyPositioned: note.manuallyPositioned || false,
                    dbId: note.id,
                },
            };
            
            editor.createShape(shapeData);
        });
        
        // Generate date headers (always show them even if no notes)
        generateDateHeaders(editor);
        
        // console.log('📊 Setting noteIdMap with', newNoteIdMap.size, 'entries');
        setNoteIdMap(newNoteIdMap);
        
        // Restore camera position or set default
        if (savedCamera) {
            // console.log('📸 Restoring camera position:', savedCamera);
            editor.setCamera(savedCamera);
        } else {
            // Set camera to TODAY column (center on it)
            const TODAY_X = 5000;
            const COLUMN_WIDTH = 180;
            // Use centerOnPoint for proper centering
            editor.centerOnPoint({ 
                x: TODAY_X + (COLUMN_WIDTH / 2), // Center of the column
                y: 200 // Approximate vertical center of content
            });
            // console.log('📸 Centered camera on TODAY column');
        }
    }, [generateDateHeaders]);
    
    // Helper functions for note merging
    const calculateOverlap = (shape1, shape2) => {
        // Get bounds for both shapes
        const bounds1 = {
            left: shape1.x,
            right: shape1.x + (shape1.props?.w || 180),
            top: shape1.y,
            bottom: shape1.y + (shape1.props?.h || 150)
        };
        
        const bounds2 = {
            left: shape2.x,
            right: shape2.x + (shape2.props?.w || 180),
            top: shape2.y,
            bottom: shape2.y + (shape2.props?.h || 150)
        };
        
        // Calculate intersection
        const intersectLeft = Math.max(bounds1.left, bounds2.left);
        const intersectRight = Math.min(bounds1.right, bounds2.right);
        const intersectTop = Math.max(bounds1.top, bounds2.top);
        const intersectBottom = Math.min(bounds1.bottom, bounds2.bottom);
        
        // Check if there is an intersection
        if (intersectLeft < intersectRight && intersectTop < intersectBottom) {
            const intersectionArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
            const shape1Area = (bounds1.right - bounds1.left) * (bounds1.bottom - bounds1.top);
            const overlapPercentage = intersectionArea / shape1Area;
            
            console.log(`📐 Overlap calculation:`, {
                shape1Id: shape1.id,
                shape2Id: shape2.id,
                intersectionArea,
                shape1Area,
                overlapPercentage: (overlapPercentage * 100).toFixed(1) + '%'
            });
            
            return overlapPercentage;
        }
        
        return 0;
    };
    
    const mergeNotes = async (draggedNote, targetNote) => {
        console.log('🔀 Starting merge operation:', {
            dragged: draggedNote.props?.dbId,
            target: targetNote.props?.dbId
        });
        
        const draggedDbId = draggedNote.props?.dbId;
        const targetDbId = targetNote.props?.dbId;
        
        if (!draggedDbId || !targetDbId) {
            console.error('❌ Cannot merge: missing DB IDs');
            return;
        }
        
        try {
            // Small delay to ensure position updates are synced
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get note data from backend
            const [draggedResponse, targetResponse] = await Promise.all([
                fetch(`${API_URL}/notes/${draggedDbId}`, {
                    headers: { 'user-id': USER_ID }
                }),
                fetch(`${API_URL}/notes/${targetDbId}`, {
                    headers: { 'user-id': USER_ID }
                })
            ]);
            
            if (!draggedResponse.ok || !targetResponse.ok) {
                console.error('❌ Failed to fetch notes:', {
                    dragged: { id: draggedDbId, status: draggedResponse.status },
                    target: { id: targetDbId, status: targetResponse.status }
                });
                
                // Try to use data from shapes if backend fetch fails
                const draggedShape = editor.getShape(draggedNote.id);
                const targetShape = editor.getShape(targetNote.id);
                
                if (!draggedShape || !targetShape) {
                    throw new Error('Failed to fetch notes and no local data available');
                }
                
                // Extract title and content from richText
                const extractTextFromRichText = (richText) => {
                    if (!richText || !richText.content) return { title: '', content: '' };
                    const paragraphs = richText.content
                        .filter(p => p.content && p.content[0])
                        .map(p => p.content[0].text || '');
                    return {
                        title: paragraphs[0] || '',
                        content: paragraphs.slice(1).join('\n')
                    };
                };
                
                const draggedText = extractTextFromRichText(draggedShape.props.richText);
                const targetText = extractTextFromRichText(targetShape.props.richText);
                
                // Use shape data as fallback
                var draggedData = {
                    title: draggedText.title,
                    content: draggedText.content,
                    date: new Date().toISOString() // Use today as fallback
                };
                
                var targetData = {
                    title: targetText.title,
                    content: targetText.content,
                    date: new Date().toISOString(), // Use today as fallback
                    manuallyPositioned: targetShape.props.manuallyPositioned || false
                };
            } else {
                var draggedData = await draggedResponse.json();
                var targetData = await targetResponse.json();
            }
            
            // Create merged note
            const mergedTitle = draggedData.title + ' / ' + targetData.title;
            const mergedContent = draggedData.content + '\n/////\n' + targetData.content;
            
            console.log('📝 Creating merged note:', {
                title: mergedTitle,
                x: targetNote.x,
                y: targetNote.y,
                date: targetData.date
            });
            
            // Format date as string for backend (YYYY-MM-DD)
            const targetDate = new Date(targetData.date);
            const dateString = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}-${targetDate.getDate().toString().padStart(2, '0')}`;
            
            // Create new merged note with target's position
            const createResponse = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': USER_ID,
                },
                body: JSON.stringify({
                    title: mergedTitle,
                    content: mergedContent,
                    type: 'text',
                    date: dateString,
                    x: targetNote.x,
                    y: targetNote.y,
                    manuallyPositioned: targetData.manuallyPositioned || false,
                }),
            });
            
            if (!createResponse.ok) {
                throw new Error('Failed to create merged note');
            }
            
            const mergedNote = await createResponse.json();
            console.log('✅ Merged note created:', mergedNote.id);
            
            // Delete original notes
            await Promise.all([
                fetch(`${API_URL}/notes/${draggedDbId}`, {
                    method: 'DELETE',
                    headers: { 'user-id': USER_ID }
                }),
                fetch(`${API_URL}/notes/${targetDbId}`, {
                    method: 'DELETE',
                    headers: { 'user-id': USER_ID }
                })
            ]);
            
            console.log('🗑️ Original notes deleted');
            
            // Reload all notes to sync UI
            const allNotes = await loadNotes();
            createShapesFromNotes(allNotes, editor, true);
            
            console.log('✨ Merge completed successfully');
            
        } catch (error) {
            console.error('❌ Error during merge:', error);
        }
    };
    
    // Setup position sync
    useEffect(() => {
        if (!editor || !noteIdMap || noteIdMap.size === 0) return;
        
        // console.log('🔗 Setting up position sync with noteIdMap:', noteIdMap.size, 'entries');
        
        // Debounced position update function
        const positionUpdateQueue = new Map();
        let updateTimer = null;
        let mergeCheckTimer = null;
        let potentialMerge = null;
        let highlightedTarget = null;
        
        const sendPositionUpdates = async () => {
            if (positionUpdateQueue.size === 0) return;
            
            const updates = Array.from(positionUpdateQueue.entries());
            positionUpdateQueue.clear();
            
            for (const [dbId, position] of updates) {
                console.log(`📍 Sending position update for note ${dbId}:`, position);
                
                try {
                    const response = await fetch(`${API_URL}/notes/${dbId}/position`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'user-id': USER_ID,
                        },
                        body: JSON.stringify(position),
                    });
                    
                    if (response.ok) {
                        const updatedNote = await response.json();
                        console.log(`✅ Position updated, manuallyPositioned: ${updatedNote.manuallyPositioned}`);
                        
                        // Update local state to reflect manuallyPositioned status
                        const shapeId = noteIdMap.get(dbId);
                        if (shapeId) {
                            const shape = editor.getShape(shapeId);
                            if (shape) {
                                editor.updateShape({
                                    id: shapeId,
                                    type: shape.type,
                                    props: {
                                        ...shape.props,
                                        manuallyPositioned: updatedNote.manuallyPositioned,
                                    },
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Error updating position:', error);
                }
            }
        };
        
        // Subscribe to shape position changes
        const unsubscribe = editor.store.listen((change) => {
            console.log('🎯 Store change detected:', {
                hasUpdates: Object.values(change.changes.updated).length > 0,
                source: change.source,
            });
            
            // Handle position updates
            for (const [from, to] of Object.values(change.changes.updated)) {
                if (from.typeName === 'shape' && to.typeName === 'shape') {
                    console.log('📦 Shape update:', {
                        type: to.type,
                        id: to.id,
                        movedX: from.x !== to.x,
                        movedY: from.y !== to.y,
                        props: to.props,
                    });
                    
                    if (to.type === 'custom-note' && (from.x !== to.x || from.y !== to.y)) {
                        // Get DB ID from shape props
                        const dbId = to.props?.dbId;
                        
                        console.log(`🔍 Looking for dbId in props:`, dbId);
                        
                        if (dbId) {
                            console.log(`🔄 Shape moved, queueing update for ${dbId}`);
                            // Add to update queue
                            positionUpdateQueue.set(dbId, { x: to.x, y: to.y });
                            
                            // Clear existing timer and set new one (debounce)
                            if (updateTimer) clearTimeout(updateTimer);
                            updateTimer = setTimeout(sendPositionUpdates, 300); // 300ms debounce
                            
                            // Check for potential merge when movement stops
                            if (mergeCheckTimer) clearTimeout(mergeCheckTimer);
                            
                            // Store the moving shape for merge check
                            potentialMerge = to;
                            
                            // Update z-index for dragging shape
                            const draggedElement = document.querySelector(`[data-shape="${to.id}"]`);
                            if (draggedElement) {
                                draggedElement.style.zIndex = '1000';
                            }
                            
                            // Real-time merge target highlighting
                            const selectedShapes = editor.getSelectedShapes();
                            if (selectedShapes.length === 1) {
                                const allShapes = editor.getCurrentPageShapes();
                                const customNotes = allShapes.filter(s => s.type === 'custom-note');
                                
                                let foundTarget = null;
                                let maxOverlap = 0;
                                
                                // Find the best merge target
                                for (const shape of customNotes) {
                                    if (shape.id === to.id) continue; // Skip self
                                    
                                    const overlap = calculateOverlap(to, shape);
                                    
                                    if (overlap >= 0.3 && overlap > maxOverlap) {
                                        maxOverlap = overlap;
                                        foundTarget = shape;
                                    }
                                }
                                
                                // Update highlighting
                                if (foundTarget) {
                                    // Remove old highlight
                                    if (highlightedTarget && highlightedTarget !== foundTarget.id) {
                                        const oldElement = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                                        if (oldElement) {
                                            oldElement.classList.remove('merge-target');
                                        }
                                    }
                                    
                                    // Add new highlight
                                    const targetElement = document.querySelector(`[data-shape="${foundTarget.id}"]`);
                                    if (targetElement) {
                                        targetElement.classList.add('merge-target');
                                        highlightedTarget = foundTarget.id;
                                        console.log(`💡 Highlighting merge target: ${foundTarget.id} (${(maxOverlap * 100).toFixed(1)}% overlap)`);
                                    }
                                } else if (highlightedTarget) {
                                    // Remove highlight if no target found
                                    const oldElement = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                                    if (oldElement) {
                                        oldElement.classList.remove('merge-target');
                                    }
                                    highlightedTarget = null;
                                }
                            }
                            
                            mergeCheckTimer = setTimeout(() => {
                                console.log('🔍 Checking for merge after drag stop');
                                
                                // Reset z-index for all shapes after drag
                                const allElements = document.querySelectorAll('[data-shape]');
                                allElements.forEach(el => {
                                    el.style.zIndex = '';
                                });
                                
                                // Get all shapes
                                const allShapes = editor.getCurrentPageShapes();
                                const customNotes = allShapes.filter(s => s.type === 'custom-note');
                                
                                // Check only single selection (not multi-select)
                                const selectedShapes = editor.getSelectedShapes();
                                if (selectedShapes.length !== 1) {
                                    console.log('⚠️ Skipping merge: not single selection');
                                    return;
                                }
                                
                                // Find overlapping notes
                                for (const shape of customNotes) {
                                    if (shape.id === potentialMerge.id) continue; // Skip self
                                    
                                    const overlap = calculateOverlap(potentialMerge, shape);
                                    
                                    if (overlap >= 0.3) { // 30% overlap threshold
                                        console.log(`🎯 Found merge candidate with ${(overlap * 100).toFixed(1)}% overlap`);
                                        
                                        // Remove highlight before merge
                                        if (highlightedTarget) {
                                            const element = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                                            if (element) {
                                                element.classList.remove('merge-target');
                                            }
                                            highlightedTarget = null;
                                        }
                                        
                                        // Perform merge
                                        mergeNotes(potentialMerge, shape);
                                        
                                        // Only merge with first overlapping note
                                        break;
                                    }
                                }
                            }, 400); // Check for merge after 400ms of no movement
                        } else {
                            console.warn('⚠️ No dbId found in shape props!', to.props);
                        }
                    }
                }
            }
        }, { source: 'user', scope: 'document' });
        
        return () => {
            // console.log('🔌 Cleaning up position sync');
            if (updateTimer) clearTimeout(updateTimer);
            if (mergeCheckTimer) clearTimeout(mergeCheckTimer);
            
            // Clean up any remaining highlight
            if (highlightedTarget) {
                const element = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                if (element) {
                    element.classList.remove('merge-target');
                }
            }
            
            unsubscribe();
        };
    }, [editor, noteIdMap]);
    
    // Handle note click - open modal (moved before handleMount)
    const handleNoteClick = useCallback(async (shapeId) => {
        console.log('📱 handleNoteClick called with:', shapeId);
        if (!editor) {
            console.error('❌ No editor');
            return;
        }
        
        // Get shape
        const shape = editor.getShape(shapeId);
        if (!shape || shape.type !== 'custom-note') return;
        
        // Get DB ID from shape
        const dbId = shape.props?.dbId;
        if (!dbId) return;
        
        try {
            // Fetch full note data from backend
            const response = await fetch(`${API_URL}/notes/${dbId}`, {
                headers: { 'user-id': USER_ID }
            });
            
            if (response.ok) {
                const noteData = await response.json();
                setSelectedNote(noteData);
                setIsNoteModalOpen(true);
            } else {
                // Fallback to shape data if backend fails
                const extractTextFromRichText = (richText) => {
                    if (!richText || !richText.content) return { title: '', content: '' };
                    const paragraphs = richText.content
                        .filter(p => p.content && p.content[0])
                        .map(p => p.content[0].text || '');
                    return {
                        title: paragraphs[0] || '',
                        content: paragraphs.slice(1).join('\n')
                    };
                };
                
                const text = extractTextFromRichText(shape.props.richText);
                
                setSelectedNote({
                    id: dbId,
                    title: text.title,
                    content: text.content,
                    type: shape.props.noteType || 'text',
                    x: shape.x,
                    y: shape.y,
                    manuallyPositioned: shape.props.manuallyPositioned || false,
                    voiceDuration: shape.props.duration ? parseInt(shape.props.duration.split(':')[0]) * 60 + parseInt(shape.props.duration.split(':')[1]) : null,
                    date: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                setIsNoteModalOpen(true);
            }
        } catch (error) {
            console.error('❌ Error fetching note for modal:', error);
        }
    }, [editor]);
    
    // Save handleNoteClick to window for ShapeUtil access
    useEffect(() => {
        window.handleNoteClick = handleNoteClick;
        return () => {
            delete window.handleNoteClick;
        };
    }, [handleNoteClick]);
    
    // Handle editor mount
    const handleMount = useCallback(async (editor) => {
        console.log('🚀 SyncedProductionApp: Editor mounted');
        setEditor(editor);
        window.editor = editor;
        window.saveEditor(editor);
        
        // Verify CustomNoteShapeUtil is registered
        try {
            const customNoteUtil = editor.getShapeUtil('custom-note');
            console.log('✅ CustomNoteShapeUtil registered:', !!customNoteUtil);
            if (customNoteUtil) {
                console.log('   Shape util details:', customNoteUtil);
            }
        } catch (e) {
            console.error('❌ Failed to get CustomNoteShapeUtil:', e);
        }
        
        // Function to open modal - defined inside handleMount to access setters
        const handleNoteModalOpen = async (dbId, shape) => {
            
            try {
                // Fetch full note data from backend
                const response = await fetch(`${API_URL}/notes/${dbId}`, {
                    headers: { 'user-id': USER_ID }
                });
                
                if (response.ok) {
                    const noteData = await response.json();
                    setSelectedNote(noteData);
                    setIsNoteModalOpen(true);
                } else {
                    // Fallback to shape data if backend fails
                    const extractTextFromRichText = (richText) => {
                        if (!richText || !richText.content) return { title: '', content: '' };
                        const paragraphs = richText.content
                            .filter(p => p.content && p.content[0])
                            .map(p => p.content[0].text || '');
                        return {
                            title: paragraphs[0] || '',
                            content: paragraphs.slice(1).join('\n')
                        };
                    };
                    
                    const text = extractTextFromRichText(shape.props.richText);
                    
                    setSelectedNote({
                        id: dbId,
                        title: text.title,
                        content: text.content,
                        type: shape.props.noteType || 'text',
                        x: shape.x,
                        y: shape.y,
                        manuallyPositioned: shape.props.manuallyPositioned || false,
                        voiceDuration: shape.props.duration ? parseInt(shape.props.duration.split(':')[0]) * 60 + parseInt(shape.props.duration.split(':')[1]) : null,
                        date: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    setIsNoteModalOpen(true);
                }
            } catch (error) {
                console.error('❌ Error fetching note for modal:', error);
            }
        };
        
        // Store the shape that was clicked on pointer down
        let clickedShapeId = null;
        let dragStarted = false;
        
        // Correct event handler using editor.on('event', callback)
        const handleEditorEvents = (eventInfo) => {
            // Skip logging for frequent events
            if (eventInfo.name !== 'pointer_move') {
                // console.log('📡 EVENT:', eventInfo.name); // Uncomment for debugging
            }
            
            if (eventInfo.name === 'pointer_down') {
                
                dragStarted = false;
                clickedShapeId = null;
                
                // If target is canvas, try to find shape at point
                if (eventInfo.target === 'canvas') {
                    // Use currentPagePoint which is already in page space coordinates
                    const pagePoint = editor.inputs.currentPagePoint;
                    const hitShape = editor.getShapeAtPoint(pagePoint, {
                        hitInside: true,
                        margin: 10,
                    });
                    
                    if (hitShape && hitShape.type === 'custom-note') {
                        // Manually set the clicked shape
                        clickedShapeId = hitShape.id;
                    }
                }
                // Check if clicked on a custom note directly
                else if (eventInfo.target === 'shape' && eventInfo.shape?.type === 'custom-note') {
                    clickedShapeId = eventInfo.shape.id;
                }
            }
            else if (eventInfo.name === 'pointer_move') {
                if (clickedShapeId && editor.inputs.isDragging) {
                    dragStarted = true;
                }
            }
            else if (eventInfo.name === 'pointer_up') {
                // If no shape was clicked, ignore
                if (!clickedShapeId) {
                    return;
                }
                
                // If we started dragging, don't open modal
                if (dragStarted || editor.inputs.isDragging) {
                    clickedShapeId = null;
                    dragStarted = false;
                    return;
                }
                
                // It's a click! Open the modal
                const shape = editor.getShape(clickedShapeId);
                if (!shape || shape.type !== 'custom-note') {
                    return;
                }
                
                // Get DB ID from shape
                const dbId = shape.props?.dbId;
                
                if (dbId) {
                    // Extract title for logging
                    const title = shape.props.richText?.content?.[0]?.content?.[0]?.text || 'Untitled';
                    console.log(`🖾️ Click on note: "${title}" → Opening modal`);
                    handleNoteModalOpen(dbId, shape);
                }
                
                // Reset
                clickedShapeId = null;
                dragStarted = false;
            }
        };
        
        // Subscribe to events using the correct API
        editor.on('event', handleEditorEvents);
        
        // Store cleanup function
        editor._modalCleanup = () => {
            console.log('🧹 Cleaning up event subscription');
            editor.off('event', handleEditorEvents);
        };
        
        // Initial load
        const notesData = await loadNotes();
        
        // Always generate date headers first (even if no notes)
        generateDateHeaders(editor);
        
        // Then load existing notes if any
        if (notesData.length > 0) {
            createShapesFromNotes(notesData, editor, false); // Initial load, don't preserve camera
        } else {
            // No notes - still need to center camera on TODAY
            const TODAY_X = 5000;
            const COLUMN_WIDTH = 180;
            // Small delay to ensure canvas is ready
            setTimeout(() => {
                editor.centerOnPoint({ 
                    x: TODAY_X + (COLUMN_WIDTH / 2),
                    y: 200 
                });
                console.log('📸 No notes found, centered on TODAY column');
            }, 100);
        }
    }, [loadNotes, createShapesFromNotes, generateDateHeaders, handleNoteClick]);
    
    // Add single note shape without full reload
    const addSingleNoteShape = useCallback((note, editor) => {
        const shapeId = createShapeId();
        
        // Update noteIdMap
        setNoteIdMap(prev => {
            const newMap = new Map(prev);
            newMap.set(note.id, shapeId);
            return newMap;
        });
        
        // Calculate X position (note from backend has x=0 for column notes)
        const x = note.manuallyPositioned ? note.x : calculateColumnX(note.date);
        
        console.log(`📝 Adding single note at calculated X=${x}, Y=${note.y}, date: ${note.date}`);
        
        // Create the shape
        editor.createShape({
            id: shapeId,
            type: 'custom-note',
            x: x,
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
                manuallyPositioned: note.manuallyPositioned || false,
                dbId: note.id,
            },
        });
        
        console.log(`✨ Added single note shape without full reload`);
    }, []);
    
    // Add note with selected date
    const handleAddNote = async (selectedDate) => {
        setIsSyncing(true);
        try {
            // Generate random content
            const types = ['voice', 'text'];
            const titles = [
                'Утренний стендап',
                'Идея для проекта',
                'Заметка с встречи',
                'TODO на завтра',
                'Важная мысль',
                'Код ревью',
                'Планы на неделю',
                'Обратная связь',
            ];
            
            const contents = [
                'Обсуждение текущих задач',
                'Нужно не забыть реализовать',
                'Интересная концепция для улучшения',
                'Список важных пунктов',
                'Требует дополнительного анализа',
            ];
            
            const noteType = types[Math.floor(Math.random() * types.length)];
            
            // Format date as YYYY-MM-DD to avoid timezone issues
            const year = selectedDate.getFullYear();
            const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
            const day = selectedDate.getDate().toString().padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const response = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': USER_ID,
                },
                body: JSON.stringify({
                    title: titles[Math.floor(Math.random() * titles.length)],
                    content: contents[Math.floor(Math.random() * contents.length)],
                    type: noteType,
                    date: dateString,
                    voiceDuration: noteType === 'voice' ? Math.floor(Math.random() * 300) : undefined,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create note');
            }
            
            const newNote = await response.json();
            console.log('✨ Created new note:', newNote);
            
            // Just add the single new note without full reload
            addSingleNoteShape(newNote, editor);
            
            // Optional: Full sync after a delay to ensure consistency
            setTimeout(async () => {
                const allNotes = await loadNotes();
                createShapesFromNotes(allNotes, editor, true);
            }, 5000); // Sync after 5 seconds
            
        } catch (error) {
            console.error('❌ Error creating note:', error);
        } finally {
            setIsSyncing(false);
        }
    };
    
    // Open date picker
    const handleOpenDatePicker = () => {
        setIsDatePickerOpen(true);
    };
    
    // Periodic sync
    useEffect(() => {
        if (!editor) return;
        
        const interval = setInterval(async () => {
            // console.log('🔄 Periodic sync...');
            const notesData = await loadNotes();
            createShapesFromNotes(notesData, editor, true); // Preserve camera during periodic sync
        }, 30000); // Every 30 seconds
        
        return () => {
            clearInterval(interval);
            // Clean up modal click handler on unmount
            if (editor._modalCleanup) {
                editor._modalCleanup();
            }
        };
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
                        onAddNote={handleOpenDatePicker}
                        isSyncing={isSyncing}
                    />
                </Tldraw>
                
                <DatePickerModal
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    onSelectDate={handleAddNote}
                />
                
                <NoteModal
                    isOpen={isNoteModalOpen}
                    onClose={() => {
                        setIsNoteModalOpen(false);
                        setSelectedNote(null);
                    }}
                    note={selectedNote}
                />
            </div>
        </>
    );
}