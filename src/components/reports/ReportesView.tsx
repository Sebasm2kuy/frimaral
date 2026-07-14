'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import {
  FileDown, FileSpreadsheet, FileText, Loader2,
  Radar, Users, Swords, AlertTriangle, Bell, TrendingUp, FileBarChart
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type ReportType = 'radar' | 'productores' | 'competidores' | 'riesgo' | 'alertas' | 'evolucion' | 'completo'

const REPORTES: Array<{
  tipo: ReportType
  titulo: string
  descripcion: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { tipo: 'completo', titulo: 'Reporte completo', descripcion: 'Incluye radar, productores, competidores y alertas en un solo archivo', icon: FileBarChart },
  { tipo: 'radar', titulo: 'Radar comercial', descripcion: 'Conclusiones automáticas y métricas globales del período', icon: Radar },
  { tipo: 'productores', titulo: 'Productores', descripcion: 'Listado completo con estado, riesgo y recomendaciones', icon: Users },
  { tipo: 'competidores', titulo: 'Competidores', descripcion: 'Análisis de competidores con captaciones y crecimiento', icon: Swords },
  { tipo: 'riesgo', titulo: 'Clientes en riesgo', descripcion: 'Productores con riesgo alto o crítico y plan de acción', icon: AlertTriangle },
  { tipo: 'alertas', titulo: 'Alertas comerciales', descripcion: 'Historial de alertas detectadas automáticamente', icon: Bell },
  { tipo: 'evolucion', titulo: 'Evolución temporal', descripcion: 'Series históricas de operaciones Caliral vs Competencia', icon: TrendingUp },
]

const FORMATOS = [
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'emerald' },
  { id: 'pdf', label: 'PDF', icon: FileText, color: 'red' },
  { id: 'csv', label: 'CSV', icon: FileDown, color: 'blue' },
] as const

export function ReportesView() {
  const { user } = useAuthStore()
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (tipo: ReportType, formato: 'excel' | 'pdf' | 'csv') => {
    setDownloading(`${tipo}-${formato}`)
    try {
      const token = JSON.parse(localStorage.getItem('caliral-auth') || '{}')?.state?.token
      const res = await fetch(`/api/reports?tipo=${tipo}&formato=${formato}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al generar reporte')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `caliral_${tipo}_${new Date().toISOString().slice(0, 10)}.${formato === 'excel' ? 'xlsx' : formato}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Reporte ${tipo} descargado en ${formato.toUpperCase()}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al generar reporte')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileDown className="size-6 text-primary" />
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera y descarga reportes en Excel, PDF o CSV con los datos más actualizados del sistema.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {REPORTES.map((r, i) => {
          const Icon = r.icon
          return (
            <motion.div
              key={r.tipo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-5 h-full flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{r.titulo}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{r.descripcion}</p>
                  </div>
                  {r.tipo === 'completo' && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      Recomendado
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-auto">
                  {FORMATOS.map((f) => {
                    const FIcon = f.icon
                    const isDownloading = downloading === `${r.tipo}-${f.id}`
                    return (
                      <Button
                        key={f.id}
                        variant="outline"
                        size="sm"
                        disabled={isDownloading}
                        onClick={() => handleDownload(r.tipo, f.id)}
                        className="flex flex-col items-center gap-1 h-auto py-3"
                      >
                        {isDownloading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FIcon className={`size-4 text-${f.color}-400`} />
                        )}
                        <span className="text-xs">{f.label}</span>
                      </Button>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {user?.rol === 'LECTOR' && (
        <Card className="p-4 border-blue-500/30 bg-blue-500/5">
          <p className="text-sm text-blue-400">
            ℹ️ Tu rol (Solo Lectura) puede descargar reportes pero no importar archivos ni modificar datos.
          </p>
        </Card>
      )}
    </div>
  )
}
