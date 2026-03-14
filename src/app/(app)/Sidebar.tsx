'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Upload, ClipboardList, LogOut, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  full_name: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  gerente:  'Gerente Comercial',
  asesor:   'Asesor de Ventas',
  cargador: 'Cargador',
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard',       icon: LayoutDashboard, roles: ['gerente', 'asesor', 'cargador'] },
  { href: '/upload',    label: 'Cargar archivos',  icon: Upload,          roles: ['gerente', 'cargador'] },
  { href: '/historial', label: 'Historial cargas', icon: ClipboardList,   roles: ['gerente', 'cargador'] },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Si profile es null el usuario está autenticado pero no tiene entrada en app_users.
  // Mostramos toda la nav como fallback para no dejar la UI rota.
  const role = profile?.role ?? 'gerente'

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900 tracking-tight">SELLARTE OPS</p>
        <p className="text-xs text-gray-400 mt-0.5">Control de pedidos</p>
      </div>

      {/* Aviso si el perfil no está configurado */}
      {!profile && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
          <p className="text-xs text-yellow-700 font-medium">Perfil no configurado</p>
          <p className="text-xs text-yellow-600 mt-0.5">Tu cuenta no tiene rol asignado en app_users.</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.filter(item => item.roles.includes(role)).map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group
                ${active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-gray-800 truncate">{profile?.full_name ?? 'Sin perfil'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{profile ? (ROLE_LABELS[role] ?? role) : 'Cuenta sin configurar'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
            text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

    </aside>
  )
}
