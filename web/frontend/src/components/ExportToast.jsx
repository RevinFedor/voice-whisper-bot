import React, { useState, useEffect } from 'react';

const ExportToast = ({ show, onClose, noteTitle, folderPath, obsidianUrl }) => {
    const [progress, setProgress] = useState(100);
    const [isHoveringButton, setIsHoveringButton] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const TOAST_DURATION = 5000; // 5 seconds
    
    useEffect(() => {
        if (show) {
            setProgress(100);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev <= 0) {
                        clearInterval(interval);
                        onClose();
                        return 0;
                    }
                    return prev - (100 / (TOAST_DURATION / 100));
                });
            }, 100);
            
            return () => clearInterval(interval);
        }
    }, [show, onClose]);
    
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
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                    borderRadius: '12px',
                    padding: '16px',
                    minWidth: '320px',
                    maxWidth: '400px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Success icon and content */}
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    {/* Success icon */}
                    <div
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
                            background: 'linear-gradient(135deg, #6b46c1 0%, #9333ea 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease',
                            boxShadow: isHoveringButton ? '0 4px 16px rgba(147, 51, 234, 0.3)' : 'none',
                            transform: isHoveringButton ? 'translateY(-1px)' : 'translateY(0)',
                        }}
                    >
                        {/* Obsidian icon */}
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                                d="M10.813 1.069l-2.758.696a.513.513 0 00-.233.113L1.31 7.689a.823.823 0 00-.144 1.118l4.103 5.713c.24.335.684.425 1.015.195l6.183-4.287a.513.513 0 00.148-.157l2.158-3.674a.823.823 0 00-.287-1.032L11.5 1.425a.513.513 0 00-.687-.356z"
                                fill="white"
                            />
                        </svg>
                        
                        {/* Text that appears on hover */}
                        <span
                            style={{
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '500',
                                maxWidth: isHoveringButton ? '100px' : '0',
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
                        height: '3px',
                        background: 'rgba(255, 255, 255, 0.1)',
                    }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
                            transition: 'width 0.1s linear',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ExportToast;