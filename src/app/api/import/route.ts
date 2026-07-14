import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { procesarImportacion } from '@/modules/importer/xlsb-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (user.rol === 'LECTOR') {
      return NextResponse.json({ error: 'Sin permisos para importar archivos' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No se encontró el archivo' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const result = await procesarImportacion(buffer, file.name, file.size, user.id)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar archivo' }, { status: 500 })
  }
}
