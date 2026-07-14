/**
 * Carga el CSV generado por Python en la DB y genera los JSON estáticos.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as csv from 'papaparse'
import { db } from '../src/lib/db'
import { recalcularInteligenciaCompleta } from '../src/modules/intelligence/engine'
import { construirRadarComercial } from '../src/modules/intelligence/radar-builder'
import { getProductoresList, getCompetidoresList, getProductorDetalle, getCompetidorDetalle } from '../src/modules/intelligence/services'
import { getPeriodos, getCaliral } from '../src/modules/intelligence/engine'

async function main() {
  const csvPath = process.argv[2] || '/tmp/operaciones.csv'

  console.log(`📁 Cargando CSV: ${csvPath}`)

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const result = csv.parse(csvContent, { header: true, dynamicTyping: true })

  console.log(`📊 ${result.data.length} operaciones en el CSV`)

  // Limpiar DB
  console.log('🧹 Limpiando DB...')
  await db.alerta.deleteMany({})
  await db.historico.deleteMany({})
  await db.operacion.deleteMany({})
  await db.contenedor.deleteMany({})
  await db.destino.deleteMany({})
  await db.competidor.deleteMany({})
  await db.certificador.deleteMany({})
  await db.productor.deleteMany({})
  await db.importacion.deleteMany({})

  // Crear Caliral - buscar coincidencia en los datos
  console.log('🏢 Creando Caliral...')
  // El nombre real en el archivo es "CALIRAL S. A."
  const caliral = await db.certificador.create({
    data: { nombre: 'CALIRAL S.A.', esCaliral: true, activo: true },
  })

  // Crear usuario sistema
  const systemUser = await db.usuario.upsert({
    where: { email: 'system@caliral.com' },
    update: {},
    create: {
      email: 'system@caliral.com',
      nombre: 'Sistema',
      passwordHash: 'system',
      rol: 'ADMINISTRADOR',
    },
  })

  // Crear importación
  const importacion = await db.importacion.create({
    data: {
      fileName: 'Exportar_DatosEmbarqueCarne5078.xlsb',
      fileSize: 24474097,
      periodo: new Date().toISOString().slice(0, 7),
      uploadedById: systemUser.id,
      status: 'COMPLETADO',
      totalRows: result.data.length,
      validRows: 0,
      completedAt: new Date(),
    },
  })

  // Caches
  const productorCache = new Map<string, string>()
  const competidorCache = new Map<string, string>()
  const destinoCache = new Map<string, string>()
  const contenedorCache = new Map<string, string>()

  // Palabras clave para identificar Caliral (algunas filas pueden tener variantes)
  const caliralKeywords = ['CALIRAL']

  let validOps = 0
  const operacionesBatch: any[] = []

  console.log('⚙️  Procesando operaciones...')

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as any

    if (i % 5000 === 0 && i > 0) {
      console.log(`   Procesadas ${i}/${result.data.length}...`)
    }

    const productor = String(row.productor || '').trim()
    const deposito = String(row.deposito || '').trim()
    const fechaStr = String(row.fecha || '').trim()

    if (!productor || !deposito || !fechaStr) continue

    const fecha = new Date(fechaStr)
    if (isNaN(fecha.getTime())) continue

    const periodo = String(row.periodo || `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`)
    const cantidad = parseFloat(row.cantidad) || 0
    const pesoKg = parseFloat(row.pesoKg) || 0
    const valorUsd = parseFloat(row.valorUsd) || 0
    const producto = String(row.producto || '').trim() || null
    const destino = String(row.destino || '').trim() || null
    const contenedor = String(row.contenedor || '').trim().toUpperCase() || null

    // Resolver productor
    let productorId = productorCache.get(productor)
    if (!productorId) {
      let prod = await db.productor.findFirst({ where: { nombre: productor } })
      if (!prod) {
        prod = await db.productor.create({ data: { nombre: productor } })
      }
      productorId = prod.id
      productorCache.set(productor, productorId)
    }

    // Resolver depósito (Caliral o competidor)
    let certificadorId: string | null = null
    let competidorId: string | null = null

    const isCaliral = caliralKeywords.some(k => deposito.includes(k))
    if (isCaliral) {
      certificadorId = caliral.id
    } else {
      let comp = await db.competidor.findFirst({ where: { nombre: deposito } })
      if (!comp) {
        comp = await db.competidor.create({ data: { nombre: deposito } })
      }
      competidorId = comp.id
      competidorCache.set(deposito, competidorId)
    }

    // Resolver destino
    let destinoId: string | null = null
    if (destino) {
      destinoId = destinoCache.get(destino)
      if (!destinoId) {
        let dest = await db.destino.findFirst({ where: { nombre: destino } })
        if (!dest) {
          dest = await db.destino.create({ data: { nombre: destino, pais: destino } })
        }
        destinoId = dest.id
        destinoCache.set(destino, destinoId)
      }
    }

    // Resolver contenedor
    let contenedorId: string | null = null
    if (contenedor) {
      contenedorId = contenedorCache.get(contenedor)
      if (!contenedorId) {
        let cont = await db.contenedor.findFirst({ where: { codigo: contenedor } })
        if (!cont) {
          cont = await db.contenedor.create({ data: { codigo: contenedor } })
        }
        contenedorId = cont.id
        contenedorCache.set(contenedor, contenedorId)
      }
    }

    operacionesBatch.push({
      productorId,
      certificadorId,
      competidorId,
      destinoId,
      contenedorId,
      importacionId: importacion.id,
      fecha,
      periodo,
      producto,
      cantidad,
      pesoKg,
      valorUsd,
    })
    validOps++

    if (operacionesBatch.length >= 1000) {
      await db.operacion.createMany({ data: operacionesBatch.splice(0, 1000) })
    }
  }

  if (operacionesBatch.length > 0) {
    await db.operacion.createMany({ data: operacionesBatch })
  }

  console.log(`\n✅ ${validOps} operaciones insertadas`)
  console.log(`   ${productorCache.size} productores`)
  console.log(`   ${competidorCache.size} competidores`)

  // Actualizar importación
  await db.importacion.update({
    where: { id: importacion.id },
    data: { validRows: validOps },
  })

  // Recalcular inteligencia
  console.log('\n🧠 Recalculando inteligencia...')
  const { alertas } = await recalcularInteligenciaCompleta()
  console.log(`   ✅ ${alertas} alertas generadas`)

  // Exportar JSON
  console.log('\n📦 Exportando JSON estáticos...')
  await exportStaticData()

  console.log('\n✅ ¡Todo listo!')
}

async function exportStaticData() {
  const outputDir = path.join(process.cwd(), 'public', 'data')
  fs.mkdirSync(outputDir, { recursive: true })

  console.log('  • Radar comercial...')
  const radar = await construirRadarComercial()
  fs.writeFileSync(path.join(outputDir, 'radar.json'), JSON.stringify(radar, null, 2))

  console.log('  • Productores...')
  const productores = await getProductoresList()
  fs.writeFileSync(path.join(outputDir, 'productores.json'), JSON.stringify({ productores }, null, 2))

  console.log(`  • Detalle de ${productores.length} productores...`)
  const productoresDir = path.join(outputDir, 'productores')
  fs.mkdirSync(productoresDir, { recursive: true })
  fs.readdirSync(productoresDir).forEach(f => fs.unlinkSync(path.join(productoresDir, f)))
  for (const p of productores) {
    const detalle = await getProductorDetalle(p.id)
    fs.writeFileSync(path.join(productoresDir, `${p.id}.json`), JSON.stringify(detalle, null, 2))
  }

  console.log('  • Competidores...')
  const competidores = await getCompetidoresList()
  fs.writeFileSync(path.join(outputDir, 'competidores.json'), JSON.stringify({ competidores }, null, 2))

  console.log(`  • Detalle de ${competidores.length} competidores...`)
  const competidoresDir = path.join(outputDir, 'competidores')
  fs.mkdirSync(competidoresDir, { recursive: true })
  fs.readdirSync(competidoresDir).forEach(f => fs.unlinkSync(path.join(competidoresDir, f)))
  for (const c of competidores) {
    const detalle = await getCompetidorDetalle(c.id)
    fs.writeFileSync(path.join(competidoresDir, `${c.id}.json`), JSON.stringify(detalle, null, 2))
  }

  console.log('  • Alertas...')
  const alertas = await db.alerta.findMany({
    include: { productor: true, competidor: true },
    orderBy: { createdAt: 'desc' },
  })
  fs.writeFileSync(path.join(outputDir, 'alertas.json'), JSON.stringify({ alertas }, null, 2))

  console.log('  • Dashboard...')
  const periodos = await getPeriodos()
  const caliral = await getCaliral()
  const evolucion = await Promise.all(
    periodos.map(async (p) => {
      const opCaliral = caliral
        ? await db.operacion.count({ where: { certificadorId: caliral.id, periodo: p } })
        : 0
      const opCompetencia = await db.operacion.count({
        where: { competidorId: { not: null }, periodo: p },
      })
      return { periodo: p, opCaliral, opCompetencia }
    })
  )
  const stats = {
    totalProductores: await db.productor.count(),
    totalCompetidores: await db.competidor.count(),
    totalOperaciones: await db.operacion.count(),
    totalImportaciones: await db.importacion.count(),
    totalAlertas: alertas.length,
    alertasNoLeidas: alertas.filter((a) => !a.leida).length,
    periodos,
  }
  fs.writeFileSync(path.join(outputDir, 'dashboard.json'), JSON.stringify({ stats, evolucion }, null, 2))

  console.log('  • Índice de búsqueda...')
  const todosProductores = await db.productor.findMany()
  const todosCompetidores = await db.competidor.findMany()
  const todosDestinos = await db.destino.findMany()
  const caliralCert = await db.certificador.findFirst({ where: { esCaliral: true } })
  fs.writeFileSync(
    path.join(outputDir, 'search-index.json'),
    JSON.stringify({
      productores: todosProductores.map((p) => ({ id: p.id, nombre: p.nombre, tipo: 'productor' })),
      competidores: todosCompetidores.map((c) => ({ id: c.id, nombre: c.nombre, tipo: 'competidor' })),
      certificadores: caliralCert ? [{ id: caliralCert.id, nombre: caliralCert.nombre, tipo: 'certificador' }] : [],
      destinos: todosDestinos.map((d) => ({ id: d.id, nombre: d.nombre, tipo: 'destino' })),
    }, null, 2)
  )

  console.log('  ✅ JSON exportados')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
