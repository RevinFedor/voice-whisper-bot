import React, { useEffect, useRef } from 'react';
import { useEditor } from 'tldraw';

export function DOMInspector({ autoRun = true, logInterval = 10000 }) {
    const editor = useEditor();
    const intervalRef = useRef(null);
    
    useEffect(() => {
        if (!editor) return;
        
        // Comprehensive DOM inspection functions
        const inspectDOM = {
            // Check canvas/svg elements
            checkCanvasElements: () => {
                console.group('🎨 Canvas/SVG Elements Check');
                
                // Check for tldraw container
                const tlContainer = document.querySelector('.tl-container');
                console.log('tl-container found:', !!tlContainer);
                if (tlContainer) {
                    const rect = tlContainer.getBoundingClientRect();
                    console.log('Container dimensions:', {
                        width: rect.width,
                        height: rect.height,
                        visible: rect.width > 0 && rect.height > 0
                    });
                }
                
                // Check for SVG elements
                const svgs = document.querySelectorAll('svg');
                console.log('SVG elements found:', svgs.length);
                svgs.forEach((svg, i) => {
                    const rect = svg.getBoundingClientRect();
                    console.log(`SVG ${i}:`, {
                        width: rect.width,
                        height: rect.height,
                        parent: svg.parentElement?.className,
                        visible: rect.width > 0 && rect.height > 0
                    });
                });
                
                // Check for canvas elements
                const canvases = document.querySelectorAll('canvas');
                console.log('Canvas elements found:', canvases.length);
                canvases.forEach((canvas, i) => {
                    console.log(`Canvas ${i}:`, {
                        width: canvas.width,
                        height: canvas.height,
                        clientWidth: canvas.clientWidth,
                        clientHeight: canvas.clientHeight,
                        parent: canvas.parentElement?.className
                    });
                });
                
                console.groupEnd();
            },
            
            // Inspect computed styles
            inspectComputedStyles: () => {
                console.group('💄 Computed Styles Inspection');
                
                const selectors = [
                    '.tl-container',
                    '.tl-canvas',
                    '.tl-shapes',
                    '.tl-shape',
                    '.tl-background',
                    '.tl-overlays',
                    '.tlui-layout',
                    '.tl-cursor',
                    '.tl-handle'
                ];
                
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        const firstEl = elements[0];
                        const styles = window.getComputedStyle(firstEl);
                        console.log(`${selector} (${elements.length} found):`, {
                            display: styles.display,
                            visibility: styles.visibility,
                            opacity: styles.opacity,
                            position: styles.position,
                            zIndex: styles.zIndex,
                            width: styles.width,
                            height: styles.height,
                            transform: styles.transform,
                            pointerEvents: styles.pointerEvents
                        });
                    } else {
                        console.log(`${selector}: NOT FOUND`);
                    }
                });
                
                console.groupEnd();
            },
            
            // Check rendering properties
            checkRenderingProperties: () => {
                console.group('👁️ Rendering Properties Check');
                
                // Check z-index layers
                const layeredElements = document.querySelectorAll('[style*="z-index"]');
                const zIndexMap = {};
                layeredElements.forEach(el => {
                    const zIndex = window.getComputedStyle(el).zIndex;
                    const className = el.className || 'no-class';
                    if (!zIndexMap[zIndex]) zIndexMap[zIndex] = [];
                    zIndexMap[zIndex].push(className);
                });
                console.log('Z-index layers:', zIndexMap);
                
                // Check visibility issues
                const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]');
                console.log('Hidden elements:', hiddenElements.length);
                hiddenElements.forEach(el => {
                    console.log('Hidden:', el.className || el.tagName);
                });
                
                // Check transform issues
                const transformedElements = document.querySelectorAll('[style*="transform"]');
                console.log('Transformed elements:', transformedElements.length);
                
                console.groupEnd();
            },
            
            // Verify viewport and camera
            verifyViewportAndCamera: () => {
                console.group('🎯 Viewport & Camera Verification');
                
                const camera = editor.getCamera();
                console.log('Camera:', {
                    x: camera.x,
                    y: camera.y,
                    z: camera.z
                });
                
                const viewport = editor.getViewportScreenBounds();
                console.log('Viewport bounds:', {
                    x: viewport.x,
                    y: viewport.y,
                    width: viewport.w,
                    height: viewport.h
                });
                
                const currentPageBounds = editor.getCurrentPageBounds();
                console.log('Current page bounds:', currentPageBounds);
                
                console.groupEnd();
            },
            
            // Check for React errors
            checkErrorBoundariesAndReactErrors: () => {
                console.group('⚠️ Error Detection');
                
                // Look for error boundaries
                const errorBoundaries = document.querySelectorAll('[data-error], .error-boundary');
                console.log('Error boundaries found:', errorBoundaries.length);
                
                // Check for React error overlay
                const reactErrorOverlay = document.querySelector('#webpack-dev-server-client-overlay');
                console.log('React error overlay present:', !!reactErrorOverlay);
                
                // Check console for errors
                console.log('Check browser console for any React/tldraw errors');
                
                console.groupEnd();
            },
            
            // Check shapes DOM elements
            checkShapesDOMElements: () => {
                console.group('🎭 Shapes DOM Elements Check');
                
                const shapes = editor.getCurrentPageShapes();
                console.log(`Total shapes in store: ${shapes.length}`);
                
                shapes.forEach((shape, index) => {
                    const domElement = document.querySelector(`[data-shape-id="${shape.id}"]`);
                    const shapeElement = document.querySelector(`.tl-shape[data-shape-type="${shape.type}"]`);
                    
                    console.log(`Shape ${index} (${shape.type}):`, {
                        id: shape.id,
                        hasDOMElement: !!domElement,
                        hasShapeElement: !!shapeElement,
                        position: { x: shape.x, y: shape.y },
                        props: shape.props
                    });
                    
                    if (domElement) {
                        const rect = domElement.getBoundingClientRect();
                        console.log(`  DOM rect:`, {
                            width: rect.width,
                            height: rect.height,
                            visible: rect.width > 0 && rect.height > 0
                        });
                    }
                });
                
                console.groupEnd();
            },
            
            // Run full diagnostic
            runFullDiagnostic: () => {
                console.group('🔍 === FULL DOM DIAGNOSTIC ===');
                const startTime = performance.now();
                
                inspectDOM.checkCanvasElements();
                inspectDOM.inspectComputedStyles();
                inspectDOM.checkRenderingProperties();
                inspectDOM.verifyViewportAndCamera();
                inspectDOM.checkErrorBoundariesAndReactErrors();
                inspectDOM.checkShapesDOMElements();
                
                const endTime = performance.now();
                console.log(`Diagnostic completed in ${(endTime - startTime).toFixed(2)}ms`);
                console.groupEnd();
            }
        };
        
        // Expose to window for manual debugging
        window.domInspector = inspectDOM;
        
        // Auto-run on mount if enabled
        if (autoRun) {
            setTimeout(() => {
                console.log('🚀 Running initial DOM diagnostic...');
                inspectDOM.runFullDiagnostic();
            }, 2000);
        }
        
        // Set up periodic logging if interval is specified
        if (logInterval > 0) {
            intervalRef.current = setInterval(() => {
                console.log('⏰ Running periodic DOM diagnostic...');
                inspectDOM.runFullDiagnostic();
            }, logInterval);
        }
        
        console.log('🔧 DOMInspector ready. Use window.domInspector for manual diagnostics.');
        
        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [editor, autoRun, logInterval]);
    
    return null;
}

export default DOMInspector;