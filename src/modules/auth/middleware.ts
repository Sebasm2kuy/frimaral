import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractTokenFromHeader, verifyToken } from './jwt'
import type { Rol } from '@/types/domain'

export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = extractTokenFromHeader(authHeader || undefined)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const usuario = await db.usuario.findUnique({
    where: { id: payload.userId },
  })

  if (!usuario || !usuario.activo) return null

  return usuario
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'No tiene permisos para esta acción' }, { status: 403 })
}

export function requireRoles(roles: Rol[]) {
  return async (req: NextRequest) => {
    const user = await getUserFromRequest(req)
    if (!user) return { user: null, error: unauthorized() }
    if (!roles.includes(user.rol as Rol)) {
      return { user: null, error: forbidden() }
    }
    return { user, error: null }
  }
}
