'use client'

import { useApi, formatNumber, formatWeight, getSeveridadColor } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import {
  TrendingDown, TrendingUp, AlertTriangle, AlertOctagon, AlertCircle,
  UserPlus, UserMinus, CheckCircle, XCircle, PieChart, Sparkles,
  ArrowRight, Users, Swords, Activity, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart as RechartsPieChart, Pie, Cell,
  Legend
} from 'recharts'
import type { RadarComercial } from '@/types/domain'

const ICONOS: Record<string, React.ComponentType<{ className?: string }>> = {
  'alert-triangle': AlertTriangle,
  'alert-octagon': AlertOctagon,
  'alert-circle': AlertCircle,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'pie-chart': PieChart,
  'info': Activity,
}

export function RadarComercialView() {
  const { data: radar, isLoading } = useApi<RadarComercial>('/api/radar')
  const { select } = useNavStore()
  const { data: dashboard } = useApi<{ evolucion: any[]; stats: any }>('/api/dashboard')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!radar) return null

  const m = radar.metricas

  // Datos para gráficos
  const evolucionData = (dashboard?.evolucion || []).map((e: any) => ({
    periodo: e.periodo,
    Caliral: e.opCaliral,
    Competencia: e.opCompetencia,
  }))

  const estadosData = [
    { name: 'Exclusivos', value: m.productoresExclusivos, color: '#10b981' },
    { name: 'Compartidos', value: m.productoresCompartidos, color: '#eab308' },
    { name: 'Nuevos', value: m.productoresNuevos, color: '#3b82f6' },
    { name: 'Recuperados', value: m.productoresRecuperados, color: '#06b6d4' },
    { name: 'Perdidos', value: m.productoresPerdidos, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const topCompetidoresData = radar.topCompetidores
    .slice(0, 5)
    .map((c) => ({
      nombre: c.competidor.nombre,
      operaciones: c.competidor.totalOperaciones || 0,
      crecimiento: c.crecimiento,
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            Radar Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Período: <span className="font-medium text-foreground">{radar.periodo}</span>
            {' · '}
            Generado: <span className="font-medium text-foreground">
              {new Date(radar.fechaGeneracion).toLocaleString('es-UY')}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => select('ai', '')}
          className="self-start"
        >
          <Sparkles className="size-4 mr-2" />
          Preguntar a la IA
        </Button>
      </div>

      {/* Conclusiones automáticas - lo principal */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Conclusiones automáticas
        </h2>
        {radar.conclusiones.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No hay conclusiones para mostrar. Importa un archivo para activar el radar.
          </Card>
        ) : (
          <div className="grid gap-3">
            {radar.conclusiones.map((c, i) => {
              const Icon = ICONOS[c.icono] || Activity
              const sev = getSeveridadColor(c.severidad)
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`p-4 border-l-4 ${
                    c.severidad === 'CRITICAL' ? 'border-l-red-500' :
                    c.severidad === 'WARNING' ? 'border-l-yellow-500' :
                    c.severidad === 'SUCCESS' ? 'border-l-emerald-500' :
                    'border-l-blue-500'
                  }`}>
                    <div className="flex gap-3">
                      <div className={`size-9 rounded-lg ${sev.bg} ${sev.text} flex items-center justify-center shrink-0`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1">{c.titulo}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{c.mensaje}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Métricas clave */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Productores totales"
          value={formatNumber(m.totalProductores)}
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Operaciones Caliral"
          value={formatNumber(m.totalOperacionesCaliral)}
          icon={<Activity className="size-4" />}
        />
        <MetricCard
          label="Participación"
          value={`${m.participacionCaliral.toFixed(1)}%`}
          icon={<PieChart className="size-4" />}
          highlight={m.participacionCaliral < 50 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Clientes en riesgo"
          value={formatNumber(m.clientesEnRiesgo)}
          icon={<AlertTriangle className="size-4" />}
          highlight={m.clientesEnRiesgo > 0 ? 'danger' : undefined}
        />
        <MetricCard
          label="Competidores activos"
          value={formatNumber(m.competidoresActivos)}
          icon={<Swords className="size-4" />}
        />
        <MetricCard
          label="Peso Caliral"
          value={formatWeight(m.totalPesoCaliral)}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Exclusivos', value: m.productoresExclusivos, color: 'emerald' },
          { label: 'Compartidos', value: m.productoresCompartidos, color: 'yellow' },
          { label: 'Nuevos', value: m.productoresNuevos, color: 'blue' },
          { label: 'Recuperados', value: m.productoresRecuperados, color: 'cyan' },
          { label: 'Perdidos', value: m.productoresPerdidos, color: 'red' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold text-${s.color}-400`}>{formatNumber(s.value)}</p>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Evolución de operaciones */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4">Evolución de operaciones: Caliral vs Competencia</h3>
          {evolucionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={evolucionData}>
                <defs>
                  <linearGradient id="colorCaliral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompetencia" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="Caliral" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCaliral)" />
                <Area type="monotone" dataKey="Competencia" stroke="#ef4444" strokeWidth={2} fill="url(#colorCompetencia)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sin datos de evolución
            </div>
          )}
        </Card>

        {/* Distribución de estados */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Distribución de clientes</h3>
          {estadosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie
                  data={estadosData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {estadosData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(240 6% 16%)',
                    border: '1px solid hsl(240 4% 30%)',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sin datos
            </div>
          )}
        </Card>
      </div>

      {/* Top competidores y clientes en riesgo */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top competidores */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Competidores destacados</h3>
            <Button variant="ghost" size="sm" onClick={() => useNavStore.getState().setView('competidores')}>
              Ver todos
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
          {topCompetidoresData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCompetidoresData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 30%)" opacity={0.3} horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="nombre" type="category" stroke="#94a3b8" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(240 6% 16%)',
                    border: '1px solid hsl(240 4% 30%)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="operaciones" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Sin competidores activos
            </div>
          )}
        </Card>

        {/* Clientes en riesgo */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Clientes en riesgo prioritario</h3>
            <Button variant="ghost" size="sm" onClick={() => useNavStore.getState().setView('productores')}>
              Ver todos
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
          {radar.clientesEnRiesgo.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {radar.clientesEnRiesgo.slice(0, 8).map((c, i) => (
                <button
                  key={c.productor.id}
                  onClick={() => select('productor-detalle', c.productor.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
                >
                  <div className={`size-2 rounded-full ${
                    c.riskLevel === 'CRITICO' ? 'bg-red-500' : 'bg-orange-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {c.productor.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.motivo}</p>
                  </div>
                  <Badge variant="outline" className={
                    c.riskLevel === 'CRITICO'
                      ? 'border-red-500/30 text-red-400'
                      : 'border-orange-500/30 text-orange-400'
                  }>
                    {c.riskScore}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              <CheckCircle className="size-5 mr-2 text-emerald-400" />
              No hay clientes en riesgo
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  label, value, icon, highlight,
}: {
  label: string
  value: string
  icon: React.ReactNode
  highlight?: 'success' | 'warning' | 'danger'
}) {
  const colorClass =
    highlight === 'danger' ? 'text-red-400' :
    highlight === 'warning' ? 'text-yellow-400' :
    highlight === 'success' ? 'text-emerald-400' :
    'text-foreground'

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
    </Card>
  )
}
