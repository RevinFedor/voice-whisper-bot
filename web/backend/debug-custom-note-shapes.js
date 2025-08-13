// Debug script for custom-note shape pointer event detection
// Run this in the browser console while on the tldraw page

console.log('🔍 Starting custom-note shape debug script...');

function debugCustomNoteShapes() {
    // Get the editor instance
    const editor = window.editor || (window.app && window.app.editor);
    if (!editor) {
        console.error('❌ Editor not found! Make sure you\'re on the tldraw page');
        return;
    }

    console.log('✅ Editor found:', editor);

    // 1. Check if custom-note shapes are properly registered
    console.log('\n📝 Checking shape registration...');
    const shapeUtils = editor.shapeUtils;
    const customNoteUtil = shapeUtils.get('custom-note');
    
    if (!customNoteUtil) {
        console.error('❌ custom-note shape util not registered!');
        console.log('Available shape types:', Array.from(shapeUtils.keys()));
        return;
    }
    
    console.log('✅ custom-note shape util found:', customNoteUtil);

    // 2. Get all custom-note shapes on current page
    console.log('\n🔍 Finding custom-note shapes...');
    const allShapes = editor.getCurrentPageShapes();
    const customNoteShapes = allShapes.filter(shape => shape.type === 'custom-note');
    
    console.log(`Found ${customNoteShapes.length} custom-note shapes:`, customNoteShapes);

    if (customNoteShapes.length === 0) {
        console.log('⚠️ No custom-note shapes found on current page');
        return;
    }

    // 3. Test geometry calculation for each shape
    console.log('\n📐 Testing geometry calculation...');
    customNoteShapes.forEach((shape, index) => {
        console.log(`\n--- Shape ${index + 1} (${shape.id}) ---`);
        
        try {
            const geometry = editor.getShapeGeometry(shape);
            console.log('Geometry:', geometry);
            console.log('Bounds:', geometry.bounds);
            console.log('isFilled:', geometry.isFilled);
            console.log('Type:', geometry.constructor.name);
            
            // Test if it's a Group2d
            if (geometry.children) {
                console.log('Children geometries:', geometry.children);
                geometry.children.forEach((child, childIndex) => {
                    console.log(`  Child ${childIndex}:`, {
                        bounds: child.bounds,
                        isFilled: child.isFilled,
                        isLabel: child.isLabel,
                        type: child.constructor.name
                    });
                });
            }
            
            // Get shape bounds in page coordinates
            const pageTransform = editor.getShapePageTransform(shape);
            console.log('Page transform:', pageTransform);
            
            const pageBounds = editor.getShapePageBounds(shape);
            console.log('Page bounds:', pageBounds);
            
        } catch (error) {
            console.error('❌ Error calculating geometry:', error);
        }
    });

    // 4. Test hit detection at various points
    console.log('\n🎯 Testing hit detection...');
    
    // Test center point of first shape
    if (customNoteShapes.length > 0) {
        const testShape = customNoteShapes[0];
        const pageBounds = editor.getShapePageBounds(testShape);
        
        if (pageBounds) {
            const centerPoint = {
                x: pageBounds.x + pageBounds.w / 2,
                y: pageBounds.y + pageBounds.h / 2
            };
            
            console.log(`Testing center point of ${testShape.id}:`, centerPoint);
            
            // Test various hit detection options
            const hitTests = [
                { options: {}, description: 'default' },
                { options: { hitInside: true }, description: 'hitInside: true' },
                { options: { margin: 10 }, description: 'margin: 10' },
                { options: { hitLabels: true }, description: 'hitLabels: true' },
                { options: { hitInside: true, hitLabels: true }, description: 'hitInside + hitLabels' }
            ];
            
            hitTests.forEach(test => {
                const hitShape = editor.getShapeAtPoint(centerPoint, test.options);
                const result = hitShape ? hitShape.id : 'null';
                console.log(`  ${test.description}: ${result} ${result === testShape.id ? '✅' : '❌'}`);
            });
            
            // Test corners
            const corners = [
                { x: pageBounds.x, y: pageBounds.y, name: 'top-left' },
                { x: pageBounds.x + pageBounds.w, y: pageBounds.y, name: 'top-right' },
                { x: pageBounds.x, y: pageBounds.y + pageBounds.h, name: 'bottom-left' },
                { x: pageBounds.x + pageBounds.w, y: pageBounds.y + pageBounds.h, name: 'bottom-right' }
            ];
            
            console.log('\nTesting corners:');
            corners.forEach(corner => {
                const hitShape = editor.getShapeAtPoint(corner, { hitInside: true });
                const result = hitShape ? hitShape.id : 'null';
                console.log(`  ${corner.name}: ${result} ${result === testShape.id ? '✅' : '❌'}`);
            });
        }
    }

    // 5. Compare with built-in shapes
    console.log('\n🔄 Comparing with built-in shapes...');
    const builtInShapes = allShapes.filter(shape => ['geo', 'note', 'text'].includes(shape.type));
    
    if (builtInShapes.length > 0) {
        const compareShape = builtInShapes[0];
        console.log(`Comparing with ${compareShape.type} shape:`, compareShape.id);
        
        try {
            const geometry = editor.getShapeGeometry(compareShape);
            console.log('Built-in geometry:', {
                type: geometry.constructor.name,
                bounds: geometry.bounds,
                isFilled: geometry.isFilled,
                hasChildren: !!geometry.children,
                children: geometry.children ? geometry.children.length : 0
            });
            
            // Test hit detection on built-in shape
            const pageBounds = editor.getShapePageBounds(compareShape);
            if (pageBounds) {
                const centerPoint = {
                    x: pageBounds.x + pageBounds.w / 2,
                    y: pageBounds.y + pageBounds.h / 2
                };
                
                const hitShape = editor.getShapeAtPoint(centerPoint);
                console.log(`Built-in shape hit test: ${hitShape ? hitShape.id : 'null'} ${hitShape?.id === compareShape.id ? '✅' : '❌'}`);
            }
        } catch (error) {
            console.error('❌ Error testing built-in shape:', error);
        }
    }

    // 6. Debug rendering shapes
    console.log('\n🎨 Checking rendering...');
    const renderingShapes = editor.getCurrentPageRenderingShapesSorted();
    const customNotesInRender = renderingShapes.filter(shape => shape.type === 'custom-note');
    console.log(`Custom-note shapes in rendering: ${customNotesInRender.length}/${customNoteShapes.length}`);
    
    // 7. Check for common issues
    console.log('\n🔧 Checking for common issues...');
    
    customNoteShapes.forEach((shape, index) => {
        console.log(`\n--- Issues for Shape ${index + 1} ---`);
        
        // Check if shape is locked
        if (shape.isLocked) {
            console.log('⚠️ Shape is locked (may not be selectable)');
        }
        
        // Check if shape is hidden
        if (editor.isShapeHidden(shape)) {
            console.log('⚠️ Shape is hidden');
        }
        
        // Check shape mask
        const mask = editor.getShapeMask(shape);
        if (mask) {
            console.log('⚠️ Shape has mask:', mask);
        }
        
        // Check parent
        if (shape.parentId && shape.parentId !== editor.getCurrentPageId()) {
            const parent = editor.getShape(shape.parentId);
            console.log('ℹ️ Shape has parent:', parent);
        }
        
        // Check z-index
        console.log('Z-index:', shape.index);
    });

    // 8. Test manual hit detection
    console.log('\n🎪 Manual hit detection test...');
    if (customNoteShapes.length > 0) {
        const testShape = customNoteShapes[0];
        const pageBounds = editor.getShapePageBounds(testShape);
        
        if (pageBounds) {
            // Create test points
            const testPoints = [];
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    testPoints.push({
                        x: pageBounds.x + (pageBounds.w * i / 4),
                        y: pageBounds.y + (pageBounds.h * j / 4)
                    });
                }
            }
            
            console.log(`Testing ${testPoints.length} points across shape bounds...`);
            let hits = 0;
            
            testPoints.forEach((point, index) => {
                const hitShape = editor.getShapeAtPoint(point, { hitInside: true });
                if (hitShape?.id === testShape.id) {
                    hits++;
                }
            });
            
            console.log(`Hit rate: ${hits}/${testPoints.length} (${(hits/testPoints.length*100).toFixed(1)}%)`);
            
            if (hits === 0) {
                console.error('❌ No hits detected! This indicates a fundamental issue with hit detection.');
            } else if (hits < testPoints.length * 0.8) {
                console.warn('⚠️ Low hit rate detected. Shape may have hit detection issues.');
            } else {
                console.log('✅ Good hit detection rate.');
            }
        }
    }

    // 9. Provide recommendations
    console.log('\n💡 Recommendations:');
    
    if (customNoteShapes.length > 0) {
        const testShape = customNoteShapes[0];
        const geometry = editor.getShapeGeometry(testShape);
        
        if (geometry.constructor.name !== 'Group2d') {
            console.log('1. ⚠️ Consider using Group2d instead of Rectangle2d for better compatibility');
        }
        
        if (!geometry.isFilled) {
            console.log('2. ⚠️ Make sure geometry.isFilled is true for solid shapes');
        }
        
        console.log('3. 💡 Try implementing getGeometry() like the built-in NoteShapeUtil:');
        console.log(`
        getGeometry(shape) {
            return new Group2d({
                children: [
                    new Rectangle2d({ 
                        width: shape.props.w, 
                        height: shape.props.h, 
                        isFilled: true 
                    }),
                    // Add label rectangle if needed
                    new Rectangle2d({
                        x: 0, y: 0,
                        width: shape.props.w,
                        height: shape.props.h,
                        isFilled: true,
                        isLabel: true
                    })
                ]
            });
        }`);
    }

    console.log('\n🎉 Debug script completed!');
    console.log('\nTo run specific tests:');
    console.log('- debugCustomNoteShapes.testHitDetection(x, y) - test specific point');
    console.log('- debugCustomNoteShapes.listAllShapes() - list all shapes');
    console.log('- debugCustomNoteShapes.testGeometry(shapeId) - test specific shape geometry');
    
    return {
        editor,
        customNoteShapes,
        testHitDetection: (x, y) => {
            console.log(`Testing point (${x}, ${y}):`, editor.getShapeAtPoint({ x, y }, { hitInside: true }));
        },
        listAllShapes: () => {
            console.log('All shapes:', allShapes.map(s => ({ id: s.id, type: s.type })));
        },
        testGeometry: (shapeId) => {
            const shape = editor.getShape(shapeId);
            if (shape) {
                console.log('Shape:', shape);
                console.log('Geometry:', editor.getShapeGeometry(shape));
            }
        }
    };
}

// Export to window for easy access
window.debugCustomNoteShapes = debugCustomNoteShapes;

// Run the debug script
debugCustomNoteShapes();