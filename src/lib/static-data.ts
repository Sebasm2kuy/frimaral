/**
 * Capa de datos estática para GitHub Pages
 * Cuando NEXT_PUBLIC_STATIC_MODE=true, las consultas se hacen desde /data/*.json
 * en lugar de llamar a las API Routes (que no existen en GitHub Pages).
 */

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === 'true'

// Mapa de URLs API → archivos JSON estáticos
function apiToStaticUrl(url: string): string | null {
  // Radar
  if (url === '/api/radar') return '/data/radar.json'

  // Dashboard
  if (url === '/api/dashboard') return '/data/dashboard.json'

  // Alerts
  if (url === '/api/alerts' || url.startsWith('/api/alerts?')) return '/data/alertas.json'

  // Productores list
  if (url.startsWith('/api/producers?') || url === '/api/producers') return '/data/productores.json'

  // Productor detalle
  const prodMatch = url.match(/^\/api\/producers\/([^?]+)$/)
  if (prodMatch) return `/data/productores/${prodMatch[1]}.json`

  // Competidores list
  if (url.startsWith('/api/competitors?') || url === '/api/competitors') return '/data/competidores.json'

  // Competidor detalle
  const compMatch = url.match(/^\/api\/competitors\/([^?]+)$/)
  if (compMatch) return `/data/competidores/${compMatch[1]}.json`

  // Search
  if (url.startsWith('/api/search?')) {
    // En modo estático, devolvemos el índice y filtramos client-side
    return '/data/search-index.json'
  }

  return null
}

export async function staticFetch<T>(url: string): Promise<T | null> {
  if (!STATIC_MODE) return null
  const staticUrl = apiToStaticUrl(url)
  if (!staticUrl) return null

  const res = await fetch(staticUrl)
  if (!res.ok) return null

  const data = await res.json()

  // Para search, filtrar client-side
  if (url.startsWith('/api/search?')) {
    const params = new URLSearchParams(url.split('?')[1])
    const q = (params.get('q') || '').toUpperCase()
    if (!q || q.length < 2) {
      return { resultados: { productores: [], competidores: [], certificadores: [], destinos: [] }, total: 0 } as T
    }
    const resultados = {
      productores: data.productores.filter((p: any) => p.nombre.toUpperCase().includes(q)),
      competidores: data.competidores.filter((c: any) => c.nombre.toUpperCase().includes(q)),
      certificadores: data.certificadores.filter((c: any) => c.nombre.toUpperCase().includes(q)),
      destinos: data.destinos.filter((d: any) => d.nombre.toUpperCase().includes(q)),
    }
    const total = resultados.productores.length + resultados.competidores.length +
                  resultados.certificadores.length + resultados.destinos.length
    return { resultados, total } as T
  }

  return data as T
}

export function isStaticMode(): boolean {
  return STATIC_MODE
}

// En modo estático, el login acepta cualquier credencial demo
export const STATIC_CREDENTIALS = [
  { email: 'admin@caliral.com', password: 'admin123', nombre: 'Administrador', rol: 'ADMINISTRADOR' },
  { email: 'comercial@caliral.com', password: 'comercial123', nombre: 'Ejecutivo Comercial', rol: 'COMERCIAL' },
  { email: 'lector@caliral.com', password: 'lector123', nombre: 'Analista (Solo Lectura)', rol: 'LECTOR' },
]
