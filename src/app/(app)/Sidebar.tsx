'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Upload, ClipboardList, CalendarDays,
  LogOut, ChevronRight, X, ChevronUp, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation } from './ImpersonationContext'

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

const ROLE_LABELS: Record<string, string> = {
  gerente:      'Gerente Comercial',
  asesor:       'Asesor de Ventas',
  cargador:     'Cargador',
  programador:  'Producción / Compras',
}

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard, roles: ['gerente', 'asesor', 'cargador', 'programador'] },
  { href: '/calendario', label: 'Calendario',       icon: CalendarDays,    roles: ['gerente', 'asesor', 'programador'] },
  { href: '/upload',     label: 'Cargar archivos',  icon: Upload,          roles: ['gerente', 'cargador'] },
  { href: '/historial',  label: 'Historial cargas', icon: ClipboardList,   roles: ['gerente', 'cargador'] },
]

export default function Sidebar({
  profile,
  allUsers,
  open,
  onClose,
}: {
  profile: Profile | null
  allUsers: AppUser[]
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { impersonateAs, setImpersonateAs } = useImpersonation()

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return
    function handler(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [switcherOpen])

  async function handleLogout() {
    setImpersonateAs(null)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleImpersonate(u: AppUser) {
    setImpersonateAs({
      codigo: u.asesor_codigo,
      nombre: u.full_name,
      role:   u.role,
    })
    setSwitcherOpen(false)
    onClose()
  }

  function handleExitImpersonation() {
    setImpersonateAs(null)
    setSwitcherOpen(false)
  }

  const role          = impersonateAs?.role ?? profile?.role ?? 'gerente'
  const isGerente     = profile?.role === 'gerente'
  const hasSwitchable = isGerente && allUsers.length > 0

  // Group users by role for display
  const usersByRole = allUsers.reduce<Record<string, AppUser[]>>((acc, u) => {
    if (!acc[u.role]) acc[u.role] = []
    acc[u.role].push(u)
    return acc
  }, {})
  const roleOrder = ['gerente', 'asesor', 'programador', 'cargador']

  return (
    <aside className={`
      fixed md:static inset-y-0 left-0 z-30
      w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full
      transition-transform duration-200 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0
    `}>

      {/* Logo + close button (mobile) */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900 tracking-tight">SELLARTE OPS</p>
          <p className="text-xs text-gray-400 mt-0.5">Control de pedidos</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          aria-label="Cerrar menú"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Aviso de impersonación activa */}
      {impersonateAs && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-blue-600 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">
            Viendo como
          </p>
          <p className="text-sm font-bold truncate">{impersonateAs.nombre}</p>
          <p className="text-[10px] text-blue-200 mt-0.5">
            {ROLE_LABELS[impersonateAs.role] ?? impersonateAs.role}
          </p>
          <button
            onClick={handleExitImpersonation}
            className="mt-2 w-full text-[10px] font-semibold px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            Salir de esta vista
          </button>
        </div>
      )}

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
              onClick={onClose}
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
      <div className="px-3 py-4 border-t border-gray-100 space-y-1" ref={switcherRef}>

        {/* User switcher trigger (gerente only) */}
        {hasSwitchable ? (
          <div className="relative">
            {/* Switcher popover */}
            {switcherOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 z-50
                bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">

                {/* Header */}
                <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Iniciar sesión como
                  </p>
                </div>

                {/* Exit impersonation */}
                {impersonateAs && (
                  <button
                    onClick={handleExitImpersonation}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-red-50 transition-colors border-b border-gray-100"
                  >
                    <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs font-medium text-red-600">Salir de vista actual</span>
                  </button>
                )}

                {/* Users grouped by role */}
                <div className="max-h-64 overflow-y-auto py-1">
                  {roleOrder.map(r => {
                    const users = usersByRole[r]
                    if (!users?.length) return null
                    return (
                      <div key={r}>
                        <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">
                          {ROLE_LABELS[r] ?? r}
                        </p>
                        {users.map(u => {
                          const isActive = impersonateAs?.nombre === u.full_name
                          return (
                            <button
                              key={u.id}
                              onClick={() => handleImpersonate(u)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                                ${isActive
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0
                                ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}
                              />
                              <span className="text-xs font-medium truncate">{u.full_name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trigger button */}
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                ${impersonateAs
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                {impersonateAs ? (
                  <>
                    <p className="text-xs font-semibold truncate">{impersonateAs.nombre}</p>
                    <p className="text-[10px] text-blue-500">{ROLE_LABELS[impersonateAs.role] ?? impersonateAs.role}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{profile?.full_name ?? 'Sin perfil'}</p>
                    <p className="text-xs text-gray-400">{profile ? (ROLE_LABELS[role] ?? role) : 'Sin configurar'}</p>
                  </>
                )}
              </div>
              <ChevronUp className={`w-3.5 h-3.5 shrink-0 transition-transform ${switcherOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>
        ) : (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-gray-800 truncate">{profile?.full_name ?? 'Sin perfil'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{profile ? (ROLE_LABELS[role] ?? role) : 'Cuenta sin configurar'}</p>
          </div>
        )}

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
