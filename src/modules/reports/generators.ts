import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { db } from '@/lib/db'
import { getCaliral, getPeriodos } from '@/modules/intelligence/engine'
import { construirRadarComercial } from '@/modules/intelligence/radar-builder'
import type { ReportType } from '@/types/domain'

// ============================================================
// GENERADORES DE REPORTES
// ============================================================

async function getDatosReporte(tipo: ReportType) {
  const caliral = await getCaliral()
  const periodos = await getPeriodos()
  if (!caliral || periodos.length === 0) {
    return { error: 'Sin datos' }
  }
  const periodoActual = periodos[periodos.length - 1]
  const radar = await construirRadarComercial()

  switch (tipo) {
    case 'radar': {
      return { radar, periodoActual }
    }
    case 'productores': {
      const historicos = await db.historico.findMany({
        where: { periodo: periodoActual },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })
      return { historicos, periodoActual }
    }
    case 'competidores': {
      const competidores = await db.competidor.findMany({ where: { activo: true } })
      const datos = await Promise.all(competidores.map(async (c) => {
        const opActual = await db.operacion.count({ where: { competidorId: c.id, periodo: periodoActual } })
        const clientes = await db.operacion.findMany({
          where: { competidorId: c.id, periodo: periodoActual },
          select: { productorId: true },
          distinct: ['productorId'],
        })
        return { ...c, operaciones: opActual, clientes: clientes.length }
      }))
      return { competidores: datos, periodoActual }
    }
    case 'riesgo': {
      const enRiesgo = await db.historico.findMany({
        where: { riskLevel: { in: ['ALTO', 'CRITICO'] } },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })
      return { enRiesgo, periodoActual }
    }
    case 'alertas': {
      const alertas = await db.alerta.findMany({
        include: { productor: true, competidor: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return { alertas, periodoActual }
    }
    case 'evolucion': {
      const evolucion = await Promise.all(periodos.map(async (p) => {
        const opCaliral = await db.operacion.count({
          where: { certificadorId: caliral.id, periodo: p },
        })
        const opCompetencia = await db.operacion.count({
          where: { competidorId: { not: null }, periodo: p },
        })
        return { periodo: p, opCaliral, opCompetencia }
      }))
      return { evolucion, periodoActual }
    }
    case 'completo':
    default: {
      const historicos = await db.historico.findMany({
        where: { periodo: periodoActual },
        include: { productor: true },
        orderBy: { riskScore: 'desc' },
      })
      const competidores = await db.competidor.findMany({ where: { activo: true } })
      const alertas = await db.alerta.findMany({
        include: { productor: true, competidor: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return { radar, historicos, competidores, alertas, periodoActual }
    }
  }
}

// ============================================================
// EXCEL
// ============================================================

export async function generarExcel(tipo: ReportType): Promise<{ buffer: Buffer; fileName: string }> {
  const datos: any = await getDatosReporte(tipo)
  if (datos.error) throw new Error(datos.error)

  const wb = XLSX.utils.book_new()
  const ts = new Date().toISOString().slice(0, 10)

  const addSheet = (nombre: string, filas: any[]) => {
    const ws = XLSX.utils.json_to_sheet(filas)
    XLSX.utils.book_append_sheet(wb, ws, nombre.substring(0, 31))
  }

  if (tipo === 'radar' || tipo === 'completo') {
    addSheet('Radar Comercial', datos.radar.conclusiones.map((c: any) => ({
      Tipo: c.tipo,
      Titulo: c.titulo,
      Mensaje: c.mensaje,
      Severidad: c.severidad,
      Periodo: datos.radar.periodo,
    })))
    addSheet('Metricas Globales', [{
      Periodo: datos.radar.periodo,
      TotalProductores: datos.radar.metricas.totalProductores,
      Activos: datos.radar.metricas.productoresActivos,
      Exclusivos: datos.radar.metricas.productoresExclusivos,
      Compartidos: datos.radar.metricas.productoresCompartidos,
      Perdidos: datos.radar.metricas.productoresPerdidos,
      Recuperados: datos.radar.metricas.productoresRecuperados,
      Nuevos: datos.radar.metricas.productoresNuevos,
      OperacionesCaliral: datos.radar.metricas.totalOperacionesCaliral,
      ParticipacionCaliral: datos.radar.metricas.participacionCaliral.toFixed(2) + '%',
      ClientesEnRiesgo: datos.radar.metricas.clientesEnRiesgo,
    }])
  }

  if (tipo === 'productores' || tipo === 'completo') {
    addSheet('Productores', datos.historicos.map((h: any) => ({
      Productor: h.productor.nombre,
      Estado: h.estado,
      Riesgo: h.riskLevel,
      ScoreRiesgo: h.riskScore,
      OperacionesCaliral: h.operacionesCaliral,
      PesoCaliralKg: h.pesoCaliral,
      OperacionesCompetencia: h.operacionesCompetencia,
      PesoCompetenciaKg: h.pesoCompetencia,
      Recomendacion: h.recomendacion,
      Periodo: h.periodo,
    })))
  }

  if (tipo === 'competidores' || tipo === 'completo') {
    const compData = tipo === 'competidores'
      ? datos.competidores.map((c: any) => ({
          Competidor: c.nombre,
          Operaciones: c.operaciones,
          Clientes: c.clientes,
          Periodo: datos.periodoActual,
        }))
      : datos.competidores.map(async (c: any) => {
          const opActual = await db.operacion.count({ where: { competidorId: c.id, periodo: datos.periodoActual } })
          const clientes = await db.operacion.findMany({
            where: { competidorId: c.id, periodo: datos.periodoActual },
            select: { productorId: true },
            distinct: ['productorId'],
          })
          return {
            Competidor: c.nombre,
            Operaciones: opActual,
            Clientes: clientes.length,
            Periodo: datos.periodoActual,
          }
        })
    const compResolved = Array.isArray(compData) && compData[0] instanceof Promise
      ? await Promise.all(compData)
      : compData
    addSheet('Competidores', compResolved)
  }

  if (tipo === 'riesgo' || tipo === 'completo') {
    const riesgoData = tipo === 'riesgo' ? datos.enRiesgo : datos.historicos.filter((h: any) => h.riskLevel === 'ALTO' || h.riskLevel === 'CRITICO')
    addSheet('Clientes en Riesgo', riesgoData.map((h: any) => ({
      Productor: h.productor.nombre,
      NivelRiesgo: h.riskLevel,
      Score: h.riskScore,
      Estado: h.estado,
      Recomendacion: h.recomendacion,
      Periodo: h.periodo,
    })))
  }

  if (tipo === 'alertas' || tipo === 'completo') {
    const alertasData = tipo === 'alertas' ? datos.alertas : datos.alertas
    addSheet('Alertas', alertasData.map((a: any) => ({
      Tipo: a.tipo,
      Titulo: a.titulo,
      Mensaje: a.mensaje,
      Severidad: a.severidad,
      Productor: a.productor?.nombre || '',
      Competidor: a.competidor?.nombre || '',
      Periodo: a.periodo,
      Fecha: a.createdAt.toISOString(),
    })))
  }

  if (tipo === 'evolucion') {
    addSheet('Evolucion', datos.evolucion.map((e: any) => ({
      Periodo: e.periodo,
      OperacionesCaliral: e.opCaliral,
      OperacionesCompetencia: e.opCompetencia,
    })))
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return { buffer, fileName: `caliral_${tipo}_${ts}.xlsx` }
}

// ============================================================
// CSV
// ============================================================

export async function generarCSV(tipo: ReportType): Promise<{ buffer: Buffer; fileName: string }> {
  const datos: any = await getDatosReporte(tipo)
  if (datos.error) throw new Error(datos.error)

  let filas: any[] = []
  if (tipo === 'radar') {
    filas = datos.radar.conclusiones.map((c: any) => ({
      tipo: c.tipo, titulo: c.titulo, mensaje: c.mensaje, severidad: c.severidad, periodo: datos.radar.periodo,
    }))
  } else if (tipo === 'productores') {
    filas = datos.historicos.map((h: any) => ({
      productor: h.productor.nombre, estado: h.estado, riesgo: h.riskLevel, score: h.riskScore,
      operacionesCaliral: h.operacionesCaliral, operacionesCompetencia: h.operacionesCompetencia,
      recomendacion: h.recomendacion,
    }))
  } else if (tipo === 'competidores') {
    filas = datos.competidores.map((c: any) => ({
      competidor: c.nombre, operaciones: c.operaciones, clientes: c.clientes,
    }))
  } else if (tipo === 'riesgo') {
    filas = datos.enRiesgo.map((h: any) => ({
      productor: h.productor.nombre, nivel: h.riskLevel, score: h.riskScore, estado: h.estado, recomendacion: h.recomendacion,
    }))
  } else if (tipo === 'alertas') {
    filas = datos.alertas.map((a: any) => ({
      tipo: a.tipo, titulo: a.titulo, mensaje: a.mensaje, severidad: a.severidad,
      productor: a.productor?.nombre || '', competidor: a.competidor?.nombre || '', periodo: a.periodo,
    }))
  } else if (tipo === 'evolucion') {
    filas = datos.evolucion.map((e: any) => ({
      periodo: e.periodo, operacionesCaliral: e.opCaliral, operacionesCompetencia: e.opCompetencia,
    }))
  } else if (tipo === 'completo') {
    filas = datos.historicos.map((h: any) => ({
      productor: h.productor.nombre, estado: h.estado, riesgo: h.riskLevel, score: h.riskScore,
      operacionesCaliral: h.operacionesCaliral, operacionesCompetencia: h.operacionesCompetencia,
    }))
  }

  const csv = Papa.unparse(filas)
  const ts = new Date().toISOString().slice(0, 10)
  return { buffer: Buffer.from(csv, 'utf-8'), fileName: `caliral_${tipo}_${ts}.csv` }
}

// ============================================================
// PDF
// ============================================================

export async function generarPDF(tipo: ReportType): Promise<{ buffer: Buffer; fileName: string }> {
  const datos: any = await getDatosReporte(tipo)
  if (datos.error) throw new Error(datos.error)

  const doc = new jsPDF()
  const ts = new Date().toISOString().slice(0, 10)
  let y = 20

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('CALIRAL INSIGHT', 14, y)
  y += 8
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Reporte: ${tipo.toUpperCase()}`, 14, y)
  y += 6
  doc.setFontSize(10)
  doc.text(`Periodo: ${datos.periodoActual || 'N/A'}`, 14, y)
  y += 6
  doc.text(`Generado: ${new Date().toLocaleString('es-UY')}`, 14, y)
  y += 10

  if (tipo === 'radar' || tipo === 'completo') {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Radar Comercial - Conclusiones', 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Titulo', 'Severidad']],
      body: datos.radar.conclusiones.map((c: any) => [c.tipo, c.titulo, c.severidad]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // Métricas
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Metricas Globales', 14, y)
    y += 6
    const m = datos.radar.metricas
    autoTable(doc, {
      startY: y,
      head: [['Metrica', 'Valor']],
      body: [
        ['Total productores', String(m.totalProductores)],
        ['Activos', String(m.productoresActivos)],
        ['Exclusivos', String(m.productoresExclusivos)],
        ['Compartidos', String(m.productoresCompartidos)],
        ['Perdidos', String(m.productoresPerdidos)],
        ['Recuperados', String(m.productoresRecuperados)],
        ['Nuevos', String(m.productoresNuevos)],
        ['Operaciones Caliral', String(m.totalOperacionesCaliral)],
        ['Participacion Caliral', `${m.participacionCaliral.toFixed(1)}%`],
        ['Clientes en riesgo', String(m.clientesEnRiesgo)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // Mensajes detallados
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Detalle de conclusiones:', 14, y)
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    datos.radar.conclusiones.forEach((c: any) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold')
      doc.text(`• ${c.titulo}`, 14, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(c.mensaje, 180)
      doc.text(lines, 16, y)
      y += lines.length * 5 + 2
    })
  }

  if (tipo === 'productores' || tipo === 'completo') {
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Productores', 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Productor', 'Estado', 'Riesgo', 'Score', 'Op. Caliral', 'Op. Compet.']],
      body: datos.historicos.map((h: any) => [
        h.productor.nombre.substring(0, 30),
        h.estado,
        h.riskLevel,
        String(h.riskScore),
        String(h.operacionesCaliral),
        String(h.operacionesCompetencia),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  if (tipo === 'competidores') {
    autoTable(doc, {
      startY: y,
      head: [['Competidor', 'Operaciones', 'Clientes']],
      body: datos.competidores.map((c: any) => [c.nombre, String(c.operaciones), String(c.clientes)]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10 },
    })
  }

  if (tipo === 'riesgo') {
    autoTable(doc, {
      startY: y,
      head: [['Productor', 'Nivel', 'Score', 'Recomendacion']],
      body: datos.enRiesgo.map((h: any) => [
        h.productor.nombre,
        h.riskLevel,
        String(h.riskScore),
        (h.recomendacion || '').substring(0, 60),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [185, 28, 28] },
      styles: { fontSize: 9 },
    })
  }

  if (tipo === 'alertas' || tipo === 'completo') {
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Alertas Comerciales', 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Titulo', 'Severidad', 'Periodo']],
      body: datos.alertas.map((a: any) => [a.tipo, a.titulo.substring(0, 40), a.severidad, a.periodo]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    })
  }

  if (tipo === 'evolucion') {
    autoTable(doc, {
      startY: y,
      head: [['Periodo', 'Op. Caliral', 'Op. Competencia']],
      body: datos.evolucion.map((e: any) => [e.periodo, String(e.opCaliral), String(e.opCompetencia)]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10 },
    })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`CALIRAL INSIGHT - Pagina ${i} de ${pageCount}`, 14, 290)
    doc.text(`Generado: ${new Date().toLocaleString('es-UY')}`, 150, 290)
  }

  const buffer = Buffer.from(doc.output('arraybuffer'))
  return { buffer, fileName: `caliral_${tipo}_${ts}.pdf` }
}
