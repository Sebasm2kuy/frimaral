'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi, formatNumber, formatDateTime } from '@/components/shared/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileUp, History
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Importacion } from '@/types/domain'

export function ImportadorView() {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  const { data, refetch } = useApi<{ importaciones: Importacion[] }>('/api/importaciones')

  const handleFile = useCallback(async (file: File) => {
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsb', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Solo se admiten archivos .xlsb, .xlsx o .xls')
      return
    }

    setUploading(true)
    setProgress(0)
    setProgressStage('Iniciando...')
    setLastResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = JSON.parse(localStorage.getItem('caliral-auth') || '{}')?.state?.token

      let progressInterval = setInterval(() => {
        setProgress((p) => {
          if (p < 30) return p + 5
          if (p < 60) return p + 3
          if (p < 90) return p + 1
          return p
        })
      }, 500)

      setProgressStage('Procesando archivo XLSB...')

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)
      setProgressStage('Completado')

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al importar')

      setLastResult(result)
      toast.success(`Importación completada: ${result.validRows} operaciones válidas`)
      refetch()
    } catch (err: any) {
      toast.error(err.message || 'Error al importar archivo')
      setProgressStage('Error')
    } finally {
      setUploading(false)
      setTimeout(() => {
        setProgress(0)
        setProgressStage('')
      }, 3000)
    }
  }, [refetch])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const importaciones = data?.importaciones || []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="size-6 text-primary" />
          Importador XLSB
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carga archivos exportados desde INAC. El sistema detecta columnas automáticamente,
          elimina duplicados y actualiza el histórico sin sobrescribir datos previos.
        </p>
      </div>

      {user?.rol === 'LECTOR' && (
        <Card className="p-4 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="size-4" />
            <p className="text-sm">Tu rol (Solo Lectura) no permite importar archivos.</p>
          </div>
        </Card>
      )}

      <Card
        className={`p-8 border-2 border-dashed transition-all ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center justify-center text-center py-8">
          <motion.div
            animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
            className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20"
          >
            {uploading ? (
              <Loader2 className="size-8 text-primary animate-spin" />
            ) : (
              <FileSpreadsheet className="size-8 text-primary" />
            )}
          </motion.div>

          <h3 className="font-semibold text-lg mb-1">
            {uploading ? progressStage : 'Arrastra un archivo XLSB aquí'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {uploading
              ? 'Procesando archivo... esto puede tardar algunos minutos'
              : 'o haz clic para seleccionar un archivo (.xlsb, .xlsx, .xls)'}
          </p>

          {uploading && (
            <div className="w-full max-w-md space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}

          {!uploading && user?.rol !== 'LECTOR' && (
            <label>
              <input
                type="file"
                accept=".xlsb,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <Button asChild>
                <span>
                  <FileUp className="size-4 mr-2" />
                  Seleccionar archivo
                </span>
              </Button>
            </label>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-5">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Resultado de la última importación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <p className="text-xs text-emerald-400">Operaciones válidas</p>
                    <p className="text-xl font-bold">{formatNumber(lastResult.validRows)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-500/10">
                    <p className="text-xs text-yellow-400">Duplicados</p>
                    <p className="text-xl font-bold">{formatNumber(lastResult.duplicateRows)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10">
                    <p className="text-xs text-red-400">Errores</p>
                    <p className="text-xl font-bold">{formatNumber(lastResult.errorRows)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <p className="text-xs text-blue-400">Alertas generadas</p>
                    <p className="text-xl font-bold">{formatNumber(lastResult.alertasGeneradas)}</p>
                  </div>
                </div>

                {lastResult.hojasDetectadas && lastResult.hojasDetectadas.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Hojas detectadas:</p>
                    <div className="flex gap-1 flex-wrap">
                      {lastResult.hojasDetectadas.map((h: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{h}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {lastResult.columnasDetectadas && Object.keys(lastResult.columnasDetectadas).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Columnas detectadas automáticamente:</p>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(lastResult.columnasDetectadas).map(([campo, col]: [string, any]) => (
                        <Badge key={campo} variant="outline" className="text-xs">
                          {campo}: <span className="text-primary ml-1">{col}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            Historial de importaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {importaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay importaciones registradas.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {importaciones.map((imp) => (
                <div key={imp.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                    imp.status === 'COMPLETADO' ? 'bg-emerald-500/10 text-emerald-400' :
                    imp.status === 'ERROR' ? 'bg-red-500/10 text-red-400' :
                    imp.status === 'PARCIAL' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {imp.status === 'COMPLETADO' ? <CheckCircle2 className="size-4" /> :
                     imp.status === 'ERROR' ? <XCircle className="size-4" /> :
                     <AlertTriangle className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{imp.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(imp.startedAt)} · {formatNumber(imp.validRows)} válidas
                      {imp.duplicateRows > 0 && ` · ${imp.duplicateRows} duplicadas`}
                      {imp.errorRows > 0 && ` · ${imp.errorRows} errores`}
                    </p>
                  </div>
                  <Badge variant="outline" className={
                    imp.status === 'COMPLETADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    imp.status === 'ERROR' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    imp.status === 'PARCIAL' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                    'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  }>
                    {imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
