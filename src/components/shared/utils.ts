'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

// Helper para hacer peticiones autenticadas
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('caliral-auth') || '{}')?.state?.token
    : null

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }))
    throw new Error(error.error || `Error ${res.status}`)
  }

  return res.json()
}

export function useApi<T = any>(url: string | null, options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery<T>({
    queryKey: [url],
    queryFn: () => apiFetch<T>(url!),
    enabled: !!url && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
  })
}

// Helpers de formateo
export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return new Intl.NumberFormat('es-UY').format(n)
}

export function formatWeight(kg: number | undefined | null): string {
  if (!kg) return '—'
  if (kg >= 1000) {
    return `${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 }).format(kg / 1000)} t`
  }
  return `${formatNumber(kg)} kg`
}

export function formatCurrency(usd: number | undefined | null): string {
  if (!usd) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usd)
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelative(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  if (days < 60) return 'Hace 1 mes'
  return `Hace ${Math.floor(days / 30)} meses`
}

// Helpers de estado/riesgo
export function getRiskColor(level: string | undefined): { bg: string; text: string; border: string; dot: string } {
  switch (level) {
    case 'CRITICO':
      return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' }
    case 'ALTO':
      return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' }
    case 'MEDIO':
      return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500' }
    case 'BAJO':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' }
    default:
      return { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' }
  }
}

export function getEstadoColor(estado: string | undefined): { bg: string; text: string; border: string } {
  switch (estado) {
    case 'EXCLUSIVO':
    case 'ACTIVO':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }
    case 'NUEVO':
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' }
    case 'RECUPERADO':
      return { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' }
    case 'COMPARTIDO':
      return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
    case 'PERDIDO':
      return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' }
    case 'INACTIVO':
      return { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border' }
    default:
      return { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border' }
  }
}

export function getEstadoLabel(estado: string | undefined): string {
  switch (estado) {
    case 'EXCLUSIVO': return 'Exclusivo'
    case 'ACTIVO': return 'Activo'
    case 'NUEVO': return 'Nuevo'
    case 'RECUPERADO': return 'Recuperado'
    case 'COMPARTIDO': return 'Compartido'
    case 'PERDIDO': return 'Perdido'
    case 'INACTIVO': return 'Inactivo'
    default: return estado || '—'
  }
}

export function getSeveridadColor(severidad: string): { bg: string; text: string } {
  switch (severidad) {
    case 'CRITICAL': return { bg: 'bg-red-500/15', text: 'text-red-400' }
    case 'WARNING': return { bg: 'bg-yellow-500/15', text: 'text-yellow-400' }
    case 'SUCCESS': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' }
    default: return { bg: 'bg-blue-500/15', text: 'text-blue-400' }
  }
}
