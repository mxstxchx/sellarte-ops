import * as XLSX from 'xlsx'

// ============================================================
// TIPOS
// ============================================================
export interface PedidoParsed {
  empresa: 'sllrt' | 'rv'
  asesor_codigo: number
  asesor_nombre: string
  cliente_nit: number
  cliente_sucursal: number
  cliente_nombre: string
  producto_codigo: string
  referencia: string
  descripcion: string
  comprobante: string
  numero_siigo: string         // normalizado sin ceros iniciales
  sec: number
  cantidad_pedida: number
  valor_pedido: number
  cantidad_entrega: number
  valor_entregado: number
  fecha_entrega_parcial: Date | null
  cantidad_pendiente: number
  valor_pendiente: number      // (valor_pedido / cantidad_pedida) × cantidad_pendiente
  linea: string                // de tabla CONVENCIONES_LÍNEA
  fecha_pedido: Date | null    // del archivo auxiliar
  fecha_pactada: Date | null   // del archivo auxiliar
  pedido_vendedor: string | null // de Control de Pedidos
}

export interface ParseInput {
  pendientesSll: ArrayBuffer
  pendientesRv: ArrayBuffer
  auxiliarSll: ArrayBuffer
  auxiliarRv: ArrayBuffer
  controlPedidos: ArrayBuffer
}

export interface ParseResult {
  pedidos: PedidoParsed[]
  warnings: string[]  // filas que no se pudieron mapear, sin PEDIDO VENDEDOR, etc.
  fecha_datos: string // ISO date extraída del encabezado SIIGO, ej: "2026-03-13"
}

// ============================================================
// CONSTANTES
// ============================================================

/** Filas 1-6 son encabezado de SIIGO; fila 7 es header de columnas; datos desde fila 8 */
const SIIGO_DATA_START = 7 // índice 0-based

/** Tabla CONVENCIONES_LÍNEA: primer dígito del código de producto → línea */
const CONVENCIONES: Record<string, string> = {
  '1': 'M.P.',
  '3': 'PE',
  '4': 'BS',
  '5': 'BC',
  '6': 'IP',
}

/** Índices de columnas (0-based) en informe_pendientes */
const COL_P = {
  VENDED:          0,
  NOMBRE_VENDEDOR: 1,
  NIT:             2,
  SUCURS:          3,
  NOMBRE_CLIENTE:  4,
  PRODUCTO:        5,
  REFERENCIA:      6,
  DESCRIPCION:     7,
  COMP:            8,
  DOCUMENTO:       9,   // número de pedido SIIGO (-DOCUMENTO-)
  SEC:             10,
  CANT_PEDIDA:     11,
  VALOR_PEDIDO:    12,
  CANT_ENTREGA:    13,
  VALOR_ENTREGADO: 14,
  FECHA:           15,  // fecha entrega parcial (Excel serial o "0000/00/00")
  CANT_PENDIENTE:  16,
} as const

/** Índices de columnas (0-based) en auxiliar — iguales para SLL (37 cols) y RV (30 cols) */
const COL_A = {
  NUMERO:    15,   // número de pedido SIIGO → clave de cruce
  FECHA:     17,   // fecha pedido
  FECHA_PAC: 23,   // fecha pactada
} as const

/** Índices de columnas (0-based) en Control de Pedidos (hojas de asesores) */
const COL_C = {
  PEDIDO_VENDEDOR: 0,
  OC:              1,  // # OC — usado en sheet SELLARTE en lugar de PEDIDO_VENDEDOR
  PEDIDO_SIIGO:    4,
} as const

/** Sheet de ventas directas/gerencia — usa col OC como pedido_vendedor */
const SHEET_SELLARTE = 'SELLARTE'

// ============================================================
// HELPERS
// ============================================================
function readRows(buffer: ArrayBuffer, sheetIndex = 0): unknown[][] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[sheetIndex]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
}

function readAllSheets(buffer: ArrayBuffer): { name: string; rows: unknown[][] }[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  return wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][],
  }))
}

/** Quita ceros iniciales para comparar números de pedido entre sistemas */
function normDoc(v: unknown): string {
  return String(v ?? '').trim().replace(/^0+/, '') || ''
}

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Convierte un valor de celda de Excel a Date.
 * Maneja: serial numérico, string "0000/00/00", string de fecha, Date nativo.
 */
function excelDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v

  if (typeof v === 'string') {
    const s = v.trim()
    if (s === '' || s.startsWith('0000')) return null
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof v === 'number') {
    if (v <= 0) return null
    // Epoch de Excel: 25569 = días desde 30-dic-1899 hasta 01-ene-1970
    const utc = new Date((v - 25569) * 86_400_000)
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }

  return null
}

// ============================================================
// FILTROS DE SUBTOTALES
// ============================================================

/**
 * Elimina filas de subtotales del informe_pendientes.
 * Condición: col A (VENDED) empieza con "Total" O col C (NIT) empieza con "Total".
 */
function filterPendientes(rows: unknown[][]): unknown[][] {
  return rows.filter(row => {
    const a = toStr(row[COL_P.VENDED])
    const c = toStr(row[COL_P.NIT])
    if (a.toLowerCase().startsWith('total')) return false
    if (c.toLowerCase().startsWith('total')) return false
    if (a === '' && c === '') return false
    return true
  })
}

/**
 * Elimina filas de subtotales del auxiliar.
 * Condición: col A (TERCERO) empieza con "Total" o está vacía.
 */
function filterAuxiliar(rows: unknown[][]): unknown[][] {
  return rows.filter(row => {
    const a = toStr(row[0])
    if (a.toLowerCase().startsWith('total')) return false
    if (a === '') return false
    return true
  })
}

// ============================================================
// CONSTRUCCIÓN DE MAPAS DE LOOKUP
// ============================================================

interface AuxEntry {
  fechaPedido: Date | null
  fechaPactada: Date | null
}

/**
 * Construye mapa { numero_siigo → { fechaPedido, fechaPactada } } desde un archivo auxiliar.
 * Como las fechas son iguales para todas las líneas del mismo pedido, se usa el primer match.
 */
function buildAuxMap(buffer: ArrayBuffer): Map<string, AuxEntry> {
  const allRows = readRows(buffer)
  const dataRows = filterAuxiliar(allRows.slice(SIIGO_DATA_START))
  const map = new Map<string, AuxEntry>()

  for (const row of dataRows) {
    const key = normDoc(row[COL_A.NUMERO])
    if (!key || map.has(key)) continue // primer match gana
    map.set(key, {
      fechaPedido: excelDate(row[COL_A.FECHA]),
      fechaPactada: excelDate(row[COL_A.FECHA_PAC]),
    })
  }

  return map
}

/**
 * Construye mapa { numero_siigo → pedido_vendedor } leyendo TODAS las hojas
 * de asesores en el archivo Control de Pedidos.
 * Solo procesa hojas cuyo header tenga "PEDIDO VENDEDOR" en col A.
 */
function buildControlMap(buffer: ArrayBuffer): Map<string, string> {
  const sheets = readAllSheets(buffer)
  const map = new Map<string, string>()

  for (const { name, rows } of sheets) {
    if (rows.length < 2) continue
    // Validar que es una hoja de asesor (o SELLARTE)
    const headerA = toStr(rows[0][COL_C.PEDIDO_VENDEDOR]).toLowerCase()
    const headerE = toStr(rows[0][COL_C.PEDIDO_SIIGO]).toLowerCase()
    if (!headerA.includes('pedido') || !headerE.includes('siigo')) continue

    const isSellarte = name.trim().toUpperCase() === SHEET_SELLARTE

    for (const row of rows.slice(1)) {
      const pedidoSiigo = normDoc(row[COL_C.PEDIDO_SIIGO])
      if (!pedidoSiigo) continue

      // Sheet SELLARTE: usar # OC (col B) como pedido_vendedor (puede ser número real o "N/A")
      // Otros sheets: usar # PEDIDO VENDEDOR (col A)
      const pedidoVendedor = isSellarte
        ? toStr(row[COL_C.OC])
        : toStr(row[COL_C.PEDIDO_VENDEDOR])

      if (!pedidoVendedor) continue

      const existing = map.get(pedidoSiigo)
      // Preferir número real sobre "N/A"; nunca sobreescribir un número real con N/A
      const isNA = pedidoVendedor.toUpperCase() === 'N/A'
      if (!existing || (existing.toUpperCase() === 'N/A' && !isNA)) {
        map.set(pedidoSiigo, pedidoVendedor)
      }
    }
  }

  return map
}

// ============================================================
// PARSER DE INFORME PENDIENTES
// ============================================================
function parsePendientes(
  buffer: ArrayBuffer,
  empresa: 'sllrt' | 'rv',
  auxMap: Map<string, AuxEntry>,
  controlMap: Map<string, string>,
  warnings: string[]
): PedidoParsed[] {
  const allRows = readRows(buffer)
  const dataRows = filterPendientes(allRows.slice(SIIGO_DATA_START))
  const results: PedidoParsed[] = []

  for (const row of dataRows) {
    const cantPedida = toNum(row[COL_P.CANT_PEDIDA])
    const valorPedido = toNum(row[COL_P.VALOR_PEDIDO])
    const cantPendiente = toNum(row[COL_P.CANT_PENDIENTE])
    const valorPendiente = cantPedida > 0
      ? (valorPedido / cantPedida) * cantPendiente
      : 0

    const productoCodigo = toStr(row[COL_P.PRODUCTO])
    const linea = CONVENCIONES[productoCodigo.charAt(0)] ?? ''

    const key = normDoc(row[COL_P.DOCUMENTO])
    const aux = auxMap.get(key)
    const pedidoVendedor = controlMap.get(key) ?? null

    if (!aux) {
      warnings.push(`[${empresa.toUpperCase()}] Pedido ${key}: no encontrado en auxiliar — fechas quedarán vacías`)
    }
    if (pedidoVendedor === null) {
      warnings.push(`[${empresa.toUpperCase()}] Pedido ${key}: no encontrado en Control de Pedidos`)
    }

    results.push({
      empresa,
      asesor_codigo:         toNum(row[COL_P.VENDED]),
      asesor_nombre:         toStr(row[COL_P.NOMBRE_VENDEDOR]),
      cliente_nit:           toNum(row[COL_P.NIT]),
      cliente_sucursal:      toNum(row[COL_P.SUCURS]),
      cliente_nombre:        toStr(row[COL_P.NOMBRE_CLIENTE]),
      producto_codigo:       productoCodigo,
      referencia:            toStr(row[COL_P.REFERENCIA]),
      descripcion:           toStr(row[COL_P.DESCRIPCION]),
      comprobante:           toStr(row[COL_P.COMP]),
      numero_siigo:          key,
      sec:                   toNum(row[COL_P.SEC]),
      cantidad_pedida:       cantPedida,
      valor_pedido:          valorPedido,
      cantidad_entrega:      toNum(row[COL_P.CANT_ENTREGA]),
      valor_entregado:       toNum(row[COL_P.VALOR_ENTREGADO]),
      fecha_entrega_parcial: excelDate(row[COL_P.FECHA]),
      cantidad_pendiente:    cantPendiente,
      valor_pendiente:       Math.round(valorPendiente),
      linea,
      fecha_pedido:          aux?.fechaPedido ?? null,
      fecha_pactada:         aux?.fechaPactada ?? null,
      pedido_vendedor:       pedidoVendedor,
    })
  }

  return results
}

// ============================================================
// HELPER: extraer fecha del encabezado SIIGO
// Fila 1, última celda. Formato: "MAR/13/2026"
// ============================================================
const SIIGO_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

function extractSiigoDate(buffer: ArrayBuffer): string {
  try {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
    const firstRow = rows[0] ?? []
    const dateStr = String(firstRow[firstRow.length - 1]).trim() // ej: "MAR/13/2026"
    const [mon, day, year] = dateStr.split('/')
    const m = SIIGO_MONTHS[mon?.toUpperCase()]
    if (m !== undefined) {
      const d = new Date(Number(year), m, Number(day))
      return d.toISOString().slice(0, 10)
    }
  } catch { /* fallback */ }
  return new Date().toISOString().slice(0, 10)
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================
export function parseBackorder(input: ParseInput): ParseResult {
  const warnings: string[] = []

  const auxSllMap  = buildAuxMap(input.auxiliarSll)
  const auxRvMap   = buildAuxMap(input.auxiliarRv)
  const controlMap = buildControlMap(input.controlPedidos)

  const sllRows = parsePendientes(input.pendientesSll, 'sllrt', auxSllMap, controlMap, warnings)
  const rvRows  = parsePendientes(input.pendientesRv,  'rv',    auxRvMap,  controlMap, warnings)

  return {
    pedidos: [...sllRows, ...rvRows],
    warnings,
    fecha_datos: extractSiigoDate(input.pendientesSll),
  }
}
