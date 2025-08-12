import React from 'react';
import { 
    TldrawEditor,
    TldrawUi,
    defaultShapeUtils 
} from 'tldraw';
import 'tldraw/tldraw.css';
import './custom-tldraw.css'; // Кастомные стили
import { CustomNoteShapeUtil } from './components/CustomNoteShape';
import { CustomBackground } from './components/CustomBackground';
import { CustomControls } from './components/CustomControls';
import { ShapeInitializer } from './components/ShapeInitializer';
import { DiagnosticTool } from './components/DiagnosticTool';
import { DOMInspector } from './components/DOMInspector';
import { TestGeoShape } from './components/TestGeoShape';


export default function CustomApp() {
    // Кастомные компоненты для редактора
    const editorComponents = {
        Background: CustomBackground,
        Grid: null, // убираем сетку
    };

    // Кастомные UI компоненты (скрываем все стандартные)
    const uiComponents = {
        Toolbar: null,
        StylePanel: null,
        MenuPanel: null,
        NavigationPanel: null,
        HelpMenu: null,
        SharePanel: null,
        TopPanel: null,
        Minimap: null,
        ActionsMenu: null,
        MainMenu: null,
        PageMenu: null,
        ZoomMenu: null,
        QuickActions: null,
        HelperButtons: null,
        DebugPanel: null,
        DebugMenu: null,
    };

    // Объединяем кастомные и стандартные shape utils
    const shapeUtils = [
        ...defaultShapeUtils,
        CustomNoteShapeUtil,
    ];

    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0,
            background: '#0a0a0a',
        }}>
            <TldrawEditor
                shapeUtils={shapeUtils}
                components={editorComponents}
            >
                <TldrawUi components={uiComponents}>
                    <DiagnosticTool />
                    <DOMInspector autoRun={true} logInterval={10000} />
                    <TestGeoShape />
                    <ShapeInitializer />
                    <CustomControls />
                </TldrawUi>
            </TldrawEditor>
        </div>
    );
}