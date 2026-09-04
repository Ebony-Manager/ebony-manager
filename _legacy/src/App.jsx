import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import Sidebar  from './components/layout/Sidebar.jsx'
import Navbar   from './components/layout/Navbar.jsx'
import Login    from './pages/Login.jsx'
import Cotizacion from './pages/Cotizacion.jsx'

// Placeholder for future modules
function ComingSoon({ name }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-ebony-gray/30 flex items-center justify-center mb-4">
        <span className="text-3xl">🚧</span>
      </div>
      <h2 className="text-lg font-semibold text-ebony-dark">{name}</h2>
      <p className="text-ebony-light text-sm mt-1">Este módulo estará disponible próximamente.</p>
    </div>
  )
}

function AppShell() {
  const { user, loading } = useAuth()
  const [page,       setPage]       = useState('cotizacion')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-ebony-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ebony-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Login />

  const renderPage = () => {
    switch (page) {
      case 'cotizacion': return <Cotizacion />
      case 'proyectos':  return <ComingSoon name="Proyectos" />
      case 'cronograma': return <ComingSoon name="Cronograma" />
      case 'gastos':     return <ComingSoon name="Control de Gastos" />
      case 'dashboard':  return <ComingSoon name="Dashboard" />
      default:           return <Cotizacion />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ebony-warm">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  )
}
