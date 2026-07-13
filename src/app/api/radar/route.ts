import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { construirRadarComercial } from '@/modules/intelligence/radar-builder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const radar = await construirRadarComercial()
  return NextResponse.json(radar)
}
