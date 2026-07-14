import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { getProductoresList } from '@/modules/intelligence/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const estado = url.searchParams.get('estado') || undefined
  const riskLevel = url.searchParams.get('riskLevel') || undefined
  const busqueda = url.searchParams.get('busqueda') || undefined

  const productores = await getProductoresList({ estado, riskLevel, busqueda })
  return NextResponse.json({ productores })
}
