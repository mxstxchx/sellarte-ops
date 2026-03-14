'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { parseBackorder } from '@/lib/parser'

// ============================================================
// TIPOS
// ============================================================
interface FileField {
  key: string
  label: string
  description: string
  empresa?: string
}

type Status = 'idle' | 'parsing' | 'saving' | 'success' | 'error'

interface UploadResult {
  ok: boolean
  batch_id?: string
  total_pedidos?: number
  fecha_datos?: string
  warnings?: string[]
  error?: string
}

// ============================================================
// CONFIGURACIÓN DE LOS 5 ARCHIVOS
// ============================================================
const FILE_FIELDS: FileField[] = [
  {
    key: 'pendientes_sll',
    label: 'Informe Pendientes — SELLARTE',
    description: 'SIIGO › Pedidos de vendedores por clientes (Empresa 1)',
    empresa: 'SLLRT',
  },
  {
    key: 'pendientes_rv',
    label: 'Informe Pendientes — RV',
    description: 'SIIGO › Pedidos de vendedores por clientes (Empresa 2)',
    empresa: 'RV',
  },
  {
    key: 'auxiliar_sll',
    label: 'Informe Auxiliar — SELLARTE',
    description: 'SIIGO › Pedidos detallados por cliente (Empresa 1)',
    empresa: 'SLLRT',
  },
  {
    key: 'auxiliar_rv',
    label: 'Informe Auxiliar — RV',
    description: 'SIIGO › Pedidos detallados por cliente (Empresa 2)',
    empresa: 'RV',
  },
  {
    key: 'control_pedidos',
    label: 'Control de Pedidos',
    description: 'Archivo con una pestaña por asesor (pedido vendedor ↔ pedido SIIGO)',
  },
]

// ============================================================
// COMPONENTE: selector de archivo individual
// ============================================================
function FileInput({
  field,
  file,
  onChange,
  disabled,
}: {
  field: FileField
  file: File | null
  onChange: (file: File | null) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`border-2 rounded-lg p-4 transition-colors cursor-pointer
        ${file ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        disabled={disabled}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-start gap-3">
        {file ? (
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
        ) : (
          <FileSpreadsheet className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800">{field.label}</p>
            {field.empresa && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                {field.empresa}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
          {file && (
            <p className="text-xs text-green-600 mt-1 truncate font-medium">
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        {!file && (
          <span className="text-xs text-blue-500 font-medium shrink-0">Seleccionar</span>
        )}
        {file && !disabled && (
          <button
            className="text-xs text-gray-400 hover:text-red-500 shrink-0"
            onClick={e => { e.stopPropagation(); onChange(null) }}
          >
            Cambiar
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE: indicador de progreso por etapas
// ============================================================
function ProgressSteps({ status }: { status: Status }) {
  const steps = [
    { key: 'parsing', label: 'Procesando archivos en el navegador' },
    { key: 'saving',  label: 'Guardando en base de datos' },
  ]

  return (
    <div className="flex items-center gap-3 py-3">
      {steps.map((step, i) => {
        const isActive = status === step.key
        const isDone = status === 'success' ||
          (step.key === 'parsing' && status === 'saving')

        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 ${isDone || isActive ? 'bg-blue-400' : 'bg-gray-200'}`} />}
            <div className="flex items-center gap-1.5">
              {isActive
                ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                : isDone
                  ? <CheckCircle className="w-4 h-4 text-green-500" />
                  : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              }
              <span className={`text-xs ${isActive ? 'text-blue-700 font-medium' : isDone ? 'text-green-700' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// COMPONENTE: panel de warnings colapsable
// ============================================================
function WarningsPanel({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-yellow-300 rounded-lg bg-yellow-50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            {warnings.length} advertencia{warnings.length !== 1 ? 's' : ''} — revisar manualmente
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
      </button>

      {open && (
        <ul className="px-4 pb-4 space-y-1 border-t border-yellow-200 pt-3">
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

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================
export default function UploadPage() {
  const [files, setFiles] = useState<Record<string, File | null>>(
    Object.fromEntries(FILE_FIELDS.map(f => [f.key, null]))
  )
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)

  const allSelected = FILE_FIELDS.every(f => files[f.key] !== null)
  const isLoading = status === 'parsing' || status === 'saving'

  function setFile(key: string, file: File | null) {
    setFiles(prev => ({ ...prev, [key]: file }))
    if (status !== 'idle') { setStatus('idle'); setResult(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allSelected || isLoading) return

    setResult(null)

    // ── Etapa 1: parsear en el browser ───────────────────────
    setStatus('parsing')
    let parsed: Awaited<ReturnType<typeof parseBackorder>>
    try {
      const [pendientesSll, pendientesRv, auxiliarSll, auxiliarRv, controlPedidos] =
        await Promise.all(FILE_FIELDS.map(f => files[f.key]!.arrayBuffer()))

      parsed = parseBackorder({ pendientesSll, pendientesRv, auxiliarSll, auxiliarRv, controlPedidos })
    } catch (err) {
      setStatus('error')
      setResult({ ok: false, error: `Error procesando archivos: ${String(err)}` })
      return
    }

    // ── Etapa 2: enviar JSON a la API ─────────────────────────
    setStatus('saving')
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidos:     parsed.pedidos,
          warnings:    parsed.warnings,
          fecha_datos: parsed.fecha_datos,
        }),
      })
      const data: UploadResult = await res.json()

      if (!res.ok || !data.ok) {
        setStatus('error')
        setResult(data)
      } else {
        setStatus('success')
        setResult(data)
      }
    } catch (err) {
      setStatus('error')
      setResult({ ok: false, error: String(err) })
    }
  }

  return (
    <main className="flex-1 overflow-auto py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cargar archivos del día</h1>
          <p className="text-sm text-gray-500 mt-1">
            Selecciona los 5 archivos exportados de SIIGO y el Control de Pedidos actualizado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Empresa 1 — SELLARTE
            </h2>
            <div className="space-y-2">
              {[FILE_FIELDS[0], FILE_FIELDS[2]].map(f => (
                <FileInput key={f.key} field={f} file={files[f.key]} onChange={v => setFile(f.key, v)} disabled={isLoading} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Empresa 2 — RV
            </h2>
            <div className="space-y-2">
              {[FILE_FIELDS[1], FILE_FIELDS[3]].map(f => (
                <FileInput key={f.key} field={f} file={files[f.key]} onChange={v => setFile(f.key, v)} disabled={isLoading} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Referencia cruzada
            </h2>
            <FileInput field={FILE_FIELDS[4]} file={files[FILE_FIELDS[4].key]} onChange={v => setFile(FILE_FIELDS[4].key, v)} disabled={isLoading} />
          </div>

          {isLoading && <ProgressSteps status={status} />}

          <button
            type="submit"
            disabled={!allSelected || isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium text-sm transition-colors
              ${allSelected && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {allSelected
                  ? 'Procesar y cargar'
                  : `Faltan ${FILE_FIELDS.filter(f => !files[f.key]).length} archivo(s)`}
              </>
            )}
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-3">
            {status === 'success' && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-300 rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Carga exitosa — {result.total_pedidos?.toLocaleString('es-CO')} líneas de pedido procesadas
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Fecha del reporte: {result.fecha_datos} · Batch: {result.batch_id}
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg p-4">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error al procesar</p>
                  <p className="text-xs text-red-600 mt-0.5">{result.error}</p>
                </div>
              </div>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <WarningsPanel warnings={result.warnings} />
            )}
          </div>
        )}

      </div>
    </main>
  )
}
