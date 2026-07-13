import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { db } from '@/lib/db'
import { getCaliral } from '@/modules/intelligence/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('q') || ''
  if (!query || query.length < 2) {
    return NextResponse.json({ resultados: [] })
  }

  const queryUpper = query.toUpperCase()

  // Buscar productores
  const productores = await db.productor.findMany({
    where: { nombre: { contains: queryUpper } },
    take: 10,
  })

  // Buscar competidores
  const competidores = await db.competidor.findMany({
    where: { nombre: { contains: queryUpper } },
    take: 10,
  })

  // Buscar certificador
  const caliral = await getCaliral()
  const certificadores = []
  if (caliral && caliral.nombre.includes(queryUpper)) {
    certificadores.push(caliral)
  }

  // Buscar destinos
  const destinos = await db.destino.findMany({
    where: { nombre: { contains: queryUpper } },
    take: 5,
  })

  return NextResponse.json({
    resultados: {
      productores: productores.map((p) => ({ id: p.id, nombre: p.nombre, tipo: 'productor' })),
      competidores: competidores.map((c) => ({ id: c.id, nombre: c.nombre, tipo: 'competidor' })),
      certificadores: certificadores.map((c) => ({ id: c.id, nombre: c.nombre, tipo: 'certificador' })),
      destinos: destinos.map((d) => ({ id: d.id, nombre: d.nombre, tipo: 'destino' })),
    },
    total: productores.length + competidores.length + certificadores.length + destinos.length,
  })
}
