'use client'

import { useMemo, useState } from 'react'
import { Search, CalendarDays, AlertCircle } from 'lucide-react'
import { calcSemaforo } from '@/lib/parser/holidays'
import PedidoDetailPanel, { type PedidoDetail } from '@/components/PedidoDetailPanel'
import MultiFilter from '@/components/MultiFilter'
import { useImpersonation } from '../ImpersonationContext'

// ============================================================
// TIPOS
// ============================================================
interface PedidoRaw {
  empresa: 'sllrt' | 'rv'
  asesor_codigo: number
  asesor_nombre: string
  cliente_nit: number
  cliente_nombre: string
  numero_siigo: string
  pedido_vendedor: string | null
  cantidad_pedida: number
  cantidad_pendiente: number
  valor_pendiente: number
  fecha_pactada: string | null
  fecha_entrega_parcial: string | null
  sec: number
  producto_codigo: string
  descripcion: string
  linea: string
  tipo_ip: string | null
  tipo_ip_desc: string | null
  calibre: string | null
  calibre_desc: string | null
}

interface UniquePedido {
  empresa: 'sllrt' | 'rv'
  asesor_codigo: number
  asesor_nombre: string
  cliente_nombre: string
  numero_siigo: string
  pedido_vendedor: string | null
  cantidad: number
  fecha_pactada: string | null
  semaforo: number | null
  nlineas: number
  lineas: string[]
  tiposIp: string[]
  calibres: string[]
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

type SemaforoLevel = 'vencido' | 'hoy' | 'urgente' | 'pronto' | 'ok' | 'sin_fecha'

interface WeekGroup {
  weekKey: string
  label: string
  pedidos: UniquePedido[]
  counts: Record<SemaforoLevel, number>
  totalUnidades: number
}

// ============================================================
// HELPERS
// ============================================================
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function getMondayOfWeek(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  const dow = result.getDay() // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow
  result.setDate(result.getDate() + diff)
  return result
}

function getWeekKey(d: Date): string {
  return getMondayOfWeek(d).toISOString().slice(0, 10)
}

function fmtWeekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startDay   = monday.getDate()
  const endDay     = sunday.getDate()
  const startMonth = MONTHS_ES[monday.getMonth()]
  const endMonth   = MONTHS_ES[sunday.getMonth()]
  const endYear    = sunday.getFullYear()

  if (monday.getMonth() === sunday.getMonth()) {
    return `${startDay} – ${endDay} ${endMonth} ${endYear}`
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`
}

function fmtDayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

type SemaforoLevelConf = { bg: string; text: string; dot: string; label: string; order: number }

function getSemaforoLevel(days: number | null): SemaforoLevel {
  if (days === null)  return 'sin_fecha'
  if (days < 0)       return 'vencido'
  if (days === 0)     return 'hoy'
  if (days <= 3)      return 'urgente'
  if (days <= 7)      return 'pronto'
  return 'ok'
}

const SEM_CONFIG: Record<SemaforoLevel, SemaforoLevelConf> = {
  vencido:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Vencido',   order: 0 },
  hoy:      { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400',    label: 'Hoy',       order: 1 },
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

function SemaforoDot({ days }: { days: number | null }) {
  const level = getSemaforoLevel(days)
  const s = SEM_CONFIG[level]
  const label = days !== null && days < 0 ? `Vencido ${Math.abs(days)}d`
              : days === 0 ? 'Hoy'
              : days !== null ? `${days}d`
              : 'Sin fecha'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {label}
    </span>
  )
}

function EmpresaBadge({ empresa }: { empresa: 'sllrt' | 'rv' }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-mono font-semibold
      ${empresa === 'sllrt' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
      {empresa === 'sllrt' ? 'SLL' : 'RV'}
    </span>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function CalendarioClient({
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
  const isProgram = profile?.role === 'programador'
  const today = useMemo(() => new Date(), [])
  const todayWeekKey = useMemo(() => getWeekKey(today), [today])

  // ── Filtros ───────────────────────────────────────────────
  const [empresaF,  setEmpresaF]  = useState<string[]>([])
  const [asesorF,   setAsesorF]   = useState<string[]>([])
  const [clienteF,  setClienteF]  = useState<string[]>([])
  const [lineaF,    setLineaF]    = useState<string[]>([])
  const [tipoIpF,   setTipoIpF]   = useState<string[]>([])
  const [calibreF,  setCalibreF]  = useState<string[]>([])
  const [semFiltro, setSemFiltro] = useState<string[]>([])
  const [busqueda,  setBusqueda]  = useState('')
  const [calTab,    setCalTab]    = useState<'vencidos' | 'proximas'>('vencidos')
  const [selectedPedido, setSelectedPedido] = useState<UniquePedido | null>(null)
  const { impersonateAs } = useImpersonation()

  // ── Consolidar líneas → pedidos únicos ───────────────────
  const uniquePedidos = useMemo<UniquePedido[]>(() => {
    const map = new Map<string, UniquePedido & { _lineas: Set<string>; _tiposIp: Set<string>; _calibres: Set<string> }>()
    for (const p of (pedidos as PedidoRaw[])) {
      const key = `${p.empresa}:${p.numero_siigo}`
      if (!map.has(key)) {
        const semaforo = p.fecha_pactada
          ? calcSemaforo(new Date(p.fecha_pactada + 'T00:00:00'), today)
          : null
        map.set(key, {
          empresa:          p.empresa,
          asesor_codigo:    p.asesor_codigo,
          asesor_nombre:    p.asesor_nombre,
          cliente_nombre:   p.cliente_nombre,
          numero_siigo:     p.numero_siigo,
          pedido_vendedor:  p.pedido_vendedor,
          cantidad:         0,
          fecha_pactada:    p.fecha_pactada,
          semaforo,
          nlineas:          0,
          lineas:           [],
          tiposIp:          [],
          calibres:         [],
          _lineas:          new Set(),
          _tiposIp:         new Set(),
          _calibres:        new Set(),
        })
      }
      const u = map.get(key)!
      u.cantidad += p.cantidad_pendiente
      u.nlineas++
      if (p.linea)    u._lineas.add(p.linea)
      if (p.tipo_ip)  u._tiposIp.add(p.tipo_ip)
      if (p.calibre)  u._calibres.add(p.calibre)
    }
    return [...map.values()].map(u => ({
      ...u,
      lineas:   [...u._lineas],
      tiposIp:  [...u._tiposIp],
      calibres: [...u._calibres],
    }))
  }, [pedidos, today])

  // ── Listas de opciones únicas ─────────────────────────────
  const asesores = useMemo(() =>
    [...new Map(uniquePedidos.map(p => [p.asesor_codigo, p.asesor_nombre])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1])),
  [uniquePedidos])

  const clientes = useMemo(() =>
    [...new Map(uniquePedidos.map(p => [String(p.cliente_nombre), p.cliente_nombre])).entries()]
      .sort((a, b) => a[0].localeCompare(b[0])),
  [uniquePedidos])

  const lineas = useMemo(() =>
    [...new Set((pedidos as PedidoRaw[]).map(p => p.linea).filter(Boolean))].sort(),
  [pedidos])

  const tiposIp = useMemo(() =>
    [...new Map((pedidos as PedidoRaw[])
      .filter(p => p.tipo_ip)
      .map(p => [p.tipo_ip!, p.tipo_ip_desc ?? p.tipo_ip!])
    ).entries()].sort((a, b) => a[0].localeCompare(b[0])),
  [pedidos])

  const calibres = useMemo(() =>
    [...new Map((pedidos as PedidoRaw[])
      .filter(p => p.calibre)
      .map(p => [p.calibre!, p.calibre_desc ?? p.calibre!])
    ).entries()].sort((a, b) => a[0].localeCompare(b[0])),
  [pedidos])

  // ── Filtrar ───────────────────────────────────────────────
  const filteredPedidos = useMemo(() => {
    const q = busqueda.toLowerCase()
    return uniquePedidos.filter(p => {
      if (impersonateAs && p.asesor_codigo !== impersonateAs.codigo) return false
      if (empresaF.length  > 0 && !empresaF.includes(p.empresa)) return false
      if (asesorF.length   > 0 && !asesorF.includes(String(p.asesor_codigo))) return false
      if (clienteF.length  > 0 && !clienteF.includes(p.cliente_nombre)) return false
      if (lineaF.length    > 0 && !lineaF.some(f => p.lineas.includes(f))) return false
      if (tipoIpF.length   > 0 && !tipoIpF.some(f => p.tiposIp.includes(f))) return false
      if (calibreF.length  > 0 && !calibreF.some(f => p.calibres.includes(f))) return false
      if (semFiltro.length > 0 && !semFiltro.includes(getSemaforoLevel(p.semaforo))) return false
      if (q) {
        const hay = [p.cliente_nombre, p.numero_siigo, p.pedido_vendedor ?? '', p.asesor_nombre]
          .some(v => v.toLowerCase().includes(q))
        if (!hay) return false
      }
      return true
    })
  }, [uniquePedidos, impersonateAs, empresaF, asesorF, clienteF, lineaF, tipoIpF, calibreF, semFiltro, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Agrupar por semana (tabs) ─────────────────────────────
  function buildWeekGroups(peds: UniquePedido[]): WeekGroup[] {
    const map = new Map<string, UniquePedido[]>()
    for (const p of peds) {
      const key = p.fecha_pactada
        ? getWeekKey(new Date(p.fecha_pactada + 'T00:00:00'))
        : 'sin_fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    const entries = [...map.entries()].sort(([a], [b]) => {
      if (a === 'sin_fecha') return 1
      if (b === 'sin_fecha') return -1
      return a.localeCompare(b)
    })
    return entries.map(([key, ps]) => {
      const sorted = [...ps].sort((a, b) => {
        if (a.semaforo === null) return 1
        if (b.semaforo === null) return -1
        return (a.semaforo ?? 9999) - (b.semaforo ?? 9999)
      })
      const counts: Record<SemaforoLevel, number> = { vencido: 0, hoy: 0, urgente: 0, pronto: 0, ok: 0, sin_fecha: 0 }
      let totalUnidades = 0
      for (const p of sorted) { counts[getSemaforoLevel(p.semaforo)]++; totalUnidades += p.cantidad }
      const label = key === 'sin_fecha' ? 'Sin fecha pactada' : fmtWeekLabel(key)
      return { weekKey: key, label, pedidos: sorted, counts, totalUnidades }
    })
  }

  const { vencidosGroups, proximasGroups } = useMemo(() => {
    const vencidosPedidos  = filteredPedidos.filter(p => p.semaforo !== null && p.semaforo < 0)
    const proximasPedidos  = filteredPedidos.filter(p => p.semaforo === null || p.semaforo >= 0)
    return {
      vencidosGroups: buildWeekGroups(vencidosPedidos),
      proximasGroups: buildWeekGroups(proximasPedidos),
    }
  }, [filteredPedidos]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeGroups = calTab === 'vencidos' ? vencidosGroups : proximasGroups
  const vencidosCount = vencidosGroups.reduce((s, g) => s + g.pedidos.length, 0)

  const hasFilters = empresaF.length > 0 || asesorF.length > 0 || clienteF.length > 0 ||
                     lineaF.length > 0 || tipoIpF.length > 0 || calibreF.length > 0 ||
                     semFiltro.length > 0 || !!busqueda

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = []
    for (const v of empresaF) {
      chips.push({ id: `e:${v}`, label: v === 'sllrt' ? 'SELLARTE' : 'RV', onRemove: () => setEmpresaF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of asesorF) {
      const nom = asesores.find(([cod]) => String(cod) === v)?.[1] ?? v
      chips.push({ id: `a:${v}`, label: nom.replace(/\s+/g,' ').trim(), onRemove: () => setAsesorF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of clienteF) {
      chips.push({ id: `c:${v}`, label: v.replace(/\s+/g,' ').trim(), onRemove: () => setClienteF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of lineaF) {
      chips.push({ id: `l:${v}`, label: v, onRemove: () => setLineaF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of tipoIpF) {
      const desc = tiposIp.find(([cod]) => cod === v)?.[1] ?? v
      chips.push({ id: `t:${v}`, label: `${v} – ${desc}`, onRemove: () => setTipoIpF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of calibreF) {
      const desc = calibres.find(([cod]) => cod === v)?.[1] ?? v
      chips.push({ id: `k:${v}`, label: desc, onRemove: () => setCalibreF(prev => prev.filter(x => x !== v)) })
    }
    for (const v of semFiltro) {
      chips.push({ id: `s:${v}`, label: SEM_CONFIG[v as SemaforoLevel]?.label ?? v, onRemove: () => setSemFiltro(prev => prev.filter(x => x !== v)) })
    }
    return chips
  }, [empresaF, asesorF, clienteF, lineaF, tipoIpF, calibreF, semFiltro, asesores, tiposIp, calibres]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 space-y-4 min-w-0">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
              Calendario de Entregas
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Datos al {fmtDate(batch.fecha_datos)} · {filteredPedidos.length} pedidos
              {batch.warnings && batch.warnings.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {batch.warnings.length} advertencias
                </span>
              )}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setCalTab('vencidos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${calTab === 'vencidos' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              Vencidos
              {vencidosCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {vencidosCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCalTab('proximas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${calTab === 'proximas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Próximas
            </button>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente, pedido, asesor…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-56
                  focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
              />
            </div>

            <MultiFilter
              label="Empresa"
              options={[['sllrt', 'SELLARTE'], ['rv', 'RV']]}
              selected={empresaF}
              onChange={v => setEmpresaF(v)}
            />

            {isGerente && (
              <MultiFilter
                label="Asesor"
                options={asesores.map(([cod, nom]) => [String(cod), nom.replace(/\s+/g, ' ').trim()])}
                selected={asesorF}
                onChange={v => setAsesorF(v)}
                placeholder="Buscar asesor…"
              />
            )}

            <MultiFilter
              label="Cliente"
              options={clientes.map(([nom]) => [nom, nom.replace(/\s+/g, ' ').trim()])}
              selected={clienteF}
              onChange={v => setClienteF(v)}
              placeholder="Buscar cliente…"
            />

            {lineas.length > 0 && (
              <MultiFilter
                label="Línea"
                options={lineas.map(l => [l, l])}
                selected={lineaF}
                onChange={v => setLineaF(v)}
                placeholder="Buscar línea…"
              />
            )}

            {tiposIp.length > 0 && (
              <MultiFilter
                label="Tipo IP"
                options={tiposIp.map(([cod, desc]) => [cod, `${cod} – ${desc}`])}
                selected={tipoIpF}
                onChange={v => setTipoIpF(v)}
                placeholder="Buscar tipo…"
              />
            )}

            {calibres.length > 0 && (
              <MultiFilter
                label="Calibre"
                options={calibres.map(([cod, desc]) => [cod, desc])}
                selected={calibreF}
                onChange={v => setCalibreF(v)}
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
              onChange={v => setSemFiltro(v)}
            />

            {hasFilters && (
              <button
                onClick={() => { setEmpresaF([]); setAsesorF([]); setClienteF([]); setLineaF([]); setTipoIpF([]); setCalibreF([]); setSemFiltro([]); setBusqueda('') }}
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

        {/* ── Semanas ── */}
        {activeGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center">
            <p className="text-gray-400 text-sm">
              {calTab === 'vencidos' ? 'No hay pedidos vencidos' : 'No hay pedidos próximos'}
              {hasFilters ? ' con los filtros actuales' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeGroups.map(wg => {
              const isCurrentWeek = wg.weekKey === todayWeekKey
              const isSinFecha    = wg.weekKey === 'sin_fecha'
              const isVencidosTab = calTab === 'vencidos'

              const headerBg = isVencidosTab  ? 'bg-red-50 border-red-200'
                             : isCurrentWeek  ? 'bg-blue-50 border-blue-200'
                             : isSinFecha     ? 'bg-gray-50 border-gray-200'
                             : 'bg-white border-gray-200'

              const headerBorder = isVencidosTab ? 'border-red-200'
                                 : isCurrentWeek ? 'border-blue-200'
                                 : 'border-gray-200'

              const headerText = isVencidosTab  ? 'text-red-700'
                               : isCurrentWeek  ? 'text-blue-700'
                               : 'text-gray-800'

              const levels: SemaforoLevel[] = ['vencido', 'hoy', 'urgente', 'pronto', 'ok', 'sin_fecha']

              return (
                <div key={wg.weekKey} className={`rounded-xl border overflow-hidden ${headerBg}`}>
                  {/* Cabecera de semana */}
                  <div className={`px-5 py-3.5 border-b ${headerBorder}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className={`text-sm font-bold ${headerText}`}>
                          {isCurrentWeek && !isVencidosTab && <span className="mr-1.5 text-blue-500">▶</span>}
                          {isVencidosTab ? `Semana del ${wg.label}` : wg.label}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {levels.map(l => wg.counts[l] > 0 && (
                            <span key={l} className={`text-xs ${SEM_CONFIG[l].text}`}>
                              <span className="font-semibold">{wg.counts[l]}</span> {SEM_CONFIG[l].label.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          {wg.totalUnidades.toLocaleString('es-CO')} uds
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {wg.pedidos.length} pedido{wg.pedidos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Mini barra semáforo */}
                    <div className="flex rounded-full overflow-hidden h-1.5 gap-px mt-2.5">
                      {levels.map(l => {
                        const pct = (wg.counts[l] / wg.pedidos.length) * 100
                        if (pct === 0) return null
                        return <div key={l} className={SEM_BAR_COLOR[l]} style={{ width: `${pct}%` }} />
                      })}
                    </div>
                  </div>

                  {/* Filas de pedidos */}
                  <div className="bg-white divide-y divide-gray-50">
                    {wg.pedidos.map((p, i) => {
                      const level = getSemaforoLevel(p.semaforo)
                      const cfg   = SEM_CONFIG[level]
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedPedido(p)}
                        >
                          {/* Indicador semáforo */}
                          <div className={`w-0.5 h-8 rounded-full ${SEM_BAR_COLOR[level]} shrink-0`} />

                          {/* Fecha */}
                          <div className="w-24 shrink-0 hidden sm:block">
                            {p.fecha_pactada ? (
                              <p className={`text-xs font-medium ${isVencidosTab ? cfg.text : 'text-gray-600'}`}>
                                {fmtDayShort(p.fecha_pactada)}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-300">Sin fecha</p>
                            )}
                          </div>

                          {/* Semáforo badge */}
                          <div className="shrink-0">
                            <SemaforoDot days={p.semaforo} />
                          </div>

                          {/* Empresa */}
                          <div className="shrink-0">
                            <EmpresaBadge empresa={p.empresa} />
                          </div>

                          {/* Cliente */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {p.cliente_nombre.replace(/\s+/g, ' ').trim()}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {p.pedido_vendedor ?? p.numero_siigo}
                              {isGerente && (
                                <span className="ml-1.5 text-gray-300">· {p.asesor_nombre.replace(/\s+/g, ' ').trim()}</span>
                              )}
                            </p>
                          </div>

                          {/* Cantidad + líneas */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-gray-800 tabular-nums">
                              {p.cantidad.toLocaleString('es-CO')} uds
                            </p>
                            <p className="text-xs text-gray-400">
                              {p.nlineas} línea{p.nlineas !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>

    {/* ── PedidoDetailPanel ── */}
    {selectedPedido && (() => {
      const rawLines = (pedidos as PedidoRaw[]).filter(
        p => p.empresa === selectedPedido.empresa && p.numero_siigo === selectedPedido.numero_siigo
      )
      return (
        <PedidoDetailPanel
          pedido={{
            empresa:         selectedPedido.empresa,
            numero_siigo:    selectedPedido.numero_siigo,
            pedido_vendedor: selectedPedido.pedido_vendedor,
            asesor_nombre:   selectedPedido.asesor_nombre,
            cliente_nombre:  selectedPedido.cliente_nombre,
            fecha_pactada:   selectedPedido.fecha_pactada,
            semaforo:        selectedPedido.semaforo,
            cantidad:        selectedPedido.cantidad,
            nlineas:         selectedPedido.nlineas,
          }}
          lines={rawLines.map(r => ({
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
          }))}
          onClose={() => setSelectedPedido(null)}
          isProgram={isProgram}
        />
      )
    })()}
    </>
  )
}
