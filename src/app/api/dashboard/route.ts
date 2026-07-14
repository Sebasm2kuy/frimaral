import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { db } from '@/lib/db'
import { getCaliral, getPeriodos } from '@/modules/intelligence/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const caliral = await getCaliral()
  const periodos = await getPeriodos()

  // Estadísticas generales
  const totalProductores = await db.productor.count()
  const totalCompetidores = await db.competidor.count()
  const totalOperaciones = await db.operacion.count()
  const totalImportaciones = await db.importacion.count()
  const totalAlertas = await db.alerta.count()
  const alertasNoLeidas = await db.alerta.count({ where: { leida: false } })

  // Evolución de operaciones Caliral vs Competencia
  const evolucion = await Promise.all(
    periodos.map(async (p) => {
      const opCaliral = caliral
        ? await db.operacion.count({ where: { certificadorId: caliral.id, periodo: p } })
        : 0
      const opCompetencia = await db.operacion.count({
        where: { competidorId: { not: null }, periodo: p },
      })
      const pesoCaliral = caliral
        ? (await db.operacion.aggregate({
            where: { certificadorId: caliral.id, periodo: p },
            _sum: { pesoKg: true },
          }))._sum.pesoKg || 0
        : 0
      return { periodo: p, opCaliral, opCompetencia, pesoCaliral }
    })
  )

  return NextResponse.json({
    stats: {
      totalProductores,
      totalCompetidores,
      totalOperaciones,
      totalImportaciones,
      totalAlertas,
      alertasNoLeidas,
      periodos,
    },
    evolucion,
  })
}
