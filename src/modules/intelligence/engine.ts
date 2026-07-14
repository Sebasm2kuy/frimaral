import { db } from '@/lib/db'
import type {
  EstadoCliente,
  RiskLevel,
  RiskFactores,
  TipoAlerta,
} from '@/types/domain'

// ============================================================
// MOTOR DE INTELIGENCIA COMERCIAL
// Calcula automáticamente estados, riesgos, tendencias y alertas
// ============================================================

const PERIODOS_PARA_PERDIDA = 2 // Si no opera con Caliral en N periodos, se considera perdido
const DIAS_SIN_OPERAR_RIESGO = 90
const UMBRAL_DISMINUCION = 0.30 // 30% de disminución es alerta
const UMBRAL_CRECIMIENTO_COMPETIDOR = 0.15 // 15% de crecimiento es alerta

// Obtiene el certificador Caliral
export async function getCaliral() {
  return db.certificador.findFirst({
    where: { esCaliral: true, activo: true },
  })
}

// Obtiene todos los periodos ordenados
export async function getPeriodos() {
  const periodos = await db.operacion.findMany({
    select: { periodo: true },
    distinct: ['periodo'],
    orderBy: { periodo: 'asc' },
  })
  return periodos.map((p) => p.periodo)
}

// Determina el estado de un productor en un periodo específico
export async function calcularEstadoProductor(
  productorId: string,
  periodoActual: string,
  periodosAnteriores: string[]
): Promise<EstadoCliente> {
  const caliral = await getCaliral()
  if (!caliral) return 'INACTIVO'

  // Operaciones del periodo actual
  const opCaliralActual = await db.operacion.count({
    where: {
      productorId,
      certificadorId: caliral.id,
      periodo: periodoActual,
    },
  })

  const opCompetenciaActual = await db.operacion.count({
    where: {
      productorId,
      competidorId: { not: null },
      periodo: periodoActual,
    },
  })

  // Si opera con Caliral y sin competencia -> EXCLUSIVO
  if (opCaliralActual > 0 && opCompetenciaActual === 0) {
    // Verificar si es nuevo (no operaba antes con Caliral)
    if (periodosAnteriores.length === 0) return 'NUEVO'
    const opCaliralAnteriores = await db.operacion.count({
      where: {
        productorId,
        certificadorId: caliral.id,
        periodo: { in: periodosAnteriores },
      },
    })
    if (opCaliralAnteriores === 0) return 'NUEVO'
    return 'EXCLUSIVO'
  }

  // Si opera con Caliral y con competencia -> COMPARTIDO
  if (opCaliralActual > 0 && opCompetenciaActual > 0) {
    return 'COMPARTIDO'
  }

  // Si no opera con Caliral pero sí con competencia
  if (opCaliralActual === 0 && opCompetenciaActual > 0) {
    // Verificar si antes operaba con Caliral
    if (periodosAnteriores.length === 0) return 'INACTIVO'

    const opCaliralAnteriores = await db.operacion.count({
      where: {
        productorId,
        certificadorId: caliral.id,
        periodo: { in: periodosAnteriores },
      },
    })

    if (opCaliralAnteriores > 0) {
      // Verificar si está perdido o recuperandose
      // Buscar el último periodo que operó con Caliral
      const ultimaOpCaliral = await db.operacion.findFirst({
        where: {
          productorId,
          certificadorId: caliral.id,
        },
        orderBy: { periodo: 'desc' },
        select: { periodo: true },
      })

      if (ultimaOpCaliral) {
        // Si vuelve a operar después de estar perdido -> RECUPERADO
        // (pero solo si el periodo actual tiene operación con Caliral, que no es el caso aquí)
        // Aquí es PERDIDO
        return 'PERDIDO'
      }
    }

    return 'INACTIVO'
  }

  // No opera con nadie
  return 'INACTIVO'
}

// Detecta si un productor fue recuperado en el periodo actual
export async function esRecuperado(
  productorId: string,
  periodoActual: string,
  periodosAnteriores: string[]
): Promise<boolean> {
  const caliral = await getCaliral()
  if (!caliral) return false

  const opCaliralActual = await db.operacion.count({
    where: {
      productorId,
      certificadorId: caliral.id,
      periodo: periodoActual,
    },
  })

  if (opCaliralActual === 0) return false

  // Buscar si hubo un gap (periodos sin operar con Caliral seguidos de operación actual)
  if (periodosAnteriores.length < 2) return false

  // Ordenar periodos anteriores
  const sorted = [...periodosAnteriores].sort()
  const ultimoAnterior = sorted[sorted.length - 1]

  const opCaliralUltimoAnterior = await db.operacion.count({
    where: {
      productorId,
      certificadorId: caliral.id,
      periodo: ultimoAnterior,
    },
  })

  // Si en el último periodo anterior no operó con Caliral, pero ahora sí -> recuperado
  if (opCaliralUltimoAnterior === 0) {
    // Verificar que efectivamente hubo operación con Caliral en algún periodo previo
    const opCaliralPrevias = await db.operacion.count({
      where: {
        productorId,
        certificadorId: caliral.id,
        periodo: { in: sorted.slice(0, -1) },
      },
    })
    return opCaliralPrevias > 0
  }

  return false
}

// ============================================================
// CÁLCULO DE RIESGO
// ============================================================

export async function calcularRiesgo(
  productorId: string,
  periodoActual: string,
  periodosAnteriores: string[]
): Promise<{ score: number; level: RiskLevel; factores: RiskFactores }> {
  const caliral = await getCaliral()
  if (!caliral) {
    return {
      score: 0,
      level: 'BAJO',
      factores: {
        disminucionOperaciones: 0,
        usoCompetidorCreciente: 0,
        tiempoSinOperar: 0,
        cambioCertificador: false,
        cantidadCompetidores: 0,
        detalle: [],
      },
    }
  }

  const detalle: string[] = []
  let score = 0

  // 1. Disminución de operaciones con Caliral
  const opCaliralActual = await db.operacion.count({
    where: {
      productorId,
      certificadorId: caliral.id,
      periodo: periodoActual,
    },
  })

  let disminucion = 0
  if (periodosAnteriores.length > 0) {
    const sortedAnt = [...periodosAnteriores].sort()
    const ultimoAnterior = sortedAnt[sortedAnt.length - 1]
    const opCaliralAnterior = await db.operacion.count({
      where: {
        productorId,
        certificadorId: caliral.id,
        periodo: ultimoAnterior,
      },
    })

    if (opCaliralAnterior > 0 && opCaliralActual < opCaliralAnterior) {
      disminucion = (opCaliralAnterior - opCaliralActual) / opCaliralAnterior
      if (disminucion >= UMBRAL_DISMINUCION) {
        score += 25
        detalle.push(`Operaciones con Caliral disminuyeron ${(disminucion * 100).toFixed(0)}% vs período anterior`)
      } else if (disminucion > 0) {
        score += 10
        detalle.push(`Ligera disminución de operaciones (${(disminucion * 100).toFixed(0)}%)`)
      }
    } else if (opCaliralAnterior > 0 && opCaliralActual === 0) {
      score += 40
      detalle.push('Sin operaciones con Caliral en el período actual')
    }
  }

  // 2. Uso creciente de competidores
  const opCompetenciaActual = await db.operacion.aggregate({
    where: {
      productorId,
      competidorId: { not: null },
      periodo: periodoActual,
    },
    _count: true,
  })

  let usoCreciente = 0
  if (periodosAnteriores.length > 0) {
    const sortedAnt = [...periodosAnteriores].sort()
    const ultimoAnterior = sortedAnt[sortedAnt.length - 1]
    const opCompetenciaAnterior = await db.operacion.aggregate({
      where: {
        productorId,
        competidorId: { not: null },
        periodo: ultimoAnterior,
      },
      _count: true,
    })

    if (opCompetenciaAnterior._count > 0) {
      const crecimiento = (opCompetenciaActual._count - opCompetenciaAnterior._count) / opCompetenciaAnterior._count
      if (crecimiento > 0) {
        usoCreciente = crecimiento
        score += Math.min(25, crecimiento * 50)
        detalle.push(`Uso de competidores creció ${(crecimiento * 100).toFixed(0)}% vs período anterior`)
      }
    } else if (opCompetenciaActual._count > 0) {
      // Empezó a usar competidor
      score += 20
      detalle.push('Comenzó a utilizar competidores en el período actual')
    }
  } else if (opCompetenciaActual._count > 0) {
    score += 15
    detalle.push('Utiliza competidores')
  }

  // 3. Tiempo sin operar con Caliral
  const ultimaOpCaliral = await db.operacion.findFirst({
    where: {
      productorId,
      certificadorId: caliral.id,
    },
    orderBy: { fecha: 'desc' },
    select: { fecha: true },
  })

  let tiempoSinOperar = 0
  if (ultimaOpCaliral) {
    const diffMs = Date.now() - new Date(ultimaOpCaliral.fecha).getTime()
    tiempoSinOperar = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (tiempoSinOperar > 180) {
      score += 30
      detalle.push(`Sin operar con Caliral hace ${tiempoSinOperar} días`)
    } else if (tiempoSinOperar > 90) {
      score += 15
      detalle.push(`Sin operar con Caliral hace ${tiempoSinOperar} días`)
    }
  } else {
    // Nunca operó con Caliral
    if (opCompetenciaActual._count > 0) {
      score += 25
      detalle.push('Nunca ha operado con Caliral')
    }
  }

  // 4. Cambio de certificador
  const competidoresUsadosActual = await db.operacion.findMany({
    where: {
      productorId,
      competidorId: { not: null },
      periodo: periodoActual,
    },
    select: { competidorId: true },
    distinct: ['competidorId'],
  })

  let cambioCertificador = false
  if (periodosAnteriores.length > 0 && opCaliralActual === 0) {
    const opCaliralAnterior = await db.operacion.count({
      where: {
        productorId,
        certificadorId: caliral.id,
        periodo: periodosAnteriores[periodosAnteriores.length - 1],
      },
    })
    if (opCaliralAnterior > 0 && competidoresUsadosActual.length > 0) {
      cambioCertificador = true
      score += 35
      detalle.push('Migró de Caliral a un competidor')
    }
  }

  // 5. Cantidad de competidores utilizados
  const cantidadCompetidores = competidoresUsadosActual.length
  if (cantidadCompetidores >= 3) {
    score += 20
    detalle.push(`Opera con ${cantidadCompetidores} competidores simultáneamente`)
  } else if (cantidadCompetidores === 2) {
    score += 10
    detalle.push('Opera con 2 competidores')
  }

  // Normalizar score 0-100
  score = Math.min(100, Math.max(0, score))

  const level: RiskLevel =
    score >= 80 ? 'CRITICO' :
    score >= 60 ? 'ALTO' :
    score >= 30 ? 'MEDIO' : 'BAJO'

  return {
    score,
    level,
    factores: {
      disminucionOperaciones: disminucion,
      usoCompetidorCreciente: usoCreciente,
      tiempoSinOperar,
      cambioCertificador,
      cantidadCompetidores,
      detalle,
    },
  }
}

// ============================================================
// GENERACIÓN DE RECOMENDACIONES COMERCIALES
// ============================================================

export function generarRecomendacion(
  estado: EstadoCliente,
  riskLevel: RiskLevel,
  factores: RiskFactores
): string {
  const partes: string[] = []

  if (estado === 'PERDIDO') {
    partes.push('Cliente perdido. Contactar inmediatamente para entender motivos de migración.')
    if (factores.cambioCertificador) {
      partes.push('Migró a competidor directo. Investigar oferta de la competencia.')
    }
  } else if (estado === 'RECUPERADO') {
    partes.push('Cliente recuperado. Reforzar relación y ofrecer condiciones preferenciales para fidelizar.')
  } else if (estado === 'NUEVO') {
    partes.push('Cliente nuevo. Asignar ejecutivo de cuenta y programar seguimiento trimestral.')
  } else if (estado === 'COMPARTIDO') {
    partes.push('Cliente compartido con competencia. Diversificar servicios y promover exclusividad.')
    if (factores.usoCompetidorCreciente > 0.2) {
      partes.push('Uso de competidor en crecimiento. Acción urgente requerida.')
    }
  } else if (estado === 'EXCLUSIVO') {
    partes.push('Cliente exclusivo. Mantener calidad de servicio y buscar expandir volumen.')
  }

  if (riskLevel === 'CRITICO') {
    partes.push('Riesgo crítico: intervención del gerente comercial recomendada.')
  } else if (riskLevel === 'ALTO') {
    partes.push('Riesgo alto: visita comercial en los próximos 15 días.')
  } else if (riskLevel === 'MEDIO' && estado === 'ACTIVO') {
    partes.push('Monitorear de cerca. Llamada de seguimiento este mes.')
  }

  if (factores.tiempoSinOperar > 90 && estado !== 'PERDIDO') {
    partes.push(`Sin operar hace ${factores.tiempoSinOperar} días. Contactar para reactivar operaciones.`)
  }

  return partes.join(' ')
}

// ============================================================
// CÁLCULO DE HISTÓRICO POR PERIODO
// ============================================================

export async function calcularHistoricoPeriodo(
  productorId: string,
  periodo: string,
  periodosAnteriores: string[]
) {
  const caliral = await getCaliral()
  if (!caliral) return null

  // Métricas con Caliral
  const caliralMetrics = await db.operacion.aggregate({
    where: {
      productorId,
      certificadorId: caliral.id,
      periodo,
    },
    _count: true,
    _sum: { pesoKg: true, valorUsd: true },
  })

  // Métricas con competencia
  const competenciaMetrics = await db.operacion.aggregate({
    where: {
      productorId,
      competidorId: { not: null },
      periodo,
    },
    _count: true,
    _sum: { pesoKg: true, valorUsd: true },
  })

  // Competidores usados en el periodo
  const competidoresUsados = await db.operacion.groupBy({
    by: ['competidorId'],
    where: {
      productorId,
      competidorId: { not: null },
      periodo,
    },
    _count: true,
    _sum: { pesoKg: true },
  })

  const competidoresNombres = await Promise.all(
    competidoresUsados
      .filter((c) => c.competidorId)
      .map(async (c) => {
        const comp = await db.competidor.findUnique({
          where: { id: c.competidorId! },
          select: { nombre: true },
        })
        return {
          competidorId: c.competidorId!,
          nombre: comp?.nombre || 'Desconocido',
          operaciones: c._count,
          peso: c._sum.pesoKg || 0,
        }
      })
  )

  // Determinar estado
  let estado: EstadoCliente = 'INACTIVO'
  const opCaliral = caliralMetrics._count
  const opCompetencia = competenciaMetrics._count

  // Verificar recuperación
  const recuperado = await esRecuperado(productorId, periodo, periodosAnteriores)

  if (recuperado) {
    estado = 'RECUPERADO'
  } else if (opCaliral > 0 && opCompetencia === 0) {
    if (periodosAnteriores.length === 0) {
      estado = 'NUEVO'
    } else {
      const opCaliralAnt = await db.operacion.count({
        where: {
          productorId,
          certificadorId: caliral.id,
          periodo: { in: periodosAnteriores },
        },
      })
      estado = opCaliralAnt === 0 ? 'NUEVO' : 'EXCLUSIVO'
    }
  } else if (opCaliral > 0 && opCompetencia > 0) {
    estado = 'COMPARTIDO'
  } else if (opCaliral === 0 && opCompetencia > 0) {
    if (periodosAnteriores.length > 0) {
      const opCaliralAnt = await db.operacion.count({
        where: {
          productorId,
          certificadorId: caliral.id,
          periodo: { in: periodosAnteriores },
        },
      })
      estado = opCaliralAnt > 0 ? 'PERDIDO' : 'INACTIVO'
    } else {
      estado = 'INACTIVO'
    }
  }

  // Calcular riesgo
  const { score, level, factores } = await calcularRiesgo(
    productorId,
    periodo,
    periodosAnteriores
  )

  // Generar recomendación
  const recomendacion = generarRecomendacion(estado, level, factores)

  return {
    periodo,
    operacionesCaliral: opCaliral,
    pesoCaliral: caliralMetrics._sum.pesoKg || 0,
    valorCaliral: caliralMetrics._sum.valorUsd || 0,
    operacionesCompetencia: opCompetencia,
    pesoCompetencia: competenciaMetrics._sum.pesoKg || 0,
    valorCompetencia: competenciaMetrics._sum.valorUsd || 0,
    competidoresUsados: competidoresNombres,
    estado,
    riskScore: score,
    riskLevel: level,
    riskFactores: factores,
    recomendacion,
  }
}

// ============================================================
// RECÁLCULO COMPLETO DE HISTÓRICO Y ALERTAS
// ============================================================

export async function recalcularInteligenciaCompleta() {
  const periodos = await getPeriodos()
  if (periodos.length === 0) return { procesados: 0, alertas: 0 }

  // Limpiar alertas e histórico previo
  await db.alerta.deleteMany({})
  await db.historico.deleteMany({})

  let totalAlertas = 0
  const productores = await db.productor.findMany()

  for (const productor of productores) {
    for (let i = 0; i < periodos.length; i++) {
      const periodo = periodos[i]
      const periodosAnteriores = periodos.slice(0, i)

      const historicoData = await calcularHistoricoPeriodo(
        productor.id,
        periodo,
        periodosAnteriores
      )

      if (!historicoData) continue

      // Guardar histórico
      const historico = await db.historico.create({
        data: {
          productorId: productor.id,
          periodo,
          operacionesCaliral: historicoData.operacionesCaliral,
          pesoCaliral: historicoData.pesoCaliral,
          valorCaliral: historicoData.valorCaliral,
          operacionesCompetencia: historicoData.operacionesCompetencia,
          pesoCompetencia: historicoData.pesoCompetencia,
          valorCompetencia: historicoData.valorCompetencia,
          competidoresUsadosJson: JSON.stringify(historicoData.competidoresUsados),
          estado: historicoData.estado,
          riskScore: historicoData.riskScore,
          riskLevel: historicoData.riskLevel,
          riskFactoresJson: JSON.stringify(historicoData.riskFactores),
          recomendacion: historicoData.recomendacion,
        },
      })

      // Generar alertas para el último periodo
      if (i === periodos.length - 1) {
        totalAlertas += await generarAlertasProductor(
          productor.id,
          productor.nombre,
          periodo,
          historicoData,
          periodosAnteriores
        )
      }
    }
  }

  // Generar alertas de competidores
  totalAlertas += await generarAlertasCompetidores(periodos)

  return { procesados: productores.length, alertas: totalAlertas }
}

// ============================================================
// GENERACIÓN DE ALERTAS
// ============================================================

async function generarAlertasProductor(
  productorId: string,
  productorNombre: string,
  periodo: string,
  historicoData: Awaited<ReturnType<typeof calcularHistoricoPeriodo>>,
  periodosAnteriores: string[]
): Promise<number> {
  if (!historicoData) return 0
  let count = 0

  // Alerta: Cliente perdido
  if (historicoData.estado === 'PERDIDO') {
    await db.alerta.create({
      data: {
        tipo: 'CLIENTE_PERDIDO',
        severidad: 'CRITICAL',
        productorId,
        periodo,
        titulo: `${productorNombre} abandonó Caliral`,
        mensaje: `${productorNombre} dejó de operar con Caliral en ${periodo}. Continúa operando con competencia.`,
        datosJson: JSON.stringify({ estado: historicoData.estado }),
      },
    })
    count++

    // Migración a competidor
    if (historicoData.competidoresUsados.length > 0) {
      const competidorId = historicoData.competidoresUsados[0].competidorId
      const competidorNombre = historicoData.competidoresUsados[0].nombre
      await db.alerta.create({
        data: {
          tipo: 'MIGRACION',
          severidad: 'CRITICAL',
          productorId,
          competidorId,
          periodo,
          titulo: `${productorNombre} migró a ${competidorNombre}`,
          mensaje: `${productorNombre} migró sus operaciones de Caliral a ${competidorNombre}.`,
          datosJson: JSON.stringify({ competidorId, competidorNombre }),
        },
      })
      count++
    }
  }

  // Alerta: Cliente recuperado
  if (historicoData.estado === 'RECUPERADO') {
    await db.alerta.create({
      data: {
        tipo: 'CLIENTE_RECUPERADO',
        severidad: 'SUCCESS',
        productorId,
        periodo,
        titulo: `${productorNombre} fue recuperado`,
        mensaje: `${productorNombre} volvió a operar con Caliral en ${periodo}.`,
        datosJson: JSON.stringify({ estado: historicoData.estado }),
      },
    })
    count++
  }

  // Alerta: Cliente nuevo
  if (historicoData.estado === 'NUEVO') {
    await db.alerta.create({
      data: {
        tipo: 'CLIENTE_NUEVO',
        severidad: 'SUCCESS',
        productorId,
        periodo,
        titulo: `${productorNombre} es cliente nuevo`,
        mensaje: `${productorNombre} comenzó a operar con Caliral en ${periodo}.`,
        datosJson: JSON.stringify({ estado: historicoData.estado }),
      },
    })
    count++
  }

  // Alerta: Cliente compartido
  if (historicoData.estado === 'COMPARTIDO' && periodosAnteriores.length > 0) {
    const ultimoAnterior = periodosAnteriores[periodosAnteriores.length - 1]
    const opCompAnt = await db.operacion.count({
      where: {
        productorId,
        competidorId: { not: null },
        periodo: ultimoAnterior,
      },
    })

    if (opCompAnt === 0) {
      // Empezó a compartir
      const competidorId = historicoData.competidoresUsados[0]?.competidorId
      const competidorNombre = historicoData.competidoresUsados[0]?.nombre
      await db.alerta.create({
        data: {
          tipo: 'CLIENTE_COMPARTIDO',
          severidad: 'WARNING',
          productorId,
          competidorId,
          periodo,
          titulo: `${productorNombre} ahora usa competidor`,
          mensaje: `${productorNombre} comenzó a operar también con ${competidorNombre} en ${periodo}.`,
          datosJson: JSON.stringify({ competidorId, competidorNombre }),
        },
      })
      count++
    }
  }

  // Alertas de riesgo
  if (historicoData.riskLevel === 'CRITICO') {
    await db.alerta.create({
      data: {
        tipo: 'RIESGO_CRITICO',
        severidad: 'CRITICAL',
        productorId,
        periodo,
        titulo: `Riesgo crítico: ${productorNombre}`,
        mensaje: `${productorNombre} tiene riesgo crítico (score: ${historicoData.riskScore}). ${historicoData.recomendacion}`,
        datosJson: JSON.stringify({
          riskScore: historicoData.riskScore,
          riskLevel: historicoData.riskLevel,
          factores: historicoData.riskFactores,
        }),
      },
    })
    count++
  } else if (historicoData.riskLevel === 'ALTO') {
    await db.alerta.create({
      data: {
        tipo: 'RIESGO_ALTO',
        severidad: 'WARNING',
        productorId,
        periodo,
        titulo: `Riesgo alto: ${productorNombre}`,
        mensaje: `${productorNombre} tiene riesgo alto (score: ${historicoData.riskScore}). ${historicoData.recomendacion}`,
        datosJson: JSON.stringify({
          riskScore: historicoData.riskScore,
          riskLevel: historicoData.riskLevel,
          factores: historicoData.riskFactores,
        }),
      },
    })
    count++
  }

  // Alerta: Disminución significativa
  if (historicoData.riskFactores && historicoData.riskFactores.disminucionOperaciones >= UMBRAL_DISMINUCION) {
    const disminucion = historicoData.riskFactores.disminucionOperaciones
    await db.alerta.create({
      data: {
        tipo: 'DISMINUCION',
        severidad: 'WARNING',
        productorId,
        periodo,
        titulo: `Disminución en ${productorNombre}`,
        mensaje: `${productorNombre} redujo operaciones con Caliral un ${(disminucion * 100).toFixed(0)}% en ${periodo}.`,
        datosJson: JSON.stringify({ disminucion }),
      },
    })
    count++
  }

  return count
}

async function generarAlertasCompetidores(periodos: string[]): Promise<number> {
  if (periodos.length < 2) return 0
  let count = 0
  const periodoActual = periodos[periodos.length - 1]
  const periodoAnterior = periodos[periodos.length - 2]

  const competidores = await db.competidor.findMany({ where: { activo: true } })

  for (const competidor of competidores) {
    // Operaciones en periodo actual
    const opActual = await db.operacion.aggregate({
      where: { competidorId: competidor.id, periodo: periodoActual },
      _count: true,
      _sum: { pesoKg: true },
    })

    // Operaciones en periodo anterior
    const opAnterior = await db.operacion.aggregate({
      where: { competidorId: competidor.id, periodo: periodoAnterior },
      _count: true,
      _sum: { pesoKg: true },
    })

    // Crecimiento
    if (opAnterior._count > 0) {
      const crecimiento = (opActual._count - opAnterior._count) / opAnterior._count
      if (crecimiento >= UMBRAL_CRECIMIENTO_COMPETIDOR) {
        await db.alerta.create({
          data: {
            tipo: 'COMPETIDOR_CRECIMIENTO',
            severidad: 'WARNING',
            competidorId: competidor.id,
            periodo: periodoActual,
            titulo: `${competidor.nombre} creció ${(crecimiento * 100).toFixed(0)}%`,
            mensaje: `${competidor.nombre} aumentó operaciones de ${opAnterior._count} a ${opActual._count} (${(crecimiento * 100).toFixed(0)}% de crecimiento).`,
            datosJson: JSON.stringify({
              operacionesAnterior: opAnterior._count,
              operacionesActual: opActual._count,
              crecimiento,
            }),
          },
        })
        count++
      }
    }

    // Captaciones: clientes que antes estaban con Caliral y ahora con este competidor
    const productoresActuales = await db.operacion.findMany({
      where: { competidorId: competidor.id, periodo: periodoActual },
      select: { productorId: true },
      distinct: ['productorId'],
    })

    for (const { productorId } of productoresActuales) {
      const opCaliralAnterior = await db.operacion.count({
        where: {
          productorId,
          certificadorId: (await getCaliral())?.id,
          periodo: periodoAnterior,
        },
      })

      const opCaliralActual = await db.operacion.count({
        where: {
          productorId,
          certificadorId: (await getCaliral())?.id,
          periodo: periodoActual,
        },
      })

      // Si antes operaba con Caliral y ahora no (y ahora opera con este competidor)
      if (opCaliralAnterior > 0 && opCaliralActual === 0) {
        const productor = await db.productor.findUnique({
          where: { id: productorId },
          select: { nombre: true },
        })
        await db.alerta.create({
          data: {
            tipo: 'COMPETIDOR_CAPTACION',
            severidad: 'CRITICAL',
            productorId,
            competidorId: competidor.id,
            periodo: periodoActual,
            titulo: `${competidor.nombre} captó a ${productor?.nombre}`,
            mensaje: `${competidor.nombre} captó a ${productor?.nombre} que antes operaba con Caliral.`,
            datosJson: JSON.stringify({ productorId, productorNombre: productor?.nombre }),
          },
        })
        count++
      }
    }
  }

  return count
}
