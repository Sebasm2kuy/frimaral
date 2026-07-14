'use client'

import { useApi, formatNumber, formatWeight, getEstadoColor } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import { Swords, Loader2, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Competidor } from '@/types/domain'

export function CompetidoresListView() {
  const { select } = useNavStore()
  const { data, isLoading } = useApi<{ competidores: Competidor[] }>('/api/competitors')

  const competidores = data?.competidores || []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Swords className="size-6 text-red-400" />
          Competidores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Otros depósitos frigoríficos y certificadores detectados en el sistema
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : competidores.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No hay competidores registrados. Importa un archivo para detectarlos automáticamente.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {competidores.map((c, i) => {
            const crecimientoPositivo = (c.crecimiento || 0) >= 0
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <Card
                  className="p-5 hover:border-red-500/40 transition-all cursor-pointer group"
                  onClick={() => select('competidor-detalle', c.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold group-hover:text-red-400 transition-colors">{c.nombre}</h3>
                      {c.pais && <p className="text-xs text-muted-foreground mt-0.5">{c.pais}</p>}
                    </div>
                    {(c.crecimiento || 0) !== 0 && (
                      <Badge variant="outline" className={
                        crecimientoPositivo
                          ? 'border-red-500/30 text-red-400 bg-red-500/10'
                          : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      }>
                        {crecimientoPositivo ? <TrendingUp className="size-3 mr-1" /> : <TrendingDown className="size-3 mr-1" />}
                        {Math.abs(c.crecimiento || 0).toFixed(0)}%
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Operaciones</p>
                      <p className="text-lg font-bold">{formatNumber(c.totalOperaciones)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peso total</p>
                      <p className="text-lg font-bold">{formatWeight(c.totalPeso)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                      <p className="text-lg font-bold">{formatNumber(c.totalClientes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Participación</p>
                      <p className="text-lg font-bold">{(c.participacion || 0).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Users className="size-3" />
                      {c.clientesCompartidos} compartidos
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertCircle className="size-3" />
                      {c.clientesExclusivos} exclusivos del competidor
                    </span>
                    {(c.captaciones ?? 0) > 0 && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 text-red-400">
                          <TrendingUp className="size-3" />
                          {c.captaciones} captaciones
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
