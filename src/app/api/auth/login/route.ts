import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken } from '@/modules/auth/jwt'
import { recalcularInteligenciaCompleta } from '@/modules/intelligence/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const usuario = await db.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!usuario || !usuario.activo) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const passwordValida = await verifyPassword(password, usuario.passwordHash)
    if (!passwordValida) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    await db.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    })

    const token = signToken({
      userId: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    })

    // Asegurar que la inteligencia esté calculada (para usuarios nuevos en DB existente)
    try {
      await recalcularInteligenciaCompleta()
    } catch (e) {
      // Silencioso: ya puede estar calculada
    }

    return NextResponse.json({
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
