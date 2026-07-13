import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const soloNoLeidas = url.searchParams.get('unread') === 'true'
  const tipo = url.searchParams.get('tipo')

  const where: any = {}
  if (soloNoLeidas) where.leida = false
  if (tipo) where.tipo = tipo

  const alertas = await db.alerta.findMany({
    where,
    include: { productor: true, competidor: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ alertas })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id, leida, marcarTodas } = await req.json()

  if (marcarTodas) {
    await db.alerta.updateMany({ where: { leida: false }, data: { leida: true } })
    return NextResponse.json({ success: true })
  }

  if (id) {
    await db.alerta.update({ where: { id }, data: { leida } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
}
