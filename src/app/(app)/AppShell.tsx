'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { ImpersonationProvider } from './ImpersonationContext'

interface Profile {
  full_name: string
  role: string
}

interface AppUser {
  id: string
  full_name: string
  role: string
  asesor_codigo: number | null
}

export default function AppShell({
  profile,
  allUsers,
  children,
}: {
  profile: Profile | null
  allUsers: AppUser[]
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ImpersonationProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Overlay móvil */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          profile={profile}
          allUsers={allUsers}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Barra superior en móvil con botón hamburger */}
          <div className="md:hidden flex items-center h-14 px-4 bg-white border-b border-gray-200 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <span className="ml-3 font-semibold text-gray-900 text-sm">SELLARTE OPS</span>
          </div>
          {children}
        </div>
      </div>
    </ImpersonationProvider>
  )
}
