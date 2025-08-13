import { createRoot } from 'react-dom/client'
import './index.css'
import SyncedProductionApp from './SyncedProductionApp.jsx'

// StrictMode can cause double-rendering issues with tldraw (see: https://github.com/tldraw/tldraw/issues/5611)
// Disabled for tldraw compatibility
createRoot(document.getElementById('root')).render(
  <SyncedProductionApp />
)
