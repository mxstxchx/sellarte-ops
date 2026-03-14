'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
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

type SortDir = 'asc' | 'desc' | null
type SortKey = keyof PedidoRow | null

function getSemaforoStyle(days: number | null): {
  bg: string; text: string; label: string; dot: string; order: number
} {
  if (days === null)  return { bg: 'bg-gray-100',   text: 'text-gray-500',  dot: 'bg-gray-400',   label: 'Sin fecha',               order: 99 }
  if (days < 0)       return { bg: 'bg-red-100',    text: 'text-red-700',   dot: 'bg-red-500',    label: `Vencido ${Math.abs(days)}d`, order: 0 }
  if (days === 0)     return { bg: 'bg-red-100',    text: 'text-red-700',   dot: 'bg-red-500',    label: 'Vence hoy',               order: 1 }
  if (days <= 3)      return { bg: 'bg-orange-100', text: 'text-orange-700',dot: 'bg-orange-500', label: `${days}d`,                order: 2 }
  if (days <= 7)      return { bg: 'bg-yellow-100', text: 'text-yellow-700',dot: 'bg-yellow-500', label: `${days}d`,                order: 3 }
  return               { bg: 'bg-green-100',  text: 'text-green-700', dot: 'bg-green-500',  label: `${days}d`,                order: 4 }
}

// ============================================================
// SUB-COMPONENTES
// ============================================================
function SemaforoBadge({ days }: { days: number | null }) {
  const s = getSemaforoStyle(days)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
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

function KpiCard({ title, value, sub, accent }: {
  title: string; value: string; sub?: string; accent?: 'red' | 'orange' | 'blue' | 'gray'
}) {
  const border = accent === 'red' ? 'border-l-red-400' : accent === 'orange' ? 'border-l-orange-400' : accent === 'blue' ? 'border-l-blue-400' : 'border-l-gray-200'
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${border} px-5 py-4`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
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

  const lineas = useMemo(() =>
    [...new Set(rows.map(r => r.linea).filter(Boolean))].sort(),
  [rows])

  // ── Filtrar ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase()
    return rows.filter(r => {
      if (empresa !== 'todas' && r.empresa !== empresa) return false
      if (asesorF !== 'todos' && String(r.asesor_codigo) !== asesorF) return false
      if (lineaF  !== 'todas' && r.linea !== lineaF) return false
      if (semFiltro === 'vencido'  && (r.semaforo === null || r.semaforo >= 0)) return false
      if (semFiltro === 'urgente'  && (r.semaforo === null || r.semaforo < 0 || r.semaforo > 3)) return false
      if (semFiltro === 'pronto'   && (r.semaforo === null || r.semaforo <= 3 || r.semaforo > 7)) return false
      if (semFiltro === 'ok'       && (r.semaforo === null || r.semaforo <= 7)) return false
      if (semFiltro === 'sin_fecha' && r.semaforo !== null) return false
      if (q) {
        const hay = [r.cliente_nombre, r.numero_siigo, r.pedido_vendedor ?? '', r.descripcion, r.producto_codigo]
          .some(v => v.toLowerCase().includes(q))
        if (!hay) return false
      }
      return true
    })
  }, [rows, empresa, asesorF, lineaF, semFiltro, busqueda])

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

  // ── Paginar ───────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function onFilterChange(fn: () => void) { fn(); setPage(1) }

  // ── KPIs (sobre datos filtrados) ──────────────────────────
  const kpis = useMemo(() => {
    const valorTotal    = filtered.reduce((s, r) => s + r.valor_pendiente, 0)
    const vencidos      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo < 0).map(r => r.numero_siigo)).size
    const urgentes      = new Set(filtered.filter(r => r.semaforo !== null && r.semaforo >= 0 && r.semaforo <= 3).map(r => r.numero_siigo)).size
    const pedidosUnicos = new Set(filtered.map(r => r.numero_siigo)).size
    return { valorTotal, vencidos, urgentes, pedidosUnicos }
  }, [filtered])

  // ── Columnas ──────────────────────────────────────────────
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-5 min-w-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
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
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Valor pendiente"    value={cop(kpis.valorTotal)}          accent="blue" />
          <KpiCard title="Pedidos vencidos"   value={String(kpis.vencidos)}   sub="fecha pactada superada"   accent="red" />
          <KpiCard title="Urgentes (≤3 días)" value={String(kpis.urgentes)}   sub="pedidos · días hábiles"   accent="orange" />
          <KpiCard title="Pedidos únicos"     value={String(kpis.pedidosUnicos)} sub={`${filtered.length} líneas`} />
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">

            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente, pedido, producto…"
                value={busqueda}
                onChange={e => onFilterChange(() => setBusqueda(e.target.value))}
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-60
                  focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Empresa */}
            <select value={empresa} onChange={e => onFilterChange(() => setEmpresa(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todas">Todas las empresas</option>
              <option value="sllrt">SELLARTE</option>
              <option value="rv">RV</option>
            </select>

            {/* Asesor (solo gerente) */}
            {isGerente && (
              <select value={asesorF} onChange={e => onFilterChange(() => setAsesorF(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="todos">Todos los asesores</option>
                {asesores.map(([cod, nom]) => (
                  <option key={cod} value={String(cod)}>{nom.replace(/\s+/g, ' ').trim()}</option>
                ))}
              </select>
            )}

            {/* Línea */}
            <select value={lineaF} onChange={e => onFilterChange(() => setLineaF(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todas">Todas las líneas</option>
              {lineas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Semáforo */}
            <select value={semFiltro} onChange={e => onFilterChange(() => setSemFiltro(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="todos">Semáforo: todos</option>
              <option value="vencido">Vencidos</option>
              <option value="urgente">Urgentes (≤3d)</option>
              <option value="pronto">Próximos (4-7d)</option>
              <option value="ok">A tiempo (&gt;7d)</option>
              <option value="sin_fecha">Sin fecha pactada</option>
            </select>

            {/* Limpiar */}
            {(empresa !== 'todas' || asesorF !== 'todos' || lineaF !== 'todas' || semFiltro !== 'todos' || busqueda) && (
              <button
                onClick={() => { setEmpresa('todas'); setAsesorF('todos'); setLineaF('todas'); setSemFiltro('todos'); setBusqueda(''); setPage(1) }}
                className="text-xs text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th col="semaforo"         label="Semáforo" />
                  <th className={thClass}>Empresa</th>
                  <Th col="pedido_vendedor"  label="# Vendedor" />
                  <Th col="numero_siigo"     label="# SIIGO" />
                  {isGerente && <Th col="asesor_nombre" label="Asesor" />}
                  <Th col="cliente_nombre"   label="Cliente" />
                  <Th col="descripcion"      label="Descripción" />
                  <Th col="linea"            label="Línea" />
                  <Th col="cantidad_pendiente" label="Cant. Pend." />
                  <Th col="valor_pendiente"  label="Valor Pend." />
                  <Th col="fecha_pedido"     label="F. Pedido" />
                  <Th col="fecha_pactada"    label="F. Pactada" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={isGerente ? 12 : 11} className="px-3 py-10 text-center text-sm text-gray-400">
                      No hay pedidos con los filtros actuales
                    </td>
                  </tr>
                ) : pageRows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className={tdClass}><SemaforoBadge days={r.semaforo} /></td>
                    <td className={tdClass}><EmpresaBadge empresa={r.empresa} /></td>
                    <td className={tdClass + ' font-mono text-xs'}>{r.pedido_vendedor ?? <span className="text-gray-300">—</span>}</td>
                    <td className={tdClass + ' font-mono text-xs'}>{r.numero_siigo}</td>
                    {isGerente && <td className={tdClass + ' max-w-[140px] truncate'} title={r.asesor_nombre}>{r.asesor_nombre.replace(/\s+/g,' ').trim()}</td>}
                    <td className={tdClass + ' max-w-[180px] truncate'} title={r.cliente_nombre}>{r.cliente_nombre.replace(/\s+/g,' ').trim()}</td>
                    <td className={tdClass + ' max-w-[200px] truncate'} title={r.descripcion}>{r.descripcion.replace(/\s+/g,' ').trim()}</td>
                    <td className={tdClass}>{r.linea || <span className="text-gray-300">—</span>}</td>
                    <td className={tdClass + ' text-right tabular-nums'}>{r.cantidad_pendiente.toLocaleString('es-CO')}</td>
                    <td className={tdClass + ' text-right tabular-nums font-medium'}>{cop(r.valor_pendiente)}</td>
                    <td className={tdClass + ' text-gray-400 text-xs'}>{fmtDate(r.fecha_pedido)}</td>
                    <td className={tdClass + ' text-xs'}>{fmtDate(r.fecha_pactada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                {sorted.length} resultados · página {currentPage} de {totalPages}
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
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors
                        ${p === currentPage ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                      {p}
                    </button>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
