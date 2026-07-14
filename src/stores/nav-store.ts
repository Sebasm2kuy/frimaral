'use client'

import { create } from 'zustand'

export type View =
  | 'radar'
  | 'productores'
  | 'productor-detalle'
  | 'competidores'
  | 'competidor-detalle'
  | 'mapa'
  | 'importador'
  | 'reportes'
  | 'alertas'
  | 'ai'

interface NavState {
  view: View
  selectedId: string | null
  setView: (view: View) => void
  select: (view: View, id: string) => void
  back: () => void
  history: View[]
}

export const useNavStore = create<NavState>((set) => ({
  view: 'radar',
  selectedId: null,
  history: ['radar'],
  setView: (view) =>
    set((state) => ({
      view,
      selectedId: view === state.view ? state.selectedId : null,
      history: [...state.history, view].slice(-10),
    })),
  select: (view, id) =>
    set((state) => ({
      view,
      selectedId: id,
      history: [...state.history, view].slice(-10),
    })),
  back: () =>
    set((state) => {
      if (state.history.length <= 1) return state
      const newHistory = [...state.history]
      newHistory.pop()
      return { view: newHistory[newHistory.length - 1], history: newHistory, selectedId: null }
    }),
}))
