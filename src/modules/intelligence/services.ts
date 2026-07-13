import { db } from '@/lib/db'
import { getCaliral, getPeriodos } from '@/modules/intelligence/engine'
import type { Productor, Competidor } from '@/types/domain'

// ============================================================
// SERVICIOS DE DETALLE - Productores y Competidores
// ============================================================

export async function getProductoresList(filters?: {
  estado?: string
  riskLevel?: string
  busqueda?: string
}): Promise<Productor[]> {
  const caliral = await getCaliral()
  const periodos = await getPeriodos()
  if (!caliral || periodos.length === 0) return []

  const periodoActual = periodos[periodos.length - 1]

  // Filtro base por histórico del último periodo
  const whereHistorico: any = { periodo: periodoActual }
  if (filters?.estado && filters.estado !== 'TODOS') {
    whereHistorico.estado = filters.estado
  }
  if (filters?.riskLevel && filters.riskLevel !== 'TODOS') {
    whereHistorico.riskLevel = filters.riskLevel
  }

  const whereProductor: any = { activo: true }
  if (filters?.busqueda) {
    whereProductor.nombre = { contains: filters.busqueda.toUpperCase() }
  }

  const historicos = await db.historico.findMany({
    where: whereHistorico,
    include: { productor: true },
    orderBy: { riskScore: 'desc' },
  })

  const productoresFiltrados = historicos.filter((h) => {
    if (!filters?.busqueda) return true
    return h.productor.nombre.includes(filters.busqueda.toUpperCase())
  })

  return Promise.all(productoresFiltrados.map(async (h) => {
    const compsUsados = h.competidoresUsadosJson ? JSON.parse(h.competidoresUsadosJson) : []

    // Última y primera operación con Caliral
    const ultimaOp = await db.operacion.findFirst({
      where: { productorId: h.productorId, certificadorId: caliral.id },
      orderBy: { fecha: 'desc' },
      select: { fecha: true },
    })
    const primeraOp = await db.operacion.findFirst({
      where: { productorId: h.productorId, certificadorId: caliral.id },
      orderBy: { fecha: 'asc' },
      select: { fecha: true },
    })

    // Totales históricos
    const totalCaliral = await db.operacion.count({
      where: { productorId: h.productorId, certificadorId: caliral.id },
    })
    const totalCompetencia = await db.operacion.count({
      where: { productorId: h.productorId, competidorId: { not: null } },
    })

    const total = totalCaliral + totalCompetencia
    const participacionCaliral = total > 0 ? (totalCaliral / total) * 100 : 0

    return {
      id: h.productor.id,
      nombre: h.productor.nombre,
      cuit: h.productor.cuit,
      razonSocial: h.productor.razonSocial,
      pais: h.productor.pais,
      provincia: h.productor.provincia,
      localidad: h.productor.localidad,
      activo: h.productor.activo,
      estado: h.estado as any,
      riskScore: h.riskScore,
      riskLevel: h.riskLevel as any,
      operacionesCaliralTotal: totalCaliral,
      operacionesCompetenciaTotal: totalCompetencia,
      participacionCaliral,
      ultimaOperacionCaliral: ultimaOp?.fecha.toISOString(),
      primeraOperacionCaliral: primeraOp?.fecha.toISOString(),
      competidoresUsados: compsUsados.map((c: any) => c.nombre),
      recomendacion: h.recomendacion,
    } as Productor
  }))
}

export async function getProductorDetalle(productorId: string) {
  const caliral = await getCaliral()
  const periodos = await getPeriodos()
  if (!caliral) return null

  const productor = await db.productor.findUnique({ where: { id: productorId } })
  if (!productor) return null

  // Histórico por periodo
  const historico = await db.historico.findMany({
    where: { productorId },
    orderBy: { periodo: 'asc' },
  })

  // Operaciones con Caliral
  const operacionesCaliral = await db.operacion.findMany({
    where: { productorId, certificadorId: caliral.id },
    include: {
      destino: true,
      contenedor: true,
    },
    orderBy: { fecha: 'desc' },
    take: 50,
  })

  // Operaciones con competidores
  const operacionesCompetencia = await db.operacion.findMany({
    where: { productorId, competidorId: { not: null } },
    include: {
      competidor: true,
      destino: true,
    },
    orderBy: { fecha: 'desc' },
    take: 50,
  })

  // Competidores usados
  const competidoresUsadosAgg = await db.operacion.groupBy({
    by: ['competidorId'],
    where: { productorId, competidorId: { not: null } },
    _count: true,
    _sum: { pesoKg: true, valorUsd: true },
  })

  const competidores = await Promise.all(
    competidoresUsadosAgg.map(async (c) => {
      const comp = await db.competidor.findUnique({ where: { id: c.competidorId! } })
      return {
        competidorId: c.competidorId,
        nombre: comp?.nombre,
        operaciones: c._count,
        peso: c._sum.pesoKg || 0,
        valor: c._sum.valorUsd || 0,
      }
    })
  )

  // Timeline de alertas
  const alertas = await db.alerta.findMany({
    where: { productorId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Datos para gráfico de evolución
  const evolucion = historico.map((h) => ({
    periodo: h.periodo,
    operacionesCaliral: h.operacionesCaliral,
    operacionesCompetencia: h.operacionesCompetencia,
    pesoCaliral: h.pesoCaliral,
    pesoCompetencia: h.pesoCompetencia,
    riskScore: h.riskScore,
    estado: h.estado,
  }))

  // Última operación con Caliral
  const ultimaOp = await db.operacion.findFirst({
    where: { productorId, certificadorId: caliral.id },
    orderBy: { fecha: 'desc' },
  })

  // Primera operación con Caliral
  const primeraOp = await db.operacion.findFirst({
    where: { productorId, certificadorId: caliral.id },
    orderBy: { fecha: 'asc' },
  })

  // Total histórico
  const totalCaliral = await db.operacion.count({
    where: { productorId, certificadorId: caliral.id },
  })
  const totalCompetencia = await db.operacion.count({
    where: { productorId, competidorId: { not: null } },
  })

  const total = totalCaliral + totalCompetencia
  const participacionCaliral = total > 0 ? (totalCaliral / total) * 100 : 0

  // Histórico del último periodo (para estado actual)
  const ultimoHistorico = periodos.length > 0
    ? historico.find((h) => h.periodo === periodos[periodos.length - 1])
    : null

  // Destinos principales
  const destinosAgg = await db.operacion.groupBy({
    by: ['destinoId'],
    where: { productorId, destinoId: { not: null } },
    _count: true,
    _sum: { pesoKg: true },
  })
  const destinosPrincipales = await Promise.all(
    destinosAgg
      .filter((d) => d.destinoId)
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map(async (d) => {
        const destino = await db.destino.findUnique({ where: { id: d.destinoId! } })
        return {
          nombre: destino?.nombre,
          operaciones: d._count,
          peso: d._sum.pesoKg || 0,
        }
      })
  )

  return {
    productor: {
      id: productor.id,
      nombre: productor.nombre,
      cuit: productor.cuit,
      razonSocial: productor.razonSocial,
      pais: productor.pais,
      provincia: productor.provincia,
      localidad: productor.localidad,
      activo: productor.activo,
      estado: ultimoHistorico?.estado,
      riskScore: ultimoHistorico?.riskScore,
      riskLevel: ultimoHistorico?.riskLevel,
      operacionesCaliralTotal: totalCaliral,
      operacionesCompetenciaTotal: totalCompetencia,
      participacionCaliral,
      ultimaOperacionCaliral: ultimaOp?.fecha.toISOString(),
      primeraOperacionCaliral: primeraOp?.fecha.toISOString(),
      competidoresUsados: competidores.map((c) => c.nombre),
      recomendacion: ultimoHistorico?.recomendacion,
    },
    historico,
    evolucion,
    operacionesCaliral,
    operacionesCompetencia,
    competidores,
    alertas,
    destinosPrincipales,
    riskFactores: ultimoHistorico?.riskFactoresJson
      ? JSON.parse(ultimoHistorico.riskFactoresJson)
      : null,
  }
}

export async function getCompetidoresList(): Promise<Competidor[]> {
  const periodos = await getPeriodos()
  if (periodos.length === 0) return []

  const periodoActual = periodos[periodos.length - 1]
  const periodoAnterior = periodos.length > 1 ? periodos[periodos.length - 2] : null

  const competidores = await db.competidor.findMany({ where: { activo: true } })
  const caliral = await getCaliral()

  const result: Competidor[] = []
  for (const c of competidores) {
    const opActual = await db.operacion.count({
      where: { competidorId: c.id, periodo: periodoActual },
    })
    const pesoActual = await db.operacion.aggregate({
      where: { competidorId: c.id, periodo: periodoActual },
      _sum: { pesoKg: true },
    })

    // Clientes únicos en el periodo actual
    const clientesActuales = await db.operacion.findMany({
      where: { competidorId: c.id, periodo: periodoActual },
      select: { productorId: true },
      distinct: ['productorId'],
    })

    // Clientes que también operan con Caliral (compartidos)
    let compartidos = 0
    let exclusivos = 0
    if (caliral) {
      for (const { productorId } of clientesActuales) {
        const opCaliral = await db.operacion.count({
          where: { productorId, certificadorId: caliral.id, periodo: periodoActual },
        })
        if (opCaliral > 0) compartidos++
        else exclusivos++
      }
    }

    // Crecimiento
    let crecimiento = 0
    if (periodoAnterior) {
      const opAnterior = await db.operacion.count({
        where: { competidorId: c.id, periodo: periodoAnterior },
      })
      if (opAnterior > 0) {
        crecimiento = ((opActual - opAnterior) / opAnterior) * 100
      } else if (opActual > 0) {
        crecimiento = 100
      }
    }

    // Captaciones y pérdidas
    const captaciones = await db.alerta.count({
      where: { tipo: 'COMPETIDOR_CAPTACION', competidorId: c.id, periodo: periodoActual },
    })
    const perdidas = await db.alerta.count({
      where: { tipo: 'CLIENTE_RECUPERADO', competidorId: c.id, periodo: periodoActual },
    })

    // Participación de mercado
    const totalOpPeriodo = await db.operacion.count({ where: { periodo: periodoActual } })
    const participacion = totalOpPeriodo > 0 ? (opActual / totalOpPeriodo) * 100 : 0

    result.push({
      id: c.id,
      nombre: c.nombre,
      cuit: c.cuit,
      pais: c.pais,
      activo: c.activo,
      totalOperaciones: opActual,
      totalPeso: pesoActual._sum.pesoKg || 0,
      totalClientes: clientesActuales.length,
      clientesExclusivos: exclusivos,
      clientesCompartidos: compartidos,
      captaciones,
      perdidas,
      crecimiento,
      participacion,
    })
  }

  // Ordenar por operaciones descendente
  result.sort((a, b) => (b.totalOperaciones || 0) - (a.totalOperaciones || 0))
  return result
}

export async function getCompetidorDetalle(competidorId: string) {
  const periodos = await getPeriodos()
  const caliral = await getCaliral()
  if (periodos.length === 0) return null

  const competidor = await db.competidor.findUnique({ where: { id: competidorId } })
  if (!competidor) return null

  const periodoActual = periodos[periodos.length - 1]

  // Operaciones del periodo actual
  const operaciones = await db.operacion.findMany({
    where: { competidorId },
    include: { productor: true, destino: true },
    orderBy: { fecha: 'desc' },
    take: 50,
  })

  // Clientes (productores que usan este competidor en el periodo actual)
  const clientesActuales = await db.operacion.findMany({
    where: { competidorId, periodo: periodoActual },
    select: { productorId: true },
    distinct: ['productorId'],
  })

  const clientes = await Promise.all(
    clientesActuales.map(async ({ productorId }) => {
      const productor = await db.productor.findUnique({ where: { id: productorId } })
      const opConCompetidor = await db.operacion.aggregate({
        where: { productorId, competidorId, periodo: periodoActual },
        _count: true,
        _sum: { pesoKg: true },
      })
      const opConCaliral = caliral
        ? await db.operacion.count({
            where: { productorId, certificadorId: caliral.id, periodo: periodoActual },
          })
        : 0
      const hist = await db.historico.findFirst({
        where: { productorId, periodo: periodoActual },
      })
      return {
        productorId,
        nombre: productor?.nombre,
        operacionesCompetidor: opConCompetidor._count,
        pesoCompetidor: opConCompetidor._sum.pesoKg || 0,
        operacionesCaliral: opConCaliral,
        estado: hist?.estado,
        riesgo: hist?.riskLevel,
        tipo: opConCaliral > 0 ? 'COMPARTIDO' : 'EXCLUSIVO_DEL_COMPETIDOR',
      }
    })
  )

  // Captaciones (productores que antes estaban con Caliral y ahora con este competidor)
  const captaciones = await db.alerta.findMany({
    where: { tipo: 'COMPETIDOR_CAPTACION', competidorId },
    include: { productor: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Evolución por periodo
  const evolucion = await Promise.all(
    periodos.map(async (p) => {
      const ops = await db.operacion.aggregate({
        where: { competidorId, periodo: p },
        _count: true,
        _sum: { pesoKg: true },
      })
      const clientesEnPeriodo = await db.operacion.findMany({
        where: { competidorId, periodo: p },
        select: { productorId: true },
        distinct: ['productorId'],
      })
      return {
        periodo: p,
        operaciones: ops._count,
        peso: ops._sum.pesoKg || 0,
        clientes: clientesEnPeriodo.length,
      }
    })
  )

  // Productores compartidos (con Caliral)
  const compartidos = clientes.filter((c) => c.operacionesCaliral > 0)
  const exclusivos = clientes.filter((c) => c.operacionesCaliral === 0)

  return {
    competidor: {
      id: competidor.id,
      nombre: competidor.nombre,
      cuit: competidor.cuit,
      pais: competidor.pais,
      activo: competidor.activo,
    },
    operaciones,
    clientes,
    captaciones,
    evolucion,
    compartidos,
    exclusivos,
    totalClientes: clientes.length,
    totalCompartidos: compartidos.length,
    totalExclusivos: exclusivos.length,
  }
}
