import React from 'react';

export function CustomBackground() {
    return (
        <div 
            className="tl-background"
            style={{
                width: '100%',
                height: '100%',
                background: `
                    radial-gradient(circle at 20% 50%, #0a1a0a 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, #1a0a1a 0%, transparent 50%),
                    #0a0a0a
                `,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: -1,
            }}
        />
    );
}

export default CustomBackground;