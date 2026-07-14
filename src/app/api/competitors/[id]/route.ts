import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { getCompetidorDetalle } from '@/modules/intelligence/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const detalle = await getCompetidorDetalle(id)
  if (!detalle) {
    return NextResponse.json({ error: 'Competidor no encontrado' }, { status: 404 })
  }

  return NextResponse.json(detalle)
}
