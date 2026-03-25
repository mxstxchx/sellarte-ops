'use client'

import { X, ArrowLeft } from 'lucide-react'

// ── Tipos exportados para que los componentes padre puedan reusarlos ──
export interface PedidoDetail {
  empresa: 'sllrt' | 'rv'
  numero_siigo: string
  pedido_vendedor: string | null
  asesor_nombre: string
  cliente_nombre: string
  fecha_pactada: string | null
  semaforo: number | null
  cantidad: number
  nlineas: number
}

export interface PedidoLine {
  sec: number
  producto_codigo: string
  descripcion: string
  linea: string
  tipo_ip: string | null
  tipo_ip_desc: string | null
  calibre: string | null
  calibre_desc: string | null
  cantidad_pedida: number
  cantidad_pendiente: number
  valor_pendiente: number
  fecha_entrega_parcial: string | null
}

// ── Helpers locales ────────────────────────────────────────────────────
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

const SEM_CONFIG: Record<SemaforoLevel, { bg: string; text: string; label: string }> = {
  vencido:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Vencido'   },
  hoy:      { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Hoy'       },
  urgente:  { bg: 'bg-orange-100', text: 'text-orange-700', label: '≤3 días'   },
  pronto:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '4-7 días'  },
  ok:       { bg: 'bg-green-100',  text: 'text-green-700',  label: '>7 días'   },
  sin_fecha:{ bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Sin fecha' },
}

function SemaforoBadge({ days }: { days: number | null }) {
  const level = getSemaforoLevel(days)
  const s = SEM_CONFIG[level]
  const label = days !== null && days < 0 ? `Vencido ${Math.abs(days)}d`
              : days !== null && days > 0  ? `${days}d`
              : s.label
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
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

// ── Componente ─────────────────────────────────────────────────────────
interface PedidoDetailPanelProps {
  pedido: PedidoDetail | null
  lines: PedidoLine[]
  onClose: () => void
  onBack?: () => void      // if set, shows back arrow instead of X
  isProgram?: boolean
}

export default function PedidoDetailPanel({
  pedido,
  lines,
  onClose,
  onBack,
  isProgram = false,
}: PedidoDetailPanelProps) {
  if (!pedido) return null

  const totalUnidades = lines.reduce((s, l) => s + l.cantidad_pendiente, 0)
  const totalValor    = lines.reduce((s, l) => s + l.valor_pendiente, 0)

  const thCls = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap'
  const tdCls = 'px-3 py-2.5 text-xs text-gray-700'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 inset-y-0 z-50 w-full sm:w-[480px] bg-white shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <EmpresaBadge empresa={pedido.empresa} />
            <span className="font-bold text-gray-900 text-base font-mono">{pedido.numero_siigo}</span>
            {pedido.pedido_vendedor && (
              <span className="text-xs text-gray-400">/ {pedido.pedido_vendedor}</span>
            )}
            <SemaforoBadge days={pedido.semaforo} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
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

        {/* Subheader */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-1 shrink-0 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800 truncate">{pedido.cliente_nombre}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Asesor: <span className="text-gray-700">{pedido.asesor_nombre}</span></span>
            <span>F. pactada: <span className="text-gray-700">{fmtDate(pedido.fecha_pactada)}</span></span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{pedido.nlineas} línea{pedido.nlineas !== 1 ? 's' : ''}</span>
            <span>{totalUnidades.toLocaleString('es-CO')} unidades pendientes</span>
          </div>
        </div>

        {/* Lines table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse min-w-[400px]">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className={thCls}>#</th>
                <th className={thCls}>Línea / Código</th>
                <th className={thCls}>Descripción</th>
                <th className={thCls}>Tipo IP</th>
                <th className={thCls}>Calibre</th>
                <th className={`${thCls} text-right`}>Pdte</th>
                {!isProgram && <th className={`${thCls} text-right`}>Valor</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((l) => (
                <tr key={l.sec} className="hover:bg-gray-50/60">
                  <td className={`${tdCls} text-gray-400 font-mono`}>{l.sec}</td>
                  <td className={tdCls}>
                    <p className="text-[10px] text-gray-400 font-mono">{l.producto_codigo}</p>
                    <p className="text-xs text-gray-500 leading-tight">{l.linea}</p>
                  </td>
                  <td className={`${tdCls} max-w-[160px]`}>
                    <p className="line-clamp-2 leading-tight text-gray-700">{l.descripcion}</p>
                    {l.fecha_entrega_parcial && (
                      <p className="text-[10px] text-blue-500 mt-0.5">
                        Entrega parcial: {fmtDate(l.fecha_entrega_parcial)}
                      </p>
                    )}
                  </td>
                  <td className={tdCls}>
                    {l.tipo_ip ? (
                      <span title={l.tipo_ip_desc ?? ''} className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {l.tipo_ip}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                    {l.tipo_ip_desc && (
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-1">{l.tipo_ip_desc}</p>
                    )}
                  </td>
                  <td className={tdCls}>
                    {l.calibre ? (
                      <span className="text-xs text-gray-700">{l.calibre_desc ?? l.calibre}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`${tdCls} text-right font-semibold text-gray-800`}>
                    {l.cantidad_pendiente.toLocaleString('es-CO')}
                  </td>
                  {!isProgram && (
                    <td className={`${tdCls} text-right font-mono text-gray-700`}>
                      {cop(l.valor_pendiente)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-gray-500">Total pendiente:</span>{' '}
              <span className="font-bold text-gray-900">{totalUnidades.toLocaleString('es-CO')} uds</span>
            </div>
            {!isProgram && (
              <div className="text-sm">
                <span className="font-bold text-gray-900">{cop(totalValor)}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
