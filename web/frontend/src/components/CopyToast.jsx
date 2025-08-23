import React, { useState } from 'react';
import { useToastTimer } from '../hooks/useToastTimer';

const CopyToast = ({ show, onClose, noteCount = 0 }) => {
    const [progress, setProgress] = useState(100);
    const TOAST_DURATION = 3000; // 3 seconds for copy notification
    
    // Use custom hook for timer management with tab visibility support
    useToastTimer(show, TOAST_DURATION, onClose, setProgress);
    
    if (!show) return null;
    
    return (
        <div
            style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                animation: 'slideInFromTop 0.3s ease-out',
            }}
        >
            <style>{`
                @keyframes slideInFromTop {
                    from {
                        transform: translateX(-50%) translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
            
            <div
                style={{
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    minWidth: '250px',
                    maxWidth: '350px',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.8)',
                    border: '1px solid #333',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Success icon and content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Copy icon */}
                    <div
                        style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: '#4a9eff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                            {noteCount === 1 
                                ? 'Заметка скопирована' 
                                : `Скопировано заметок: ${noteCount}`}
                        </div>
                        <div style={{ color: '#999', fontSize: '12px', marginTop: '2px' }}>
                            В буфер обмена
                        </div>
                    </div>
                    
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '0',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#999')}
                        onMouseLeave={(e) => (e.target.style.color = '#666')}
                    >
                        ×
                    </button>
                </div>
                
                {/* Progress bar */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            background: '#4a9eff',
                            transform: `translateX(${progress - 100}%)`,
                            transition: 'transform 0.1s linear',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CopyToast;