'use client'

import { useState } from 'react'
import { useApi, formatNumber, formatWeight, formatDate, getRiskColor, getEstadoColor, getEstadoLabel } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import { Search, Users, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Productor } from '@/types/domain'

export function ProductoresListView() {
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS')
  const [riesgoFiltro, setRiesgoFiltro] = useState('TODOS')
  const { select } = useNavStore()

  const { data, isLoading } = useApi<{ productores: Productor[] }>(
    `/api/producers?${new URLSearchParams({
      busqueda,
      estado: estadoFiltro,
      riskLevel: riesgoFiltro,
    }).toString()}`
  )

  const productores = data?.productores || []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" />
          Productores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatNumber(productores.length)} productor(es) en el período actual
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-9"
            />
          </div>
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estados</SelectItem>
              <SelectItem value="EXCLUSIVO">Exclusivos</SelectItem>
              <SelectItem value="COMPARTIDO">Compartidos</SelectItem>
              <SelectItem value="NUEVO">Nuevos</SelectItem>
              <SelectItem value="RECUPERADO">Recuperados</SelectItem>
              <SelectItem value="PERDIDO">Perdidos</SelectItem>
              <SelectItem value="INACTIVO">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riesgoFiltro} onValueChange={setRiesgoFiltro}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Riesgo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los riesgos</SelectItem>
              <SelectItem value="CRITICO">Crítico</SelectItem>
              <SelectItem value="ALTO">Alto</SelectItem>
              <SelectItem value="MEDIO">Medio</SelectItem>
              <SelectItem value="BAJO">Bajo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : productores.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No se encontraron productores con los filtros seleccionados.
        </Card>
      ) : (
        <div className="grid gap-2">
          {productores.map((p, i) => {
            const riskC = getRiskColor(p.riskLevel)
            const estadoC = getEstadoColor(p.estado)
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card
                  className="p-4 hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => select('productor-detalle', p.id)}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {p.nombre}
                        </h3>
                        <Badge variant="outline" className={`${estadoC.bg} ${estadoC.text} ${estadoC.border} text-xs`}>
                          {getEstadoLabel(p.estado)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatNumber(p.operacionesCaliralTotal)} op. Caliral</span>
                        <span>·</span>
                        <span>{formatNumber(p.operacionesCompetenciaTotal)} op. Competencia</span>
                        <span>·</span>
                        <span>Part. {p.participacionCaliral?.toFixed(0)}%</span>
                        {p.ultimaOperacionCaliral && (
                          <>
                            <span>·</span>
                            <span>Última: {formatDate(p.ultimaOperacionCaliral)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {p.competidoresUsados && p.competidoresUsados.length > 0 && (
                      <div className="hidden md:flex items-center gap-1 flex-wrap max-w-xs">
                        {p.competidoresUsados.slice(0, 3).map((c, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <div className={`size-2 rounded-full ${riskC.dot}`} />
                          <span className={`text-xs font-medium ${riskC.text}`}>{p.riskLevel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Score: {p.riskScore}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver ficha →
                      </Button>
                    </div>
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
