'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Batch {
  id: string
  fecha_datos: string | null
  uploaded_by_name: string
  created_at: string
  total_pedidos: number | null
  status: string
  error_msg: string | null
  warnings: string[] | null
}

const fmtDate = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const fmtDateTime = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ok')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3.5 h-3.5" /> Exitoso
      </span>
    )
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3.5 h-3.5" /> Error
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Clock className="w-3.5 h-3.5" /> Procesando
    </span>
  )
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border border-yellow-200 rounded-lg bg-yellow-50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
          <span className="text-xs font-medium text-yellow-800">
            {warnings.length} advertencia{warnings.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-yellow-500" /> : <ChevronDown className="w-3.5 h-3.5 text-yellow-500" />}
      </button>
      {open && (
        <ul className="px-3 pb-3 space-y-1 border-t border-yellow-200 pt-2 max-h-60 overflow-y-auto">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-yellow-800 font-mono bg-yellow-100 rounded px-2 py-1">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function HistorialClient({ batches }: { batches: Batch[]; userId: string }) {
  if (batches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-gray-500 font-medium">No hay cargas registradas</p>
          <p className="text-sm text-gray-400">Las cargas aparecerán aquí una vez que subas archivos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Historial de cargas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Últimas {batches.length} cargas registradas</p>
        </div>

        <div className="space-y-3">
          {batches.map(batch => (
            <div key={batch.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={batch.status} />
                    <span className="text-sm font-medium text-gray-800">
                      Datos al {fmtDate(batch.fecha_datos)}
                    </span>
                    {batch.total_pedidos != null && (
                      <span className="text-xs text-gray-400">
                        · {batch.total_pedidos.toLocaleString('es-CO')} líneas
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-1">
                    Subido por <span className="font-medium text-gray-600">{batch.uploaded_by_name}</span>
                    {' · '}{fmtDateTime(batch.created_at)}
                  </p>

                  {batch.error_msg && (
                    <p className="mt-2 text-xs text-red-600 font-mono bg-red-50 rounded px-2 py-1">
                      {batch.error_msg}
                    </p>
                  )}

                  {batch.warnings && batch.warnings.length > 0 && (
                    <WarningsPanel warnings={batch.warnings} />
                  )}
                </div>

                <span className="text-xs text-gray-300 font-mono shrink-0 hidden sm:block">
                  {batch.id.slice(0, 8)}…
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
