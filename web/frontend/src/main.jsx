import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// import App from './App.jsx'
// import CustomApp from './CustomApp.jsx' // Используем кастомное приложение
// import SimpleTest from './components/SimpleTest.jsx' // Тестируем простой пример
// import BasicWorkingTest from './BasicWorkingTest.jsx' // Базовый рабочий тест
// import MinimalTest from './MinimalTest.jsx' // МИНИМАЛЬНЫЙ ТЕСТ без всех проблем
// import WorkingCustomApp from './WorkingCustomApp.jsx' // РАБОЧАЯ КАСТОМНАЯ ВЕРСИЯ
// import FinalWorkingApp from './FinalWorkingApp.jsx' // ФИНАЛЬНАЯ ВЕРСИЯ
// import DebugApp from './DebugApp.jsx' // DEBUG для диагностики
// import NoUIApp from './NoUIApp.jsx' // Версия без UI
import ProductionApp from './ProductionApp.jsx' // ФИНАЛЬНАЯ PRODUCTION ВЕРСИЯ
import TestPositionSync from './TestPositionSync.jsx' // TEST: Position tracking
import TestDateLayout from './TestDateLayout.jsx' // TEST: Date-based layout
import SyncedProductionApp from './SyncedProductionApp.jsx' // PRODUCTION with backend sync

// Test without StrictMode to check if it resolves canvas issues
// StrictMode can cause double-rendering issues with tldraw (see: https://github.com/tldraw/tldraw/issues/5611)
const USE_STRICT_MODE = false; // Set to true to enable StrictMode

// Choose which app to run based on URL params:
// ?test=position - Test position tracking and sync
// ?test=date - Test date-based layout algorithm
// ?sync=true - Production app with backend sync
// default - Production app (standalone)
const params = new URLSearchParams(window.location.search);
const testMode = params.get('test');
const syncMode = params.get('sync');

let AppComponent = ProductionApp;
if (testMode === 'position') {
  AppComponent = TestPositionSync;
  console.log('🧪 Running TestPositionSync');
} else if (testMode === 'date') {
  AppComponent = TestDateLayout;
  console.log('🧪 Running TestDateLayout');
} else if (syncMode === 'true') {
  AppComponent = SyncedProductionApp;
  console.log('🔄 Running SyncedProductionApp with backend');
}

createRoot(document.getElementById('root')).render(
  USE_STRICT_MODE ? (
    <StrictMode>
      <AppComponent />
    </StrictMode>
  ) : (
    <AppComponent />
  ),
)
