'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useNavStore } from '@/stores/nav-store'
import { AppShell } from '@/components/layout/AppShell'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { RadarComercialView } from '@/components/radar/RadarComercialView'
import { ProductoresListView } from '@/components/producers/ProductoresListView'
import { ProductorDetalleView } from '@/components/producers/ProductorDetalleView'
import { CompetidoresListView } from '@/components/competitors/CompetidoresListView'
import { CompetidorDetalleView } from '@/components/competitors/CompetidorDetalleView'
import { MapaRelacionesView } from '@/components/relationships/MapaRelacionesView'
import { ImportadorView } from '@/components/importer/ImportadorView'
import { ReportesView } from '@/components/reports/ReportesView'
import { AlertasView } from '@/components/alerts/AlertasView'
import { IAComercialView } from '@/components/ai/IAComercialView'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
})

function AuthenticatedApp() {
  const { view, selectedId } = useNavStore()

  const renderView = () => {
    switch (view) {
      case 'radar':
        return <RadarComercialView />
      case 'productores':
        return <ProductoresListView />
      case 'productor-detalle':
        return selectedId ? <ProductorDetalleView productorId={selectedId} /> : <ProductoresListView />
      case 'competidores':
        return <CompetidoresListView />
      case 'competidor-detalle':
        return selectedId ? <CompetidorDetalleView competidorId={selectedId} /> : <CompetidoresListView />
      case 'mapa':
        return <MapaRelacionesView />
      case 'importador':
        return <ImportadorView />
      case 'reportes':
        return <ReportesView />
      case 'alertas':
        return <AlertasView />
      case 'ai':
        return <IAComercialView />
      default:
        return <RadarComercialView />
    }
  }

  return <AppShell>{renderView()}</AppShell>
}

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    // hidratación cliente
    requestAnimationFrame(() => setMounted(true))
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      {token ? <AuthenticatedApp /> : <LoginScreen />}
    </QueryClientProvider>
  )
}
