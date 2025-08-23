// Helper functions for clipboard operations

/**
 * Convert richText format from TipTap to plain text
 */
export function richTextToPlainText(richText) {
    if (!richText || !richText.content) return '';
    
    return richText.content
        .map(paragraph => {
            if (!paragraph.content) return '';
            return paragraph.content
                .map(item => item.text || '')
                .join('');
        })
        .filter(line => line !== undefined)
        .join('\n');
}

/**
 * Format a single note for clipboard in Markdown style
 */
export function formatNoteForClipboard(note) {
    const date = new Date(note.date || note.createdAt).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const time = note.time || new Date(note.createdAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Build the formatted text
    let formatted = `## ${note.title || 'Без заголовка'}\n`;
    
    // Add metadata line
    formatted += `*${date} • ${time}`;
    if (note.duration) {
        formatted += ` • ${note.duration}`;
    }
    formatted += `*\n\n`;
    
    // Add content
    const content = note.content || note.text || '';
    formatted += `${content}\n`;
    
    // Add tags if present
    if (note.tags && note.tags.length > 0) {
        formatted += `\n${note.tags.map(tag => `#${tag}`).join(' ')}`;
    }
    
    return formatted;
}

/**
 * Format multiple notes for clipboard
 */
export function formatMultipleNotesForClipboard(notes) {
    if (!notes || notes.length === 0) return '';
    
    // Sort notes by date and Y position
    const sortedNotes = [...notes].sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        const dateCompare = dateA - dateB;
        
        if (dateCompare !== 0) return dateCompare;
        
        // If same date, sort by Y position (top to bottom)
        return (a.y || 0) - (b.y || 0);
    });
    
    // Format each note and join with separator
    return sortedNotes
        .map(formatNoteForClipboard)
        .join('\n\n---\n\n');
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text) {
    try {
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            console.log('✅ Copied to clipboard using Clipboard API');
            return true;
        }
        
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        // Select and copy
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
            console.log('✅ Copied to clipboard using execCommand');
        } else {
            console.error('❌ Failed to copy using execCommand');
        }
        
        return success;
    } catch (err) {
        console.error('❌ Error copying to clipboard:', err);
        return false;
    }
}

/**
 * Extract note data from shape props
 */
export function extractNoteDataFromShape(shape) {
    if (!shape || shape.type !== 'custom-note') return null;
    
    const props = shape.props || {};
    
    return {
        id: props.dbId || shape.id,
        title: richTextToPlainText(props.richText),
        content: richTextToPlainText(props.richText), // Will be replaced with full content from API
        date: props.date,
        time: props.time,
        duration: props.duration,
        tags: props.tags || [],
        noteType: props.noteType,
        y: shape.y,
        createdAt: props.createdAt,
    };
}

/**
 * Load full note data from backend
 */
export async function loadFullNoteData(noteId, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/notes/${noteId}`, {
            headers: {
                'user-id': 'test-user-id'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load note: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Failed to load note ${noteId}:`, error);
        return null;
    }
}

/**
 * Load multiple notes from backend
 */
export async function loadMultipleNotes(noteIds, apiUrl) {
    const promises = noteIds.map(id => loadFullNoteData(id, apiUrl));
    const results = await Promise.allSettled(promises);
    
    // Filter out failed requests and extract values
    return results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
}