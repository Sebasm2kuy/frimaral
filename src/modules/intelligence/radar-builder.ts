import { db } from '@/lib/db'
import { getCaliral, getPeriodos, calcularRiesgo } from './engine'
import type { RadarComercial, RadarConclusion, Productor, Competidor } from '@/types/domain'

// ============================================================
// RADAR COMERCIAL
// Genera conclusiones automáticas en lenguaje natural
// ============================================================

export async function construirRadarComercial(): Promise<RadarComercial> {
  const caliral = await getCaliral()
  const periodos = await getPeriodos()

  if (!caliral || periodos.length === 0) {
    return {
      periodo: '—',
      fechaGeneracion: new Date().toISOString(),
      conclusiones: [{
        tipo: 'OPORTUNIDAD',
        icono: 'info',
        titulo: 'Sin datos disponibles',
        mensaje: 'Aún no se han importado archivos XLSB. Cargue el primer archivo desde el módulo de Importación para activar el radar comercial.',
        severidad: 'INFO',
      }],
      metricas: {
        totalProductores: 0,
        productoresActivos: 0,
        productoresExclusivos: 0,
        productoresCompartidos: 0,
        productoresPerdidos: 0,
        productoresRecuperados: 0,
        productoresNuevos: 0,
        totalOperacionesCaliral: 0,
        totalPesoCaliral: 0,
        participacionCaliral: 0,
        competidoresActivos: 0,
        clientesEnRiesgo: 0,
      },
      topCompetidores: [],
      clientesEnRiesgo: [],
    }
  }

  const periodoActual = periodos[periodos.length - 1]
  const periodosAnteriores = periodos.slice(0, -1)
  const conclusions: RadarConclusion[] = []

  // Obtener históricos del último periodo
  const historicosActual = await db.historico.findMany({
    where: { periodo: periodoActual },
    include: { productor: true },
  })

  // Métricas globales
  const totalProductores = await db.productor.count({ where: { activo: true } })

  const productoresActivos = historicosActual.filter(
    (h) => h.estado === 'ACTIVO' || h.estado === 'EXCLUSIVO' || h.estado === 'COMPARTIDO' || h.estado === 'NUEVO' || h.estado === 'RECUPERADO'
  ).length
  const productoresExclusivos = historicosActual.filter((h) => h.estado === 'EXCLUSIVO').length
  const productoresCompartidos = historicosActual.filter((h) => h.estado === 'COMPARTIDO').length
  const productoresPerdidos = historicosActual.filter((h) => h.estado === 'PERDIDO').length
  const productoresRecuperados = historicosActual.filter((h) => h.estado === 'RECUPERADO').length
  const productoresNuevos = historicosActual.filter((h) => h.estado === 'NUEVO').length

  const totalOperacionesCaliral = await db.operacion.count({
    where: { certificadorId: caliral.id, periodo: periodoActual },
  })
  const totalPesoCaliralAgg = await db.operacion.aggregate({
    where: { certificadorId: caliral.id, periodo: periodoActual },
    _sum: { pesoKg: true },
  })

  // Participación Caliral
  const totalOperacionesPeriodo = await db.operacion.count({
    where: { periodo: periodoActual },
  })
  const participacionCaliral = totalOperacionesPeriodo > 0
    ? (totalOperacionesCaliral / totalOperacionesPeriodo) * 100
    : 0

  const competidoresActivosAgg = await db.operacion.findMany({
    where: { periodo: periodoActual, competidorId: { not: null } },
    select: { competidorId: true },
    distinct: ['competidorId'],
  })
  const competidoresActivos = competidoresActivosAgg.length

  const clientesEnRiesgoList = historicosActual.filter(
    (h) => h.riskLevel === 'ALTO' || h.riskLevel === 'CRITICO'
  )
  const clientesEnRiesgo = clientesEnRiesgoList.length

  // ============================================================
  // GENERAR CONCLUSIONES EN LENGUAJE NATURAL
  // ============================================================

  // 1. Clientes que comenzaron a operar con competidor
  if (productoresCompartidos > 0) {
    const compartidos = historicosActual.filter((h) => h.estado === 'COMPARTIDO')
    conclusions.push({
      tipo: 'COMPARTIDO',
      icono: 'alert-triangle',
      titulo: `${productoresCompartidos} productor(es) comenzaron a operar con un competidor`,
      mensaje: `${compartidos.map((h) => h.productor.nombre).slice(0, 5).join(', ')}${compartidos.length > 5 ? ` y ${compartidos.length - 5} más` : ''} ahora comparten operaciones entre Caliral y otros depósitos. Riesgo de migración creciente.`,
      severidad: 'WARNING',
      datos: { productores: compartidos.map((h) => ({ id: h.productorId, nombre: h.productor.nombre })) },
    })
  }

  // 2. Clientes que redujeron operaciones
  const reducciones = historicosActual.filter(
    (h) => h.riskFactoresJson && JSON.parse(h.riskFactoresJson).disminucionOperaciones >= 0.30
  )
  if (reducciones.length > 0) {
    conclusions.push({
      tipo: 'DISMINUCION',
      icono: 'trending-down',
      titulo: `${reducciones.length} productor(es) redujeron operaciones`,
      mensaje: `${reducciones.map((h) => h.productor.nombre).slice(0, 5).join(', ')}${reducciones.length > 5 ? ` y ${reducciones.length - 5} más` : ''} disminuyeron significativamente sus operaciones con Caliral. Se requiere contacto comercial inmediato.`,
      severidad: 'WARNING',
      datos: { productores: reducciones.map((h) => ({ id: h.productorId, nombre: h.productor.nombre })) },
    })
  }

  // 3. Clientes recuperados
  if (productoresRecuperados > 0) {
    const recuperados = historicosActual.filter((h) => h.estado === 'RECUPERADO')
    conclusions.push({
      tipo: 'RECUPERACION',
      icono: 'check-circle',
      titulo: `${productoresRecuperados} cliente(s) fueron recuperados`,
      mensaje: `${recuperados.map((h) => h.productor.nombre).join(', ')} volvieron a operar con Caliral. Reforzar relación y ofrecer condiciones preferenciales.`,
      severidad: 'SUCCESS',
      datos: { productores: recuperados.map((h) => ({ id: h.productorId, nombre: h.productor.nombre })) },
    })
  }

  // 4. Clientes perdidos
  if (productoresPerdidos > 0) {
    const perdidos = historicosActual.filter((h) => h.estado === 'PERDIDO')
    conclusions.push({
      tipo: 'PERDIDA',
      icono: 'x-circle',
      titulo: `${productoresPerdidos} cliente(s) abandonaron Caliral`,
      mensaje: `${perdidos.map((h) => h.productor.nombre).slice(0, 5).join(', ')}${perdidos.length > 5 ? ` y ${perdidos.length - 5} más` : ''} dejaron de operar con Caliral en el período actual. Investigar migración a competencia.`,
      severidad: 'CRITICAL',
      datos: { productores: perdidos.map((h) => ({ id: h.productorId, nombre: h.productor.nombre })) },
    })
  }

  // 5. Crecimiento de competidores
  if (periodosAnteriores.length > 0) {
    const periodoAnterior = periodosAnteriores[periodosAnteriores.length - 1]
    const competidoresCrecieron: Array<{ competidor: Competidor; crecimiento: number; captaciones: number }> = []

    const competidores = await db.competidor.findMany({ where: { activo: true } })
    for (const competidor of competidores) {
      const opActual = await db.operacion.count({
        where: { competidorId: competidor.id, periodo: periodoActual },
      })
      const opAnterior = await db.operacion.count({
        where: { competidorId: competidor.id, periodo: periodoAnterior },
      })
      if (opAnterior > 0 && opActual > opAnterior) {
        const crecimiento = ((opActual - opAnterior) / opAnterior) * 100
        if (crecimiento >= 10) {
          // Contar captaciones
          const captaciones = await db.alerta.count({
            where: { tipo: 'COMPETIDOR_CAPTACION', competidorId: competidor.id, periodo: periodoActual },
          })
          competidoresCrecieron.push({
            competidor: {
              ...competidor,
              totalOperaciones: opActual,
            } as Competidor,
            crecimiento,
            captaciones,
          })
        }
      }
    }

    competidoresCrecieron
      .sort((a, b) => b.crecimiento - a.crecimiento)
      .slice(0, 3)
      .forEach(({ competidor, crecimiento, captaciones }) => {
        conclusions.push({
          tipo: 'CRECIMIENTO_COMPETIDOR',
          icono: 'trending-up',
          titulo: `${competidor.nombre} aumentó su participación un ${crecimiento.toFixed(0)}%`,
          mensaje: `${competidor.nombre} creció de operaciones significativamente${captaciones > 0 ? ` y captó ${captaciones} cliente(s) de Caliral` : ''}. Analizar estrategia competitiva.`,
          severidad: 'WARNING',
          datos: { competidorId: competidor.id, crecimiento, captaciones },
        })
      })
  }

  // 6. Riesgo de perder clientes
  if (clientesEnRiesgo > 0) {
    const enRiesgoCritico = clientesEnRiesgoList.filter((h) => h.riskLevel === 'CRITICO')
    if (enRiesgoCritico.length > 0) {
      conclusions.push({
        tipo: 'RIESGO',
        icono: 'alert-octagon',
        titulo: `Existe riesgo crítico de perder ${enRiesgoCritico.length} cliente(s)`,
        mensaje: `${enRiesgoCritico.map((h) => h.productor.nombre).slice(0, 5).join(', ')}${enRiesgoCritico.length > 5 ? ` y ${enRiesgoCritico.length - 5} más` : ''} presentan señales críticas de abandono. Intervención del gerente comercial recomendada.`,
        severidad: 'CRITICAL',
        datos: { productores: enRiesgoCritico.map((h) => ({ id: h.productorId, nombre: h.productor.nombre, score: h.riskScore })) },
      })
    }
    if (clientesEnRiesgo > enRiesgoCritico.length) {
      conclusions.push({
        tipo: 'RIESGO',
        icono: 'alert-circle',
        titulo: `${clientesEnRiesgo} cliente(s) con riesgo de abandono`,
        mensaje: `Hay ${clientesEnRiesgo} productor(es) con score de riesgo elevado. Se recomienda plan de retención comercial focalizado.`,
        severidad: 'WARNING',
      })
    }
  }

  // 7. Clientes nuevos
  if (productoresNuevos > 0) {
    const nuevos = historicosActual.filter((h) => h.estado === 'NUEVO')
    conclusions.push({
      tipo: 'NUEVO',
      icono: 'user-plus',
      titulo: `${productoresNuevos} cliente(s) nuevo(s) este período`,
      mensaje: `${nuevos.map((h) => h.productor.nombre).join(', ')} comenzaron a operar con Caliral. Asignar ejecutivo de cuenta y programar seguimiento.`,
      severidad: 'SUCCESS',
      datos: { productores: nuevos.map((h) => ({ id: h.productorId, nombre: h.productor.nombre })) },
    })
  }

  // 8. Participación general
  conclusions.push({
    tipo: 'OPORTUNIDAD',
    icono: 'pie-chart',
    titulo: `Participación de Caliral: ${participacionCaliral.toFixed(1)}%`,
    mensaje: `Caliral participa en ${participacionCaliral.toFixed(1)}% de las operaciones del período. ${participacionCaliral < 50 ? 'Por debajo del 50%: la competencia domina el mercado.' : 'Por encima del 50%: posición de liderazgo en el mercado.'}`,
    severidad: participacionCaliral < 50 ? 'WARNING' : 'INFO',
  })

  // Top competidores
  const topCompetidoresData: Array<{ competidor: Competidor; crecimiento: number; captaciones: number }> = []
  if (periodosAnteriores.length > 0) {
    const periodoAnterior = periodosAnteriores[periodosAnteriores.length - 1]
    for (const competidor of await db.competidor.findMany({ where: { activo: true } })) {
      const opActual = await db.operacion.count({
        where: { competidorId: competidor.id, periodo: periodoActual },
      })
      const opAnterior = await db.operacion.count({
        where: { competidorId: competidor.id, periodo: periodoAnterior },
      })
      const crecimiento = opAnterior > 0 ? ((opActual - opAnterior) / opAnterior) * 100 : opActual > 0 ? 100 : 0
      const captaciones = await db.alerta.count({
        where: { tipo: 'COMPETIDOR_CAPTACION', competidorId: competidor.id, periodo: periodoActual },
      })
      const totalPeso = await db.operacion.aggregate({
        where: { competidorId: competidor.id, periodo: periodoActual },
        _sum: { pesoKg: true },
      })
      const totalClientes = await db.operacion.findMany({
        where: { competidorId: competidor.id, periodo: periodoActual },
        select: { productorId: true },
        distinct: ['productorId'],
      })
      topCompetidoresData.push({
        competidor: {
          ...competidor,
          totalOperaciones: opActual,
          totalPeso: totalPeso._sum.pesoKg || 0,
          totalClientes: totalClientes.length,
          crecimiento,
          captaciones,
        } as Competidor,
        crecimiento,
        captaciones,
      })
    }
  }
  topCompetidoresData.sort((a, b) => (b.competidor.totalOperaciones || 0) - (a.competidor.totalOperaciones || 0))

  // Clientes en riesgo
  const clientesEnRiesgoData = await Promise.all(
    clientesEnRiesgoList
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10)
      .map(async (h) => {
        const factores = h.riskFactoresJson ? JSON.parse(h.riskFactoresJson) : null
        return {
          productor: {
            id: h.productor.id,
            nombre: h.productor.nombre,
            estado: h.estado as any,
            riskScore: h.riskScore,
            riskLevel: h.riskLevel as any,
          } as Productor,
          riskScore: h.riskScore,
          riskLevel: h.riskLevel as any,
          motivo: factores?.detalle?.join(' ') || 'Múltiples señales de riesgo',
        }
      })
  )

  return {
    periodo: periodoActual,
    fechaGeneracion: new Date().toISOString(),
    conclusiones: conclusions,
    metricas: {
      totalProductores,
      productoresActivos,
      productoresExclusivos,
      productoresCompartidos,
      productoresPerdidos,
      productoresRecuperados,
      productoresNuevos,
      totalOperacionesCaliral,
      totalPesoCaliral: totalPesoCaliralAgg._sum.pesoKg || 0,
      participacionCaliral,
      competidoresActivos,
      clientesEnRiesgo,
    },
    topCompetidores: topCompetidoresData.slice(0, 5),
    clientesEnRiesgo: clientesEnRiesgoData,
  }
}
