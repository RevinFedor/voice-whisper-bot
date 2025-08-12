import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// import App from './App.jsx'
import CustomApp from './CustomApp.jsx' // Используем кастомное приложение

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CustomApp />
  </StrictMode>,
)
