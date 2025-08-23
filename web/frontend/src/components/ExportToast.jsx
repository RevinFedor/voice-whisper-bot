import React, { useState } from 'react';
import obsidianIcon from '../assets/obsidian-icon.svg';
import { useToastTimer } from '../hooks/useToastTimer';

const ExportToast = ({ show, onClose, noteTitle, folderPath, obsidianUrl }) => {
    const [progress, setProgress] = useState(100);
    const [isHoveringButton, setIsHoveringButton] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const TOAST_DURATION = 5000; // 5 seconds
    
    // Use custom hook for timer management with tab visibility support
    useToastTimer(show, TOAST_DURATION, onClose, (newProgress) => {
        setProgress(newProgress);
        if (show && newProgress === 100) {
            setIsHoveringButton(false); // Reset hover state on new toast
        }
    });
    
    const handleOpenInObsidian = () => {
        window.location.href = obsidianUrl;
    };
    
    const truncateTitle = (title, maxLength = 30) => {
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength) + '...';
    };
    
    if (!show) return null;
    
    return (
        <div
            style={{
                position: 'fixed',
                top: '20px',
                left: '20px',
                zIndex: 10000,
                animation: 'slideInFromTop 0.3s ease-out',
            }}
        >
            <style>{`
                @keyframes slideInFromTop {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }
                
                @keyframes expandButton {
                    from {
                        width: 40px;
                    }
                    to {
                        width: auto;
                    }
                }
            `}</style>
            
            <div
                style={{
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    minWidth: '320px',
                    maxWidth: '380px',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.8)',
                    border: '1px solid #333',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Success icon and content */}
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    {/* Success icon */}
                    <div
                        style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path
                                d="M11.5 3.5L5.5 9.5L2.5 6.5"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                            Экспортировано в Obsidian
                        </div>
                        <div style={{ color: '#999', fontSize: '12px', marginBottom: '2px' }}>
                            {folderPath}
                        </div>
                        <div
                            style={{ position: 'relative', display: 'inline-block' }}
                            onMouseEnter={() => noteTitle.length > 30 && setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                        >
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '400' }}>
                                {truncateTitle(noteTitle)}
                            </div>
                            
                            {/* Tooltip for full title */}
                            {showTooltip && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '-30px',
                                        left: '0',
                                        background: '#000',
                                        color: '#fff',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        whiteSpace: 'nowrap',
                                        zIndex: 10001,
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                                    }}
                                >
                                    {noteTitle}
                                </div>
                            )}
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
                
                {/* Obsidian button */}
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleOpenInObsidian}
                        onMouseEnter={() => setIsHoveringButton(true)}
                        onMouseLeave={() => setIsHoveringButton(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: isHoveringButton ? '8px' : '0',
                            transition: 'all 0.2s ease',
                            opacity: isHoveringButton ? 0.8 : 1,
                        }}
                    >
                        {/* Obsidian icon */}
                        <img 
                            src={obsidianIcon} 
                            alt="Obsidian"
                            style={{
                                width: '30px',
                                height: '30px',
                            }}
                        />
                        
                        {/* Text that appears on hover */}
                        <span
                            style={{
                                color: '#999',
                                fontSize: '13px',
                                fontWeight: '500',
                                maxWidth: isHoveringButton ? '150px' : '0',
                                overflow: 'hidden',
                                transition: 'max-width 0.3s ease',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Открыть в Obsidian
                        </span>
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
                            background: '#22c55e',
                            transform: `translateX(${progress - 100}%)`,
                            transition: 'transform 0.1s linear',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ExportToast;