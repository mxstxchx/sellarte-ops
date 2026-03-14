import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PedidoParsed } from '@/lib/parser'

export const maxDuration = 60 // segundos (Vercel Pro)

// ============================================================
// HELPER: insertar en lotes para no saturar Supabase
// ============================================================
async function insertInChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Record<string, unknown>[],
  chunkSize = 500
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await supabase.from('pedidos').insert(rows.slice(i, i + chunkSize))
    if (error) throw new Error(`Error en chunk ${i}: ${error.message}`)
  }
}

// ============================================================
// POST /api/upload
// Body: JSON { pedidos: PedidoParsed[], warnings: string[], fecha_datos: string }
// El parseo de Excel ocurre en el browser — aquí solo se persiste.
// ============================================================
export async function POST(request: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = await createAdminClient()

  const { data: profile } = await admin
    .from('app_users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['gerente', 'cargador'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos para subir archivos' }, { status: 403 })
  }

  // ── Leer body ─────────────────────────────────────────────
  let body: { pedidos: PedidoParsed[]; warnings: string[]; fecha_datos: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { pedidos, warnings, fecha_datos } = body

  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    return NextResponse.json({ error: 'No hay pedidos para guardar' }, { status: 400 })
  }

  const { data: batch, error: batchError } = await admin
    .from('upload_batches')
    .insert({
      uploaded_by:      user.id,
      uploaded_by_name: profile.full_name,
      fecha_datos,
      status:           'procesando',
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    return NextResponse.json(
      { error: `Error creando batch: ${batchError?.message}` },
      { status: 500 }
    )
  }

  const batchId = batch.id

  // ── Insertar pedidos ──────────────────────────────────────
  const rows = pedidos.map((p: PedidoParsed) => ({
    empresa:               p.empresa,
    asesor_codigo:         p.asesor_codigo,
    asesor_nombre:         p.asesor_nombre,
    cliente_nit:           p.cliente_nit,
    cliente_sucursal:      p.cliente_sucursal,
    cliente_nombre:        p.cliente_nombre,
    producto_codigo:       p.producto_codigo,
    referencia:            p.referencia,
    descripcion:           p.descripcion,
    comprobante:           p.comprobante,
    numero_siigo:          p.numero_siigo,
    sec:                   p.sec,
    cantidad_pedida:       p.cantidad_pedida,
    valor_pedido:          p.valor_pedido,
    cantidad_entrega:      p.cantidad_entrega,
    valor_entregado:       p.valor_entregado,
    fecha_entrega_parcial: p.fecha_entrega_parcial ?? null,
    cantidad_pendiente:    p.cantidad_pendiente,
    valor_pendiente:       p.valor_pendiente,
    linea:                 p.linea,
    fecha_pedido:          p.fecha_pedido ?? null,
    fecha_pactada:         p.fecha_pactada ?? null,
    pedido_vendedor:       p.pedido_vendedor,
    upload_batch_id:       batchId,
  }))

  try {
    await insertInChunks(admin, rows)
  } catch (e) {
    await admin
      .from('upload_batches')
      .update({ status: 'error', error_msg: String(e) })
      .eq('id', batchId)

    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  // ── Marcar batch como completado ──────────────────────────
  await admin
    .from('upload_batches')
    .update({ status: 'ok', total_pedidos: rows.length, warnings })
    .eq('id', batchId)

  return NextResponse.json({
    ok: true,
    batch_id:      batchId,
    total_pedidos: rows.length,
    warnings,
    fecha_datos,
  })
}
