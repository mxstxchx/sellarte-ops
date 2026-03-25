'use client'

import { useMemo } from 'react'
import { X, TrendingDown, Clock, Package, DollarSign, Eye } from 'lucide-react'

// ── Tipos (subset del PedidoRow del Dashboard) ─────────────────────────
export interface AsesorPanelRow {
  numero_siigo: string
  empresa: 'sllrt' | 'rv'
  asesor_codigo: number
  asesor_nombre: string
  cliente_nit: number
  cliente_nombre: string
  semaforo: number | null
  cantidad_pendiente: number
  valor_pendiente: number
  fecha_pactada: string | null
  pedido_vendedor: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────
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

const SEM_BAR_COLOR: Record<SemaforoLevel, string> = {
  vencido:  'bg-red-500',
  hoy:      'bg-red-400',
  urgente:  'bg-orange-400',
  pronto:   'bg-yellow-400',
  ok:       'bg-green-400',
  sin_fecha:'bg-gray-300',
}

const SEM_LABEL: Record<SemaforoLevel, string> = {
  vencido: 'Vencido', hoy: 'Hoy', urgente: '≤3d', pronto: '4-7d', ok: '>7d', sin_fecha: 'Sin fecha',
}

function EmpresaBadge({ empresa }: { empresa: 'sllrt' | 'rv' }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-mono font-semibold
      ${empresa === 'sllrt' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
      {empresa === 'sllrt' ? 'SLL' : 'RV'}
    </span>
  )
}

// ── Componente ─────────────────────────────────────────────────────────
interface AsesorDetailPanelProps {
  asesorCodigo: number | null
  asesorNombre: string
  rows: AsesorPanelRow[]
  onClose: () => void
  onPedidoClick?: (key: string) => void
  onImpersonate?: (codigo: number, nombre: string) => void
}

export default function AsesorDetailPanel({
  asesorCodigo,
  asesorNombre,
  rows,
  onClose,
  onPedidoClick,
  onImpersonate,
}: AsesorDetailPanelProps) {
  if (asesorCodigo === null) return null

  // Filtrar solo las filas de este asesor
  const asesorRows = useMemo(
    () => rows.filter(r => r.asesor_codigo === asesorCodigo),
    [rows, asesorCodigo]
  )

  const stats = useMemo(() => {
    const pedidosUnicos = new Set(asesorRows.map(r => r.numero_siigo))
    const valorTotal    = asesorRows.reduce((s, r) => s + r.valor_pendiente, 0)
    const cantTotal     = asesorRows.reduce((s, r) => s + r.cantidad_pendiente, 0)
    const vencidos      = new Set(asesorRows.filter(r => r.semaforo !== null && r.semaforo < 0).map(r => r.numero_siigo)).size
    const urgentes      = new Set(asesorRows.filter(r => r.semaforo !== null && r.semaforo >= 0 && r.semaforo <= 3).map(r => r.numero_siigo)).size

    const counts: Record<SemaforoLevel, number> = { vencido: 0, hoy: 0, urgente: 0, pronto: 0, ok: 0, sin_fecha: 0 }
    const seenSem = new Set<string>()
    for (const r of asesorRows) {
      if (seenSem.has(r.numero_siigo)) continue
      seenSem.add(r.numero_siigo)
      counts[getSemaforoLevel(r.semaforo)]++
    }

    const empresas = [...new Set(asesorRows.map(r => r.empresa))] as ('sllrt' | 'rv')[]

    return { pedidosUnicos: pedidosUnicos.size, valorTotal, cantTotal, vencidos, urgentes, counts, empresas }
  }, [asesorRows])

  // Clientes agrupados
  const clientes = useMemo(() => {
    const map = new Map<number, { nombre: string; pedidos: Set<string>; vencidos: number; valor: number }>()
    for (const r of asesorRows) {
      if (!map.has(r.cliente_nit)) {
        map.set(r.cliente_nit, { nombre: r.cliente_nombre, pedidos: new Set(), vencidos: 0, valor: 0 })
      }
      const c = map.get(r.cliente_nit)!
      c.pedidos.add(r.numero_siigo)
      if (r.semaforo !== null && r.semaforo < 0) c.vencidos++
      c.valor += r.valor_pendiente
    }
    return [...map.values()]
      .map(c => ({ ...c, pedidos: c.pedidos.size }))
      .sort((a, b) => b.valor - a.valor)
  }, [asesorRows])

  // Pedidos críticos (vencido o urgente), únicos, top 10
  const criticos = useMemo(() => {
    const seen = new Set<string>()
    return asesorRows
      .filter(r => r.semaforo !== null && r.semaforo <= 3)
      .filter(r => { if (seen.has(r.numero_siigo)) return false; seen.add(r.numero_siigo); return true })
      .sort((a, b) => (a.semaforo ?? 9999) - (b.semaforo ?? 9999))
  }, [asesorRows])

  const totalSem = Object.values(stats.counts).reduce((s, n) => s + n, 0)
  const levels: SemaforoLevel[] = ['vencido', 'hoy', 'urgente', 'pronto', 'ok', 'sin_fecha']

  const thCls = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider'
  const tdCls = 'px-3 py-2.5 text-xs text-gray-700'

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 inset-y-0 z-50 w-full sm:w-[520px] bg-white shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium mb-0.5">Portafolio asesor</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-base">{asesorNombre}</span>
              {stats.empresas.map(e => <EmpresaBadge key={e} empresa={e} />)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onImpersonate && asesorCodigo !== null && (
              <button
                onClick={() => { onImpersonate(asesorCodigo, asesorNombre); onClose() }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                title="Ver el dashboard desde la perspectiva de este asesor"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver como</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              { label: 'Pedidos únicos',  value: String(stats.pedidosUnicos), icon: Package,    accent: '' },
              { label: 'Valor pendiente', value: cop(stats.valorTotal),        icon: DollarSign, accent: '' },
              { label: 'Vencidos',        value: String(stats.vencidos),       icon: TrendingDown, accent: 'border-l-red-400' },
              { label: 'Urgentes ≤3d',   value: String(stats.urgentes),       icon: Clock,      accent: 'border-l-orange-400' },
            ].map(k => (
              <div key={k.label} className={`bg-gray-50 rounded-lg border border-gray-200 border-l-4 ${k.accent || 'border-l-gray-200'} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{k.label}</p>
                  <k.icon className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <p className="text-lg font-bold text-gray-900 mt-1 truncate">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Semáforo bar */}
          {totalSem > 0 && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Estado del portafolio · {totalSem} pedidos
              </p>
              <div className="flex rounded-full overflow-hidden h-3 gap-px">
                {levels.map(l => {
                  const pct = totalSem > 0 ? (stats.counts[l] / totalSem) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <div
                      key={l}
                      className={SEM_BAR_COLOR[l]}
                      style={{ width: `${pct}%` }}
                      title={`${SEM_LABEL[l]}: ${stats.counts[l]}`}
                    />
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {levels.map(l => stats.counts[l] > 0 && (
                  <div key={l} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-sm ${SEM_BAR_COLOR[l]}`} />
                    <span className="text-[10px] text-gray-500">{stats.counts[l]} {SEM_LABEL[l]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clientes */}
          <div className="border-t border-gray-100">
            <p className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
              Clientes ({clientes.length})
            </p>
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thCls}>Cliente</th>
                  <th className={`${thCls} text-center`}>Pedidos</th>
                  <th className={`${thCls} text-center`}>Vencidos</th>
                  <th className={`${thCls} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className={`${tdCls} font-medium text-gray-800 max-w-[180px]`}>
                      <p className="truncate">{c.nombre}</p>
                    </td>
                    <td className={`${tdCls} text-center`}>{c.pedidos}</td>
                    <td className={`${tdCls} text-center`}>
                      {c.vencidos > 0
                        ? <span className="text-red-600 font-semibold">{c.vencidos}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className={`${tdCls} text-right font-mono`}>{cop(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pedidos críticos */}
          {criticos.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                Pedidos críticos — {criticos.length} (vencidos + urgentes)
              </p>
              <div className="divide-y divide-gray-50">
                {criticos.map(r => {
                  const pedidoKey = `${r.empresa}:${r.numero_siigo}`
                  const clickable = !!onPedidoClick
                  return (
                    <div
                      key={r.numero_siigo}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3
                        ${clickable ? 'cursor-pointer hover:bg-blue-50/40 transition-colors' : ''}`}
                      onClick={clickable ? () => onPedidoClick!(pedidoKey) : undefined}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <EmpresaBadge empresa={r.empresa} />
                          <span className="text-xs font-mono font-semibold text-gray-800">{r.numero_siigo}</span>
                          {r.pedido_vendedor && (
                            <span className="text-[10px] text-gray-400">/ {r.pedido_vendedor}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{r.cliente_nombre}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{fmtDate(r.fecha_pactada)}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                          ${r.semaforo !== null && r.semaforo < 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {r.semaforo !== null && r.semaforo < 0 ? `−${Math.abs(r.semaforo)}d` : `${r.semaforo}d`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
