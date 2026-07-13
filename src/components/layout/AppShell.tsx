'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Radar, Users, Swords, Network, Upload, FileDown,
  Bell, Sparkles, LogOut, ChevronLeft, Search, Menu, X
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useNavStore, type View } from '@/stores/nav-store'
import { apiFetch, formatRelative } from '@/components/shared/utils'
import { BuscadorGlobal } from '@/components/search/BuscadorGlobal'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { GitHubSettingsButton } from '@/components/shared/GitHubSettingsButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { Alerta } from '@/types/domain'

interface NavItem {
  view: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[] // si no se especifica, todos los roles
}

const NAV_ITEMS: NavItem[] = [
  { view: 'radar', label: 'Radar Comercial', icon: Radar },
  { view: 'productores', label: 'Productores', icon: Users },
  { view: 'competidores', label: 'Competidores', icon: Swords },
  { view: 'mapa', label: 'Mapa de Relaciones', icon: Network },
  { view: 'importador', label: 'Importador', icon: Upload, roles: ['ADMINISTRADOR', 'COMERCIAL'] },
  { view: 'reportes', label: 'Reportes', icon: FileDown },
  { view: 'alertas', label: 'Alertas', icon: Bell },
  { view: 'ai', label: 'IA Comercial', icon: Sparkles },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const { view, setView, back, history } = useNavStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0)
  // Cargar alertas no leídas
  useEffect(() => {
    const loadAlertas = async () => {
      try {
        const res = await apiFetch<{ alertas: Alerta[] }>('/api/alerts?unread=true')
        setAlertasNoLeidas(res.alertas.length)
      } catch {}
    }
    loadAlertas()
    const interval = setInterval(loadAlertas, 30000)
    return () => clearInterval(interval)
  }, [view])

  // Atajo ⌘K / Ctrl+K para abrir buscador
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const canSee = (item: NavItem) => !item.roles || (user && item.roles.includes(user.rol))

  const initials = user?.nombre
    ?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Activity className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base tracking-tight truncate">CALIRAL INSIGHT</h1>
              <p className="text-xs text-muted-foreground truncate">Inteligencia Comercial</p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.filter(canSee).map((item) => {
            const Icon = item.icon
            const isActive = view === item.view ||
              (item.view === 'productores' && view === 'productor-detalle') ||
              (item.view === 'competidores' && view === 'competidor-detalle')
            return (
              <button
                key={item.view}
                onClick={() => {
                  setView(item.view)
                  setMobileOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-transparent'
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
                <span className="truncate">{item.label}</span>
                {item.view === 'alertas' && alertasNoLeidas > 0 && (
                  <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                    {alertasNoLeidas}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer del sidebar */}
        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left">
                <Avatar className="size-8 border border-border">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user?.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.rol}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.nombre}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">Último login: {formatRelative(user?.ultimoLogin)}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout()
                  toast.success('Sesión cerrada')
                }}
                className="text-red-400 focus:text-red-400 cursor-pointer"
              >
                <LogOut className="size-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 border-b border-border glass flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>

          {history.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={back}
              className="size-8 shrink-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}

          <h2 className="font-medium text-sm hidden sm:block">
            {NAV_ITEMS.find((n) =>
              n.view === view ||
              (n.view === 'productores' && view === 'productor-detalle') ||
              (n.view === 'competidores' && view === 'competidor-detalle')
            )?.label || 'Caliral Insight'}
          </h2>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="relative hidden sm:flex items-center gap-2 h-8 w-56 lg:w-72 px-3 rounded-md border border-input bg-background/50 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              <Search className="size-3.5" />
              <span>Buscar productor, competidor...</span>
              <kbd className="ml-auto px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted">⌘K</kbd>
            </button>

            <ThemeToggle />

            <GitHubSettingsButton />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('alertas')}
              className="size-8 relative"
            >
              <Bell className="size-4" />
              {alertasNoLeidas > 0 && (
                <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full" />
              )}
            </Button>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-4 md:p-6 max-w-[1600px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Buscador Global */}
      <AnimatePresence>
        {searchOpen && (
          <BuscadorGlobal onClose={() => setSearchOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
