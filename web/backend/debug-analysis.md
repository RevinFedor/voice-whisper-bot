# Custom-Note Shape Pointer Events Debug Analysis

## Problem Summary
Custom-note shapes are not being detected on pointer events, showing `target: 'canvas'` instead of `target: 'shape'`.

## Root Cause Analysis

### 1. Geometry Implementation Issue
**Problem**: Your original `getGeometry()` method returns a single `Rectangle2d`, while tldraw's built-in shapes use `Group2d` for better hit detection compatibility.

**Original Code**:
```javascript
getGeometry(shape) {
    return new Rectangle2d({
        width: shape.props.w,
        height: shape.props.h,
        isFilled: true,
    });
}
```

**Fixed Code**:
```javascript
getGeometry(shape) {
    return new Group2d({
        children: [
            // Main shape rectangle
            new Rectangle2d({
                width: shape.props.w,
                height: shape.props.h,
                isFilled: true,
            }),
            // Label area rectangle for text interaction
            new Rectangle2d({
                x: 0,
                y: 0,
                width: shape.props.w,
                height: shape.props.h,
                isFilled: true,
                isLabel: true,
            })
        ]
    });
}
```

### 2. Hit Detection Flow in tldraw

Based on the `getShapeAtPoint` method analysis:

1. **Shape Filtering**: Shapes are filtered by visibility, lock status, and masks
2. **Geometry Check**: `getShapeGeometry(shape)` is called for each shape
3. **Point Transformation**: Point is transformed to shape's local space
4. **Distance Calculation**: `geometry.distanceToPoint()` determines hit
5. **Priority**: Filled shapes take priority over hollow ones

### 3. Key Differences from Built-in Shapes

**Built-in NoteShapeUtil**:
- Uses `Group2d` with multiple child rectangles
- Has separate label geometry with `isLabel: true`
- Properly handles text interaction areas

**Your Custom Shape**:
- Originally used single `Rectangle2d` (now fixed)
- Missing label geometry for text areas
- Same type name format ('custom-note' vs 'note')

## Diagnostic Tools

### 1. Browser Console Debug Script
Run `/debug-custom-note-shapes.js` in browser console:

```javascript
// Load and run the debug script
const script = document.createElement('script');
script.src = 'path/to/debug-custom-note-shapes.js';
document.head.appendChild(script);

// Or copy-paste the script content directly
```

**What it tests**:
- Shape registration verification
- Geometry calculation for each shape
- Hit detection at multiple points
- Comparison with built-in shapes
- Common issues (locked, hidden, masked shapes)
- Manual hit rate testing

### 2. React Debug Component
Add `CustomNoteDebugComponent.jsx` to your app for real-time debugging:

```javascript
import { CustomNoteDebugComponent } from './CustomNoteDebugComponent';

// In your main component:
<Tldraw shapeUtils={[CustomNoteShapeUtil]}>
    <CustomNoteDebugComponent />
    {/* other components */}
</Tldraw>
```

**Features**:
- Real-time mouse position tracking
- Live shape detection display
- Click event logging
- Console output for detailed analysis

## Testing Checklist

### ✅ Verify Shape Registration
- [x] Shape type is 'custom-note'
- [x] CustomNoteShapeUtil is in shapeUtils array
- [x] No console errors during registration

### ✅ Test Geometry Implementation
- [x] `getGeometry()` returns Group2d (fixed)
- [x] Main rectangle has `isFilled: true`
- [x] Label rectangle has `isLabel: true`
- [x] Bounds match shape dimensions

### 🔍 Debug Hit Detection
```javascript
// Test specific points
const editor = window.editor;
const shape = editor.getCurrentPageShapes().find(s => s.type === 'custom-note');
const bounds = editor.getShapePageBounds(shape);
const center = { x: bounds.x + bounds.w/2, y: bounds.y + bounds.h/2 };

// Should return your shape
console.log(editor.getShapeAtPoint(center, { hitInside: true }));
```

### 🔍 Common Issues to Check
- **Shape is locked**: `shape.isLocked === true`
- **Shape is hidden**: `editor.isShapeHidden(shape) === true`
- **Shape has mask**: `editor.getShapeMask(shape) !== null`
- **Shape is behind frame**: Check z-index and parent relationships
- **Geometry bounds are wrong**: Verify width/height calculations

## Quick Fixes

### Fix 1: Use Group2d Geometry (Applied)
Replace single Rectangle2d with Group2d containing main + label rectangles.

### Fix 2: Ensure Proper Props
```javascript
static props = {
    w: T.number,
    h: T.number,
    // ... ensure all props have proper validators
};
```

### Fix 3: Debug Event Handling
Add temporary logging to your shape component:
```javascript
component(shape) {
    return (
        <HTMLContainer
            onPointerDown={(e) => {
                console.log('Custom note pointer down!', shape.id);
                e.stopPropagation(); // Prevent event bubbling if needed
            }}
            style={{ ... }}
        >
            {/* your content */}
        </HTMLContainer>
    );
}
```

## Expected Results After Fix

1. **Hit Detection**: `editor.getShapeAtPoint()` should return your custom-note shapes
2. **Event Target**: Pointer events should show `target: 'shape'` instead of `target: 'canvas'`
3. **Selection**: Shapes should be selectable by clicking
4. **Interaction**: Click handlers should fire properly

## Next Steps

1. **Apply the geometry fix** (already done)
2. **Run the debug script** to verify hit detection works
3. **Test with debug component** for real-time feedback
4. **Check console logs** for any remaining errors
5. **Test different pointer event scenarios**

## Additional Resources

- **tldraw Editor API**: Check `editor.getShapeAtPoint()` options
- **Geometry Classes**: Rectangle2d, Group2d documentation
- **Built-in Shapes**: Study NoteShapeUtil implementation
- **Hit Testing**: Understanding margin, hitInside, hitLabels options

The main fix (Group2d geometry) should resolve the pointer event detection issue. Use the diagnostic tools to verify and catch any remaining edge cases.