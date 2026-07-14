'use client'

import { useApi, formatDateTime, getSeveridadColor } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import {
  Bell, Loader2, CheckCircle2, AlertTriangle, AlertOctagon,
  AlertCircle, UserPlus, UserMinus, TrendingUp, ArrowRightLeft
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { apiFetch } from '@/components/shared/utils'
import { toast } from 'sonner'
import type { Alerta } from '@/types/domain'

const ICONOS_TIPO: Record<string, React.ComponentType<{ className?: string }>> = {
  CLIENTE_PERDIDO: UserMinus,
  CLIENTE_RECUPERADO: UserPlus,
  CLIENTE_NUEVO: UserPlus,
  CLIENTE_COMPARTIDO: ArrowRightLeft,
  RIESGO_ALTO: AlertTriangle,
  RIESGO_CRITICO: AlertOctagon,
  COMPETIDOR_CRECIMIENTO: TrendingUp,
  COMPETIDOR_CAPTACION: AlertCircle,
  MIGRACION: ArrowRightLeft,
  DISMINUCION: TrendingUp,
}

export function AlertasView() {
  const { select } = useNavStore()
  const { data, refetch } = useApi<{ alertas: Alerta[] }>('/api/alerts')

  const alertas = data?.alertas || []
  const noLeidas = alertas.filter((a) => !a.leida)
  const leidas = alertas.filter((a) => a.leida)

  const marcarTodasLeidas = async () => {
    try {
      await apiFetch('/api/alerts', {
        method: 'PATCH',
        body: JSON.stringify({ marcarTodas: true }),
      })
      toast.success('Todas las alertas marcadas como leídas')
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const marcarLeida = async (id: string) => {
    try {
      await apiFetch('/api/alerts', {
        method: 'PATCH',
        body: JSON.stringify({ id, leida: true }),
      })
      refetch()
    } catch {}
  }

  const renderAlerta = (a: Alerta) => {
    const Icon = ICONOS_TIPO[a.tipo] || Bell
    const sev = getSeveridadColor(a.severidad)
    return (
      <motion.div
        key={a.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className={`p-4 ${!a.leida ? 'border-l-4 border-l-primary' : 'opacity-75'}`}>
          <div className="flex gap-3">
            <div className={`size-9 rounded-lg ${sev.bg} ${sev.text} flex items-center justify-center shrink-0`}>
              <Icon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm">{a.titulo}</h3>
                <Badge variant="outline" className={`${sev.bg} ${sev.text} text-xs shrink-0`}>
                  {a.severidad}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{a.mensaje}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDateTime(a.createdAt)}</span>
                <span>·</span>
                <span>Período: {a.periodo}</span>
                {a.productorNombre && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => select('productor-detalle', a.productorId!)}
                      className="hover:text-primary hover:underline"
                    >
                      {a.productorNombre}
                    </button>
                  </>
                )}
                {a.competidorNombre && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => select('competidor-detalle', a.competidorId!)}
                      className="hover:text-red-400 hover:underline"
                    >
                      {a.competidorNombre}
                    </button>
                  </>
                )}
              </div>
            </div>
            {!a.leida && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => marcarLeida(a.id)}
                className="shrink-0"
              >
                <CheckCircle2 className="size-4" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="size-6 text-primary" />
            Alertas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {noLeidas.length} sin leer · {alertas.length} total
          </p>
        </div>
        {noLeidas.length > 0 && (
          <Button variant="outline" size="sm" onClick={marcarTodasLeidas}>
            <CheckCircle2 className="size-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {!data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : alertas.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No hay alertas registradas.</p>
        </Card>
      ) : (
        <Tabs defaultValue="no-leidas">
          <TabsList>
            <TabsTrigger value="no-leidas">
              No leídas ({noLeidas.length})
            </TabsTrigger>
            <TabsTrigger value="todas">
              Todas ({alertas.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="no-leidas" className="space-y-2 mt-4">
            {noLeidas.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-400 mx-auto mb-2" />
                No hay alertas sin leer.
              </Card>
            ) : (
              noLeidas.map(renderAlerta)
            )}
          </TabsContent>
          <TabsContent value="todas" className="space-y-2 mt-4">
            {alertas.map(renderAlerta)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
