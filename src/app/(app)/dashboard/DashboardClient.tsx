'use client'

import { useMemo, useState, Fragment } from 'react'
import {
  AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Search,
  LayoutGrid, Table2, TrendingDown, Clock, Calendar, CheckCircle2,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { calcSemaforo } from '@/lib/parser/holidays'

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
function SemaforoBar({ rows }: { rows: PedidoRow[] }) {
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Estado del portafolio · {total} pedidos únicos
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

function GroupCards({ rows, groupBy }: { rows: PedidoRow[]; groupBy: 'asesor' | 'cliente' }) {
  const groups = useMemo(() => {
    const map = new Map<string, {
      label: string
      valor: number
      counts: Record<SemaforoLevel, number>
      pedidos: Set<string>
      empresas: Set<string>
    }>()

    for (const r of rows) {
      const key = groupBy === 'asesor' ? String(r.asesor_codigo) : String(r.cliente_nit)
      const label = groupBy === 'asesor'
        ? r.asesor_nombre.replace(/\s+/g, ' ').trim()
        : r.cliente_nombre.replace(/\s+/g, ' ').trim()

      if (!map.has(key)) {
        map.set(key, {
          label,
          valor: 0,
          counts: { vencido: 0, hoy: 0, urgente: 0, pronto: 0, ok: 0, sin_fecha: 0 },
          pedidos: new Set(),
          empresas: new Set(),
        })
      }
      const g = map.get(key)!
      g.valor += r.valor_pendiente
      g.pedidos.add(r.numero_siigo)
      g.empresas.add(r.empresa)
      if (!g.pedidos.has(r.numero_siigo + '_counted')) {
        g.counts[getSemaforoLevel(r.semaforo)]++
        g.pedidos.add(r.numero_siigo + '_counted')
      }
    }

    return [...map.values()].sort((a, b) => b.valor - a.valor)
  }, [rows, groupBy])

  const URGENCY_LABELS: Record<SemaforoLevel, string> = {
    vencido: 'vencido', hoy: 'vencido hoy', urgente: 'urgentes', pronto: 'próximos', ok: 'a tiempo', sin_fecha: 'sin fecha',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {groups.map((g, i) => {
        const total = Object.values(g.counts).reduce((s, n) => s + n, 0)
        const critical = g.counts.vencido + g.counts.hoy
        const urgent   = g.counts.urgente
        const mainLevel: SemaforoLevel = critical > 0 ? 'vencido' : urgent > 0 ? 'urgente' : g.counts.pronto > 0 ? 'pronto' : g.counts.ok > 0 ? 'ok' : 'sin_fecha'
        const cfg = SEM_CONFIG[mainLevel]

        return (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
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
                <p className="text-base font-bold text-gray-900">{cop(g.valor)}</p>
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
function ProximasEntregas({ rows }: { rows: PedidoRow[] }) {
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
      <div className="space-y-2">
        {upcoming.map((r, i) => {
          const level = getSemaforoLevel(r.semaforo)
          const cfg   = SEM_CONFIG[level]
          return (
            <div key={i} className="flex items-center gap-3">
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
  const isGerente = profile?.role === 'gerente'
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
  const [empresa,   setEmpresa]   = useState<string>('todas')
  const [asesorF,   setAsesorF]   = useState<string>('todos')
  const [clienteF,  setClienteF]  = useState<string>('todos')
  const [lineaF,    setLineaF]    = useState<string>('todas')
  const [semFiltro, setSemFiltro] = useState<string>('todos')
  const [busqueda,  setBusqueda]  = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('semaforo')
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')
  const [page,      setPage]      = useState(1)

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

  // ── Filtrar ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase()
    return rows.filter(r => {
      if (empresa   !== 'todas' && r.empresa !== empresa) return false
      if (asesorF   !== 'todos' && String(r.asesor_codigo) !== asesorF) return false
      if (clienteF  !== 'todos' && String(r.cliente_nit)   !== clienteF) return false
      if (lineaF    !== 'todas' && r.linea !== lineaF) return false
      if (semFiltro === 'vencido'   && (r.semaforo === null || r.semaforo >= 0)) return false
      if (semFiltro === 'urgente'   && (r.semaforo === null || r.semaforo < 0 || r.semaforo > 3)) return false
      if (semFiltro === 'pronto'    && (r.semaforo === null || r.semaforo <= 3 || r.semaforo > 7)) return false
      if (semFiltro === 'ok'        && (r.semaforo === null || r.semaforo <= 7)) return false
      if (semFiltro === 'sin_fecha' && r.semaforo !== null) return false
      if (q) {
        const hay = [r.cliente_nombre, r.numero_siigo, r.pedido_vendedor ?? '', r.descripcion, r.producto_codigo]
          .some(v => v.toLowerCase().includes(q))
        if (!hay) return false
      }
      return true
    })
  }, [rows, empresa, asesorF, clienteF, lineaF, semFiltro, busqueda])

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
    const vencidos      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo < 0).map(r => r.numero_siigo)).size
    const urgentes      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo >= 0 && r.semaforo <= 3).map(r => r.numero_siigo)).size
    const pedidosUnicos = new Set(filtered.map(r => r.numero_siigo)).size
    return { valorTotal, vencidos, urgentes, pedidosUnicos }
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

  const colCount = isGerente ? 13 : 12

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

  const hasFilters = empresa !== 'todas' || asesorF !== 'todos' || clienteF !== 'todos' || lineaF !== 'todas' || semFiltro !== 'todos' || busqueda

  return (
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
          <KpiCard title="Valor pendiente"    value={cop(kpis.valorTotal)}             accent="blue"   icon={CheckCircle2} />
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

            <select value={empresa} onChange={e => onFilterChange(() => setEmpresa(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todas">Todas las empresas</option>
              <option value="sllrt">SELLARTE</option>
              <option value="rv">RV</option>
            </select>

            {isGerente && (
              <select value={asesorF} onChange={e => onFilterChange(() => setAsesorF(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="todos">Todos los asesores</option>
                {asesores.map(([cod, nom]) => (
                  <option key={cod} value={String(cod)}>{nom.replace(/\s+/g, ' ').trim()}</option>
                ))}
              </select>
            )}

            <select value={clienteF} onChange={e => onFilterChange(() => setClienteF(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todos">Todos los clientes</option>
              {clientes.map(([nit, nom]) => (
                <option key={nit} value={String(nit)}>{nom.replace(/\s+/g, ' ').trim()}</option>
              ))}
            </select>

            <select value={lineaF} onChange={e => onFilterChange(() => setLineaF(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todas">Todas las líneas</option>
              {lineas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select value={semFiltro} onChange={e => onFilterChange(() => setSemFiltro(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todos">Semáforo: todos</option>
              <option value="vencido">Vencidos</option>
              <option value="urgente">Urgentes (≤3d)</option>
              <option value="pronto">Próximos (4-7d)</option>
              <option value="ok">A tiempo (&gt;7d)</option>
              <option value="sin_fecha">Sin fecha pactada</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => {
                  setEmpresa('todas'); setAsesorF('todos'); setClienteF('todos')
                  setLineaF('todas'); setSemFiltro('todos'); setBusqueda(''); setPage(1)
                  setExpandedPedidos(new Set())
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Vista Resumen ── */}
        {viewMode === 'resumen' && (
          <div className="space-y-4">
            <SemaforoBar rows={filtered} />

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {isGerente ? 'Por asesor' : 'Por cliente'}
              </p>
              <GroupCards rows={filtered} groupBy={isGerente ? 'asesor' : 'cliente'} />
            </div>

            <ProximasEntregas rows={filtered} />
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
                    {isGerente && <Th col="asesor_nombre" label="Asesor" />}
                    <Th col="cliente_nombre"     label="Cliente" />
                    <Th col="descripcion"        label="Descripción" />
                    <Th col="linea"              label="Línea" />
                    <Th col="cantidad_pendiente" label="Cant. Pend." />
                    <Th col="valor_pendiente"    label="Valor Pend." />
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
                        {/* ── Fila pedido (colapsable) ── */}
                        <tr
                          className="bg-gray-50/80 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          onClick={() => togglePedido(gKey)}
                        >
                          <td className="px-2 py-2.5 text-gray-400 text-center">
                            {isExpanded
                              ? <ChevronDown  className="w-3.5 h-3.5 inline" />
                              : <ChevronRight className="w-3.5 h-3.5 inline" />
                            }
                          </td>
                          <td className={tdClass}><SemaforoBadge days={first.semaforo} /></td>
                          <td className={tdClass}><EmpresaBadge empresa={first.empresa} /></td>
                          <td className={tdClass + ' font-mono text-xs'}>
                            {first.pedido_vendedor ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className={tdClass + ' font-mono text-xs font-semibold'}>{first.numero_siigo}</td>
                          {isGerente && (
                            <td className={tdClass + ' max-w-[140px] truncate'} title={first.asesor_nombre}>
                              {first.asesor_nombre.replace(/\s+/g,' ').trim()}
                            </td>
                          )}
                          <td className={tdClass + ' max-w-[180px] truncate'} title={first.cliente_nombre}>
                            {first.cliente_nombre.replace(/\s+/g,' ').trim()}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-gray-400 italic">
                              {group.length} producto{group.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-300 text-xs">—</td>
                          <td className={tdClass + ' text-right tabular-nums font-medium'}>
                            {totalCantidad.toLocaleString('es-CO')}
                          </td>
                          <td className={tdClass + ' text-right tabular-nums font-semibold'}>
                            {cop(totalValor)}
                          </td>
                          <td className={tdClass + ' text-gray-400 text-xs'}>{fmtDate(first.fecha_pedido)}</td>
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
                            <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                              {line.referencia || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                              {line.producto_codigo}
                            </td>
                            {isGerente && <td className="px-3 py-2" />}
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-sm text-gray-700 max-w-[200px]">
                              <span className="truncate block" title={line.descripcion}>
                                {line.descripcion.replace(/\s+/g,' ').trim()}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {line.linea
                                ? <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{line.linea}</span>
                                : <span className="text-gray-300 text-xs">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 text-right tabular-nums">
                              {line.cantidad_pendiente.toLocaleString('es-CO')}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 text-right tabular-nums">
                              {cop(line.valor_pendiente)}
                            </td>
                            <td className="px-3 py-2" />
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
  )
}
