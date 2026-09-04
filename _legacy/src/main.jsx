import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#FAF7F2',
          color: '#2C1A0E',
          border: '1px solid #E8E2D9',
          fontFamily: 'Inter, sans-serif',
        },
        success: { iconTheme: { primary: '#C9A84C', secondary: '#FAF7F2' } },
        error:   { iconTheme: { primary: '#DC2626', secondary: '#FAF7F2' } },
      }}
    />
  </React.StrictMode>
)
