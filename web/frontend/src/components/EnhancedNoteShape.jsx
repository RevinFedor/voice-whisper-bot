import { ShapeUtil, HTMLContainer, Rectangle2d, resizeBox, T } from 'tldraw';
import React from 'react';

// Visual System Configuration
const VISUAL_SYSTEM_COLORS = {
  // Location/Place markers (where recorded)
  location: {
    home: '#4A90E2',      // Blue - comfortable, stable
    office: '#7ED321',    // Green - productive, focused  
    cafe: '#F5A623',      // Orange - social, creative
    outdoor: '#50E3C2',   // Teal - free, natural
    travel: '#D0021B',    // Red - dynamic, adventure
    unknown: '#9013FE'    // Purple - mystery
  },
  
  // State/Mode markers (your mental state)
  state: {
    work: '#FF6B6B',      // Coral - active, energetic
    tilt: '#4ECDC4',      // Mint - unbalanced, shifting
    aggression: '#FF4757', // Bright red - intense
    philosopher: '#5F27CD', // Deep purple - contemplative
    creative: '#00D2D3',   // Cyan - innovative
    analytical: '#747d8c'  // Gray - logical
  },
  
  // Life importance levels (impact on your life)
  importance: {
    critical: '#FF3838',   // Bright red - life-changing
    high: '#FF9500',       // Orange - significant impact
    medium: '#FFD23F',     // Yellow - moderate importance
    low: '#A4B0BE',        // Light gray - minor relevance
    reference: '#576574'   // Dark gray - just for reference
  },
  
  // Note types (what kind of content)
  types: {
    insight: '#6C5CE7',    // Purple - wisdom, realization
    report: '#74B9FF',     // Light blue - factual information
    daily: '#55A3FF',      // Blue - routine observations
    random: '#FDCB6E',     // Yellow - spontaneous thoughts
    voice: '#4a9eff',      // Existing voice notes
    text: '#4aff4a',       // Existing text notes
    collection: '#2a4'     // Existing collections
  },
  
  // Source platforms (where it came from)
  sources: {
    tiktok: '#FF0050',     // TikTok brand color
    youtube: '#FF0000',    // YouTube red
    twitter: '#1DA1F2',    // Twitter blue
    podcast: '#9B59B6',    // Purple for audio
    book: '#8D6E63',       // Brown for traditional media
    conversation: '#26A69A', // Teal for personal interaction
    self: '#E91E63'        // Pink for your own thoughts
  }
};

const ICON_SYSTEM = {
  // Location icons (top-left corner badge)
  location: {
    home: '🏠',
    office: '🏢', 
    cafe: '☕',
    outdoor: '🌳',
    travel: '✈️',
    unknown: '❓'
  },
  
  // State/mood icons (top-right corner)
  state: {
    work: '💼',
    tilt: '🌀',
    aggression: '⚡',
    philosopher: '🤔',
    creative: '💡',
    analytical: '📊'
  },
  
  // Source platform icons (bottom-left)
  sources: {
    tiktok: '📱',
    youtube: '📺',
    twitter: '🐦',
    podcast: '🎧',
    book: '📚',
    conversation: '💬',
    self: '🧠'
  },
  
  // Type icons (main icon, center-top)
  types: {
    insight: '💎',
    report: '📋',
    daily: '📅',
    random: '🎲',
    voice: '🎙️',  // existing
    text: '📝',   // existing
    collection: '📚' // existing
  }
};

const BORDER_PATTERNS = {
  // Different border styles for states
  state: {
    work: { style: 'solid', width: '2px' },
    tilt: { style: 'dashed', width: '2px' },
    aggression: { style: 'solid', width: '4px', animation: 'pulse' },
    philosopher: { style: 'dotted', width: '3px' },
    creative: { style: 'solid', width: '2px', gradient: true },
    analytical: { style: 'solid', width: '1px' }
  },
  
  // Size variations for importance
  importance: {
    critical: { scale: 1.15, shadow: '0 0 20px rgba(255, 56, 56, 0.6)' },
    high: { scale: 1.08, shadow: '0 0 10px rgba(255, 149, 0, 0.4)' },
    medium: { scale: 1.0, shadow: 'none' },
    low: { scale: 0.92, opacity: 0.8 },
    reference: { scale: 0.85, opacity: 0.6 }
  }
};

// Custom note dimensions
const ENHANCED_NOTE_WIDTH = 180;
const ENHANCED_NOTE_HEIGHT = 160;

// Function to convert text to richText format
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

// Enhanced NoteShapeUtil with Visual System
export class EnhancedNoteShapeUtil extends ShapeUtil {
    static type = 'enhanced-note';
    
    static props = {
        // Existing props
        w: T.number,
        h: T.number,
        richText: T.any,
        noteType: T.string,
        time: T.string,
        dbId: T.string,
        manuallyPositioned: T.boolean,
        
        // New visual system props
        location: T.string,     // home, office, cafe, outdoor, travel
        state: T.string,        // work, tilt, aggression, philosopher, creative
        importance: T.string,   // critical, high, medium, low, reference
        sources: T.array,       // [tiktok, youtube, etc] - can be multiple
        contentType: T.string,  // insight, report, daily, random
        tags: T.array,          // existing tags system
        
        // Connection system
        connectedTo: T.array,   // IDs of related notes
        connectionType: T.string, // solution, inspiration, contradiction, evolution
    };

    getDefaultProps() {
        return {
            w: ENHANCED_NOTE_WIDTH,
            h: ENHANCED_NOTE_HEIGHT,
            richText: toRichText(''),
            noteType: 'text',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            manuallyPositioned: false,
            dbId: '',
            
            // Default visual system values
            location: 'unknown',
            state: 'analytical',
            importance: 'medium',
            sources: [],
            contentType: 'random',
            tags: [],
            connectedTo: [],
            connectionType: ''
        };
    }

    getGeometry(shape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    onResize(shape, info) {
        return resizeBox(shape, info);
    }

    component(shape) {
        const { 
            richText, noteType, time, location, state, 
            importance, sources, contentType, tags, manuallyPositioned 
        } = shape.props;

        const [isMergeTarget, setIsMergeTarget] = React.useState(false);

        // Listen for merge target highlighting
        React.useEffect(() => {
            const checkMergeTarget = () => {
                const element = document.querySelector(`[data-shape="${shape.id}"]`);
                if (element && element.classList.contains('merge-target')) {
                    setIsMergeTarget(true);
                } else {
                    setIsMergeTarget(false);
                }
            };
            
            checkMergeTarget();
            const observer = new MutationObserver(checkMergeTarget);
            const element = document.querySelector(`[data-shape="${shape.id}"]`);
            if (element) {
                observer.observe(element, { attributes: true, attributeFilter: ['class'] });
            }
            
            return () => observer.disconnect();
        }, [shape.id]);

        // Calculate visual properties
        const locationColor = VISUAL_SYSTEM_COLORS.location[location] || VISUAL_SYSTEM_COLORS.location.unknown;
        const stateColor = VISUAL_SYSTEM_COLORS.state[state] || VISUAL_SYSTEM_COLORS.state.analytical;
        const importanceLevel = BORDER_PATTERNS.importance[importance] || BORDER_PATTERNS.importance.medium;
        const typeColor = VISUAL_SYSTEM_COLORS.types[contentType] || VISUAL_SYSTEM_COLORS.types.random;
        const borderPattern = BORDER_PATTERNS.state[state] || BORDER_PATTERNS.state.analytical;
        
        // Extract text content
        let displayText = '';
        let title = '';
        if (richText && richText.content) {
            const paragraphs = richText.content
                .filter(p => p.content && p.content[0])
                .map(p => p.content[0].text);
            
            if (paragraphs.length > 0) {
                title = paragraphs[0];
                displayText = paragraphs.slice(1).join('\n');
            }
        }

        // Create multi-source indicator
        const sourceIcons = sources.map(source => ICON_SYSTEM.sources[source]).filter(Boolean);
        
        // Build dynamic styles
        const containerStyle = {
            width: shape.props.w,
            height: shape.props.h,
            backgroundColor: '#1a1a1a',
            
            // Dynamic border based on state and importance
            border: isMergeTarget 
                ? `3px solid #ffc800` 
                : `${borderPattern.width} ${borderPattern.style} ${stateColor}`,
            borderLeft: `4px solid ${locationColor}`,
            borderRight: `4px solid ${typeColor}`,
            
            borderRadius: '12px',
            padding: '12px',
            color: '#e0e0e0',
            fontSize: '12px',
            overflow: 'hidden',
            
            // Dynamic sizing and effects based on importance
            transform: isMergeTarget ? 'scale(1.03)' : `scale(${importanceLevel.scale})`,
            boxShadow: isMergeTarget 
                ? '0 0 20px rgba(255, 200, 0, 0.8)' 
                : (importanceLevel.shadow || '0 2px 8px rgba(0, 0, 0, 0.3)'),
            opacity: importanceLevel.opacity || 1,
            
            transition: 'all 0.3s ease',
            position: 'relative'
        };

        // Add critical animation
        if (importance === 'critical' && !isMergeTarget) {
            containerStyle.animation = 'criticalPulse 2s ease-in-out infinite';
        }

        return (
            <HTMLContainer
                data-shape={shape.id}
                className={isMergeTarget ? 'merge-target' : ''}
                style={containerStyle}
            >
                {/* Top row: Location + State + Time */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    height: '16px'
                }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {/* Location indicator */}
                        <span style={{ 
                            fontSize: '10px',
                            backgroundColor: locationColor,
                            color: 'white',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            fontWeight: 'bold',
                            lineHeight: '1'
                        }}>
                            {ICON_SYSTEM.location[location]}
                        </span>
                        
                        {/* Manual positioning indicator */}
                        {manuallyPositioned && (
                            <span style={{ fontSize: '8px', color: '#ff9500', lineHeight: '1' }}>📍</span>
                        )}
                    </div>
                    
                    {/* State indicator */}
                    <span style={{ 
                        fontSize: '12px',
                        filter: `drop-shadow(0 0 3px ${stateColor})`,
                        lineHeight: '1'
                    }}>
                        {ICON_SYSTEM.state[state]}
                    </span>
                    
                    {/* Time */}
                    <span style={{ fontSize: '9px', color: '#666', lineHeight: '1' }}>{time}</span>
                </div>

                {/* Main content type icon */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '6px'
                }}>
                    <span style={{ 
                        fontSize: '18px',
                        filter: `drop-shadow(0 0 3px ${typeColor})`,
                        lineHeight: '1'
                    }}>
                        {ICON_SYSTEM.types[contentType] || ICON_SYSTEM.types[noteType]}
                    </span>
                </div>
                
                {/* Title */}
                <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '6px',
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.2'
                }}>
                    {title || 'Без заголовка'}
                </div>
                
                {/* Content preview */}
                <div style={{
                    fontSize: '10px',
                    color: '#888',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.3',
                    marginBottom: '8px',
                    height: '26px'
                }}>
                    {displayText || 'Пустая заметка'}
                </div>
                
                {/* Bottom row: Sources + Importance */}
                <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    {/* Source indicators */}
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        {sourceIcons.slice(0, 3).map((icon, index) => (
                            <span key={index} style={{ 
                                fontSize: '8px',
                                opacity: 0.8,
                                lineHeight: '1'
                            }}>
                                {icon}
                            </span>
                        ))}
                        {sourceIcons.length > 3 && (
                            <span style={{ fontSize: '7px', color: '#666' }}>+{sourceIcons.length - 3}</span>
                        )}
                    </div>
                    
                    {/* Importance indicator */}
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: VISUAL_SYSTEM_COLORS.importance[importance],
                        ...(importance === 'critical' && {
                            boxShadow: `0 0 6px ${VISUAL_SYSTEM_COLORS.importance[importance]}`
                        })
                    }} />
                </div>
            </HTMLContainer>
        );
    }

    indicator(shape) {
        const { importance } = shape.props;
        const importanceLevel = BORDER_PATTERNS.importance[importance] || BORDER_PATTERNS.importance.medium;
        
        return (
            <rect 
                width={shape.props.w} 
                height={shape.props.h}
                style={{
                    fill: 'transparent',
                    stroke: VISUAL_SYSTEM_COLORS.importance[importance] || '#2a4',
                    strokeWidth: importance === 'critical' ? 3 : 2,
                    rx: 12,
                    ry: 12,
                    transform: `scale(${importanceLevel.scale})`
                }}
            />
        );
    }

    // Static styles for animations
    static styles = `
        @keyframes criticalPulse {
            0%, 100% { 
                transform: scale(1.15);
                box-shadow: 0 0 20px rgba(255, 56, 56, 0.6);
            }
            50% { 
                transform: scale(1.18);
                box-shadow: 0 0 30px rgba(255, 56, 56, 0.9);
            }
        }
        
        .note-cluster-critical {
            animation: criticalClusterGlow 3s ease-in-out infinite;
        }
        
        @keyframes criticalClusterGlow {
            0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 56, 56, 0.3)); }
            50% { filter: drop-shadow(0 0 20px rgba(255, 56, 56, 0.6)); }
        }
    `;
}

// Export visual system constants for use in other components
export { VISUAL_SYSTEM_COLORS, ICON_SYSTEM, BORDER_PATTERNS };