// Example of how to integrate MetadataEditor into your existing NoteModal.jsx
// Add these imports at the top of your NoteModal.jsx

import MetadataEditor from './MetadataEditor';

// Add these state variables to your existing useState declarations
const [showMetadata, setShowMetadata] = useState(false);
const [localMetadata, setLocalMetadata] = useState({
    location: note.location || 'unknown',
    state: note.state || 'analytical', 
    importance: note.importance || 'medium',
    sources: note.sources || [],
    contentType: note.contentType || 'random',
    tags: note.tags || []
});

// Add this function to handle metadata updates
const handleMetadataChange = useCallback(async (newMetadata) => {
    setLocalMetadata(newMetadata);
    
    // Auto-save metadata changes
    try {
        const response = await fetch(`http://localhost:3001/api/notes/${note.id}/metadata`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: newMetadata.location,
                state: newMetadata.state,
                importance: newMetadata.importance,
                sources: newMetadata.sources,
                contentType: newMetadata.contentType
            })
        });

        if (response.ok) {
            const updatedNote = await response.json();
            onNoteUpdate(updatedNote); // This will update the visual representation
        }
    } catch (error) {
        console.error('Failed to update metadata:', error);
    }
}, [note.id, onNoteUpdate]);

// Add this tab to your existing tab navigation (around line 200+ in your modal)
// Find where you have the tabs like "История", "Теги", etc. and add:

<button
    onClick={() => setShowMetadata(!showMetadata)}
    style={{
        background: showMetadata ? '#2196F3' : 'transparent',
        color: showMetadata ? 'white' : '#888',
        border: '1px solid #444',
        borderRadius: '6px',
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    }}
>
    🎨 Visual
</button>

// Add this section after your existing tabs content (around line 800+ in your modal)
// Find where you render the history or tags content and add:

{showMetadata && (
    <MetadataEditor
        note={localMetadata}
        onChange={handleMetadataChange}
    />
)}

// Update your useEffect that syncs note changes to include metadata:
useEffect(() => {
    if (note) {
        setLocalTitle(note.title || '');
        setLocalContent(note.content || '');
        setServerTitle(note.title || '');
        setServerContent(note.content || '');
        setLocalTags(note.tags || []);
        
        // Add metadata sync
        setLocalMetadata({
            location: note.location || 'unknown',
            state: note.state || 'analytical',
            importance: note.importance || 'medium', 
            sources: note.sources || [],
            contentType: note.contentType || 'random',
            tags: note.tags || []
        });
        
        // Reset states
        setTitleChanged(false);
        setContentChanged(false);
        setTitleSaveStatus('idle');
        setContentSaveStatus('idle');
        setShowHistory(false);
        setShowMetadata(false); // Add this line
        setNewlyGeneratedId(null);
    }
}, [note]);

// Add this helper function to show visual preview in the modal header
const getVisualPreview = () => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: '#333',
            borderRadius: '4px',
            fontSize: '10px'
        }}>
            <span style={{ color: '#4A90E2' }}>📍 {localMetadata.location}</span>
            <span style={{ color: '#FF6B6B' }}>🧠 {localMetadata.state}</span>
            <span style={{ color: '#6C5CE7' }}>💎 {localMetadata.contentType}</span>
            <div style={{
                width: '6px',
                height: '6px', 
                borderRadius: '50%',
                backgroundColor: {
                    critical: '#FF3838',
                    high: '#FF9500', 
                    medium: '#FFD23F',
                    low: '#A4B0BE',
                    reference: '#576574'
                }[localMetadata.importance]
            }} />
        </div>
    );
};

// Add the visual preview to your modal header (find the header section and add):
<div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
}}>
    {/* Your existing header content */}
    {getVisualPreview()}
</div>

/* 
COMPLETE INTEGRATION EXAMPLE:

1. Add the imports at the top
2. Add the new state variables  
3. Add the handleMetadataChange function
4. Add the "Visual" tab button to your tab navigation
5. Add the MetadataEditor component after your existing tab contents
6. Update the useEffect to sync metadata
7. Add the visual preview to the header

This will give you a complete metadata editing interface within your existing note modal,
with auto-saving and visual feedback.
*/