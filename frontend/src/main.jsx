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
import DebugApp from './DebugApp.jsx' // DEBUG для диагностики
// import NoUIApp from './NoUIApp.jsx' // Версия без UI

// Test without StrictMode to check if it resolves canvas issues
// StrictMode can cause double-rendering issues with tldraw (see: https://github.com/tldraw/tldraw/issues/5611)
const USE_STRICT_MODE = false; // Set to true to enable StrictMode

createRoot(document.getElementById('root')).render(
  USE_STRICT_MODE ? (
    <StrictMode>
      <DebugApp />
    </StrictMode>
  ) : (
    <DebugApp />
  ),
)
