import { db } from '@/lib/db'
import { getCaliral, getPeriodos } from '@/modules/intelligence/engine'
import { construirRadarComercial } from '@/modules/intelligence/radar-builder'
import type { AIResponse } from '@/types/domain'

// ============================================================
// IA COMERCIAL
// Responde preguntas en lenguaje natural usando la base de datos real
// ============================================================

interface PreguntaDetectada {
  intencion: string
  parametros: Record<string, string>
}

// Detecta la intención de la pregunta del usuario
export function detectarIntencion(pregunta: string): PreguntaDetectada {
  const q = pregunta.toLowerCase().trim()

  // ¿Qué clientes comenzaron a usar otro depósito?
  if ((q.includes('comenzaron') || q.includes('empezaron') || q.includes('usar otro') || q.includes('nuevo dep') || q.includes('otro dep')) && (q.includes('deposito') || q.includes('dep') || q.includes('certificador'))) {
    return { intencion: 'clientes_compartidos', parametros: {} }
  }

  // ¿Qué clientes tienen riesgo alto?
  if (q.includes('riesgo') && (q.includes('alto') || q.includes('critico') || q.includes('elevado'))) {
    return { intencion: 'clientes_riesgo_alto', parametros: {} }
  }
  if (q.includes('riesgo') && (q.includes('perder') || q.includes('abandono'))) {
    return { intencion: 'clientes_riesgo_abandono', parametros: {} }
  }

  // ¿Qué competidor más creció?
  if (q.includes('competidor') && (q.includes('crec') || q.includes('mas') || q.includes('mas crec'))) {
    return { intencion: 'competidor_mas_crecio', parametros: {} }
  }
  if (q.includes('crec') && q.includes('compet')) {
    return { intencion: 'competidor_mas_crecio', parametros: {} }
  }

  // ¿Qué productores dejaron de trabajar con Caliral?
  if ((q.includes('dejaron') || q.includes('abandonaron') || q.includes('perdieron')) && (q.includes('caliral') || q.includes('trabajar'))) {
    return { intencion: 'productores_perdidos', parametros: {} }
  }

  // ¿Qué clientes puedo recuperar?
  if (q.includes('recuperar') || (q.includes('recupera') && q.includes('cliente'))) {
    return { intencion: 'clientes_recuperar', parametros: {} }
  }

  // ¿Cuáles son mis mejores clientes?
  if (q.includes('mejores') && q.includes('cliente')) {
    return { intencion: 'mejores_clientes', parametros: {} }
  }
  if (q.includes('top') && q.includes('cliente')) {
    return { intencion: 'mejores_clientes', parametros: {} }
  }

  // ¿Qué clientes son exclusivos?
  if (q.includes('exclusivos') || (q.includes('exclusivo') && q.includes('cliente'))) {
    return { intencion: 'clientes_exclusivos', parametros: {} }
  }

  // ¿Qué clientes son compartidos?
  if (q.includes('compartidos') || (q.includes('compartido') && q.includes('cliente'))) {
    return { intencion: 'clientes_compartidos', parametros: {} }
  }

  // Búsqueda por nombre de competidor/productor
  const palabrasComunes = ['que', 'cual', 'cuales', 'cuanto', 'cuantos', 'como', 'donde', 'cuando', 'esta', 'estan', 'hay', 'el', 'la', 'los', 'las', 'de', 'del', 'con', 'sin', 'para', 'por', 'en', 'y', 'o', 'a', 'mi', 'mis', 'es', 'son']
  const palabras = q.split(/\s+/).filter((p) => p.length > 2 && !palabrasComunes.includes(p))

  // Buscar competidores conocidos
  if (palabras.length > 0) {
    return { intencion: 'busqueda_nombre', parametros: { query: palabras.join(' ') } }
  }

  return { intencion: 'desconocida', parametros: {} }
}

// ============================================================
// RESPUESTAS BASADAS EN BASE DE DATOS
// ============================================================

export async function responderPregunta(pregunta: string): Promise<AIResponse> {
  const { intencion, parametros } = detectarIntencion(pregunta)
  const caliral = await getCaliral()
  const periodos = await getPeriodos()

  if (!caliral || periodos.length === 0) {
    return {
      content: 'Aún no hay datos cargados en el sistema. Importa un archivo XLSB desde el módulo de Importación para que pueda responder preguntas comerciales.',
      query: pregunta,
      sources: ['base de datos - sin datos'],
    }
  }

  const periodoActual = periodos[periodos.length - 1]
  const periodoAnterior = periodos.length > 1 ? periodos[periodos.length - 2] : null

  switch (intencion) {
    case 'clientes_compartidos': {
      const compartidos = await db.historico.findMany({
        where: { periodo: periodoActual, estado: 'COMPARTIDO' },
        include: { productor: true },
      })
      if (compartidos.length === 0) {
        return {
          content: `No hay productores compartidos en el período ${periodoActual}. Todos los clientes que operan con Caliral son exclusivos en este período.`,
          query: pregunta,
          sources: ['tabla: historico', 'tabla: productor'],
          datos: { total: 0 },
        }
      }
      const detalles = await Promise.all(compartidos.map(async (h) => {
        const comps = h.competidoresUsadosJson ? JSON.parse(h.competidoresUsadosJson) : []
        return `• **${h.productor.nombre}**: opera con ${comps.map((c: any) => c.nombre).join(', ')} además de Caliral. Riesgo: ${h.riskLevel}.`
      }))
      return {
        content: `En el período ${periodoActual}, ${compartidos.length} productor(es) comenzaron a operar con un competidor además de Caliral:\n\n${detalles.join('\n')}\n\n**Recomendación**: Contactar a cada uno para entender motivos y reforzar relación.`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor', 'tabla: operacion'],
        datos: { total: compartidos.length, productores: compartidos.map((h) => h.productor.nombre) },
      }
    }

    case 'clientes_riesgo_alto': {
      const enRiesgo = await db.historico.findMany({
        where: {
          periodo: periodoActual,
          riskLevel: { in: ['ALTO', 'CRITICO'] },
        },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })
      if (enRiesgo.length === 0) {
        return {
          content: `No hay clientes con riesgo alto o crítico en el período ${periodoActual}. El portafolio de Caliral está estable.`,
          query: pregunta,
          sources: ['tabla: historico'],
          datos: { total: 0 },
        }
      }
      const detalles = enRiesgo.map((h) => {
        const factores = h.riskFactoresJson ? JSON.parse(h.riskFactoresJson) : { detalle: [] }
        return `• **${h.productor.nombre}** (Score: ${h.riskScore}/100, Nivel: ${h.riskLevel}) - ${factores.detalle?.join('; ') || 'Múltiples señales de riesgo'}`
      })
      return {
        content: `Hay ${enRiesgo.length} cliente(s) con riesgo alto o crítico en el período ${periodoActual}:\n\n${detalles.join('\n')}\n\n**Acción recomendada**: Intervención comercial prioritaria en los próximos 15 días.`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor'],
        datos: { total: enRiesgo.length, clientes: enRiesgo.map((h) => h.productor.nombre) },
      }
    }

    case 'clientes_riesgo_abandono': {
      const enRiesgo = await db.historico.findMany({
        where: {
          periodo: periodoActual,
          riskLevel: { in: ['ALTO', 'CRITICO'] },
        },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })
      const perdidos = await db.historico.findMany({
        where: { periodo: periodoActual, estado: 'PERDIDO' },
        include: { productor: true },
      })
      return {
        content: `Hay ${enRiesgo.length} cliente(s) con riesgo elevado de abandonar Caliral y ${perdidos.length} ya perdidos en el período ${periodoActual}.\n\n**En riesgo**:\n${enRiesgo.map((h) => `• ${h.productor.nombre} (score: ${h.riskScore})`).join('\n')}\n\n**Ya perdidos**:\n${perdidos.map((h) => `• ${h.productor.nombre}`).join('\n') || 'Ninguno'}`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor'],
        datos: { enRiesgo: enRiesgo.length, perdidos: perdidos.length },
      }
    }

    case 'competidor_mas_crecio': {
      if (!periodoAnterior) {
        return {
          content: 'Solo hay un período cargado. Se necesitan al menos dos períodos para calcular crecimiento de competidores.',
          query: pregunta,
          sources: ['tabla: operacion'],
        }
      }
      const competidores = await db.competidor.findMany({ where: { activo: true } })
      const crecimientos: Array<{ nombre: string; opActual: number; opAnterior: number; crecimiento: number; captaciones: number }> = []
      for (const c of competidores) {
        const opActual = await db.operacion.count({ where: { competidorId: c.id, periodo: periodoActual } })
        const opAnterior = await db.operacion.count({ where: { competidorId: c.id, periodo: periodoAnterior } })
        const crecimiento = opAnterior > 0 ? ((opActual - opAnterior) / opAnterior) * 100 : opActual > 0 ? 100 : 0
        const captaciones = await db.alerta.count({
          where: { tipo: 'COMPETIDOR_CAPTACION', competidorId: c.id, periodo: periodoActual },
        })
        if (opActual > 0) {
          crecimientos.push({ nombre: c.nombre, opActual, opAnterior, crecimiento, captaciones })
        }
      }
      crecimientos.sort((a, b) => b.crecimiento - a.crecimiento)
      if (crecimientos.length === 0) {
        return {
          content: 'No hay competidores con operaciones registradas en el período actual.',
          query: pregunta,
          sources: ['tabla: operacion', 'tabla: competidor'],
        }
      }
      const top = crecimientos[0]
      const otros = crecimientos.slice(1, 4)
      let content = `**${top.nombre}** es el competidor que más creció en el período ${periodoActual}: aumentó un ${top.crecimiento.toFixed(0)}% sus operaciones (de ${top.opAnterior} a ${top.opActual})`
      if (top.captaciones > 0) {
        content += ` y captó ${top.captaciones} cliente(s) de Caliral`
      }
      content += '.'
      if (otros.length > 0) {
        content += `\n\nOtros competidores en crecimiento:\n${otros.map((c) => `• ${c.nombre}: +${c.crecimiento.toFixed(0)}% (${c.opActual} operaciones, ${c.captaciones} captaciones)`).join('\n')}`
      }
      return {
        content,
        query: pregunta,
        sources: ['tabla: operacion', 'tabla: competidor', 'tabla: alerta'],
        datos: { top, todos: crecimientos },
      }
    }

    case 'productores_perdidos': {
      const perdidos = await db.historico.findMany({
        where: { periodo: periodoActual, estado: 'PERDIDO' },
        include: { productor: true },
      })
      if (perdidos.length === 0) {
        return {
          content: `No hay productores que hayan abandonado Caliral en el período ${periodoActual}. La base de clientes está estable.`,
          query: pregunta,
          sources: ['tabla: historico'],
          datos: { total: 0 },
        }
      }
      const detalles = await Promise.all(perdidos.map(async (h) => {
        const comps = h.competidoresUsadosJson ? JSON.parse(h.competidoresUsadosJson) : []
        const compNombres = comps.map((c: any) => c.nombre).join(', ') || 'sin competencia detectada'
        return `• **${h.productor.nombre}**: migró a ${compNombres}`
      }))
      return {
        content: `En el período ${periodoActual}, ${perdidos.length} productor(es) dejaron de operar con Caliral:\n\n${detalles.join('\n')}\n\n**Recomendación**: Plan de recuperación comercial urgente para estos clientes.`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor', 'tabla: operacion'],
        datos: { total: perdidos.length, productores: perdidos.map((h) => h.productor.nombre) },
      }
    }

    case 'clientes_recuperar': {
      // Clientes perdidos + en riesgo crítico con recuperación posible
      const perdidos = await db.historico.findMany({
        where: { periodo: periodoActual, estado: 'PERDIDO' },
        include: { productor: true },
      })
      const enRiesgoCritico = await db.historico.findMany({
        where: { periodo: periodoActual, riskLevel: 'CRITICO', estado: { not: 'PERDIDO' } },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })

      const totalRecuperables = perdidos.length + enRiesgoCritico.length
      if (totalRecuperables === 0) {
        return {
          content: `No hay clientes para recuperar en este momento. Todos los productores están activos con bajo riesgo.`,
          query: pregunta,
          sources: ['tabla: historico'],
        }
      }

      let content = `Hay ${totalRecuperables} cliente(s) que puedes recuperar o retener:\n\n`
      if (perdidos.length > 0) {
        content += `**Perdidos (${perdidos.length}) - alta prioridad de recuperación:**\n`
        content += perdidos.map((h) => `• ${h.productor.nombre}`).join('\n')
        content += '\n\n'
      }
      if (enRiesgoCritico.length > 0) {
        content += `**En riesgo crítico (${enRiesgoCritico.length}) - retención urgente:**\n`
        content += enRiesgoCritico.map((h) => `• ${h.productor.nombre} (score: ${h.riskScore})`).join('\n')
      }
      content += `\n\n**Estrategia sugerida**: Visita comercial personalizada, análisis de causas de migración, oferta competitiva personalizada.`

      return {
        content,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor'],
        datos: { perdidos: perdidos.length, enRiesgo: enRiesgoCritico.length },
      }
    }

    case 'mejores_clientes': {
      const mejores = await db.historico.findMany({
        where: {
          periodo: periodoActual,
          estado: { in: ['EXCLUSIVO', 'COMPARTIDO', 'NUEVO', 'RECUPERADO', 'ACTIVO'] },
        },
        include: { productor: true },
        orderBy: { pesoCaliral: 'desc' },
        take: 10,
      })
      if (mejores.length === 0) {
        return {
          content: 'No hay clientes activos en el período actual.',
          query: pregunta,
          sources: ['tabla: historico'],
        }
      }
      const detalles = mejores.map((h, i) => {
        const toneladas = (h.pesoCaliral / 1000).toFixed(1)
        return `${i + 1}. **${h.productor.nombre}** - ${h.operacionesCaliral} operaciones, ${toneladas} toneladas, estado: ${h.estado}, riesgo: ${h.riskLevel}`
      })
      return {
        content: `Top ${mejores.length} mejores clientes de Caliral en ${periodoActual}:\n\n${detalles.join('\n')}\n\n**Insight**: Estos clientes representan el mayor volumen operativo de Caliral. Priorizar fidelización.`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor'],
        datos: { total: mejores.length, top: mejores[0]?.productor.nombre },
      }
    }

    case 'clientes_exclusivos': {
      const exclusivos = await db.historico.findMany({
        where: { periodo: periodoActual, estado: 'EXCLUSIVO' },
        include: { productor: true },
        orderBy: { pesoCaliral: 'desc' },
      })
      if (exclusivos.length === 0) {
        return {
          content: `No hay clientes exclusivos en el período ${periodoActual}.`,
          query: pregunta,
          sources: ['tabla: historico'],
        }
      }
      const detalles = exclusivos.map((h) => `• **${h.productor.nombre}**: ${h.operacionesCaliral} operaciones, ${(h.pesoCaliral / 1000).toFixed(1)} toneladas`)
      return {
        content: `Hay ${exclusivos.length} cliente(s) exclusivo(s) en el período ${periodoActual}:\n\n${detalles.join('\n')}\n\n**Insight**: Clientes exclusivos son el activo más valioso de Caliral. Priorizar retención y expansión de volumen.`,
        query: pregunta,
        sources: ['tabla: historico', 'tabla: productor'],
        datos: { total: exclusivos.length },
      }
    }

    case 'busqueda_nombre': {
      const query = parametros.query
      // Buscar en productores
      const productores = await db.productor.findMany({
        where: { nombre: { contains: query } },
      })
      // Buscar en competidores
      const competidores = await db.competidor.findMany({
        where: { nombre: { contains: query } },
      })

      let content = ''
      if (productores.length > 0) {
        content += `**Productores encontrados para "${query}":**\n`
        for (const p of productores) {
          const hist = await db.historico.findFirst({
            where: { productorId: p.id, periodo: periodoActual },
          })
          content += `\n• **${p.nombre}**\n  Estado: ${hist?.estado || 'N/A'}\n  Riesgo: ${hist?.riskLevel || 'N/A'} (score: ${hist?.riskScore || 0})\n  Operaciones con Caliral: ${hist?.operacionesCaliral || 0}\n  Operaciones con competencia: ${hist?.operacionesCompetencia || 0}`
          if (hist?.competidoresUsadosJson) {
            const comps = JSON.parse(hist.competidoresUsadosJson)
            if (comps.length > 0) {
              content += `\n  Competidores: ${comps.map((c: any) => c.nombre).join(', ')}`
            }
          }
        }
      }
      if (competidores.length > 0) {
        content += `\n\n**Competidores encontrados para "${query}":**\n`
        for (const c of competidores) {
          const opActual = await db.operacion.count({ where: { competidorId: c.id, periodo: periodoActual } })
          const clientes = await db.operacion.findMany({
            where: { competidorId: c.id, periodo: periodoActual },
            select: { productorId: true },
            distinct: ['productorId'],
          })
          content += `\n• **${c.nombre}**\n  Operaciones: ${opActual}\n  Clientes: ${clientes.length}`
        }
      }
      if (content === '') {
        content = `No se encontraron resultados para "${query}" en productores ni competidores.`
      }
      return {
        content,
        query: pregunta,
        sources: ['tabla: productor', 'tabla: competidor', 'tabla: historico'],
      }
    }

    default: {
      // Para preguntas no reconocidas, mostrar resumen del radar
      const radar = await construirRadarComercial()
      const resumen = radar.conclusiones.slice(0, 5).map((c) => `• ${c.titulo}`).join('\n')
      return {
        content: `No reconocí esa pregunta específica, pero aquí hay un resumen comercial actual:\n\n${resumen}\n\n**Preguntas que puedo responder:**\n• ¿Qué clientes comenzaron a usar otro depósito?\n• ¿Qué clientes tienen riesgo alto?\n• ¿Qué competidor más creció?\n• ¿Qué productores dejaron de trabajar con Caliral?\n• ¿Qué clientes puedo recuperar?\n• ¿Cuáles son mis mejores clientes?\n• ¿Qué clientes son exclusivos/compartidos?\n• ¿[Nombre de productor o competidor]?`,
        query: pregunta,
        sources: ['motor: radar comercial'],
      }
    }
  }
}

// ============================================================
// SUGERENCIAS DE PREGUNTAS
// ============================================================

export const SUGERENCIAS_PREGUNTAS = [
  '¿Qué clientes comenzaron a usar otro depósito?',
  '¿Qué clientes tienen riesgo alto?',
  '¿Qué competidor más creció?',
  '¿Qué productores dejaron de trabajar con Caliral?',
  '¿Qué clientes puedo recuperar?',
  '¿Cuáles son mis mejores clientes?',
  '¿Qué clientes son exclusivos?',
  '¿Qué clientes son compartidos?',
  'Frioport',
  'Las Moras',
]
