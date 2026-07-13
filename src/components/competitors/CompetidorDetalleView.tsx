'use client'

import { useApi, formatNumber, formatWeight, formatDate, formatDateTime } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, Swords, TrendingUp, Users, AlertCircle,
  Activity, History, Target
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'

export function CompetidorDetalleView({ competidorId }: { competidorId: string }) {
  const { back, select } = useNavStore()
  const { data, isLoading } = useApi<any>(`/api/competitors/${competidorId}`)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  const { competidor, clientes, captaciones, evolucion, compartidos, exclusivos } = data

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={back} className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{competidor.nombre}</h1>
            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
              Competidor
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Depósito frigorífico / certificador competidor de Caliral
          </p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Clientes totales</p>
          <p className="text-2xl font-bold text-red-400">{formatNumber(clientes.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Compartidos con Caliral</p>
          <p className="text-2xl font-bold text-yellow-400">{formatNumber(compartidos.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Exclusivos del competidor</p>
          <p className="text-2xl font-bold text-red-400">{formatNumber(exclusivos.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Captaciones (clientes de Caliral)</p>
          <p className="text-2xl font-bold text-red-400">{formatNumber(captaciones.length)}</p>
        </Card>
      </div>

      {/* Evolución */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-red-400" />
            Evolución del competidor
          </CardTitle>
        </CardHeader>
        {evolucion.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolucion}>
              <defs>
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
              <Area type="monotone" dataKey="operaciones" name="Operaciones" stroke="#ef4444" strokeWidth={2} fill="url(#colorComp)" />
              <Area type="monotone" dataKey="clientes" name="Clientes" stroke="#eab308" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Sin datos de evolución</p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Clientes del competidor */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Clientes del competidor ({clientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin clientes en el período actual.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientes.map((c: any) => (
                  <button
                    key={c.productorId}
                    onClick={() => select('productor-detalle', c.productorId)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(c.operacionesCompetidor)} op · {formatWeight(c.pesoCompetidor)}
                        {c.operacionesCaliral > 0 && ` · ${c.operacionesCaliral} op. con Caliral`}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      c.tipo === 'COMPARTIDO'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }>
                      {c.tipo === 'COMPARTIDO' ? 'Compartido' : 'Exclusivo competidor'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Captaciones */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4 text-red-400" />
              Captaciones de clientes de Caliral
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {captaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este competidor no ha captado clientes de Caliral en el período actual.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {captaciones.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => a.productorId && select('productor-detalle', a.productorId)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-left"
                  >
                    <AlertCircle className="size-4 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.productor?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{a.mensaje}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas operaciones */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-red-400" />
            Últimas operaciones del competidor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.operaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin operaciones registradas.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.operaciones.slice(0, 20).map((op: any) => (
                <div key={op.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-sm">
                  <div>
                    <p className="font-medium">{op.productor?.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(op.fecha)} · {op.producto || 'Sin producto'} · {formatWeight(op.pesoKg)}
                    </p>
                  </div>
                  {op.destino && (
                    <Badge variant="secondary" className="text-xs">{op.destino.nombre}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
