'use client'

import { useMemo, useState, Fragment } from 'react'
import {
  AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Search,
  LayoutGrid, Table2, TrendingDown, Clock, Calendar, CheckCircle2,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { calcSemaforo } from '@/lib/parser/holidays'
import MultiFilter from '@/components/MultiFilter'
import PedidoDetailPanel, { type PedidoDetail, type PedidoLine } from '@/components/PedidoDetailPanel'
import AsesorDetailPanel, { type AsesorPanelRow } from '@/components/AsesorDetailPanel'
import { useImpersonation } from '../ImpersonationContext'

// ============================================================
// TIPOS
// ============================================================
interface Pedido {
  id: string
  empresa: 'sllrt' | 'rv'
  asesor_codigo: number
  asesor_nombre: string
  cliente_nit: number
  cliente_nombre: string
  producto_codigo: string
  referencia: string
  descripcion: string
  numero_siigo: string
  sec: number
  pedido_vendedor: string | null
  cantidad_pedida: number
  valor_pedido: number
  cantidad_pendiente: number
  valor_pendiente: number
  linea: string
  fecha_pedido: string | null
  fecha_pactada: string | null
  fecha_entrega_parcial: string | null
  tipo_ip: string | null
  tipo_ip_desc: string | null
  calibre: string | null
  calibre_desc: string | null
}

interface PedidoRow extends Pedido {
  semaforo: number | null
}

interface Batch {
  id: string
  fecha_datos: string
  uploaded_by_name: string
  created_at: string
  total_pedidos: number
  warnings: string[] | null
}

interface Profile {
  full_name: string
  role: string
  asesor_codigo: number | null
}

type ViewMode = 'resumen' | 'tabla'
type SortDir  = 'asc' | 'desc' | null
type SortKey  = keyof PedidoRow | null

// ============================================================
// HELPERS
// ============================================================
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

type SemaforoLevel = 'vencido' | 'hoy' | 'urgente' | 'pronto' | 'ok' | 'sin_fecha'

function getSemaforoLevel(days: number | null): SemaforoLevel {
  if (days === null) return 'sin_fecha'
  if (days < 0)  return 'vencido'
  if (days === 0) return 'hoy'
  if (days <= 3)  return 'urgente'
  if (days <= 7)  return 'pronto'
  return 'ok'
}

const SEM_CONFIG: Record<SemaforoLevel, { bg: string; text: string; dot: string; label: string; order: number }> = {
  vencido:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Vencido',   order: 0 },
  hoy:      { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Hoy',       order: 1 },
  urgente:  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: '≤3 días',   order: 2 },
  pronto:   { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: '4-7 días',  order: 3 },
  ok:       { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  label: '>7 días',   order: 4 },
  sin_fecha:{ bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Sin fecha', order: 5 },
}

const SEM_BAR_COLOR: Record<SemaforoLevel, string> = {
  vencido:  'bg-red-500',
  hoy:      'bg-red-400',
  urgente:  'bg-orange-400',
  pronto:   'bg-yellow-400',
  ok:       'bg-green-400',
  sin_fecha:'bg-gray-300',
}

function SemaforoBadge({ days }: { days: number | null }) {
  const level = getSemaforoLevel(days)
  const s = SEM_CONFIG[level]
  const label = days !== null && days < 0 ? `Vencido ${Math.abs(days)}d`
              : days !== null && days > 0  ? `${days}d`
              : s.label
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  )
}

function EmpresaBadge({ empresa }: { empresa: 'sllrt' | 'rv' }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-semibold
      ${empresa === 'sllrt' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
      {empresa === 'sllrt' ? 'SLL' : 'RV'}
    </span>
  )
}

function KpiCard({ title, value, sub, accent, icon: Icon }: {
  title: string; value: string; sub?: string
  accent?: 'red' | 'orange' | 'blue' | 'gray'
  icon?: React.ElementType
}) {
  const border = accent === 'red' ? 'border-l-red-400' : accent === 'orange' ? 'border-l-orange-400' : accent === 'blue' ? 'border-l-blue-400' : 'border-l-gray-200'
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${border} px-5 py-4`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
        {Icon && <Icon className="w-4 h-4 text-gray-300" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
  if (sortDir === 'asc')  return <ArrowUp className="w-3 h-3 text-blue-500" />
  return <ArrowDown className="w-3 h-3 text-blue-500" />
}

const PAGE_SIZE = 25

// ============================================================
// VISTA RESUMEN: barra semáforo global
// ============================================================
function SemaforoBar({ rows, onClick }: { rows: PedidoRow[]; onClick?: () => void }) {
  const counts = useMemo(() => {
    const c: Record<SemaforoLevel, number> = { vencido: 0, hoy: 0, urgente: 0, pronto: 0, ok: 0, sin_fecha: 0 }
    const seen = new Set<string>()
    for (const r of rows) {
      if (seen.has(r.numero_siigo)) continue
      seen.add(r.numero_siigo)
      c[getSemaforoLevel(r.semaforo)]++
    }
    return c
  }, [rows])

  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  if (total === 0) return null

  const levels: SemaforoLevel[] = ['vencido', 'hoy', 'urgente', 'pronto', 'ok', 'sin_fecha']

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Estado del portafolio · {total} pedidos únicos
        {onClick && <span className="ml-2 text-blue-400 font-normal normal-case tracking-normal">· Ver tabla →</span>}
      </p>

      <div className="flex rounded-full overflow-hidden h-4 gap-px">
        {levels.map(l => {
          const pct = (counts[l] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={l}
              className={`${SEM_BAR_COLOR[l]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${SEM_CONFIG[l].label}: ${counts[l]}`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {levels.map(l => counts[l] > 0 && (
          <div key={l} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${SEM_BAR_COLOR[l]}`} />
            <span className="text-xs text-gray-600">
              <span className="font-semibold text-gray-800">{counts[l]}</span>
              {' '}{SEM_CONFIG[l].label}
              <span className="text-gray-400"> ({((counts[l]/total)*100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// VISTA RESUMEN: cards por asesor (gerente) o por cliente (asesor)
// ============================================================
function MiniSemaforoBar({ counts, total }: { counts: Record<SemaforoLevel, number>; total: number }) {
  const levels: SemaforoLevel[] = ['vencido', 'hoy', 'urgente', 'pronto', 'ok', 'sin_fecha']
  return (
    <div className="flex rounded-full overflow-hidden h-1.5 gap-px mt-2">
      {levels.map(l => {
        const pct = (counts[l] / total) * 100
        if (pct === 0) return null
        return <div key={l} className={`${SEM_BAR_COLOR[l]}`} style={{ width: `${pct}%` }} />
      })}
    </div>
  )
}

function GroupCards({
  rows, groupBy, isProgram, onCardClick,
}: {
  rows: PedidoRow[]
  groupBy: 'asesor' | 'cliente'
  isProgram: boolean
  onCardClick?: (codigo: number, nombre: string) => void
}) {
  const groupsWithKeys = useMemo(() => {
    const map = new Map<string, { label: string; valor: number; cantidad: number; counts: Record<SemaforoLevel, number>; pedidos: Set<string>; empresas: Set<string> }>()
    for (const r of rows) {
      const key = groupBy === 'asesor' ? String(r.asesor_codigo) : String(r.cliente_nit)
      const label = groupBy === 'asesor' ? r.asesor_nombre.replace(/\s+/g, ' ').trim() : r.cliente_nombre.replace(/\s+/g, ' ').trim()
      if (!map.has(key)) map.set(key, { label, valor: 0, cantidad: 0, counts: { vencido: 0, hoy: 0, urgente: 0, pronto: 0, ok: 0, sin_fecha: 0 }, pedidos: new Set(), empresas: new Set() })
      const g = map.get(key)!
      g.valor += r.valor_pendiente; g.cantidad += r.cantidad_pendiente
      g.pedidos.add(r.numero_siigo); g.empresas.add(r.empresa)
      if (!g.pedidos.has(r.numero_siigo + '_counted')) { g.counts[getSemaforoLevel(r.semaforo)]++; g.pedidos.add(r.numero_siigo + '_counted') }
    }
    return [...map.entries()].sort(([,a], [,b]) => b.valor - a.valor)
  }, [rows, groupBy])

  const URGENCY_LABELS: Record<SemaforoLevel, string> = {
    vencido: 'vencido', hoy: 'vencido hoy', urgente: 'urgentes', pronto: 'próximos', ok: 'a tiempo', sin_fecha: 'sin fecha',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {groupsWithKeys.map(([rawKey, g], i) => {
        const total = Object.values(g.counts).reduce((s, n) => s + n, 0)
        const critical = g.counts.vencido + g.counts.hoy
        const urgent   = g.counts.urgente
        const mainLevel: SemaforoLevel = critical > 0 ? 'vencido' : urgent > 0 ? 'urgente' : g.counts.pronto > 0 ? 'pronto' : g.counts.ok > 0 ? 'ok' : 'sin_fecha'
        const cfg = SEM_CONFIG[mainLevel]
        const clickable = !!onCardClick && groupBy === 'asesor'

        return (
          <div
            key={i}
            className={`bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow
              ${clickable ? 'cursor-pointer hover:border-blue-300' : ''}`}
            onClick={clickable ? () => onCardClick!(Number(rawKey), g.label) : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{g.label}</p>
              {critical > 0 && (
                <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                  {critical}
                </span>
              )}
            </div>

            <MiniSemaforoBar counts={g.counts} total={total} />

            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">
                  {isProgram
                    ? `${g.cantidad.toLocaleString('es-CO')} uds`
                    : cop(g.valor)
                  }
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {total} pedido{total !== 1 ? 's' : ''}
                  {[...g.empresas].map(e => (
                    <span key={e} className={`ml-1 font-mono text-[10px] px-1 rounded ${e === 'sllrt' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {e === 'sllrt' ? 'SLL' : 'RV'}
                    </span>
                  ))}
                </p>
              </div>
              <div className="text-right">
                {critical > 0 && <p className={`text-xs font-medium ${cfg.text}`}>{critical} {URGENCY_LABELS[mainLevel]}</p>}
                {urgent > 0 && critical === 0 && <p className="text-xs font-medium text-orange-600">{urgent} urgentes</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// VISTA RESUMEN: próximas entregas
// ============================================================
function ProximasEntregas({
  rows,
  onPedidoClick,
}: {
  rows: PedidoRow[]
  onPedidoClick?: (key: string) => void
}) {
  const upcoming = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .filter(r => r.semaforo !== null && r.semaforo >= 0 && r.semaforo <= 14)
      .filter(r => {
        if (seen.has(r.numero_siigo)) return false
        seen.add(r.numero_siigo)
        return true
      })
      .sort((a, b) => (a.semaforo ?? 99) - (b.semaforo ?? 99))
      .slice(0, 12)
  }, [rows])

  if (upcoming.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Próximas entregas · 14 días
        </p>
      </div>
      <div className="space-y-1">
        {upcoming.map((r, i) => {
          const level = getSemaforoLevel(r.semaforo)
          const cfg   = SEM_CONFIG[level]
          const key   = `${r.empresa}:${r.numero_siigo}`
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-1 py-1.5 rounded-lg -mx-1
                ${onPedidoClick ? 'cursor-pointer hover:bg-blue-50/40 transition-colors' : ''}`}
              onClick={onPedidoClick ? () => onPedidoClick(key) : undefined}
            >
              <div className={`w-1 h-8 rounded-full ${SEM_BAR_COLOR[level]} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {r.cliente_nombre.replace(/\s+/g, ' ').trim()}
                  </p>
                  <EmpresaBadge empresa={r.empresa} />
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {r.pedido_vendedor ?? r.numero_siigo} · {r.asesor_nombre.replace(/\s+/g, ' ').trim()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${cfg.text}`}>
                  {r.semaforo === 0 ? 'Hoy' : `${r.semaforo}d`}
                </p>
                <p className="text-xs text-gray-400">{fmtDate(r.fecha_pactada)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function DashboardClient({
  pedidos,
  batch,
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pedidos: any[]
  batch: Batch | null
  profile: Profile | null
}) {
  const isGerente  = profile?.role === 'gerente'
  const isProgram  = profile?.role === 'programador'
  const showAsesor = isGerente || isProgram  // keep for backwards compat in filters
  const [viewMode, setViewMode] = useState<ViewMode>('resumen')

  // ── Expandir/colapsar pedidos (vista tabla) ───────────────
  const [expandedPedidos, setExpandedPedidos] = useState<Set<string>>(new Set())
  function togglePedido(key: string) {
    setExpandedPedidos(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Enriquecer con semáforo ───────────────────────────────
  const rows: PedidoRow[] = useMemo(() => {
    const today = new Date()
    return (pedidos as Pedido[]).map(p => ({
      ...p,
      semaforo: p.fecha_pactada ? calcSemaforo(new Date(p.fecha_pactada), today) : null,
    }))
  }, [pedidos])

  // ── Estado de filtros ─────────────────────────────────────
  const [empresaF,  setEmpresaF]  = useState<string[]>([])
  const [asesorF,   setAsesorF]   = useState<string[]>([])
  const [clienteF,  setClienteF]  = useState<string[]>([])
  const [lineaF,    setLineaF]    = useState<string[]>([])
  const [tipoIpF,   setTipoIpF]   = useState<string[]>([])
  const [calibreF,  setCalibreF]  = useState<string[]>([])
  const [semFiltro, setSemFiltro] = useState<string[]>([])
  const [busqueda,  setBusqueda]  = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('semaforo')
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')
  const [page,      setPage]      = useState(1)

  // ── Impersonación ─────────────────────────────────────────
  const { impersonateAs } = useImpersonation()

  // ── Panel stack (asesor → pedido con navegación back) ─────
  type Panel = { kind: 'asesor'; codigo: number; nombre: string } | { kind: 'pedido'; key: string }
  const [panels, setPanels] = useState<Panel[]>([])
  const topPanel = panels[panels.length - 1] ?? null

  function pushPanel(p: Panel) { setPanels(prev => [...prev, p]) }
  function popPanel()          { setPanels(prev => prev.slice(0, -1)) }
  function closeAllPanels()    { setPanels([]) }

  // ── Listas de opciones únicas ─────────────────────────────
  const asesores = useMemo(() =>
    [...new Map(rows.map(r => [r.asesor_codigo, r.asesor_nombre])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1])),
  [rows])

  const clientes = useMemo(() =>
    [...new Map(rows.map(r => [r.cliente_nit, r.cliente_nombre])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1])),
  [rows])

  const lineas = useMemo(() =>
    [...new Set(rows.map(r => r.linea).filter(Boolean))].sort(),
  [rows])

  const tiposIp = useMemo(() =>
    [...new Map(rows
      .filter(r => r.tipo_ip)
      .map(r => [r.tipo_ip!, r.tipo_ip_desc ?? r.tipo_ip!])
    ).entries()].sort((a, b) => a[0].localeCompare(b[0])),
  [rows])

  const calibres = useMemo(() =>
    [...new Map(rows
      .filter(r => r.calibre)
      .map(r => [r.calibre!, r.calibre_desc ?? r.calibre!])
    ).entries()].sort((a, b) => a[0].localeCompare(b[0])),
  [rows])

  // Derived flags considering impersonation
  const effectiveIsGerente = isGerente && !impersonateAs
  const showAsesorCol      = (isGerente || isProgram) && !impersonateAs

  // ── Filtrar ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase()
    return rows.filter(r => {
      if (impersonateAs && impersonateAs.codigo !== null && r.asesor_codigo !== impersonateAs.codigo) return false
      if (empresaF.length > 0 && !empresaF.includes(r.empresa)) return false
      if (asesorF.length  > 0 && !asesorF.includes(String(r.asesor_codigo))) return false
      if (clienteF.length > 0 && !clienteF.includes(String(r.cliente_nit)))  return false
      if (lineaF.length   > 0 && !lineaF.includes(r.linea))                  return false
      if (tipoIpF.length  > 0 && !tipoIpF.includes(r.tipo_ip ?? ''))         return false
      if (calibreF.length > 0 && !calibreF.includes(r.calibre ?? ''))        return false
      if (semFiltro.length > 0 && !semFiltro.includes(getSemaforoLevel(r.semaforo))) return false
      if (q) {
        const hay = [r.cliente_nombre, r.numero_siigo, r.pedido_vendedor ?? '', r.descripcion, r.producto_codigo]
          .some(v => v.toLowerCase().includes(q))
        if (!hay) return false
      }
      return true
    })
  }, [rows, impersonateAs, empresaF, asesorF, clienteF, lineaF, tipoIpF, calibreF, semFiltro, busqueda])

  // ── Ordenar ───────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? (sortKey === 'semaforo' ? 9999 : '')
      const vb = b[sortKey] ?? (sortKey === 'semaforo' ? 9999 : '')
      if (typeof va === 'number' && typeof vb === 'number')
        return sortDir === 'asc' ? va - vb : vb - va
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
  }, [filtered, sortKey, sortDir])

  // ── Agrupar por pedido (para vista tabla) ─────────────────
  const groupedPedidos = useMemo(() => {
    const groups = new Map<string, PedidoRow[]>()
    for (const row of sorted) {
      const key = `${row.empresa}:${row.numero_siigo}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }
    return [...groups.values()]
  }, [sorted])

  // ── Paginar (por grupos de pedido) ────────────────────────
  const totalPages  = Math.max(1, Math.ceil(groupedPedidos.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageGroups  = groupedPedidos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key); setSortDir('asc')
    }
    setPage(1)
  }

  function onFilterChange(fn: () => void) {
    fn()
    setPage(1)
    setExpandedPedidos(new Set())
  }

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const valorTotal    = filtered.reduce((s, r) => s + r.valor_pendiente, 0)
    const cantTotal     = filtered.reduce((s, r) => s + r.cantidad_pendiente, 0)
    const vencidos      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo < 0).map(r => r.numero_siigo)).size
    const urgentes      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo >= 0 && r.semaforo <= 3).map(r => r.numero_siigo)).size
    const pedidosUnicos = new Set(filtered.map(r => r.numero_siigo)).size
    return { valorTotal, cantTotal, vencidos, urgentes, pedidosUnicos }
  }, [filtered])

  // ── Clases reutilizables (tabla) ──────────────────────────
  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-gray-700'
  const tdClass = 'px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap'

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className={thClass} onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
        </span>
      </th>
    )
  }

  const colCount = (isGerente && !impersonateAs) ? 13 : 12

  // ── Sin datos ─────────────────────────────────────────────
  if (!batch) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-gray-500 font-medium">No hay datos cargados aún</p>
          <p className="text-sm text-gray-400">Sube los archivos de SIIGO para comenzar</p>
        </div>
      </div>
    )
  }

  const hasFilters = empresaF.length > 0 || asesorF.length > 0 || clienteF.length > 0 ||
                     lineaF.length > 0 || tipoIpF.length > 0 || calibreF.length > 0 ||
                     semFiltro.length > 0 || !!busqueda

  // Active chips for multi-select filters
  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = []
    for (const v of empresaF) {
      const label = v === 'sllrt' ? 'SELLARTE' : 'RV'
      chips.push({ id: `e:${v}`, label, onRemove: () => { onFilterChange(() => setEmpresaF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of asesorF) {
      const nom = asesores.find(([cod]) => String(cod) === v)?.[1] ?? v
      chips.push({ id: `a:${v}`, label: nom.replace(/\s+/g,' ').trim(), onRemove: () => { onFilterChange(() => setAsesorF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of clienteF) {
      const nom = clientes.find(([nit]) => String(nit) === v)?.[1] ?? v
      chips.push({ id: `c:${v}`, label: nom.replace(/\s+/g,' ').trim(), onRemove: () => { onFilterChange(() => setClienteF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of lineaF) {
      chips.push({ id: `l:${v}`, label: v, onRemove: () => { onFilterChange(() => setLineaF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of tipoIpF) {
      const desc = tiposIp.find(([cod]) => cod === v)?.[1] ?? v
      chips.push({ id: `t:${v}`, label: `${v} – ${desc}`, onRemove: () => { onFilterChange(() => setTipoIpF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of calibreF) {
      const desc = calibres.find(([cod]) => cod === v)?.[1] ?? v
      chips.push({ id: `k:${v}`, label: desc, onRemove: () => { onFilterChange(() => setCalibreF(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    for (const v of semFiltro) {
      const label = SEM_CONFIG[v as SemaforoLevel]?.label ?? v
      chips.push({ id: `s:${v}`, label, onRemove: () => { onFilterChange(() => setSemFiltro(prev => prev.filter(x => x !== v))); setPage(1) } })
    }
    return chips
  }, [empresaF, asesorF, clienteF, lineaF, tipoIpF, calibreF, semFiltro, asesores, clientes, tiposIp, calibres]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-4 min-w-0">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Dashboard de Pedidos</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Datos al {fmtDate(batch.fecha_datos)} · Cargado por {batch.uploaded_by_name}
              {batch.warnings && batch.warnings.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {batch.warnings.length} advertencias
                </span>
              )}
            </p>
          </div>

          {/* Toggle de vista */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setViewMode('resumen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${viewMode === 'resumen' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Resumen
            </button>
            <button
              onClick={() => setViewMode('tabla')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${viewMode === 'tabla' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Table2 className="w-3.5 h-3.5" /> Tabla
            </button>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isProgram
            ? <KpiCard title="Total unidades"   value={kpis.cantTotal.toLocaleString('es-CO')} sub={`${filtered.length} líneas`} accent="blue" icon={CheckCircle2} />
            : <KpiCard title="Valor pendiente"  value={cop(kpis.valorTotal)}                   accent="blue" icon={CheckCircle2} />
          }
          <KpiCard title="Pedidos vencidos"   value={String(kpis.vencidos)}   sub="fecha pactada superada"  accent="red"    icon={TrendingDown} />
          <KpiCard title="Urgentes (≤3 días)" value={String(kpis.urgentes)}   sub="pedidos · días hábiles"  accent="orange" icon={Clock} />
          <KpiCard title="Pedidos únicos"     value={String(kpis.pedidosUnicos)} sub={`${filtered.length} líneas`} icon={Calendar} />
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente, pedido, producto…"
                value={busqueda}
                onChange={e => onFilterChange(() => setBusqueda(e.target.value))}
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-60
                  focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
              />
            </div>

            <MultiFilter
              label="Empresa"
              options={[['sllrt', 'SELLARTE'], ['rv', 'RV']]}
              selected={empresaF}
              onChange={v => onFilterChange(() => setEmpresaF(v))}
            />

            {showAsesorCol && (
              <MultiFilter
                label="Asesor"
                options={asesores.map(([cod, nom]) => [String(cod), nom.replace(/\s+/g, ' ').trim()])}
                selected={asesorF}
                onChange={v => onFilterChange(() => setAsesorF(v))}
                placeholder="Buscar asesor…"
              />
            )}

            <MultiFilter
              label="Cliente"
              options={clientes.map(([nit, nom]) => [String(nit), nom.replace(/\s+/g, ' ').trim()])}
              selected={clienteF}
              onChange={v => onFilterChange(() => setClienteF(v))}
              placeholder="Buscar cliente…"
            />

            {lineas.length > 0 && (
              <MultiFilter
                label="Línea"
                options={lineas.map(l => [l, l])}
                selected={lineaF}
                onChange={v => onFilterChange(() => setLineaF(v))}
                placeholder="Buscar línea…"
              />
            )}

            {tiposIp.length > 0 && (
              <MultiFilter
                label="Tipo IP"
                options={tiposIp.map(([cod, desc]) => [cod, `${cod} – ${desc}`])}
                selected={tipoIpF}
                onChange={v => onFilterChange(() => setTipoIpF(v))}
                placeholder="Buscar tipo…"
              />
            )}

            {calibres.length > 0 && (
              <MultiFilter
                label="Calibre"
                options={calibres.map(([cod, desc]) => [cod, desc])}
                selected={calibreF}
                onChange={v => onFilterChange(() => setCalibreF(v))}
                placeholder="Buscar calibre…"
              />
            )}

            <MultiFilter
              label="Semáforo"
              options={[
                ['vencido',   'Vencidos'],
                ['hoy',       'Vence hoy'],
                ['urgente',   'Urgentes (≤3d)'],
                ['pronto',    'Próximos (4-7d)'],
                ['ok',        'A tiempo (>7d)'],
                ['sin_fecha', 'Sin fecha'],
              ]}
              selected={semFiltro}
              onChange={v => onFilterChange(() => setSemFiltro(v))}
            />

            {hasFilters && (
              <button
                onClick={() => {
                  setEmpresaF([]); setAsesorF([]); setClienteF([])
                  setLineaF([]); setTipoIpF([]); setCalibreF([])
                  setSemFiltro([]); setBusqueda(''); setPage(1)
                  setExpandedPedidos(new Set())
                }}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {/* Active chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              {activeChips.map(chip => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                    text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {chip.label}
                  <button
                    onClick={chip.onRemove}
                    className="hover:text-blue-900 font-bold leading-none"
                    aria-label={`Quitar filtro ${chip.label}`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Vista Resumen ── */}
        {viewMode === 'resumen' && (
          <div className="space-y-4">
            <SemaforoBar rows={filtered} onClick={() => setViewMode('tabla')} />

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {effectiveIsGerente ? 'Por asesor' : 'Por cliente'}
              </p>
              <GroupCards
                rows={filtered}
                groupBy={effectiveIsGerente ? 'asesor' : 'cliente'}
                isProgram={isProgram}
                onCardClick={effectiveIsGerente
                  ? (codigo, nombre) => pushPanel({ kind: 'asesor', codigo, nombre })
                  : undefined}
              />
            </div>

            <ProximasEntregas
              rows={filtered}
              onPedidoClick={key => pushPanel({ kind: 'pedido', key })}
            />
          </div>
        )}

        {/* ── Vista Tabla ── */}
        {viewMode === 'tabla' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-8 px-2" />
                    <Th col="semaforo"           label="Semáforo" />
                    <th className={thClass}>Empresa</th>
                    <Th col="pedido_vendedor"    label="# Vendedor" />
                    <Th col="numero_siigo"       label="# SIIGO" />
                    {showAsesorCol && <Th col="asesor_nombre" label="Asesor" />}
                    <Th col="cliente_nombre"     label="Cliente" />
                    <Th col="descripcion"        label="Descripción" />
                    <Th col="linea"              label="Línea" />
                    <Th col="cantidad_pendiente" label="Cant. Pend." />
                    {!isProgram && <Th col="valor_pendiente" label="Valor Pend." />}
                    <Th col="fecha_pedido"       label="F. Pedido" />
                    <Th col="fecha_pactada"      label="F. Pactada" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageGroups.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-gray-400">
                        No hay pedidos con los filtros actuales
                      </td>
                    </tr>
                  ) : pageGroups.map(group => {
                    const first = group[0]
                    const gKey = `${first.empresa}:${first.numero_siigo}`
                    const isExpanded = expandedPedidos.has(gKey)
                    const totalValor    = group.reduce((s, r) => s + r.valor_pendiente, 0)
                    const totalCantidad = group.reduce((s, r) => s + r.cantidad_pendiente, 0)

                    return (
                      <Fragment key={gKey}>
                        {/* ── Fila pedido (colapsable / detail) ── */}
                        <tr
                          className="bg-gray-50/80 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          onClick={() => pushPanel({ kind: 'pedido', key: gKey })}
                        >
                          <td
                            className="px-2 py-2.5 text-gray-400 text-center"
                            onClick={e => { e.stopPropagation(); togglePedido(gKey) }}
                          >
                            {isExpanded
                              ? <ChevronDown  className="w-3.5 h-3.5 inline hover:text-blue-600" />
                              : <ChevronRight className="w-3.5 h-3.5 inline hover:text-blue-600" />
                            }
                          </td>
                          <td className={tdClass}><SemaforoBadge days={first.semaforo} /></td>
                          <td className={tdClass}><EmpresaBadge empresa={first.empresa} /></td>
                          <td className={tdClass + ' font-mono text-xs'}>
                            {first.pedido_vendedor ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className={tdClass + ' font-mono text-xs font-semibold'}>{first.numero_siigo}</td>
                          {showAsesorCol && (
                            <td className={tdClass + ' max-w-[140px] truncate hidden sm:table-cell'} title={first.asesor_nombre}>
                              {first.asesor_nombre.replace(/\s+/g,' ').trim()}
                            </td>
                          )}
                          <td className={tdClass + ' max-w-[180px] truncate'} title={first.cliente_nombre}>
                            {first.cliente_nombre.replace(/\s+/g,' ').trim()}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <span className="text-xs text-gray-400 italic">
                              {group.length} producto{group.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-300 text-xs hidden sm:table-cell">—</td>
                          <td className={tdClass + ' text-right tabular-nums font-medium'}>
                            {totalCantidad.toLocaleString('es-CO')}
                          </td>
                          {!isProgram && (
                            <td className={tdClass + ' text-right tabular-nums font-semibold'}>
                              {cop(totalValor)}
                            </td>
                          )}
                          <td className={tdClass + ' text-gray-400 text-xs hidden sm:table-cell'}>{fmtDate(first.fecha_pedido)}</td>
                          <td className={tdClass + ' text-xs'}>{fmtDate(first.fecha_pactada)}</td>
                        </tr>

                        {/* ── Filas de productos (expandidas) ── */}
                        {isExpanded && group.map((line, li) => (
                          <tr key={`${gKey}-${li}`} className="bg-blue-50/20 hover:bg-blue-50/40 border-l-2 border-l-blue-100">
                            <td className="px-2 py-2 text-center">
                              <span className="text-gray-300 text-xs">└</span>
                            </td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-xs text-gray-400 font-mono hidden sm:table-cell">
                              {line.referencia || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 font-mono hidden sm:table-cell">
                              {line.producto_codigo}
                            </td>
                            {showAsesorCol && <td className="px-3 py-2 hidden sm:table-cell" />}
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-sm text-gray-700 max-w-[200px] hidden sm:table-cell">
                              <span className="truncate block" title={line.descripcion}>
                                {line.descripcion.replace(/\s+/g,' ').trim()}
                              </span>
                            </td>
                            <td className="px-3 py-2 hidden sm:table-cell">
                              {line.linea
                                ? <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{line.linea}</span>
                                : <span className="text-gray-300 text-xs">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 text-right tabular-nums">
                              {line.cantidad_pendiente.toLocaleString('es-CO')}
                            </td>
                            {!isProgram && (
                              <td className="px-3 py-2 text-sm text-gray-600 text-right tabular-nums">
                                {cop(line.valor_pendiente)}
                              </td>
                            )}
                            <td className="px-3 py-2 hidden sm:table-cell" />
                            <td className="px-3 py-2" />
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  {groupedPedidos.length} pedido{groupedPedidos.length !== 1 ? 's' : ''}
                  {' '}· {sorted.length} líneas · página {currentPage} de {totalPages}
                </p>
                <div className="flex gap-1">
                  {(() => {
                    const pages: number[] = []
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i)
                    } else {
                      const start = Math.max(2, currentPage - 2)
                      const end   = Math.min(totalPages - 1, currentPage + 2)
                      pages.push(1)
                      for (let i = start; i <= end; i++) pages.push(i)
                      pages.push(totalPages)
                    }
                    return [...new Set(pages)].map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors
                          ${p === currentPage ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                        {p}
                      </button>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {/* ── PedidoDetailPanel ── */}
    {/* ── Panel stack ── */}
    {topPanel?.kind === 'asesor' && (
      <AsesorDetailPanel
        asesorCodigo={topPanel.codigo}
        asesorNombre={topPanel.nombre}
        rows={rows as AsesorPanelRow[]}
        onClose={closeAllPanels}
        onPedidoClick={key => pushPanel({ kind: 'pedido', key })}
      />
    )}

    {topPanel?.kind === 'pedido' && (() => {
      const group = rows
        .reduce<PedidoRow[][]>((acc, r) => {
          const k = `${r.empresa}:${r.numero_siigo}`
          if (k !== topPanel.key) return acc
          const existing = acc.find(g => `${g[0].empresa}:${g[0].numero_siigo}` === k)
          if (existing) { existing.push(r) } else { acc.push([r]) }
          return acc
        }, [])
        .find(g => `${g[0].empresa}:${g[0].numero_siigo}` === topPanel.key)
      if (!group) return null
      const first = group[0]
      const pedido: PedidoDetail = {
        empresa:         first.empresa,
        numero_siigo:    first.numero_siigo,
        pedido_vendedor: first.pedido_vendedor,
        asesor_nombre:   first.asesor_nombre,
        cliente_nombre:  first.cliente_nombre,
        fecha_pactada:   first.fecha_pactada,
        semaforo:        first.semaforo,
        cantidad:        group.reduce((s, r) => s + r.cantidad_pendiente, 0),
        nlineas:         group.length,
      }
      const lines: PedidoLine[] = group.map(r => ({
        sec:                   r.sec,
        producto_codigo:       r.producto_codigo,
        descripcion:           r.descripcion,
        linea:                 r.linea,
        tipo_ip:               r.tipo_ip,
        tipo_ip_desc:          r.tipo_ip_desc,
        calibre:               r.calibre,
        calibre_desc:          r.calibre_desc,
        cantidad_pedida:       r.cantidad_pedida,
        cantidad_pendiente:    r.cantidad_pendiente,
        valor_pendiente:       r.valor_pendiente,
        fecha_entrega_parcial: r.fecha_entrega_parcial,
      }))
      const hasBack = panels.length > 1
      return (
        <PedidoDetailPanel
          pedido={pedido}
          lines={lines}
          onClose={closeAllPanels}
          onBack={hasBack ? popPanel : undefined}
          isProgram={isProgram}
        />
      )
    })()}
    </>
  )
}
