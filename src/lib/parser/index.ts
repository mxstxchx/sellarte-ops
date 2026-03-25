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
  // Enriquecimiento de código de producto (decodificado desde Excel TIPO IP / CALIBRE)
  tipo_ip: string
  tipo_ip_desc: string
  calibre: string
  calibre_desc: string
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

// ============================================================
// MAPPINGS DE ENRIQUECIMIENTO DE PRODUCTO
// Fuente: itera_backorder.xlsx — hojas "TIPO IP" y "CALIBRE"
// Formato producto_codigo: AAABBCCDDEEFF (13 dígitos)
//   AAA (0-2) = TIPO IP   BB (3-4) = COLOR   CC (5-6) = CALIBRE
//   DD (7-8)  = ESTAMPADO  EE (9-10) = CARACTERÍSTICA  FF (11-12) = TALLA
// ============================================================

/** Primeros 3 dígitos del código → descripción de TIPO IP (178 entradas) */
const TIPO_IP_MAP: Record<string, string> = {
  '601': 'GABARDINA ADULTO BOLSILLOS PARCHE',
  '604': 'GABARDINA UNISEX SILIC CON EMPAQUE INDIV',
  '602': 'GABRDINA INFANTIL',
  '603': 'GABÁN DAMA SILIC CON CINTURÓN',
  '605': 'GABARDINA ESPECIAL',
  '606': 'ABRIGO BOLSILLOS PARCHE',
  '608': 'ABRIGO BOLSILLOS PARCHE C/REFL',
  '888': 'ABRIGO BOLSILLOS PARCHE C/REFL C-18L RT',
  '607': 'ABRIGO ESPECIAL',
  '609': 'ABRIGO ESPECIAL C/REFL',
  '610': 'CAPA ADULTO CORTE LIMPIO',
  '611': 'CAPA INFANTIL',
  '612': 'CAPA JUNIOR',
  '862': 'CAPA ADULTO SILI C/BR PECHO Y REFL DOBLADILLAD',
  '614': 'CAPA REDONDA SILIC UNISEX C/MANGAS',
  '615': 'CAPA ADULTO',
  '863': 'CAPA ADULTO C-18L RT',
  '616': 'CAPA ADULTO C/REFL',
  '617': 'CAPA GANADERA',
  '618': 'CAPA GANADERA C/REFL',
  '619': 'CAPA LLANERA',
  '620': 'CAPA LLANERA C/REFL',
  '861': 'CAPA LLANERA C/ CUELLO',
  '613': 'CAPA VAQUERÍA',
  '621': 'CAPA CAFETERA',
  '622': 'CAPA VAQUERO C/ CUELLO Y BROCHE',
  '623': 'CAPA VAQUERO TIPO RUANA C/ ELÁSTICO',
  '624': 'CAPA ESPECIAL',
  '625': 'CAPA ESPECIAL C/REFL',
  '638': 'CHAQUETA TIFÓN',
  '639': 'CHAQUETA TIFÓN C/REFL',
  '640': 'CHAQUETA TORMENTA',
  '641': 'CHAQUETA TORMENTA C/REFL',
  '868': 'CHAQUETA TORMENTA C/REFL C-18L RT',
  '642': 'CHAQUETA TRUENO',
  '643': 'CHAQUETA TRUENO C/REFL',
  '644': 'CHAQUETA TORNADO C/REFL',
  '645': 'CHAQUETA TORNADO DAMA C/REFL',
  '646': 'CHAQUETA CICLÓN C/REFL',
  '860': 'CHAQUETA CICLÓN MORRALERA C/REFL',
  '647': 'CHAQUETA RAYO C/REFL SILIC',
  '648': 'CHAQUETA SPORT C/REFL SILIC',
  '649': 'CHAQUETA GLOW C/REFL SILIC',
  '650': 'CHAQUETA BRISA C/REFL',
  '651': 'CHAQUETA TIFÓN INFANTIL',
  '652': 'CHAQUETA ECOPOLI C/REFL',
  '653': 'CHAQUETA ESCARABAJO C/REFL SILIC',
  '654': 'CHAQUETA ESPECIAL',
  '655': 'CHAQUETA ESPECIAL C/REFL',
  '656': 'PANTALÓN',
  '657': 'PANTALÓN C/REFL',
  '658': 'PANTALÓN RAYO C/REFL SILIC',
  '659': 'PANTALÓN SPORT C/REFL SILIC',
  '660': 'PANTALÓN GLOW C/REFL SILIC',
  '661': 'PANTALÓN BRISA C/REFL',
  '662': 'PANTALÓN ESPECIAL',
  '663': 'PANTALÓN ESPECIAL C/REFL',
  '628': 'DELANTAL PEQUEÑO',
  '629': 'DELANTAL MEDIANO',
  '630': 'DELANTAL GRANDE',
  '626': 'DELANTAL 80X130',
  '627': 'DELANTAL 80X140',
  '878': 'DELANTAL OTRA MEDIDA',
  '634': 'DELANTAL PEQUEÑO REFORZADO',
  '635': 'DELANTAL MEDIANO REFORZADO',
  '636': 'DELANTAL GRANDE REFORZADO',
  '879': 'DELANTAL 80X130 REFORZADO',
  '880': 'DELANTAL 80X140 REFORZADO',
  '884': 'DELANTAL OTRA MEDIDA REFORZADO',
  '631': 'DELANTAL CRUZADO PEQUEÑO',
  '632': 'DELANTAL CRUZADO MEDIANO',
  '633': 'DELANTAL CRUZADO GRANDE',
  '881': 'DELANTAL CRUZADO 80X130',
  '882': 'DELANTAL CRUZADO 80X140',
  '883': 'DELANTAL CRUZADO OTRA MEDIDA',
  '856': 'DELANTAL CRUZADO REFORZADO PEQUEÑO',
  '857': 'DELANTAL CRUZADO REFORZADO MEDIANO',
  '858': 'DELANTAL CRUZADO REFORZADO GRANDE',
  '885': 'DELANTAL CRUZADO REFORZADO 80x140',
  '886': 'DELANTAL CRUZADO REFORZADO 80x130',
  '887': 'DELANTAL CRUZADO REFORZADO OTRA MEDIDA',
  '637': 'DELANTAL FORMA ESPECIAL',
  '851': 'DELANTAL BANANERO',
  '852': 'DELANTAL CARNICERO',
  '853': 'DELANTAL GABACHA',
  '664': 'CONJUNTO TIFÓN 2P',
  '892': 'CONJUNTO TIFÓN 2P C-18L RT',
  '665': 'CONJUNTO TIFÓN 2P C/REFL',
  '893': 'CONJUNTO TIFÓN 2P C/REFL C-18L RT',
  '666': 'CONJUNTO TIFÓN ESPECIAL',
  '667': 'CONJUNTO TIFÓN ESPECIAL OTRO MATERIAL',
  '668': 'CONJUNTO TORMENTA 2P',
  '866': 'CONJUNTO TORMENTA 2P C-18L RT',
  '669': 'CONJUNTO TORMENTA 2P C/REFL',
  '867': 'CONJUNTO TORMENTA 2P C/REFL C-18L RT',
  '889': 'CONJUNTO TORMENTA 3P',
  '895': 'CONJUNTO TORMENTA 3P C-18L RT',
  '890': 'CONJUNTO TORMENTA 3P C/REFL',
  '891': 'CONJUNTO TORMENTA 4P',
  '896': 'CONJUNTO TORMENTA 4P C-18L RT',
  '859': 'CONJUNTO TORMENTA 4P C/REFL',
  '869': 'CONJUNTO TORMENTA 4P C/REFL C-18L RT',
  '670': 'CONJUNTO TORMENTA ESPECIAL',
  '671': 'CONJUNTO TORMENTA ESPECIAL OTRO MATERIAL',
  '672': 'CONJUNTO TRUENO 2P',
  '673': 'CONJUNTO TRUENO 2P C/REFL',
  '897': 'CONJUNTO TRUENO 2P C/REFL C-18L RT',
  '674': 'CONJUNTO TRUENO 4P C/REFL',
  '675': 'CONJUNTO TRUENO ESPECIAL',
  '676': 'CONJUNTO TRUENO ESPECIAL C/REFL',
  '677': 'CONJUNTO CHAQUETA TIFÓN + OVEROL',
  '678': 'CONJUNTO CHAQUETA TORMENTA + OVEROL',
  '679': 'CONJUNTO ESPECIAL CHAQUETA + OVEROL',
  '680': 'CONJUNTO ESP CHAQUETA OVEROL C/REFL 2XL',
  '681': 'CONJUNTO TORNADO 2P C/REFL',
  '682': 'CONJUNTO TORNADO 3P C/REFL',
  '683': 'CONJUNTO TORNADO 4P C/REFL',
  '684': 'CONJUNTO TORNADO DAMA 2P C/REFL',
  '685': 'CONJUNTO TORNADO DAMA 3P C/REFL',
  '686': 'CONJUNTO TORNADO DAMA 4P C/REFL',
  '894': 'CONJUNTO MOTO OVERSIZE 2P C/REFL',
  '687': 'CONJUNTO CICLÓN 2P C/REFL',
  '688': 'CONJUNTO CICLÓN 3P C/REFL',
  '695': 'CONJUNTO CICLÓN MORRALERO 2P C/REFL',
  '696': 'CONJUNTO CICLÓN MORRALERO 3P C/REFL',
  '801': 'CONJUNTO DEPORTIVO SILIC 2P C/REFL',
  '689': 'CONJUNTO RAYO 2P C/REFL SILIC',
  '690': 'CONJUNTO RAYO 3P C/REFL SILIC',
  '691': 'CONJUNTO RAYO 4P C/REFL SILIC',
  '692': 'CONJUNTO SPORT 2P C/REFL SILIC',
  '693': 'CONJUNTO SPORT 3P C/REFL SILIC',
  '694': 'CONJUNTO SPORT 4P C/REFL SILIC',
  '697': 'CONJUNTO GLOW C/REFL SILIC',
  '698': 'CONJUNTO BRISA 2P C/REFL',
  '699': 'CONJUNTO BRISA 3P C/REFL',
  '800': 'CONJUNTO TIFÓN INFANTIL 2P',
  '802': 'CONJUNTO ECOPOLI C/REFL',
  '803': 'CONJUNTO PROTECTCROSS C/REFL',
  '854': 'CONJUNTO OVEROL ENTERIZO C/CUBRECALZADO',
  '804': 'OVEROL CON PECHERA',
  '805': 'OVEROL CON PECHERA C/REFL',
  '806': 'OVEROL CON PECHERA ESPECIAL',
  '807': 'OVEROL CON PECHERA ESPECIAL C/REFL',
  '808': 'OVEROL ENTERIZO',
  '809': 'OVEROL ENTERIZO C/REFL',
  '810': 'OVEROL FONTANERO SIN PUNT',
  '811': 'OVEROL FONTANERO CON PUNT',
  '812': 'OVEROL FONTANERO ESPECIAL',
  '813': 'OVEROL ESCAFANDRA SIN PUNT',
  '814': 'OVEROL ESCAFANDRA CON PUNT',
  '815': 'OVEROL ESCAFANDRA ESPECIAL',
  '830': 'ZAPATONES MOTORIZADOS CAÑA ALTA C/REFL',
  '827': 'ZAPATONES DAMA SILIC',
  '828': 'ZAPATONES CICLÓN',
  '829': 'ZAPATONES TORNADO',
  '831': 'PROTECTORES CALZADO',
  '832': 'ZAPATONES O PROTECT CALZADO ESP',
  '836': 'PIJAMA MOTO PEQUEÑA',
  '837': 'PIJAMA MOTO GRANDE',
  '838': 'PIJAMA MOTO EXTRAGRANDE',
  '839': 'PIJAMA CUBREMONTACARGAS',
  '840': 'PIJAMA ESPECIAL',
  '842': 'KIT DE ESTADIO INFANTIL',
  '843': 'KIT DE ESTADIO ADULTO',
  '844': 'CUBRE MORRAL',
  '846': 'PLACA REFLECTIVA',
  '847': 'REFLECTIVO PARA MALETA',
  '849': 'BOLSO PARA CONJUNTO',
  '850': 'CANGURO PLANO',
  '833': 'MANGAS CON HEBILLA',
  '834': 'MANGAS CON DOBLE RESORTE',
  '835': 'MANGAS ESPECIALES',
  '855': 'ZAPATONES ESTÉRILES',
  '841': 'COJÍN CARNICERO',
  '845': 'CUBRE SOMBRERO',
  '864': 'BRAZALETE BRIGADISTA C/REFL IMPRESO',
  '865': 'CAPUCHA MONJA',
  '899': 'OTROS ESPECIALES',
}

/** Dígitos 5-6 del código → descripción de CALIBRE (19 entradas) */
const CALIBRE_MAP: Record<string, string> = {
  '25': 'C-4',
  '39': 'C-14',
  '40': 'C-16',
  '41': 'C-18',
  '42': 'C-20',
  '43': 'C-22',
  '44': 'C-25',
  '45': 'SILC C-8',
  '47': 'VINI-CONC',
  '48': 'VINI-LON',
  '49': 'AGRO-CONC',
  '50': 'AGRO-LON',
  '51': 'AGROFLEX',
  '52': 'FRIGOFLEX',
  '53': 'REFLECTIVO',
  '54': 'SILC C-4',
  '55': 'CLEAR',
  '56': 'DOBLEFAZ',
  '99': 'OTRO MATERIAL',
}

function parseCodigo(codigo: string): {
  tipo_ip: string; tipo_ip_desc: string
  calibre: string; calibre_desc: string
} {
  if (codigo.length < 7) {
    return { tipo_ip: '', tipo_ip_desc: '', calibre: '', calibre_desc: '' }
  }
  const tipo_ip = codigo.slice(0, 3)
  const calibre  = codigo.slice(5, 7)
  return {
    tipo_ip,
    tipo_ip_desc: TIPO_IP_MAP[tipo_ip] ?? '',
    calibre,
    calibre_desc:  CALIBRE_MAP[calibre] ?? '',
  }
}

/** Tabla CONVENCIONES_LÍNEA: primer dígito del código de producto → línea */
const CONVENCIONES: Record<string, string> = {
  '1': 'M.P.',
  '3': 'PE',
  '4': 'BS',
  '5': 'BC',
  '6': 'IP',
  '7': 'EPP',
  '8': 'IP',
}

/** Índices de columnas (0-based) en informe_pendientes — formato "PEDIDOS DE VENDEDORES POR CLIENTES" */
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
  FECHA:           15,  // fecha entrega parcial
  CANT_PENDIENTE:  16,
} as const

/** Fila 2 esperada en informe_pendientes. Lanzar error si es otro reporte. */
const PENDIENTES_TITULO = 'PEDIDOS DE VENDEDORES POR CLIENTES'

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
 * Condición: col VENDED empieza con "Total" O col NIT empieza con "Total",
 * o ambas vacías.
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

  // Validar tipo de reporte: buscar el título en las primeras 6 filas
  const hasTitle = allRows.slice(0, 6).some(row =>
    row.some(cell => toStr(cell).includes(PENDIENTES_TITULO))
  )
  if (!hasTitle) {
    const found = toStr(allRows[1]?.[0]) || '(vacío)'
    throw new Error(
      `[${empresa.toUpperCase()}] Reporte incorrecto: se esperaba "${PENDIENTES_TITULO}". ` +
      `Fila 2 contiene: "${found}". Sube el informe correcto desde SIIGO.`
    )
  }

  const dataRows = filterPendientes(allRows.slice(SIIGO_DATA_START))
  const results: PedidoParsed[] = []

  for (const row of dataRows) {
    const cantPedida    = toNum(row[COL_P.CANT_PEDIDA])
    const valorPedido   = toNum(row[COL_P.VALOR_PEDIDO])
    const cantPendiente = toNum(row[COL_P.CANT_PENDIENTE])
    const valorPendiente = cantPedida > 0
      ? (valorPedido / cantPedida) * cantPendiente
      : 0

    const productoCodigo = toStr(row[COL_P.PRODUCTO])
    const linea = CONVENCIONES[productoCodigo.charAt(0)] ?? ''
    const { tipo_ip, tipo_ip_desc, calibre, calibre_desc } = parseCodigo(productoCodigo)

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
      tipo_ip,
      tipo_ip_desc,
      calibre,
      calibre_desc,
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
