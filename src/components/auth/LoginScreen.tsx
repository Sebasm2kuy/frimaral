'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { apiFetch } from '@/components/shared/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

const ROLES_DEMO = [
  { rol: 'Administrador', email: 'admin@caliral.com', password: 'admin123', desc: 'Acceso total, gestión de usuarios y configuración' },
  { rol: 'Comercial', email: 'comercial@caliral.com', password: 'comercial123', desc: 'Análisis comercial, importación de archivos y reportes' },
  { rol: 'Solo Lectura', email: 'lector@caliral.com', password: 'lector123', desc: 'Visualización de dashboards y reportes sin edición' },
]

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await apiFetch<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setAuth(res.token, res.user)
      toast.success(`Bienvenido, ${res.user.nombre}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-chart-4/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Lado izquierdo - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden md:block space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Activity className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CALIRAL INSIGHT</h1>
              <p className="text-sm text-muted-foreground">Inteligencia Comercial</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-semibold leading-tight">
              Descubre inteligencia comercial en tiempo real.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Sistema profesional para el Departamento Comercial de CALIRAL. Detecta automáticamente
              clientes perdidos, recuperados, competidores crecientes y oportunidades de negocio.
            </p>
            <div className="space-y-3">
              {[
                'Importación automática de archivos XLSB desde INAC',
                'Motor de inteligencia con índice de riesgo predictivo',
                'Radar comercial con conclusiones automáticas',
                'IA integrada que responde desde tu base histórica',
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="flex items-center gap-3"
                >
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lado derecho - Formulario */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-8">
            <div className="md:hidden flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <Activity className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">CALIRAL INSIGHT</h1>
                <p className="text-xs text-muted-foreground">Inteligencia Comercial</p>
              </div>
            </div>

            <h2 className="text-2xl font-semibold mb-1">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground mb-6">Ingresa tus credenciales para continuar</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@caliral.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground mb-3">Cuentas de demostración (clic para autocompletar):</p>
              <div className="space-y-2">
                {ROLES_DEMO.map((r) => (
                  <button
                    key={r.email}
                    onClick={() => handleDemoLogin(r.email, r.password)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{r.rol}</span>
                      <span className="text-xs text-muted-foreground font-mono">{r.email}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
