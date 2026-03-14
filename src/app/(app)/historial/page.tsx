import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import HistorialClient from './HistorialClient'

export const dynamic = 'force-dynamic'

export default async function HistorialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await createAdminClient()
  const { data: batches } = await admin
    .from('upload_batches')
    .select('id, fecha_datos, uploaded_by_name, created_at, total_pedidos, status, error_msg, warnings')
    .order('created_at', { ascending: false })
    .limit(50)

  return <HistorialClient batches={batches ?? []} userId={user!.id} />
}
