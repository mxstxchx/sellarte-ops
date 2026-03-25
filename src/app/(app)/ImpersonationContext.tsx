'use client'

import { createContext, useContext, useState } from 'react'

export interface ImpersonatedUser {
  codigo: number | null    // asesor_codigo (null if not an asesor)
  nombre: string
  role: string
}

interface ContextValue {
  impersonateAs: ImpersonatedUser | null
  setImpersonateAs: (v: ImpersonatedUser | null) => void
}

const ImpersonationContext = createContext<ContextValue>({
  impersonateAs: null,
  setImpersonateAs: () => {},
})

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonateAs, setImpersonateAs] = useState<ImpersonatedUser | null>(null)
  return (
    <ImpersonationContext.Provider value={{ impersonateAs, setImpersonateAs }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  return useContext(ImpersonationContext)
}
