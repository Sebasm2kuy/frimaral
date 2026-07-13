'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi, formatNumber, formatDateTime } from '@/components/shared/utils'
import { useAuthStore } from '@/stores/auth-store'
import { isStaticMode } from '@/lib/static-data'
import { hasGitHubToken, commitFiles } from '@/lib/github-api'
import { parseXLSBFile, detectarColumnas, validarEstructura, procesarFilas } from '@/lib/xlsb-client-parser'
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileUp, History, Lock, Github, Sparkles, KeyRound
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Importacion } from '@/types/domain'

export function ImportadorView() {
  const { user } = useAuthStore()
  const staticMode = isStaticMode()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)
  const [hasToken, setHasToken] = useState(typeof window !== 'undefined' && hasGitHubToken())

  const { data, refetch } = useApi<{ importaciones: Importacion[] }>(
    staticMode ? null : '/api/importaciones'
  )

  const handleFile = useCallback(async (file: File) => {
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsb', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Solo se admiten archivos .xlsb, .xlsx o .xls')
      return
    }

    // En modo estático, subir vía GitHub API
    if (staticMode) {
      if (!hasGitHubToken()) {
        toast.error('Configura tu token de GitHub primero (botón ⚙️ en el header)')
        return
      }

      setUploading(true)
      setProgress(5)
      setProgressStage('Parseando archivo XLSB...')

      try {
        // 1. Parsear el archivo client-side para validarlo
        setProgress(15)
        const parsed = await parseXLSBFile(file)

        if (parsed.hojas.length === 0) {
          throw new Error('El archivo no contiene hojas con datos válidos.')
        }

        // 2. Detectar columnas
        setProgress(30)
        setProgressStage('Detectando columnas automáticamente...')
        const columnas = detectarColumnas(parsed.hojas)
        const { valida, errores } = validarEstructura(columnas)

        if (!valida) {
          throw new Error(`Estructura inválida: ${errores.join('; ')}`)
        }

        // 3. Procesar filas para validar
        setProgress(45)
        setProgressStage('Procesando y validando datos...')
        const { operaciones, errores: errFilas, duplicados } = procesarFilas(parsed.hojas, columnas)

        if (operaciones.length === 0) {
          throw new Error('No se encontraron operaciones válidas en el archivo.')
        }

        // 4. Convertir archivo a base64
        setProgress(60)
        setProgressStage('Preparando archivo para subir a GitHub...')
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode.apply(null, Array.from(chunk) as any)
        }
        const base64 = btoa(binary)
        const fileName = `data/raw/${new Date().toISOString().slice(0, 10)}_${file.name}`

        // 5. Crear metadata
        setProgress(70)
        setProgressStage('Subiendo archivo al repositorio...')
        const metadata = {
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user?.email || 'unknown',
          hojas: parsed.hojasNombres,
          columnasDetectadas: columnas,
          operacionesValidas: operaciones.length,
          duplicadosEliminados: duplicados,
          errores: errFilas.slice(0, 10),
        }

        // 6. Subir via GitHub API
        setProgress(85)
        setProgressStage('Commit a GitHub...')
        const { commitSha } = await commitFiles(
          [
            { path: fileName, content: base64 },
            { path: `${fileName}.meta.json`, content: JSON.stringify(metadata, null, 2) },
          ],
          `feat(data): subir ${file.name} (${operaciones.length} operaciones)

Subido desde la app por ${user?.email || 'usuario'}
- ${operaciones.length} operaciones válidas
- ${duplicados} duplicados eliminados
- ${errFilas.length} errores

Será procesado automáticamente por GitHub Action.`
        )

        setProgress(100)
        setProgressStage('¡Completado!')

        setLastResult({
          commitSha,
          fileName: file.name,
          operaciones: operaciones.length,
          duplicados,
          errores: errFilas.length,
          hojas: parsed.hojasNombres,
          columnasDetectadas: columnas,
          metadataPath: `${fileName}.meta.json`,
          filePath: fileName,
        })

        toast.success(`Archivo subido. Se procesará automáticamente en ~2 minutos.`)
        setHasToken(true)
      } catch (err: any) {
        toast.error(err.message || 'Error al subir archivo')
        setProgressStage('Error')
      } finally {
        setUploading(false)
        setTimeout(() => {
          setProgress(0)
          setProgressStage('')
        }, 5000)
      }
      return
    }

    // Modo dinámico (servidor con backend)
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
  }, [refetch, user])

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
          {staticMode
            ? 'Sube archivos XLSB exportados desde INAC. Se guardan en el repositorio y se procesan automáticamente.'
            : 'Carga archivos exportados desde INAC. El sistema detecta columnas automáticamente, elimina duplicados y actualiza el histórico.'
          }
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

      {/* Aviso en modo estático - requiere token de GitHub */}
      {staticMode && !hasToken && (
        <Card className="p-5 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex gap-3">
            <div className="size-9 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
              <KeyRound className="size-4 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1 text-yellow-400">
                Configuración requerida
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Para subir archivos XLSB necesitas configurar un Personal Access Token de GitHub.
                Esto permite que la app guarde los archivos en el repositorio y los procese automáticamente.
              </p>
              <p className="text-xs text-muted-foreground">
                💡 Haz clic en el botón <strong>⚙️</strong> del header para configurar tu token.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Zona de drop - siempre visible si tiene token o modo dinámico */}
      {(!staticMode || hasToken) && (
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
              ) : staticMode ? (
                <Github className="size-8 text-primary" />
              ) : (
                <FileSpreadsheet className="size-8 text-primary" />
              )}
            </motion.div>

            <h3 className="font-semibold text-lg mb-1">
              {uploading ? progressStage : 'Arrastra un archivo XLSB aquí'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {uploading
                ? staticMode
                  ? 'Subiendo a GitHub y procesando...'
                  : 'Procesando archivo... esto puede tardar algunos minutos'
                : staticMode
                  ? 'o haz clic para seleccionar. Se subirá al repositorio y se procesará automáticamente.'
                  : 'o haz clic para seleccionar un archivo (.xlsb, .xlsx, .xls)'
              }
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

            {staticMode && hasToken && !uploading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                <Github className="size-3.5" />
                Conectado a GitHub - los archivos se procesarán automáticamente
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Resultado última subida */}
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
                  {staticMode ? 'Archivo subido a GitHub' : 'Resultado de la última importación'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {staticMode ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-emerald-500/10">
                        <p className="text-xs text-emerald-400">Operaciones válidas</p>
                        <p className="text-xl font-bold">{formatNumber(lastResult.operaciones)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-yellow-500/10">
                        <p className="text-xs text-yellow-400">Duplicados</p>
                        <p className="text-xl font-bold">{formatNumber(lastResult.duplicados)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <p className="text-xs text-red-400">Errores</p>
                        <p className="text-xl font-bold">{formatNumber(lastResult.errores)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/10">
                        <p className="text-xs text-blue-400">Commit SHA</p>
                        <p className="text-sm font-mono font-bold mt-1">{lastResult.commitSha?.slice(0, 7)}</p>
                      </div>
                    </div>

                    {lastResult.hojas && lastResult.hojas.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Hojas detectadas:</p>
                        <div className="flex gap-1 flex-wrap">
                          {lastResult.hojas.map((h: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{h}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastResult.columnasDetectadas && Object.keys(lastResult.columnasDetectadas).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Columnas detectadas:</p>
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(lastResult.columnasDetectadas).map(([campo, col]: [string, any]) => (
                            <Badge key={campo} variant="outline" className="text-xs">
                              {campo}: <span className="text-primary ml-1">{col}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Card className="p-3 bg-blue-500/5 border-blue-500/20 mt-3">
                      <div className="flex gap-2">
                        <Sparkles className="size-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p className="text-blue-400 font-medium mb-1">¿Qué pasa ahora?</p>
                          <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>GitHub Action detectó el archivo subido</li>
                            <li>Procesa el XLSB con el motor de inteligencia (1-2 min)</li>
                            <li>Genera los JSON estáticos y los commitea al repo</li>
                            <li>GitHub Pages se redespliega automáticamente (1-2 min)</li>
                            <li>Los nuevos datos aparecerán en la app</li>
                          </ol>
                          <p className="mt-2 text-xs">
                            Puedes ver el progreso en{' '}
                            <a
                              href="https://github.com/Sebasm2kuy/frimaral/actions"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              GitHub Actions →
                            </a>
                          </p>
                        </div>
                      </div>
                    </Card>
                  </>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historial - solo en modo dinámico */}
      {!staticMode && (
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
      )}
    </div>
  )
}
