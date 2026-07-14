'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { Search, X, Users, Swords, MapPin, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  productor: Users,
  competidor: Swords,
  certificador: Building2,
  destino: MapPin,
}

const TIPO_COLOR: Record<string, string> = {
  productor: 'text-emerald-400',
  competidor: 'text-red-400',
  certificador: 'text-blue-400',
  destino: 'text-yellow-400',
}

export function BuscadorGlobal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<any>(null)
  const { select } = useNavStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      // No buscar con query muy corto
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (!cancelled) setResultados(res.resultados)
      } catch {}
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  // Reset resultados cuando query se vacía
  const resultadosFiltrados = query.length < 2 ? null : resultados

  const handleSelect = (item: any) => {
    if (item.tipo === 'productor') select('productor-detalle', item.id)
    else if (item.tipo === 'competidor') select('competidor-detalle', item.id)
    onClose()
  }

  const total = resultadosFiltrados ? resultadosFiltrados.productores.length + resultadosFiltrados.competidores.length + resultadosFiltrados.certificadores.length + resultadosFiltrados.destinos.length : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-3 border-b border-border">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productores, competidores, destinos..."
            className="pl-10 pr-10 border-0 focus-visible:ring-0 text-base"
          />
          <button
            onClick={onClose}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Escribe al menos 2 caracteres para buscar.
              <br />
              Ejemplos: "Las Moras", "Frioport", "Caliral", "China"
            </div>
          ) : !resultadosFiltrados ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Buscando...</div>
          ) : total === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            <div className="p-2">
              {(['certificador', 'productor', 'competidor', 'destino'] as const).map((tipo) => {
                const items = resultadosFiltrados[`${tipo === 'certificador' ? 'certificadores' : tipo + 's'}`] || []
                if (items.length === 0) return null
                return (
                  <div key={tipo} className="mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-1">
                      {tipo === 'productor' ? 'Productores' : tipo === 'competidor' ? 'Competidores' : tipo === 'certificador' ? 'Certificadores' : 'Destinos'} ({items.length})
                    </p>
                    {items.map((item: any) => {
                      const Icon = TIPO_ICON[item.tipo] || Users
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
                        >
                          <Icon className={`size-4 ${TIPO_COLOR[item.tipo]}`} />
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.nombre}</span>
                          <Badge variant="outline" className="ml-auto text-xs">{item.tipo}</Badge>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
