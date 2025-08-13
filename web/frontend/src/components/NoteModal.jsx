import React from 'react';

const NoteModal = ({ isOpen, onClose, note }) => {
    if (!isOpen || !note) return null;
    
    // Format dates for display
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };
    
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Get type icon
    const getTypeIcon = (type) => {
        const icons = {
            voice: '🎙️',
            text: '📝',
            collection: '📚'
        };
        return icons[type] || '📝';
    };
    
    // Get type label
    const getTypeLabel = (type) => {
        const labels = {
            voice: 'Голосовая заметка',
            text: 'Текстовая заметка',
            collection: 'Коллекция'
        };
        return labels[type] || 'Заметка';
    };
    
    return (
        <>
            {/* Backdrop */}
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 9998,
                    cursor: 'pointer'
                }}
                onClick={onClose}
            />
            
            {/* Modal */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                maxWidth: '800px',
                maxHeight: '80vh',
                backgroundColor: '#1a1a1a',
                borderRadius: '16px',
                border: '1px solid #333',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '12px'
                        }}>
                            <span style={{ fontSize: '24px' }}>
                                {getTypeIcon(note.type)}
                            </span>
                            <span style={{
                                color: '#888',
                                fontSize: '14px',
                                padding: '4px 12px',
                                backgroundColor: '#2a2a2a',
                                borderRadius: '12px'
                            }}>
                                {getTypeLabel(note.type)}
                            </span>
                            {note.manuallyPositioned && (
                                <span style={{
                                    fontSize: '16px',
                                    color: '#ff9500',
                                    title: 'Перемещена вручную'
                                }}>
                                    📍
                                </span>
                            )}
                        </div>
                        <h2 style={{
                            color: '#fff',
                            fontSize: '20px',
                            fontWeight: '600',
                            margin: 0,
                            lineHeight: '1.4'
                        }}>
                            {note.title || 'Без заголовка'}
                        </h2>
                    </div>
                    
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '4px',
                            marginLeft: '20px',
                            lineHeight: '1',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#fff'}
                        onMouseLeave={(e) => e.target.style.color = '#666'}
                    >
                        ×
                    </button>
                </div>
                
                {/* Content */}
                <div style={{
                    flex: 1,
                    padding: '24px 32px',
                    overflowY: 'auto',
                    color: '#e0e0e0',
                    fontSize: '15px',
                    lineHeight: '1.6'
                }}>
                    {note.content ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                            {note.content}
                        </div>
                    ) : (
                        <div style={{ color: '#666', fontStyle: 'italic' }}>
                            Нет содержимого
                        </div>
                    )}
                    
                    {/* Voice duration */}
                    {note.type === 'voice' && note.voiceDuration && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ fontSize: '14px' }}>⏱️</span>
                            <span style={{ fontSize: '14px', color: '#888' }}>
                                Длительность: {Math.floor(note.voiceDuration / 60)}:{(note.voiceDuration % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Metadata Footer */}
                <div style={{
                    padding: '16px 32px',
                    borderTop: '1px solid #2a2a2a',
                    backgroundColor: '#161616',
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '20px'
                }}>
                    <div>
                        <span style={{ color: '#555' }}>ID:</span>{' '}
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                            {note.id}
                        </span>
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Дата:</span>{' '}
                        {formatDate(note.date)}
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Создано:</span>{' '}
                        {formatDateTime(note.createdAt)}
                    </div>
                    {note.updatedAt && note.updatedAt !== note.createdAt && (
                        <div>
                            <span style={{ color: '#555' }}>Обновлено:</span>{' '}
                            {formatDateTime(note.updatedAt)}
                        </div>
                    )}
                    <div>
                        <span style={{ color: '#555' }}>Позиция:</span>{' '}
                        ({Math.round(note.x)}, {Math.round(note.y)})
                    </div>
                    <div>
                        <span style={{ color: '#555' }}>Перемещена:</span>{' '}
                        <span style={{ color: note.manuallyPositioned ? '#ff9500' : '#666' }}>
                            {note.manuallyPositioned ? 'Да' : 'Нет'}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NoteModal;