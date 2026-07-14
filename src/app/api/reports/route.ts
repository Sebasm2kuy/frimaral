import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/modules/auth/middleware'
import { generarExcel, generarPDF, generarCSV } from '@/modules/reports/generators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const tipo = (url.searchParams.get('tipo') || 'completo') as any
  const formato = (url.searchParams.get('formato') || 'excel') as 'excel' | 'pdf' | 'csv'

  try {
    let buffer: Buffer
    let fileName: string
    let mimeType: string

    if (formato === 'excel') {
      const r = await generarExcel(tipo)
      buffer = r.buffer
      fileName = r.fileName
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } else if (formato === 'pdf') {
      const r = await generarPDF(tipo)
      buffer = r.buffer
      fileName = r.fileName
      mimeType = 'application/pdf'
    } else {
      const r = await generarCSV(tipo)
      buffer = r.buffer
      fileName = r.fileName
      mimeType = 'text/csv'
    }

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Report error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
