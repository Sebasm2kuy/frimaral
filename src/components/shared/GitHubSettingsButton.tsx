'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, X, Key, Check, AlertCircle, Loader2, ExternalLink,
  ShieldCheck, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getGitHubToken, setGitHubToken, clearGitHubToken,
  verifyToken, hasGitHubToken,
} from '@/lib/github-api'

export function GitHubSettingsButton() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [userName, setUserName] = useState('')
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasToken(hasGitHubToken())
  }, [open])

  const handleVerify = async () => {
    if (!token) return
    setVerifying(true)
    setGitHubToken(token)
    const result = await verifyToken()
    if (result.valid) {
      setVerified(true)
      setUserName(result.user || '')
      setHasToken(true)
      toast.success(`Token válido. Conectado como @${result.user}`)
    } else {
      setVerified(false)
      clearGitHubToken()
      toast.error(result.error || 'Token inválido')
    }
    setVerifying(false)
  }

  const handleClear = () => {
    clearGitHubToken()
    setToken('')
    setVerified(false)
    setHasToken(false)
    setUserName('')
    toast.success('Token eliminado')
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="size-8"
        title="Configuración de GitHub"
      >
        <Settings className="size-4" />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Key className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Configuración de GitHub</h2>
                    <p className="text-xs text-muted-foreground">Token para subir archivos XLSB</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {hasToken ? (
                  <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <Check className="size-4" />
                      <span className="text-sm font-medium">Token configurado</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ya puedes subir archivos XLSB desde el Importador. Los datos se guardarán
                      en el repositorio y se procesarán automáticamente.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      className="mt-3 text-red-400 hover:text-red-500"
                    >
                      <Trash2 className="size-3.5 mr-1.5" />
                      Eliminar token
                    </Button>
                  </Card>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Personal Access Token (PAT)</Label>
                      <Input
                        type="password"
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value)
                          setVerified(false)
                        }}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="font-mono text-xs"
                      />
                    </div>

                    <Button
                      onClick={handleVerify}
                      disabled={!token || verifying}
                      className="w-full"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Verificando...
                        </>
                      ) : verified ? (
                        <>
                          <Check className="size-4 mr-2" />
                          Conectado como @{userName}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-4 mr-2" />
                          Verificar y guardar token
                        </>
                      )}
                    </Button>

                    <Card className="p-4 border-blue-500/30 bg-blue-500/5">
                      <div className="flex gap-2">
                        <AlertCircle className="size-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-2 text-muted-foreground">
                          <p className="text-blue-400 font-medium">Cómo crear un token:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>
                              Ve a{' '}
                              <a
                                href="https://github.com/settings/tokens/new?scopes=repo&description=CALIRAL%20INSIGHT"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                              >
                                GitHub Settings → Tokens
                                <ExternalLink className="size-3" />
                              </a>
                            </li>
                            <li>Selecciona el scope <Badge variant="secondary" className="text-xs">repo</Badge> (acceso al repositorio)</li>
                            <li>Click en "Generate token"</li>
                            <li>Copia el token y pégalo arriba</li>
                          </ol>
                          <p className="pt-2 text-yellow-400">
                            ⚠️ El token se guarda solo en tu navegador (localStorage) y solo se envía a GitHub.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
