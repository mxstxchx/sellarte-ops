// ============================================================
// ROLES DE USUARIO
// ============================================================
export type UserRole = 'gerente' | 'asesor' | 'cargador'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  asesor_codigo?: string // código del asesor en SIIGO (solo role='asesor')
  created_at: string
}

// ============================================================
// PEDIDOS (CONSOLIDADO DESDE EXCEL SIIGO)
// ============================================================
export interface Pedido {
  id: string
  numero_pedido: string
  fecha_pedido: string          // ISO date
  fecha_entrega?: string        // ISO date
  empresa: 'empresa_1' | 'empresa_2'
  asesor_codigo: string
  asesor_nombre: string
  cliente_codigo: string
  cliente_nombre: string
  ciudad?: string
  estado: EstadoPedido
  total_bruto: number
  descuento: number
  total_neto: number
  observaciones?: string
  upload_batch_id: string       // FK → upload_batches
  created_at: string
}

export type EstadoPedido =
  | 'pendiente'
  | 'en_proceso'
  | 'despachado'
  | 'entregado'
  | 'anulado'

// ============================================================
// ITEMS DE PEDIDO
// ============================================================
export interface ItemPedido {
  id: string
  pedido_id: string
  referencia: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

// ============================================================
// UPLOAD BATCHES (HISTORIAL DE CARGAS)
// ============================================================
export interface UploadBatch {
  id: string
  uploaded_by: string           // user id
  uploaded_by_name: string
  empresa: 'empresa_1' | 'empresa_2'
  filename: string
  fecha_datos: string           // fecha de los datos del excel
  total_pedidos: number
  status: 'procesando' | 'ok' | 'error'
  error_msg?: string
  created_at: string
}

// ============================================================
// FILTROS DEL DASHBOARD
// ============================================================
export interface DashboardFilters {
  fecha_desde?: string
  fecha_hasta?: string
  empresa?: 'empresa_1' | 'empresa_2' | 'todas'
  asesor_codigo?: string
  estado?: EstadoPedido | 'todos'
}
