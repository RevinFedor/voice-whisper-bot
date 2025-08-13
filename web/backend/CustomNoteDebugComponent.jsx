import React, { useEffect, useState } from 'react';
import { useEditor } from 'tldraw';

// Diagnostic component to help debug custom-note shape detection
// Add this temporarily to your app to see real-time debug info
export function CustomNoteDebugComponent() {
    const editor = useEditor();
    const [debugInfo, setDebugInfo] = useState({
        mousePos: { x: 0, y: 0 },
        hoveredShape: null,
        customNoteShapes: [],
        lastClicked: null
    });

    useEffect(() => {
        if (!editor) return;

        let isActive = true;

        // Track mouse movement and shape detection
        const handlePointerMove = (e) => {
            if (!isActive) return;

            const point = { x: e.clientX, y: e.clientY };
            const pagePoint = editor.screenToPage(point);
            
            const hitShape = editor.getShapeAtPoint(pagePoint, { 
                hitInside: true,
                hitLabels: true 
            });

            const customNoteShapes = editor.getCurrentPageShapes().filter(s => s.type === 'custom-note');

            setDebugInfo(prev => ({
                ...prev,
                mousePos: pagePoint,
                hoveredShape: hitShape,
                customNoteShapes: customNoteShapes.length
            }));
        };

        // Track clicks
        const handlePointerDown = (e) => {
            if (!isActive) return;

            const point = { x: e.clientX, y: e.clientY };
            const pagePoint = editor.screenToPage(point);
            
            const hitShape = editor.getShapeAtPoint(pagePoint, { 
                hitInside: true,
                hitLabels: true 
            });

            setDebugInfo(prev => ({
                ...prev,
                lastClicked: {
                    point: pagePoint,
                    shape: hitShape,
                    timestamp: Date.now()
                }
            }));

            // Log detailed info to console
            if (hitShape?.type === 'custom-note') {
                console.log('✅ Custom-note clicked!', {
                    shape: hitShape,
                    point: pagePoint,
                    geometry: editor.getShapeGeometry(hitShape),
                    bounds: editor.getShapePageBounds(hitShape)
                });
            } else if (hitShape) {
                console.log(`🔄 Other shape clicked: ${hitShape.type}`, hitShape);
            } else {
                console.log('❌ No shape detected at click point', pagePoint);
                
                // Check if there are custom-note shapes nearby
                const nearbyCustomNotes = editor.getCurrentPageShapes()
                    .filter(s => s.type === 'custom-note')
                    .map(s => ({
                        shape: s,
                        bounds: editor.getShapePageBounds(s),
                        distance: Math.sqrt(
                            Math.pow(pagePoint.x - (editor.getShapePageBounds(s).x + editor.getShapePageBounds(s).w/2), 2) +
                            Math.pow(pagePoint.y - (editor.getShapePageBounds(s).y + editor.getShapePageBounds(s).h/2), 2)
                        )
                    }))
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 3);

                if (nearbyCustomNotes.length > 0) {
                    console.log('Nearby custom-note shapes:', nearbyCustomNotes);
                }
            }
        };

        // Add event listeners to the canvas
        const canvas = editor.getContainer();
        if (canvas) {
            canvas.addEventListener('pointermove', handlePointerMove);
            canvas.addEventListener('pointerdown', handlePointerDown);
        }

        return () => {
            isActive = false;
            if (canvas) {
                canvas.removeEventListener('pointermove', handlePointerMove);
                canvas.removeEventListener('pointerdown', handlePointerDown);
            }
        };
    }, [editor]);

    if (!editor) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 10,
            right: 10,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 10000,
            maxWidth: '300px',
            pointerEvents: 'none'
        }}>
            <div><strong>🔍 Custom-Note Debug</strong></div>
            <div>Mouse: {debugInfo.mousePos.x.toFixed(1)}, {debugInfo.mousePos.y.toFixed(1)}</div>
            <div>Custom Notes: {debugInfo.customNoteShapes}</div>
            <div>
                Hovered: {debugInfo.hoveredShape 
                    ? `${debugInfo.hoveredShape.type} (${debugInfo.hoveredShape.id.slice(0, 8)}...)` 
                    : 'none'
                }
                {debugInfo.hoveredShape?.type === 'custom-note' ? ' ✅' : ''}
            </div>
            {debugInfo.lastClicked && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '5px', marginTop: '5px' }}>
                    <div><strong>Last Click:</strong></div>
                    <div>
                        {debugInfo.lastClicked.shape 
                            ? `${debugInfo.lastClicked.shape.type} (${debugInfo.lastClicked.shape.id.slice(0, 8)}...)` 
                            : 'canvas'
                        }
                        {debugInfo.lastClicked.shape?.type === 'custom-note' ? ' ✅' : ''}
                    </div>
                    <div>
                        At: {debugInfo.lastClicked.point.x.toFixed(1)}, {debugInfo.lastClicked.point.y.toFixed(1)}
                    </div>
                </div>
            )}
            <div style={{ borderTop: '1px solid #444', paddingTop: '5px', marginTop: '5px', fontSize: '10px' }}>
                Check console for detailed logs
            </div>
        </div>
    );
}

// Usage: Add this to your main app component temporarily:
// import { CustomNoteDebugComponent } from './path/to/CustomNoteDebugComponent';
// 
// And in your JSX:
// <Tldraw>
//     <CustomNoteDebugComponent />
//     {/* your other components */}
// </Tldraw>