import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import CalendarioClient from './CalendarioClient'

export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('app_users')
    .select('full_name, role, asesor_codigo')
    .eq('id', user!.id)
    .single()

  // Cargador no tiene acceso al calendario
  if (profile?.role === 'cargador') redirect('/dashboard')

  // Último batch procesado exitosamente
  const { data: batch } = await admin
    .from('upload_batches')
    .select('id, fecha_datos, uploaded_by_name, created_at, total_pedidos, warnings')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let pedidos: unknown[] = []

  if (batch) {
    let query = admin
      .from('pedidos')
      .select('empresa, asesor_codigo, asesor_nombre, cliente_nit, cliente_nombre, numero_siigo, pedido_vendedor, cantidad_pendiente, fecha_pactada, sec')
      .eq('upload_batch_id', batch.id)
      .order('fecha_pactada', { ascending: true })

    // Asesor solo ve sus propios pedidos
    if (profile?.role === 'asesor' && profile?.asesor_codigo) {
      query = query.eq('asesor_codigo', profile.asesor_codigo)
    }

    const { data } = await query
    pedidos = data ?? []
  }

  return (
    <CalendarioClient
      pedidos={pedidos}
      batch={batch}
      profile={profile}
    />
  )
}
