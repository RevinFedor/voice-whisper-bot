import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { StaticDateHeaderShapeUtil } from './components/StaticDateHeaderShape';
import { SelectionContextMenu } from './components/SelectionContextMenu';
import { ModalStackProvider } from './contexts/ModalStackContext';
import DatePickerModal from './components/DatePickerModal';
import NoteModal from './components/NoteModal';
import ExportToast from './components/ExportToast';
import './utils/debugHelpers';
import './utils/debugShapes';
import './utils/quickTest';
import './utils/finalTest';
import './utils/debugModalStack';

// API configuration
if (!import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is required in environment variables');
}
const API_URL = import.meta.env.VITE_API_URL;
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
    
    /* Custom note shapes now handle pointer events and cursor internally */
    /* See CustomNoteShape.jsx component for cursor and interaction handling */
    
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
        z-index: 10000 !important;
    }
    
    /* Ensure selected shapes during drag are on top */
    .tl-shape.selected.dragging {
        z-index: 10000 !important;
    }
    
    /* Force dragging shapes to be on top */
    [data-shape*="shape:"][style*="z-index: 10000"] {
        z-index: 10000 !important;
    }
    
    /* Ensure HTML containers in dragging shapes are on top */
    .tl-shape[style*="z-index: 10000"] .tl-html-container {
        z-index: 10000 !important;
    }
    
    .tl-shape-indicator[data-shape-type="custom-note"] {
        z-index: 997 !important;
    }
    
    /* Static date header styles - делаем их полностью неинтерактивными */
    .tl-shape[data-shape-type="static-date-header"] {
        pointer-events: none !important;
        user-select: none !important;
    }
    
    .tl-shape[data-shape-type="static-date-header"] .tl-shape-indicator {
        display: none !important;
    }
    
    }
    
    /* Отключаем все интерактивности для date headers */
    .tl-shape[data-shape-type="static-date-header"] * {
        pointer-events: none !important;
        user-select: none !important;
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
    const [dateColumnMap, setDateColumnMap] = useState({}); // Map date string -> column index
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [showExportToast, setShowExportToast] = useState(false);
    const [exportToastData, setExportToastData] = useState(null);
    
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
            
            // Build date column map from unique dates (normalized to days)
            // Only consider notes that are NOT manually positioned for column calculation
            const columnNotes = data.filter(note => !note.manuallyPositioned);
            const normalizedDates = columnNotes.map(note => {
                const date = new Date(note.date);
                date.setHours(0, 0, 0, 0);
                return date.toISOString();
            });
            const uniqueDates = [...new Set(normalizedDates)].sort();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString();
            
            // Find today's index or use 0 if today has no notes
            const todayIndex = uniqueDates.indexOf(todayStr);
            const baseTodayIndex = todayIndex !== -1 ? todayIndex : uniqueDates.findIndex(d => d > todayStr);
            
            // Create mapping with today at position 0
            const mapping = {};
            uniqueDates.forEach((date, index) => {
                mapping[date] = index - (baseTodayIndex !== -1 ? baseTodayIndex : uniqueDates.length);
            });
            setDateColumnMap(mapping);
            
            console.log(`📊 Loaded ${data.length} notes (${columnNotes.length} in columns, ${data.length - columnNotes.length} manually positioned) with ${uniqueDates.length} unique column dates`);
            return { notes: data, dateMap: mapping };
        } catch (error) {
            console.error('❌ Error loading notes:', error);
            return { notes: [], dateMap: {} };
        } finally {
            setIsSyncing(false);
        }
    }, []);
    
    // Calculate X position with hybrid approach: static 7 days + dynamic old dates
    const calculateColumnX = useCallback((dateStr, customDateMap = null) => {
        const TODAY_X = 5000;
        const COLUMN_SPACING = 230;
        const STATIC_DAYS = 7; // Show 7 days back statically
        const SEPARATOR_X = 3300; // Position of visual separator
        const OLD_DATES_START_X = 3070; // Where old dates start
        
        // Use provided map or fall back to state
        const mapToUse = customDateMap || dateColumnMap;
        
        // Normalize the date to day (remove time)
        const noteDate = new Date(dateStr);
        noteDate.setHours(0, 0, 0, 0);
        const normalizedDateStr = noteDate.toISOString();
        
        // Calculate days difference from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((noteDate - today) / (24 * 60 * 60 * 1000));
        
        // Static zone: last 7 days (including today)
        if (daysDiff >= -STATIC_DAYS && daysDiff <= 0) {
            const x = TODAY_X + (daysDiff * COLUMN_SPACING);
            // console.log(`📍 Static zone: ${dateStr.split('T')[0]} → X=${x} (day ${daysDiff})`);
            return x;
        }
        
        // Dynamic zone: older dates
        // Get all old dates from the map and sort them
        const oldDates = Object.keys(mapToUse)
            .filter(d => {
                const date = new Date(d);
                date.setHours(0, 0, 0, 0);
                const diff = Math.floor((date - today) / (24 * 60 * 60 * 1000));
                return diff < -STATIC_DAYS;
            })
            .sort()
            .reverse(); // Most recent old dates first
        
        // Use normalized date for lookup
        const oldDateIndex = oldDates.indexOf(normalizedDateStr);
        if (oldDateIndex !== -1) {
            const x = OLD_DATES_START_X - (oldDateIndex * COLUMN_SPACING);
            // console.log(`📚 Dynamic zone: ${dateStr.split('T')[0]} → X=${x} (index ${oldDateIndex})`);
            return x;
        }
        
        // Fallback - this can happen for manually positioned notes
        // Don't warn since it's expected
        return TODAY_X + (daysDiff * COLUMN_SPACING);
    }, [dateColumnMap]);
    
    // Generate date headers with hybrid approach
    const generateDateHeaders = useCallback((editor, customDateMap = null) => {
        if (!editor) return;
        
        // Get ALL shapes first
        const allShapes = editor.getCurrentPageShapes();
        
        // Get existing headers BEFORE mergeRemoteChanges
        const existingHeaders = allShapes.filter(s => 
            s.type === 'text' || s.type === 'static-date-header' || 
            (s.type === 'geo' && s.props?.w === 2 && s.props?.h === 800) // Our separator
        );
        
        // Delete headers OUTSIDE of mergeRemoteChanges first (deleteShapes doesn't work inside mergeRemoteChanges)
        if (existingHeaders.length > 0) {
            // Unlock locked headers first
            const lockedHeaders = existingHeaders.filter(s => s.isLocked);
            if (lockedHeaders.length > 0) {
                lockedHeaders.forEach(header => {
                    editor.updateShape({
                        id: header.id,
                        type: header.type,
                        isLocked: false
                    });
                });
            }
            
            // Delete all headers
            editor.deleteShapes(existingHeaders.map(s => s.id));
        }
        
        // Now create new headers inside mergeRemoteChanges
        editor.store.mergeRemoteChanges(() => {
            
            const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const STATIC_DAYS = 7;
        
        // 1. Generate static 7 days headers (always visible)
        for (let i = -STATIC_DAYS; i <= 0; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString();
            const x = 5000 + (i * 230);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase().replace('.', '');
            const isToday = i === 0;
            
            editor.createShape({
                id: createShapeId(),
                type: 'static-date-header',
                x: x - 14,
                y: 60,
                isLocked: true,
                props: {
                    w: 70,
                    h: 55,
                    day: day,
                    month: month,
                    isToday: isToday,
                },
            });
        }
        
        // 2. Generate dynamic old dates headers (only for existing dates)
        const mapToUse = customDateMap || dateColumnMap;
        if (mapToUse) {
            const oldDates = Object.keys(mapToUse)
                .filter(d => {
                    const date = new Date(d);
                    date.setHours(0, 0, 0, 0);
                    const diff = Math.floor((date - today) / (24 * 60 * 60 * 1000));
                    return diff < -STATIC_DAYS;
                })
                .sort()
                .reverse(); // Most recent first
            
            oldDates.forEach((dateStr, index) => {
                const date = new Date(dateStr);
                const x = 3070 - (index * 230);
                const day = date.getDate().toString().padStart(2, '0');
                const month = date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase().replace('.', '');
                
                editor.createShape({
                    id: createShapeId(),
                    type: 'static-date-header',
                    x: x - 14,
                    y: 60,
                    isLocked: true,
                    props: {
                        w: 70,
                        h: 55,
                        day: day,
                        month: month,
                        isToday: false,
                    },
                });
            });
            
            // 3. Add visual separator if there are old dates  
            if (oldDates.length > 0) {
                // Create a vertical line using geo shape (more reliable than line)
                editor.createShape({
                    id: createShapeId(),
                    type: 'geo',
                    x: 3300,
                    y: 40,
                    isLocked: true,
                    opacity: 0.3, // opacity on shape level, not in props
                    props: {
                        geo: 'rectangle',
                        w: 2, // Very thin rectangle to look like a line
                        h: 800,
                        color: 'grey',
                        fill: 'none', // transparent fill
                        dash: 'dashed',
                        size: 's',
                    },
                });
            }
        }
        });
    }, [dateColumnMap]); // dateColumnMap is still a dependency for when customDateMap is not provided
    
    // Generate date headers when dateColumnMap updates
    // DISABLED: This causes double generation after loadNotes
    // useEffect(() => {
    //     if (editor) {
    //         // Always generate static headers, dynamic headers will be added if dateColumnMap has old dates
    //         generateDateHeaders(editor);
    //     }
    // }, [editor, dateColumnMap, generateDateHeaders]);
    
    // Create shapes from notes
    const createShapesFromNotes = useCallback((notesData, editor, preserveCamera = false, customDateMap = null) => {
        if (!editor) return;
        
        // console.log('🎨 Creating shapes from notes:', notesData.length);
        
        // Save current camera position if needed
        let savedCamera = null;
        if (preserveCamera) {
            savedCamera = editor.getCamera();
            // console.log('📸 Saved camera position:', savedCamera);
        }
        
        // Create new ID map before mergeRemoteChanges
        const newNoteIdMap = new Map();
        
        // All shape creation/deletion should be marked as programmatic
        editor.store.mergeRemoteChanges(() => {
            // Clear existing shapes
            const existingShapes = editor.getCurrentPageShapes();
            editor.deleteShapes(existingShapes.map(s => s.id));
            
            // Create shapes for each note
            notesData.forEach(note => {
                const shapeId = createShapeId();
                newNoteIdMap.set(note.id, shapeId);
            
            // Calculate X position for column notes, use saved X for manually positioned
            let x;
            if (note.manuallyPositioned) {
                x = note.x;
            } else {
                // Always use calculateColumnX for non-manual notes
                x = calculateColumnX(note.date, customDateMap);
            }
            
            const shapeData = {
                id: shapeId,
                type: 'custom-note',
                x: x,
                y: note.y,
                props: {
                    w: 180,
                    h: 50, // Компактная высота карточки
                    color: 'black',
                    labelColor: 'black',
                    richText: toRichText(note.title + '\n\n' + (note.content || '')),
                    noteType: note.type,
                    time: new Date(note.date).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }),
                    duration: note.voiceDuration ? 
                        `${Math.floor(note.voiceDuration / 60)}:${(note.voiceDuration % 60).toString().padStart(2, '0')}` : 
                        '',
                    manuallyPositioned: note.manuallyPositioned || false,
                    dbId: note.id,
                    tags: note.tags || [],
                    aiSuggestedTags: note.aiSuggestedTags || [],
                },
            };
            
                editor.createShape(shapeData);
            });
            
            // Generate date headers (always show them even if no notes)
            generateDateHeaders(editor, customDateMap);
        });
        
        // Set the noteIdMap after all shapes are created
        // console.log('📊 Setting noteIdMap with', newNoteIdMap.size, 'entries');
        setNoteIdMap(newNoteIdMap);
        
        // Restore camera position or set default
        if (savedCamera) {
            // console.log('📸 Restoring camera position:', savedCamera);
            editor.setCamera(savedCamera);
        } else {
            // Try to restore from localStorage first
            const storedCameraStr = localStorage.getItem('tldraw-camera-position');
            if (storedCameraStr) {
                try {
                    const storedCamera = JSON.parse(storedCameraStr);
                    // Check if position is not too old (24 hours)
                    if (storedCamera.timestamp && Date.now() - storedCamera.timestamp < 24 * 60 * 60 * 1000) {
                        editor.setCamera({ x: storedCamera.x, y: storedCamera.y, z: storedCamera.z });
                        console.log('📸 Restored camera position from localStorage:', storedCamera);
                    } else {
                        // Position too old, center on TODAY
                        const TODAY_X = 5000;
                        const COLUMN_WIDTH = 180;
                        editor.centerOnPoint({ 
                            x: TODAY_X + (COLUMN_WIDTH / 2),
                            y: 200
                        });
                        console.log('📸 Camera position too old, centered on TODAY');
                    }
                } catch (e) {
                    // Invalid stored data, center on TODAY
                    const TODAY_X = 5000;
                    const COLUMN_WIDTH = 180;
                    editor.centerOnPoint({ 
                        x: TODAY_X + (COLUMN_WIDTH / 2),
                        y: 200
                    });
                    console.log('📸 Invalid stored camera position, centered on TODAY');
                }
            } else {
                // No stored position, center on TODAY
                const TODAY_X = 5000;
                const COLUMN_WIDTH = 180;
                editor.centerOnPoint({ 
                    x: TODAY_X + (COLUMN_WIDTH / 2),
                    y: 200
                });
                console.log('📸 No stored camera position, centered on TODAY');
            }
        }
    }, [generateDateHeaders, calculateColumnX]);
    
    // Helper functions for note merging
    const calculateOverlap = (shape1, shape2) => {
        // Get bounds for both shapes
        const bounds1 = {
            left: shape1.x,
            right: shape1.x + (shape1.props?.w || 180),
            top: shape1.y,
            bottom: shape1.y + (shape1.props?.h || 50)
        };
        
        const bounds2 = {
            left: shape2.x,
            right: shape2.x + (shape2.props?.w || 180),
            top: shape2.y,
            bottom: shape2.y + (shape2.props?.h || 50)
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
        
        // DEBUG: Показываем удаление при слиянии
        if (window.DEBUG_SYNC) {
            console.log('🔀 УДАЛЕНИЕ при слиянии:', {
                действие: 'Удаляем перетаскиваемую заметку',
                пометка: 'source: remote (слушатель НЕ попытается обработать)'
            });
        }
        
        // Immediately hide the dragged note
        editor.store.mergeRemoteChanges(() => {
            editor.deleteShapes([draggedNote.id]);
        });
        
        // Add loading animation to target note
        const targetElement = document.querySelector(`[data-shape="${targetNote.id}"]`);
        if (targetElement) {
            targetElement.style.animation = 'pulse 1s ease-in-out infinite';
            targetElement.style.boxShadow = '0 0 20px rgba(135, 206, 250, 0.6)';
        }
        
        try {
            // Get note data from backend immediately - no delay needed
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
                    date: new Date().toISOString(), // Use today as fallback
                    tags: draggedShape.props.tags || [],
                    aiSuggestedTags: draggedShape.props.aiSuggestedTags || []
                };
                
                var targetData = {
                    title: targetText.title,
                    content: targetText.content,
                    date: new Date().toISOString(), // Use today as fallback
                    manuallyPositioned: targetShape.props.manuallyPositioned || false,
                    tags: targetShape.props.tags || [],
                    aiSuggestedTags: targetShape.props.aiSuggestedTags || []
                };
            } else {
                var draggedData = await draggedResponse.json();
                var targetData = await targetResponse.json();
            }
            
            // Create merged note - dragged note goes to the end
            const mergedTitle = targetData.title + ' / ' + draggedData.title;
            const mergedContent = targetData.content + '\n\n//////\n\n' + draggedData.content;
            
            // Merge tags (unique values only)
            const mergedTags = [...new Set([...(targetData.tags || []), ...(draggedData.tags || [])])];
            
            console.log('📝 Creating merged note:', {
                title: mergedTitle,
                x: targetNote.x,
                y: targetNote.y,
                date: targetData.date,
                targetTags: targetData.tags,
                draggedTags: draggedData.tags,
                mergedTags: mergedTags
            });
            
            // Format date as string for backend (YYYY-MM-DD)
            const targetDate = new Date(targetData.date);
            const dateString = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}-${targetDate.getDate().toString().padStart(2, '0')}`;
            
            // Create new merged note with target's position
            const requestBody = {
                title: mergedTitle,
                content: mergedContent,
                type: 'text',
                date: dateString,
                x: targetNote.x,
                y: targetNote.y,
                manuallyPositioned: targetData.manuallyPositioned || false,
                tags: mergedTags,
            };
            
            console.log('📡 POST /notes request body:', requestBody);
            
            const createResponse = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': USER_ID,
                },
                body: JSON.stringify(requestBody),
            });
            
            if (!createResponse.ok) {
                throw new Error('Failed to create merged note');
            }
            
            const mergedNote = await createResponse.json();
            console.log('✅ Merged note created:', mergedNote.id, 'with tags:', mergedNote.tags);
            
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
            const result = await loadNotes();
            const allNotes = result.notes || result;
            const dateMap = result.dateMap || null;
            createShapesFromNotes(allNotes, editor, true, dateMap);
            
            console.log('✨ Merge completed successfully');
            
            // Remove loading animation from target
            if (targetElement) {
                targetElement.style.animation = '';
                targetElement.style.boxShadow = '';
            }
            
        } catch (error) {
            console.error('❌ Error during merge:', error);
            
            // Remove animation on error
            if (targetElement) {
                targetElement.style.animation = '';
                targetElement.style.boxShadow = '';
            }
        }
    };
    
    // Setup position sync
    useEffect(() => {
        if (!editor || !noteIdMap || noteIdMap.size === 0) return;
        
        // console.log('🔗 Setting up position sync with noteIdMap:', noteIdMap.size, 'entries');
        
        // Track dragging state
        let draggedNotes = new Map();  // Store all dragged notes info
        let potentialMerge = null;
        let highlightedTarget = null;
        let wasDragging = false; // Флаг для отслеживания отпускания
        
        const sendPositionUpdate = async (dbId, position) => {
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
                            // Use mergeRemoteChanges to mark as programmatic update
                            editor.store.mergeRemoteChanges(() => {
                                editor.updateShape({
                                    id: shapeId,
                                    type: shape.type,
                                    props: {
                                        ...shape.props,
                                        manuallyPositioned: updatedNote.manuallyPositioned,
                                    },
                                });
                            });
                            
                            // If note became manually positioned, reload and redraw to update columns
                            if (updatedNote.manuallyPositioned) {
                                console.log('🔄 Note became manually positioned, reloading and redrawing...');
                                const result = await loadNotes();
                                if (result && editor) {
                                    // Redraw all shapes with new column positions
                                    const allNotes = result.notes || [];
                                    const dateMap = result.dateMap || null;
                                    createShapesFromNotes(allNotes, editor, true, dateMap);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error updating position:', error);
            }
        };
        
        // Subscribe to shape position changes
        let unsubscribe;
        unsubscribe = editor.store.listen((change) => {
            // DEBUG: Показываем что приходит в слушатель
            if (window.DEBUG_SYNC) {
                console.log('🔍 СЛУШАТЕЛЬ ПОЛУЧИЛ СОБЫТИЕ:', {
                    source: change.source,
                    количество_изменений: Object.values(change.changes.updated).length,
                    тип: change.source === 'user' ? '👤 ОТ ПОЛЬЗОВАТЕЛЯ' : '🤖 ОТ ПРОГРАММЫ'
                });
            }
            
            // Handle position updates
            for (const [from, to] of Object.values(change.changes.updated)) {
                if (from.typeName === 'shape' && to.typeName === 'shape') {
                    // Компактный лог
                    // console.log('📦 Shape update:', {
                    //     type: to.type,
                    //     id: to.id,
                    //     movedX: from.x !== to.x,
                    //     movedY: from.y !== to.y,
                    //     props: to.props,
                    // });
                    
                    if (to.type === 'custom-note' && (from.x !== to.x || from.y !== to.y)) {
                        // Get DB ID from shape props
                        const dbId = to.props?.dbId;
                        
                        // DEBUG: Показываем что обрабатываем
                        if (window.DEBUG_SYNC) {
                            console.log('📍 ОБРАБАТЫВАЕМ движение заметки:', {
                                dbId,
                                старая_позиция: { x: from.x, y: from.y },
                                новая_позиция: { x: to.x, y: to.y },
                                источник: 'USER (только пользовательские попадают сюда)'
                            });
                        }
                        
                        // Track dragged notes
                        
                        if (dbId) {
                            // Store the dragged note info (will send update on release)
                            draggedNotes.set(dbId, { dbId, x: to.x, y: to.y });
                            
                            // Store the moving shape for merge check
                            potentialMerge = to;
                            
                            // Update z-index for all dragging shapes
                            const selectedShapes = editor.getSelectedShapes();
                            
                            // Z-index diagnostics removed - issue fixed
                            
                            // Apply high z-index to shape and its container
                            selectedShapes.forEach(shape => {
                                const element = document.querySelector(`[data-shape="${shape.id}"]`);
                                if (element) {
                                    // Set on the shape element itself
                                    element.style.zIndex = '10000';
                                    element.style.position = 'relative';
                                    
                                    // Also set on parent tl-shape element if it exists
                                    const tlShape = element.closest('.tl-shape');
                                    if (tlShape) {
                                        tlShape.style.zIndex = '10000';
                                    }
                                    
                                    // Find the HTML container inside and set z-index there too
                                    const htmlContainer = element.querySelector('.tl-html-container');
                                    if (htmlContainer) {
                                        htmlContainer.style.zIndex = '10000';
                                        htmlContainer.style.position = 'relative';
                                    }
                                    
                                    // Z-index successfully applied
                                }
                            });
                            
                            // Real-time merge target highlighting
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
                            
                            // Отслеживаем состояние перетаскивания
                            if (!wasDragging) {
                                console.log(`⏱ T+${Date.now() % 100000}: START_DRAG`);
                            }
                            wasDragging = true;
                        } else {
                            console.warn('⚠️ No dbId found in shape props!', to.props);
                        }
                    }
                }
            }
        }, { source: 'user', scope: 'document' });
        
        // 🎯 Мгновенная проверка слияния без задержек
        const performInstantMergeCheck = () => {
            console.log(`⏱ T+${Date.now() % 100000}: performInstantMergeCheck`);
            
            if (!potentialMerge) {
                console.log(`⏱ T+${Date.now() % 100000}: no potentialMerge`);
                return;
            }
            
            const allShapes = editor.getCurrentPageShapes();
            const customNotes = allShapes.filter(s => s.type === 'custom-note');
            const selectedShapes = editor.getSelectedShapes();
            
            console.log(`⏱ T+${Date.now() % 100000}: shapes=${customNotes.length} selected=${selectedShapes.length}`);
            
            if (selectedShapes.length === 1) {
                for (const shape of customNotes) {
                    if (shape.id === potentialMerge.id) continue;
                    
                    const overlap = calculateOverlap(potentialMerge, shape);
                    
                    if (overlap >= 0.3) {
                        console.log(`⏱ T+${Date.now() % 100000}: MERGE! overlap=${(overlap * 100).toFixed(1)}%`);
                        
                        // Убираем подсветку
                        if (highlightedTarget) {
                            const element = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                            if (element) {
                                element.classList.remove('merge-target');
                            }
                            highlightedTarget = null;
                        }
                        
                        // Слияние
                        mergeNotes(potentialMerge, shape);
                        potentialMerge = null;
                        break;
                    }
                }
            }
            
            // Очищаем
            potentialMerge = null;
            
            // Очищаем z-index
            const allElements = document.querySelectorAll('[data-shape]');
            allElements.forEach(el => {
                el.style.zIndex = '';
            });
        };
        
        // Вариант 1: Подписка на document pointerup
        const handlePointerUp = (e) => {
            console.log(`⏱ T+${Date.now() % 100000}: DOC_POINTER_UP wasDrag=${wasDragging}`);
            
            if (wasDragging) {
                wasDragging = false;
                
                // Send position update to backend ONLY when drag ends
                if (draggedNotes.size > 0) {
                    for (const [dbId, note] of draggedNotes) {
                        sendPositionUpdate(note.dbId, { x: note.x, y: note.y });
                    }
                    draggedNotes.clear();
                }
                
                console.log(`⏱ T+${Date.now() % 100000}: INSTANT_CHECK`);
                performInstantMergeCheck();
            }
        };
        
        document.addEventListener('pointerup', handlePointerUp);
        console.log(`⏱ T+${Date.now() % 100000}: LISTENER_ADDED`);
        
        // Вариант 2: Попробуем editor.on если поддерживается
        try {
            if (editor.on) {
                console.log(`⏱ T+${Date.now() % 100000}: editor.on EXISTS`);
                
                const unsubscribePointerUp = editor.on('pointer_up', (info) => {
                    console.log(`⏱ T+${Date.now() % 100000}: EDITOR_POINTER_UP`);
                    if (wasDragging) {
                        wasDragging = false;
                        
                        // Send position update to backend ONLY when drag ends
                        if (draggedNotes.size > 0) {
                            for (const [dbId, note] of draggedNotes) {
                                sendPositionUpdate(note.dbId, { x: note.x, y: note.y });
                            }
                            draggedNotes.clear();
                        }
                        
                        performInstantMergeCheck();
                    }
                });
            } else {
                console.log(`⏱ T+${Date.now() % 100000}: editor.on NOT_FOUND`);
            }
        } catch (err) {
            console.log(`⏱ T+${Date.now() % 100000}: editor.on ERROR:`, err.message);
        }
        
        return () => {
            // console.log('🔌 Cleaning up position sync');
            document.removeEventListener('pointerup', handlePointerUp);
            console.log(`⏱ T+${Date.now() % 100000}: CLEANUP`);
            
            // Clean up any remaining highlight
            if (highlightedTarget) {
                const element = document.querySelector(`[data-shape="${highlightedTarget}"]`);
                if (element) {
                    element.classList.remove('merge-target');
                }
            }
            
            // Unsubscribe from store changes
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
        
        // Снимаем выделение при открытии модалки
        editor.selectNone();
        
        // Также сбрасываем hover состояние если нужно
        if (editor.getHoveredShapeId() === shapeId) {
            editor.setHoveredShape(null);
        }
        
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
                    date: new Date().toISOString()
                });
                setIsNoteModalOpen(true);
            }
        } catch (error) {
            console.error('❌ Error fetching note for modal:', error);
        }
    }, [editor]);
    
    // Save camera position to localStorage only when camera stops moving
    useEffect(() => {
        if (!editor) return;
        
        let isDragging = false;
        let lastCamera = null;
        
        const saveCameraPosition = () => {
            const camera = editor.getCamera();
            localStorage.setItem('tldraw-camera-position', JSON.stringify({
                x: camera.x,
                y: camera.y,
                z: camera.z,
                timestamp: Date.now()
            }));
            console.log('📸 Camera position saved on stop:', camera);
        };
        
        // Handle pointer/wheel events to detect when user stops interacting
        const handlePointerDown = () => {
            isDragging = true;
            lastCamera = editor.getCamera();
        };
        
        const handlePointerUp = () => {
            if (isDragging) {
                isDragging = false;
                const currentCamera = editor.getCamera();
                // Only save if camera actually moved
                if (lastCamera && (lastCamera.x !== currentCamera.x || lastCamera.y !== currentCamera.y || lastCamera.z !== currentCamera.z)) {
                    saveCameraPosition();
                }
            }
        };
        
        const handleWheel = () => {
            // For wheel events, use a small debounce since wheel events fire rapidly
            clearTimeout(handleWheel.timeoutId);
            handleWheel.timeoutId = setTimeout(() => {
                saveCameraPosition();
            }, 150); // Small debounce just for wheel events to stop
        };
        
        // Listen to pointer events
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('wheel', handleWheel, { passive: true });
        
        // Also save on page unload
        const handleBeforeUnload = () => {
            saveCameraPosition();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('wheel', handleWheel);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearTimeout(handleWheel.timeoutId);
        };
    }, [editor]);
    
    // Save handleNoteClick to window for ShapeUtil access
    useEffect(() => {
        window.handleNoteClick = handleNoteClick;
        
        // Debug helper for hybrid zones
        window.debugZones = () => {
            console.log('🎯 Hybrid Zones Debug:');
            console.log('  Static zone: X from 3390 to 5000 (7 days)');
            console.log('  Separator: X = 3300');
            console.log('  Dynamic zone: X < 3070 (old dates)');
            console.log('  Date map:', dateColumnMap);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            Object.entries(dateColumnMap).forEach(([dateStr, _]) => {
                const x = calculateColumnX(dateStr);
                const date = new Date(dateStr);
                date.setHours(0, 0, 0, 0);
                const daysDiff = Math.floor((date - today) / (24 * 60 * 60 * 1000));
                const zone = daysDiff >= -7 ? 'STATIC' : 'DYNAMIC';
                console.log(`  ${dateStr.split('T')[0]} → X=${x} (${zone}, day ${daysDiff})`);
            });
        };
        
        return () => {
            delete window.handleNoteClick;
            delete window.debugZones;
        };
    }, [handleNoteClick, dateColumnMap, calculateColumnX]);
    
    
    // Handle editor mount
    const handleMount = useCallback(async (editor) => {
        console.log('🚀 SyncedProductionApp: Editor mounted');
        setEditor(editor);
        window.editor = editor;
        window.saveEditor(editor);
        
        // Автоматически исключать static-date-header из выделения
        const unsubscribeSelection = editor.on('change', ({ changes }) => {
            if (changes.updated_instance?.length > 0) {
                const selectedShapes = editor.getSelectedShapes();
                const hasStaticHeaders = selectedShapes.some(shape => shape.type === 'static-date-header');
                
                if (hasStaticHeaders) {
                    // Фильтруем только custom-note shapes
                    const onlyNotes = selectedShapes.filter(shape => shape.type === 'custom-note');
                    if (onlyNotes.length > 0) {
                        // Выделяем только заметки
                        editor.setSelectedShapes(onlyNotes.map(s => s.id));
                    } else {
                        // Если заметок нет, снимаем выделение
                        editor.setSelectedShapes([]);
                    }
                }
            }
        });
        
        // Добавляем глобальный обработчик Escape для снятия выделения
        const handleGlobalEscape = (e) => {
            if (e.key === 'Escape') {
                // Если есть выделенные shapes и фокус на canvas/editor
                if (editor.getSelectedShapes().length > 0) {
                    const activeEl = document.activeElement;
                    // Проверяем что фокус на canvas или body (не на кнопке)
                    if (activeEl && (activeEl.tagName === 'BODY' || 
                        activeEl.classList.contains('tl-canvas') ||
                        activeEl.classList.contains('tl-container'))) {
                        editor.setSelectedShapes([]);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }
        };
        
        // Слушаем на фазе bubbling (после ModalStackContext)
        document.addEventListener('keydown', handleGlobalEscape, false);
        editor._handleGlobalEscape = handleGlobalEscape;
        
        // Сохраняем функцию отписки для очистки
        editor._unsubscribeSelection = unsubscribeSelection;
        
        // Add CSS for tooltip animation
        const tooltipStyle = document.createElement('style');
        tooltipStyle.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(tooltipStyle);
        
        // Store for cleanup
        editor._tooltipStyle = tooltipStyle;
        
        // Debug commands for hover testing
        window.enableHoverDebug = () => {
            window.DEBUG_HOVER = true;
            console.log('✅ Hover debugging enabled. Watch console for events.');
            console.log('   ✅ TLDRAW HOVER = green border appears/disappears');
        };
        
        window.disableHoverDebug = () => {
            window.DEBUG_HOVER = false;
            console.log('❌ Hover debugging disabled');
        };
        
        // Debug selection state for menu visibility
        window.debugSelection = () => {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => {
                logs.push(args.join(' '));
                originalLog(...args);
            };
            
            setTimeout(() => {
                console.log = originalLog;
                const filtered = logs.filter(log => 
                    log.includes('Selection state') || 
                    log.includes('Visibility effect') ||
                    log.includes('Hiding menu') ||
                    log.includes('Showing menu') ||
                    log.includes('Setting timer')
                );
                console.log('📋 Selection logs:');
                filtered.forEach(log => console.log(log));
                navigator.clipboard.writeText(filtered.join('\n'));
                console.log('✅ Logs copied to clipboard!');
            }, 5000);
            
            console.log('🎯 Tracking selection for 5 seconds... Select some notes now!');
        };
        
        // Enhanced debug for cursor and hover sync issues
        window.debugCursor = () => {
            console.log('🔍 ENHANCED DEBUG: Cursor & Hover Analysis');
            console.log('='.repeat(50));
            
            // 1. Check tldraw hover state
            const hoveredId = editor.getHoveredShapeId();
            console.log('📍 Tldraw hovered shape ID:', hoveredId || 'None');
            
            if (hoveredId) {
                const hoveredShape = editor.getShape(hoveredId);
                console.log('📍 Hovered shape type:', hoveredShape?.type);
                console.log('📍 Hovered shape bounds:', hoveredShape ? {
                    x: hoveredShape.x,
                    y: hoveredShape.y,
                    w: hoveredShape.props?.w,
                    h: hoveredShape.props?.h
                } : 'N/A');
            }
            
            // 2. Check mouse position
            const pagePoint = editor.inputs.currentPagePoint;
            console.log('🖱️ Mouse position (page coords):', { x: pagePoint.x, y: pagePoint.y });
            
            // 3. Check what's at mouse position
            const shapeAtPoint = editor.getShapeAtPoint(pagePoint, {
                hitInside: true,
                margin: 0
            });
            console.log('🎯 Shape at mouse position:', shapeAtPoint?.id || 'None');
            
            // 4. Check green indicators (tldraw's hover visualization)
            const indicators = document.querySelectorAll('.tl-indicator[data-component="indicator"]');
            console.log('🟢 Active indicators:', indicators.length);
            indicators.forEach(ind => {
                console.log('  - Indicator for:', ind.getAttribute('data-classname'));
            });
            
            // 5. Check CSS :hover state
            const hoveredElements = document.querySelectorAll(':hover');
            const hoveredShapes = Array.from(hoveredElements).filter(el => 
                el.classList.contains('tl-shape') || 
                el.closest('[data-shape-type="custom-note"]')
            );
            console.log('🎨 CSS :hover on shapes:', hoveredShapes.length);
            
            // 6. Check all custom-note shapes and their styles
            console.log('\n📋 Custom Note Shapes Analysis:');
            const shapes = document.querySelectorAll('[data-shape-type="custom-note"]');
            
            shapes.forEach((shape, i) => {
                const shapeId = shape.getAttribute('data-shape-id');
                const rect = shape.getBoundingClientRect();
                const container = shape.querySelector('.tl-html-container');
                const isHovered = shape.matches(':hover');
                const computed = window.getComputedStyle(container || shape);
                
                console.log(`\n  Shape ${i} [${shapeId?.substring(0,8)}...]`);
                console.log(`    Position: (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
                console.log(`    Size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`);
                console.log(`    CSS :hover: ${isHovered}`);
                console.log(`    Tldraw hover: ${shapeId === hoveredId}`);
                console.log(`    Cursor style: ${computed.cursor}`);
                console.log(`    Pointer events: ${computed.pointerEvents}`);
                
                // Check for mismatch
                if (isHovered !== (shapeId === hoveredId)) {
                    console.log(`    ⚠️ MISMATCH: CSS hover=${isHovered}, Tldraw hover=${shapeId === hoveredId}`);
                }
            });
            
            // 7. Check parent SVG and canvas
            const svg = document.querySelector('.tl-svg-container svg');
            if (svg) {
                const svgComputed = window.getComputedStyle(svg);
                console.log('\n🖼️ SVG Container:');
                console.log('  Cursor:', svgComputed.cursor);
                console.log('  Pointer events:', svgComputed.pointerEvents);
            }
            
            // 8. Check canvas
            const canvas = document.querySelector('.tl-canvas');
            if (canvas) {
                const canvasComputed = window.getComputedStyle(canvas);
                console.log('\n📐 Canvas:');
                console.log('  Cursor:', canvasComputed.cursor);
            }
        };
        
        // Final cursor sync test - v2 with reactive state
        window.testCursorSync = () => {
            console.log('🧪 Testing Cursor Sync Fix v2 (Reactive)...');
            console.log('='.repeat(50));
            
            // Check all custom-note containers
            const containers = document.querySelectorAll('.tl-shape[data-shape-type="custom-note"] .tl-html-container');
            console.log(`Found ${containers.length} custom-note containers`);
            
            const hoveredId = editor.getHoveredShapeId();
            console.log(`\n🎯 Currently hovered shape: ${hoveredId || 'None'}`);
            
            let syncedCount = 0;
            let mismatchCount = 0;
            
            containers.forEach((container, i) => {
                const computed = window.getComputedStyle(container);
                const shapeElement = container.closest('[data-shape-id]');
                const shapeId = shapeElement?.getAttribute('data-shape-id');
                const isTldrawHovered = hoveredId === shapeId;
                const hasPointerCursor = computed.cursor.includes('pointer');
                const hasAutoPointerEvents = computed.pointerEvents === 'auto';
                
                // Check if cursor/pointer-events are synced with tldraw hover
                const isSynced = (isTldrawHovered === hasPointerCursor) && 
                                (isTldrawHovered === hasAutoPointerEvents);
                
                if (isSynced) syncedCount++;
                else mismatchCount++;
                
                if (!isSynced || isTldrawHovered) {
                    console.log(`\nContainer ${i} [${shapeId?.substring(0,8)}...]:`);
                    console.log(`  Tldraw hover: ${isTldrawHovered ? '✅' : '❌'}`);
                    console.log(`  Pointer events: ${hasAutoPointerEvents ? 'auto' : computed.pointerEvents} ${isTldrawHovered === hasAutoPointerEvents ? '✅' : '⚠️ MISMATCH'}`);
                    console.log(`  Cursor: ${computed.cursor} ${isTldrawHovered === hasPointerCursor ? '✅' : '⚠️ MISMATCH'}`);
                    
                    if (!isSynced) {
                        console.log(`  ⚠️ SYNC ISSUE: Hover=${isTldrawHovered}, Cursor=${hasPointerCursor}, Events=${hasAutoPointerEvents}`);
                    }
                }
            });
            
            console.log('\n📊 Sync Status:');
            console.log(`  ✅ Synced shapes: ${syncedCount}/${containers.length}`);
            console.log(`  ⚠️ Mismatched: ${mismatchCount}/${containers.length}`);
            
            console.log('\n✨ Fix Implementation v2:');
            console.log('  1. Using useEditor() and useValue() hooks ✅');
            console.log('  2. Reactive hover state synced with tldraw ✅');
            console.log('  3. pointerEvents: auto only when hovered/selected ✅');
            console.log('  4. cursor: pointer only when hovered ✅');
            console.log('  5. Removed stopPropagation for drag support ✅');
            
            if (mismatchCount === 0) {
                console.log('\n🎉 SUCCESS: All shapes properly synced!');
            } else {
                console.log('\n⚠️ WARNING: Some shapes have sync issues. Check implementation.');
            }
        };
        
        // Detailed bounds check
        window.checkBounds = () => {
            const hoveredId = editor.getHoveredShapeId();
            if (!hoveredId) {
                console.log('❌ No shape hovered. Hover over a shape and try again.');
                return;
            }
            
            console.log('🔍 Bounds Analysis for hover mismatch:');
            console.log('='.repeat(50));
            
            // Get the shape
            const shape = editor.getShape(hoveredId);
            if (!shape) return;
            
            // Shape geometry bounds
            console.log('📐 Shape Geometry:');
            console.log(`  Width: ${shape.props.w}px`);
            console.log(`  Height: ${shape.props.h}px`);
            console.log(`  Position: (${shape.x}, ${shape.y})`);
            
            // Find HTML elements
            const shapeElement = document.querySelector(`[data-shape-id="${hoveredId}"]`);
            const htmlContainer = shapeElement?.querySelector('.tl-html-container');
            const indicator = document.querySelector(`.tl-indicator[data-id="${hoveredId}"]`);
            
            if (htmlContainer) {
                const htmlRect = htmlContainer.getBoundingClientRect();
                const computed = window.getComputedStyle(htmlContainer);
                
                console.log('\n📦 HTML Container:');
                console.log(`  Actual size: ${htmlRect.width}x${htmlRect.height}px`);
                console.log(`  Position: (${htmlRect.left}, ${htmlRect.top})`);
                console.log(`  Padding: ${computed.padding}`);
                console.log(`  Border: ${computed.border}`);
                console.log(`  Box-sizing: ${computed.boxSizing}`);
                console.log(`  Pointer-events: ${computed.pointerEvents}`);
                console.log(`  Cursor: ${computed.cursor}`);
                
                // Calculate content box vs border box
                const paddingLeft = parseFloat(computed.paddingLeft) || 0;
                const paddingRight = parseFloat(computed.paddingRight) || 0;
                const paddingTop = parseFloat(computed.paddingTop) || 0;
                const paddingBottom = parseFloat(computed.paddingBottom) || 0;
                
                console.log('\n⚠️ Size Mismatch Analysis:');
                console.log(`  Geometry width: ${shape.props.w}px`);
                console.log(`  HTML width (with padding): ${htmlRect.width}px`);
                console.log(`  Content width (no padding): ${htmlRect.width - paddingLeft - paddingRight}px`);
                console.log(`  Width difference: ${Math.abs(shape.props.w - htmlRect.width)}px`);
                
                if (Math.abs(shape.props.w - htmlRect.width) > 1) {
                    console.log('  🔴 WIDTH MISMATCH - HTML container doesn\'t match geometry!');
                }
                
                console.log(`\n  Geometry height: ${shape.props.h}px`);
                console.log(`  HTML height (with padding): ${htmlRect.height}px`);
                console.log(`  Content height (no padding): ${htmlRect.height - paddingTop - paddingBottom}px`);
                console.log(`  Height difference: ${Math.abs(shape.props.h - htmlRect.height)}px`);
                
                if (Math.abs(shape.props.h - htmlRect.height) > 1) {
                    console.log('  🔴 HEIGHT MISMATCH - HTML container doesn\'t match geometry!');
                }
            }
            
            // Check indicator (green border)
            if (indicator) {
                const indRect = indicator.getBoundingClientRect();
                console.log('\n🟢 Green Border Indicator:');
                console.log(`  Size: ${indRect.width}x${indRect.height}px`);
                console.log(`  Position: (${indRect.left}, ${indRect.top})`);
                
                if (htmlContainer) {
                    const htmlRect = htmlContainer.getBoundingClientRect();
                    console.log('\n🎯 Indicator vs HTML Container:');
                    console.log(`  Indicator covers HTML: ${indRect.width >= htmlRect.width && indRect.height >= htmlRect.height}`);
                    console.log(`  Gap on sides: ${(indRect.width - htmlRect.width) / 2}px`);
                    console.log(`  Gap on top/bottom: ${(indRect.height - htmlRect.height) / 2}px`);
                    
                    if (indRect.width > htmlRect.width || indRect.height > htmlRect.height) {
                        console.log('  ⚠️ PROBLEM: Green border is larger than HTML container!');
                        console.log('  This creates dead zones where hover shows but cursor doesn\'t change.');
                    }
                }
            }
            
            // Mouse position
            const pagePoint = editor.inputs.currentPagePoint;
            console.log('\n🖱️ Current Mouse Position:');
            console.log(`  Page coords: (${pagePoint.x}, ${pagePoint.y})`);
            
            // Solution
            console.log('\n💡 Solution Options:');
            console.log('  1. Remove padding from HTML container');
            console.log('  2. Increase shape.props.w/h to include padding');
            console.log('  3. Extend pointer-events area beyond container');
        };
        
        // Quick hover check - checks tldraw cursor system
        window.checkCursor = () => {
            const hoveredId = editor.getHoveredShapeId();
            
            console.log('🔍 Tldraw Cursor System Check:');
            console.log('='.repeat(40));
            
            // Check tldraw's cursor state
            const instanceState = editor.getInstanceState();
            console.log(`  Current cursor type: ${instanceState.cursor.type}`);
            console.log(`  Current cursor rotation: ${instanceState.cursor.rotation}`);
            console.log(`  Hovered shape: ${hoveredId ? hoveredId.substring(0,8) + '...' : 'None'}`);
            
            // Check CSS variable
            const container = document.querySelector('.tl-container');
            if (container) {
                const cursorValue = getComputedStyle(container).getPropertyValue('--tl-cursor');
                console.log(`  CSS --tl-cursor: ${cursorValue || 'not set'}`);
            }
            
            // Check actual cursor on canvas
            const canvas = document.querySelector('.tl-canvas');
            if (canvas) {
                const canvasStyle = getComputedStyle(canvas);
                console.log(`  Canvas actual cursor: ${canvasStyle.cursor}`);
            }
            
            // Check if hovering custom-note
            if (hoveredId) {
                const shape = editor.getShape(hoveredId);
                if (shape) {
                    console.log(`\n  Hovered shape type: ${shape.type}`);
                    
                    if (shape.type === 'custom-note') {
                        if (instanceState.cursor.type === 'pointer') {
                            console.log('  ✅ SUCCESS: Cursor is pointer for custom-note!');
                        } else {
                            console.log('  ⚠️ PROBLEM: Cursor should be pointer for custom-note!');
                            console.log('  Current cursor: ' + instanceState.cursor.type);
                            console.log('  🔸 Check if useEffect with editor.setCursor() is running');
                        }
                    }
                }
            } else {
                console.log('\n  ℹ️ Hover over a shape to check cursor behavior');
            }
        };
        
        // Initial state
        window.DEBUG_HOVER = false; // Use window.enableHoverDebug() to enable
        
        // Debug: измерение задержки drag-to-merge
        window.measureDragDelay = () => {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => {
                const msg = args.join(' ');
                if (msg.includes('T+') || msg.includes('DRAG') || msg.includes('MERGE')) {
                    logs.push(msg);
                }
                originalLog(...args);
            };
            
            setTimeout(() => {
                console.log = originalLog;
                console.log('📋 Timing:');
                logs.forEach(l => console.log(l));
            }, 5000);
            
            console.log('⏱ Recording for 5s...');
        };
        
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
            // Снимаем выделение при открытии модалки
            editor.selectNone();
            
            // Также сбрасываем hover состояние
            if (shape && editor.getHoveredShapeId() === shape.id) {
                editor.setHoveredShape(null);
            }
            
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
                        date: new Date().toISOString()
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
        
        // Debug logging for hover events (simplified - only tldraw hover)
        let lastTldrawHovered = null;
        
        // Correct event handler using editor.on('event', callback)
        const handleEditorEvents = (eventInfo) => {
            // Debug hover events with enhanced detail
            if (window.DEBUG_HOVER && eventInfo.name === 'pointer_move') {
                const tldrawHovered = editor.getHoveredShapeId();
                
                // Log tldraw's hover state changes
                if (tldrawHovered !== lastTldrawHovered) {
                    if (tldrawHovered) {
                        const shape = editor.getShape(tldrawHovered);
                        if (shape?.type === 'custom-note') {
                            const title = shape.props?.richText?.content?.[0]?.content?.[0]?.text || 'No title';
                            console.log(`✅ TLDRAW HOVER: "${title.substring(0, 20)}..." [shape:${tldrawHovered.substring(0, 2)}]`);
                            
                            // Check CSS hover state
                            const element = document.querySelector(`[data-shape-id="${tldrawHovered}"]`);
                            if (element) {
                                const isHovered = element.matches(':hover');
                                const container = element.querySelector('.tl-html-container');
                                const computed = window.getComputedStyle(container || element);
                                console.log(`   CSS: :hover=${isHovered}, cursor=${computed.cursor}`);
                                
                                // Check indicator
                                const indicator = document.querySelector('.tl-indicator[data-component="indicator"]');
                                if (indicator) {
                                    console.log(`   🟢 Green border indicator is visible`);
                                }
                            }
                        }
                    } else if (lastTldrawHovered) {
                        console.log('❌ TLDRAW HOVER: None (green border disappears)');
                    }
                    lastTldrawHovered = tldrawHovered;
                }
            }
            
            // Skip logging for other frequent events  
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
        const result = await loadNotes();
        const notesData = result.notes || result; // Handle both old and new return format
        const dateMap = result.dateMap || null;
        
        // Generate headers and shapes immediately with the dateMap we have
        // No need to wait for React state update
        generateDateHeaders(editor, dateMap);
        
        // Then create notes if any
        if (notesData.length > 0) {
            createShapesFromNotes(notesData, editor, false, dateMap);
        } else {
            // No notes - try to restore camera position or center on TODAY
            const storedCameraStr = localStorage.getItem('tldraw-camera-position');
            if (storedCameraStr) {
                try {
                    const storedCamera = JSON.parse(storedCameraStr);
                    // Check if position is not too old (24 hours)
                    if (storedCamera.timestamp && Date.now() - storedCamera.timestamp < 24 * 60 * 60 * 1000) {
                        editor.setCamera({ x: storedCamera.x, y: storedCamera.y, z: storedCamera.z });
                        console.log('📸 No notes, but restored camera position from localStorage');
                    } else {
                        // Position too old
                        const TODAY_X = 5000;
                        const COLUMN_WIDTH = 180;
                        editor.centerOnPoint({ 
                            x: TODAY_X + (COLUMN_WIDTH / 2),
                            y: 200 
                        });
                        console.log('📸 No notes, camera position too old, centered on TODAY');
                    }
                } catch (e) {
                    // Invalid stored data
                    const TODAY_X = 5000;
                    const COLUMN_WIDTH = 180;
                    editor.centerOnPoint({ 
                        x: TODAY_X + (COLUMN_WIDTH / 2),
                        y: 200 
                    });
                    console.log('📸 No notes, invalid stored position, centered on TODAY');
                }
            } else {
                // No stored position
                const TODAY_X = 5000;
                const COLUMN_WIDTH = 180;
                editor.centerOnPoint({ 
                    x: TODAY_X + (COLUMN_WIDTH / 2),
                    y: 200 
                });
                console.log('📸 No notes found, centered on TODAY column');
            }
        }
    }, [loadNotes, createShapesFromNotes, generateDateHeaders, handleNoteClick, calculateColumnX]);
    
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
        
        // Create the shape as programmatic update
        editor.store.mergeRemoteChanges(() => {
            editor.createShape({
            id: shapeId,
            type: 'custom-note',
            x: x,
            y: note.y,
            props: {
                w: 180,
                h: 50, // Компактная высота карточки
                color: 'black',
                labelColor: 'black',
                richText: toRichText(note.title + '\n\n' + (note.content || '')),
                noteType: note.type,
                time: new Date(note.date).toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                duration: note.voiceDuration ? 
                    `${Math.floor(note.voiceDuration / 60)}:${(note.voiceDuration % 60).toString().padStart(2, '0')}` : 
                    '',
                manuallyPositioned: note.manuallyPositioned || false,
                dbId: note.id,
                tags: note.tags || [],
                aiSuggestedTags: note.aiSuggestedTags || [],
            },
            });
        });
        
        console.log(`✨ Added single note shape without full reload`);
    }, [calculateColumnX]);
    
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
            
            // Reload all notes to update dateColumnMap if needed
            const result = await loadNotes();
            if (result && editor) {
                const allNotes = result.notes || [];
                const dateMap = result.dateMap || null;
                // Redraw all shapes with correct column positions
                createShapesFromNotes(allNotes, editor, true, dateMap);
            }
            
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
    
    // Cleanup on unmount
    useEffect(() => {
        if (!editor) return;
        
        return () => {
            // Clean up modal click handler on unmount
            if (editor._modalCleanup) {
                editor._modalCleanup();
            }
        };
    }, [editor]);
    
    return (
        <ModalStackProvider>
            <style>{customStyles}</style>
            <div style={{ 
                position: 'fixed', 
                inset: 0,
                background: '#0a0a0a',
                overflow: 'hidden'
            }}>
                <Tldraw
                    shapeUtils={[CustomNoteShapeUtil, StaticDateHeaderShapeUtil]}
                    onMount={handleMount}
                >
                    <SyncedControls 
                        onAddNote={handleOpenDatePicker}
                        isSyncing={isSyncing}
                    />
                    <SelectionContextMenu 
                        onAfterDelete={async () => {
                            // Reload notes and redraw everything after deletion
                            const result = await loadNotes();
                            if (result && editor) {
                                const allNotes = result.notes || [];
                                const dateMap = result.dateMap || null;
                                // Redraw all shapes with updated positions
                                createShapesFromNotes(allNotes, editor, true, dateMap);
                            }
                        }}
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
                    onNoteUpdate={(updatedNote) => {
                        // Обновляем shape в canvas после редактирования
                        if (editor && updatedNote) {
                            const shapes = editor.getCurrentPageShapes();
                            const shape = shapes.find(s => s.props?.dbId === updatedNote.id);
                            
                            if (shape) {
                                const richText = {
                                    type: 'doc',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: updatedNote.title || '' }]
                                        },
                                        {
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: updatedNote.content || '' }]
                                        }
                                    ]
                                };
                                
                                // Обновляем время на карточке
                                const time = new Date(updatedNote.date).toLocaleTimeString('ru-RU', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                });
                                
                                // DEBUG: Показываем программное обновление
                                if (window.DEBUG_SYNC) {
                                    console.log('🤖 ПРОГРАММНОЕ ОБНОВЛЕНИЕ (смена даты):', {
                                        действие: 'Двигаем заметку в новую колонку',
                                        новая_дата: updatedNote.date,
                                        новая_X: calculateColumnX(updatedNote.date),
                                        пометка: 'source: remote (слушатель это НЕ увидит)'
                                    });
                                }
                                
                                // Use mergeRemoteChanges for all programmatic updates
                                editor.store.mergeRemoteChanges(() => {
                                    // Обновляем props карточки
                                    editor.updateShape({
                                        id: shape.id,
                                        type: 'custom-note',
                                        props: { 
                                            richText,
                                            time // Обновляем время на карточке
                                        }
                                    });
                                    
                                    // Если дата изменилась и заметка не перемещена вручную, обновляем позицию
                                    if (!updatedNote.manuallyPositioned) {
                                        const newX = calculateColumnX(updatedNote.date);
                                        // Backend уже пересчитал Y позицию, используем её
                                        if (Math.abs(shape.x - newX) > 1 || Math.abs(shape.y - updatedNote.y) > 1) { // Если позиция изменилась
                                            editor.updateShape({
                                                id: shape.id,
                                                type: 'custom-note',
                                                x: newX,
                                                y: updatedNote.y // Используем Y от backend (он нашел свободное место)
                                            });
                                        }
                                    }
                                });
                            }
                            
                            // Обновляем selectedNote чтобы модалка показывала актуальные данные
                            setSelectedNote(updatedNote);
                        }
                    }}
                    onExportSuccess={(exportData) => {
                        // Закрываем модалку
                        setIsNoteModalOpen(false);
                        setSelectedNote(null);
                        
                        // Удаляем shape с canvas
                        if (editor && exportData.noteId) {
                            const shapes = editor.getCurrentPageShapes();
                            const shape = shapes.find(s => s.props?.dbId === exportData.noteId);
                            if (shape) {
                                editor.store.mergeRemoteChanges(() => {
                                    editor.deleteShape(shape.id);
                                });
                            }
                        }
                        
                        // Показываем toast после закрытия модалки
                        setTimeout(() => {
                            setExportToastData(exportData);
                            setShowExportToast(true);
                        }, 300);
                    }}
                />
                
                {/* Export Toast Notification */}
                <ExportToast
                    show={showExportToast}
                    onClose={() => setShowExportToast(false)}
                    noteTitle={exportToastData?.noteTitle}
                    folderPath={exportToastData?.folderPath}
                    obsidianUrl={exportToastData?.obsidianUrl}
                />
            </div>
        </ModalStackProvider>
    );
}