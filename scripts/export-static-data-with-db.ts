// Script que exporta todos los datos de la DB a JSON estático
// para la versión demo en GitHub Pages
// Ejecutar: bun run scripts/export-static-data.ts

import { db } from '../src/lib/db'
import { construirRadarComercial } from '../src/modules/intelligence/radar-builder'
import { getProductoresList, getCompetidoresList, getProductorDetalle, getCompetidorDetalle } from '../src/modules/intelligence/services'
import { getPeriodos } from '../src/modules/intelligence/engine'
import * as fs from 'fs'
import * as path from 'path'

export async function exportStaticData() {
  const outputDir = path.join(process.cwd(), 'public', 'data')
  fs.mkdirSync(outputDir, { recursive: true })

  console.log('📦 Exportando datos a JSON estático...\n')

  // 1. Radar comercial
  console.log('  • Radar comercial...')
  const radar = await construirRadarComercial()
  fs.writeFileSync(path.join(outputDir, 'radar.json'), JSON.stringify(radar, null, 2))

  // 2. Productores
  console.log('  • Lista de productores...')
  const productores = await getProductoresList()
  fs.writeFileSync(path.join(outputDir, 'productores.json'), JSON.stringify({ productores }, null, 2))

  // 3. Detalle de cada productor
  console.log(`  • Detalle de ${productores.length} productores...`)
  const productoresDir = path.join(outputDir, 'productores')
  fs.mkdirSync(productoresDir, { recursive: true })
  for (const p of productores) {
    const detalle = await getProductorDetalle(p.id)
    fs.writeFileSync(
      path.join(productoresDir, `${p.id}.json`),
      JSON.stringify(detalle, null, 2)
    )
  }

  // 4. Competidores
  console.log('  • Lista de competidores...')
  const competidores = await getCompetidoresList()
  fs.writeFileSync(path.join(outputDir, 'competidores.json'), JSON.stringify({ competidores }, null, 2))

  // 5. Detalle de cada competidor
  console.log(`  • Detalle de ${competidores.length} competidores...`)
  const competidoresDir = path.join(outputDir, 'competidores')
  fs.mkdirSync(competidoresDir, { recursive: true })
  for (const c of competidores) {
    const detalle = await getCompetidorDetalle(c.id)
    fs.writeFileSync(
      path.join(competidoresDir, `${c.id}.json`),
      JSON.stringify(detalle, null, 2)
    )
  }

  // 6. Alertas
  console.log('  • Alertas...')
  const alertas = await db.alerta.findMany({
    include: { productor: true, competidor: true },
    orderBy: { createdAt: 'desc' },
  })
  fs.writeFileSync(path.join(outputDir, 'alertas.json'), JSON.stringify({ alertas }, null, 2))

  // 7. Dashboard
  console.log('  • Dashboard...')
  const periodos = await getPeriodos()
  const evolucion = await Promise.all(
    periodos.map(async (p) => {
      const caliral = await db.certificador.findFirst({ where: { esCaliral: true } })
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
  fs.writeFileSync(
    path.join(outputDir, 'dashboard.json'),
    JSON.stringify({ stats, evolucion }, null, 2)
  )

  // 8. Buscar (índice para búsqueda estática)
  console.log('  • Índice de búsqueda...')
  const todosProductores = await db.productor.findMany()
  const todosCompetidores = await db.competidor.findMany()
  const todosDestinos = await db.destino.findMany()
  const caliral = await db.certificador.findFirst({ where: { esCaliral: true } })
  fs.writeFileSync(
    path.join(outputDir, 'search-index.json'),
    JSON.stringify({
      productores: todosProductores.map((p) => ({ id: p.id, nombre: p.nombre, tipo: 'productor' })),
      competidores: todosCompetidores.map((c) => ({ id: c.id, nombre: c.nombre, tipo: 'competidor' })),
      certificadores: caliral ? [{ id: caliral.id, nombre: caliral.nombre, tipo: 'certificador' }] : [],
      destinos: todosDestinos.map((d) => ({ id: d.id, nombre: d.nombre, tipo: 'destino' })),
    }, null, 2)
  )

  console.log(`\n✅ Exportación completada en: public/data/`)
  console.log(`   Archivos generados:`)
  console.log(`   • radar.json`)
  console.log(`   • productores.json`)
  console.log(`   • productores/<id>.json (${productores.length} archivos)`)
  console.log(`   • competidores.json`)
  console.log(`   • competidores/<id>.json (${competidores.length} archivos)`)
  console.log(`   • alertas.json`)
  console.log(`   • dashboard.json`)
  console.log(`   • search-index.json`)
}

// Si se ejecuta directamente, correr la función
async function main() {
  await exportStaticData()
}

if (import.meta.main || require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Error:', e)
      process.exit(1)
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
