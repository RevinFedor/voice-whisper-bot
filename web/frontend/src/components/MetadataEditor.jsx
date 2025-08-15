import React, { useState } from 'react';
import { VISUAL_SYSTEM_COLORS, ICON_SYSTEM } from './EnhancedNoteShape';

// Helper functions to convert between importance levels and numbers
const importanceToNumber = (importance) => {
    const map = { reference: 1, low: 2, medium: 3, high: 4, critical: 5 };
    return map[importance] || 3;
};

const numberToImportance = (number) => {
    const map = { 1: 'reference', 2: 'low', 3: 'medium', 4: 'high', 5: 'critical' };
    return map[number] || 'medium';
};

const MetadataEditor = ({ note, onChange }) => {
    const [activeTab, setActiveTab] = useState('context');

    const handleSourceToggle = (source, checked) => {
        const currentSources = note.sources || [];
        const newSources = checked 
            ? [...currentSources, source]
            : currentSources.filter(s => s !== source);
        onChange({ ...note, sources: newSources });
    };

    const handleTagAdd = (newTag) => {
        if (newTag && !note.tags?.includes(newTag)) {
            onChange({ ...note, tags: [...(note.tags || []), newTag] });
        }
    };

    const handleTagRemove = (tagToRemove) => {
        onChange({ ...note, tags: note.tags.filter(tag => tag !== tagToRemove) });
    };

    return (
        <div style={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px',
            color: '#e0e0e0'
        }}>
            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                marginBottom: '16px',
                borderBottom: '1px solid #444'
            }}>
                {[
                    { id: 'context', label: '📍 Context', icon: '🎯' },
                    { id: 'sources', label: '📱 Sources', icon: '🔗' },
                    { id: 'tags', label: '🏷️ Tags', icon: '#' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: activeTab === tab.id ? '#4A90E2' : 'transparent',
                            color: activeTab === tab.id ? 'white' : '#888',
                            border: 'none',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            fontSize: '12px',
                            marginRight: '4px'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Context Tab */}
            {activeTab === 'context' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {/* Location selector */}
                    <div className="metadata-group">
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: '#fff'
                        }}>
                            📍 Location
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {Object.entries(ICON_SYSTEM.location).map(([key, icon]) => (
                                <button
                                    key={key}
                                    onClick={() => onChange({ ...note, location: key })}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: note.location === key 
                                            ? VISUAL_SYSTEM_COLORS.location[key] 
                                            : '#3a3a3a',
                                        color: note.location === key ? 'white' : '#ccc',
                                        border: `1px solid ${note.location === key 
                                            ? VISUAL_SYSTEM_COLORS.location[key] 
                                            : '#555'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {icon} {key}
                                </button>
                            ))}
                        </div>
                    </div>
      
                    {/* State selector */}
                    <div className="metadata-group">
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: '#fff'
                        }}>
                            🧠 Mental State
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {Object.entries(ICON_SYSTEM.state).map(([key, icon]) => (
                                <button
                                    key={key}
                                    onClick={() => onChange({ ...note, state: key })}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: note.state === key 
                                            ? VISUAL_SYSTEM_COLORS.state[key] 
                                            : '#3a3a3a',
                                        color: note.state === key ? 'white' : '#ccc',
                                        border: `1px solid ${note.state === key 
                                            ? VISUAL_SYSTEM_COLORS.state[key] 
                                            : '#555'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {icon} {key}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Type selector */}
                    <div className="metadata-group">
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: '#fff'
                        }}>
                            💎 Content Type
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {Object.entries(ICON_SYSTEM.types).map(([key, icon]) => (
                                <button
                                    key={key}
                                    onClick={() => onChange({ ...note, contentType: key })}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: note.contentType === key 
                                            ? VISUAL_SYSTEM_COLORS.types[key] 
                                            : '#3a3a3a',
                                        color: note.contentType === key ? 'white' : '#ccc',
                                        border: `1px solid ${note.contentType === key 
                                            ? VISUAL_SYSTEM_COLORS.types[key] 
                                            : '#555'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {icon} {key}
                                </button>
                            ))}
                        </div>
                    </div>
      
                    {/* Importance slider */}
                    <div className="metadata-group">
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: '#fff'
                        }}>
                            🎯 Life Impact: {note.importance || 'medium'}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="range" 
                                min="1" 
                                max="5" 
                                value={importanceToNumber(note.importance)}
                                onChange={e => onChange({ ...note, importance: numberToImportance(e.target.value) })}
                                style={{
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: '#555',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    appearance: 'none'
                                }}
                            />
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginTop: '4px',
                                fontSize: '10px',
                                color: '#888'
                            }}>
                                <span>Reference</span>
                                <span>Low</span>
                                <span>Medium</span>
                                <span>High</span>
                                <span>Critical</span>
                            </div>
                        </div>
                        <div style={{
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: VISUAL_SYSTEM_COLORS.importance[note.importance] + '20',
                            border: `1px solid ${VISUAL_SYSTEM_COLORS.importance[note.importance]}`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: VISUAL_SYSTEM_COLORS.importance[note.importance]
                        }}>
                            ● {note.importance || 'medium'} importance
                        </div>
                    </div>
                </div>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
                <div className="metadata-group">
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '12px', 
                        fontSize: '12px', 
                        fontWeight: '600',
                        color: '#fff'
                    }}>
                        📱 Information Sources
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        {Object.entries(ICON_SYSTEM.sources).map(([source, icon]) => {
                            const isSelected = note.sources?.includes(source);
                            return (
                                <label 
                                    key={source} 
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px',
                                        backgroundColor: isSelected 
                                            ? VISUAL_SYSTEM_COLORS.sources[source] + '20'
                                            : '#3a3a3a',
                                        border: `1px solid ${isSelected 
                                            ? VISUAL_SYSTEM_COLORS.sources[source] 
                                            : '#555'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={e => handleSourceToggle(source, e.target.checked)}
                                        style={{
                                            accentColor: VISUAL_SYSTEM_COLORS.sources[source]
                                        }}
                                    />
                                    <span style={{ fontSize: '14px' }}>{icon}</span>
                                    <span style={{ 
                                        color: isSelected 
                                            ? VISUAL_SYSTEM_COLORS.sources[source] 
                                            : '#ccc',
                                        fontWeight: isSelected ? '600' : 'normal'
                                    }}>
                                        {source}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    
                    {/* Selected sources preview */}
                    {note.sources?.length > 0 && (
                        <div style={{
                            marginTop: '12px',
                            padding: '8px',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '4px',
                            fontSize: '11px'
                        }}>
                            <strong>Selected sources:</strong> {note.sources.map(source => 
                                ICON_SYSTEM.sources[source]
                            ).join(' ')} {note.sources.join(', ')}
                        </div>
                    )}
                </div>
            )}

            {/* Tags Tab */}
            {activeTab === 'tags' && (
                <div className="metadata-group">
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px', 
                        fontSize: '12px', 
                        fontWeight: '600',
                        color: '#fff'
                    }}>
                        🏷️ Tags
                    </label>
                    
                    {/* Add new tag */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            placeholder="Add tag..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleTagAdd(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '8px',
                                backgroundColor: '#3a3a3a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                        />
                    </div>
                    
                    {/* Existing tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {note.tags?.map((tag, index) => (
                            <span
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: '#4A90E2',
                                    color: 'white',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '500'
                                }}
                            >
                                #{tag}
                                <button
                                    onClick={() => handleTagRemove(tag)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        padding: '0',
                                        marginLeft: '2px'
                                    }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    
                    {note.tags?.length === 0 && (
                        <div style={{ 
                            color: '#888', 
                            fontSize: '11px', 
                            fontStyle: 'italic',
                            textAlign: 'center',
                            padding: '16px'
                        }}>
                            No tags added yet. Press Enter to add tags.
                        </div>
                    )}
                </div>
            )}

            {/* Visual Preview */}
            <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                borderRadius: '6px',
                border: '1px solid #333'
            }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                    Visual Preview:
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px'
                }}>
                    <span style={{
                        color: VISUAL_SYSTEM_COLORS.location[note.location] || '#666'
                    }}>
                        {ICON_SYSTEM.location[note.location]} {note.location}
                    </span>
                    <span style={{
                        color: VISUAL_SYSTEM_COLORS.state[note.state] || '#666'
                    }}>
                        {ICON_SYSTEM.state[note.state]} {note.state}
                    </span>
                    <span style={{
                        color: VISUAL_SYSTEM_COLORS.types[note.contentType] || '#666'
                    }}>
                        {ICON_SYSTEM.types[note.contentType]} {note.contentType}
                    </span>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: VISUAL_SYSTEM_COLORS.importance[note.importance] || '#666',
                        display: 'inline-block'
                    }} />
                    {note.sources?.length > 0 && (
                        <span style={{ color: '#888' }}>
                            {note.sources.map(source => ICON_SYSTEM.sources[source]).join('')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MetadataEditor;