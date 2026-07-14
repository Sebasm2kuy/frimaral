import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { responderPregunta } from '@/modules/ai/assistant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { pregunta } = await req.json()
  if (!pregunta) {
    return NextResponse.json({ error: 'Pregunta requerida' }, { status: 400 })
  }

  const respuesta = await responderPregunta(pregunta)
  return NextResponse.json(respuesta)
}
