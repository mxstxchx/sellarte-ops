import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AppShell from './AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('app_users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Fetch all switchable users for gerente (to power the user switcher)
  let allUsers: { id: string; full_name: string; role: string; asesor_codigo: number | null }[] = []
  if (profile?.role === 'gerente') {
    const { data } = await admin
      .from('app_users')
      .select('id, full_name, role, asesor_codigo')
      .neq('id', user.id)
      .order('role')
      .order('full_name')
    allUsers = data ?? []
  }

  return (
    <AppShell profile={profile} allUsers={allUsers}>
      {children}
    </AppShell>
  )
}
