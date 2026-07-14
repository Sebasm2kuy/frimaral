'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario } from '@/types/domain'

interface AuthState {
  token: string | null
  user: Usuario | null
  setAuth: (token: string, user: Usuario) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'caliral-auth' }
  )
)
