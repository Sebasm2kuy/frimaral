'use client'

import { useApi, formatNumber, formatWeight, formatDate, formatDateTime, getRiskColor, getEstadoColor, getEstadoLabel } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, AlertTriangle, TrendingDown, TrendingUp,
  Activity, Calendar, MapPin, Building2, Lightbulb, History, Swords
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'

export function ProductorDetalleView({ productorId }: { productorId: string }) {
  const { back, select } = useNavStore()
  const { data, isLoading } = useApi<any>(`/api/producers/${productorId}`)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  const { productor, evolucion, operacionesCaliral, operacionesCompetencia, competidores, alertas, riskFactores, destinosPrincipales } = data
  const riskC = getRiskColor(productor.riskLevel)
  const estadoC = getEstadoColor(productor.estado)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={back} className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{productor.nombre}</h1>
            <Badge variant="outline" className={`${estadoC.bg} ${estadoC.text} ${estadoC.border}`}>
              {getEstadoLabel(productor.estado)}
            </Badge>
            <Badge variant="outline" className={`${riskC.bg} ${riskC.text} ${riskC.border}`}>
              Riesgo {productor.riskLevel} · Score {productor.riskScore}
            </Badge>
          </div>
          {productor.razonSocial && (
            <p className="text-sm text-muted-foreground mt-1">{productor.razonSocial}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
            {productor.cuit && (
              <span className="flex items-center gap-1">
                <Building2 className="size-3" /> CUIT: {productor.cuit}
              </span>
            )}
            {productor.localidad && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {productor.localidad}, {productor.provincia}
              </span>
            )}
            {productor.primeraOperacionCaliral && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" /> Primera op.: {formatDate(productor.primeraOperacionCaliral)}
              </span>
            )}
            {productor.ultimaOperacionCaliral && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" /> Última op.: {formatDate(productor.ultimaOperacionCaliral)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recomendación comercial */}
      {productor.recomendacion && (
        <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
          <div className="flex gap-3">
            <Lightbulb className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm mb-1">Recomendación comercial</h3>
              <p className="text-sm text-muted-foreground">{productor.recomendacion}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Operaciones Caliral</p>
          <p className="text-2xl font-bold text-primary">{formatNumber(productor.operacionesCaliralTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Operaciones Competencia</p>
          <p className="text-2xl font-bold text-red-400">{formatNumber(productor.operacionesCompetenciaTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Participación Caliral</p>
          <p className="text-2xl font-bold">{productor.participacionCaliral?.toFixed(0)}%</p>
          <Progress value={productor.participacionCaliral || 0} className="h-1.5 mt-2" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Competidores usados</p>
          <p className="text-2xl font-bold">{formatNumber(competidores.length)}</p>
        </Card>
      </div>

      {/* Factores de riesgo */}
      {riskFactores && (
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-yellow-400" />
              Análisis de riesgo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {riskFactores.detalle.length === 0 ? (
              <p className="text-sm text-muted-foreground">No se detectaron factores de riesgo.</p>
            ) : (
              <div className="space-y-2">
                {riskFactores.detalle.map((d: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="size-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                    <span className="text-muted-foreground">{d}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Disminución ops.</p>
                <p className="text-sm font-medium">{(riskFactores.disminucionOperaciones * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Uso competidor crec.</p>
                <p className="text-sm font-medium">{(riskFactores.usoCompetidorCreciente * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días sin operar</p>
                <p className="text-sm font-medium">{riskFactores.tiempoSinOperar}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cambio certificador</p>
                <p className="text-sm font-medium">{riskFactores.cambioCertificador ? 'Sí' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolución */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Evolución de operaciones
          </CardTitle>
        </CardHeader>
        {evolucion.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={evolucion}>
              <defs>
                <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 30%)" opacity={0.3} />
              <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(240 6% 16%)',
                  border: '1px solid hsl(240 4% 30%)',
                  borderRadius: '8px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="operacionesCaliral" name="Caliral" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCal)" />
              <Area type="monotone" dataKey="operacionesCompetencia" name="Competencia" stroke="#ef4444" strokeWidth={2} fill="url(#colorComp)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Sin datos de evolución</p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Competidores usados */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="size-4 text-red-400" />
              Competidores usados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {competidores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opera con competidores.</p>
            ) : (
              <div className="space-y-2">
                {competidores.map((c: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => select('competidor-detalle', c.competidorId)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-red-500/30 hover:bg-accent transition-all text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium group-hover:text-red-400 transition-colors">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(c.operaciones)} operaciones · {formatWeight(c.peso)}</p>
                    </div>
                    <TrendingUp className="size-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Destinos principales */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="size-4 text-emerald-400" />
              Destinos principales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {destinosPrincipales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de destinos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={destinosPrincipales} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 30%)" opacity={0.3} horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="nombre" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(240 6% 16%)',
                      border: '1px solid hsl(240 4% 30%)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="operaciones" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline de alertas */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            Timeline de eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a: any) => (
                <div key={a.id} className="flex gap-3 p-3 rounded-lg border border-border">
                  <div className={`size-2 rounded-full mt-2 shrink-0 ${
                    a.severidad === 'CRITICAL' ? 'bg-red-500' :
                    a.severidad === 'WARNING' ? 'bg-yellow-500' :
                    a.severidad === 'SUCCESS' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.mensaje}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas operaciones */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Últimas operaciones con Caliral
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {operacionesCaliral.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin operaciones con Caliral.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {operacionesCaliral.slice(0, 15).map((op: any) => (
                <div key={op.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-sm">
                  <div>
                    <p className="font-medium">{op.producto || 'Sin producto'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(op.fecha)} · {formatNumber(op.cantidad)} u · {formatWeight(op.pesoKg)}
                    </p>
                  </div>
                  <div className="text-right">
                    {op.destino && (
                      <Badge variant="secondary" className="text-xs">{op.destino.nombre}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
