/**
 * Script que procesa un archivo XLSB subido a data/raw/ y genera
 * todos los JSON estáticos para la app.
 *
 * Uso: bun run scripts/process-uploaded-xlsb.ts <path-al-archivo.xlsb>
 *
 * Este script se ejecuta en GitHub Actions cuando se sube un nuevo archivo.
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { db } from '../src/lib/db'
import { recalcularInteligenciaCompleta } from '../src/modules/intelligence/engine'

// Reutilizar la lógica del importador
import {
  parseXLSBFile,
  detectarColumnas,
  validarEstructura,
  procesarFilas,
} from '../src/lib/xlsb-client-parser'
import { exportStaticData } from './export-static-data-with-db'

async function main() {
  const xlsbPath = process.argv[2]
  if (!xlsbPath) {
    console.error('❌ Uso: bun run scripts/process-uploaded-xlsb.ts <path-al-archivo.xlsb>')
    process.exit(1)
  }

  console.log(`📁 Procesando archivo: ${xlsbPath}`)

  if (!fs.existsSync(xlsbPath)) {
    console.error(`❌ Archivo no encontrado: ${xlsbPath}`)
    process.exit(1)
  }

  // 1. Parsear el XLSB
  console.log('📖 Parseando XLSB...')
  const fileBuffer = fs.readFileSync(xlsbPath)
  const file = new File([fileBuffer], path.basename(xlsbPath))
  const parsed = await parseXLSBFile(file)

  console.log(`  ✓ ${parsed.hojas.length} hoja(s) detectada(s): ${parsed.hojasNombres.join(', ')}`)

  // 2. Detectar columnas
  console.log('🔍 Detectando columnas...')
  const columnas = detectarColumnas(parsed.hojas)
  console.log(`  ✓ Columnas detectadas:`, columnas)

  // 3. Validar estructura
  const { valida, errores } = validarEstructura(columnas)
  if (!valida) {
    console.error('❌ Estructura inválida:', errores)
    process.exit(1)
  }

  // 4. Procesar filas
  console.log('⚙️  Procesando filas...')
  const { operaciones, errores: errFilas, duplicados } = procesarFilas(parsed.hojas, columnas)
  console.log(`  ✓ ${operaciones.length} operaciones válidas`)
  console.log(`  ✓ ${duplicados} duplicados eliminados`)
  if (errFilas.length > 0) {
    console.log(`  ⚠️  ${errFilas.length} errores:`)
    errFilas.slice(0, 5).forEach((e) => console.log(`     - ${e}`))
  }

  // 5. Limpiar DB previa (el histórico se reconstruye desde cero)
  console.log('🧹 Limpiando base de datos previa...')
  await db.alerta.deleteMany({})
  await db.historico.deleteMany({})
  await db.operacion.deleteMany({})
  await db.contenedor.deleteMany({})
  await db.destino.deleteMany({})
  await db.competidor.deleteMany({})
  await db.certificador.deleteMany({})
  await db.productor.deleteMany({})
  await db.importacion.deleteMany({})

  // 6. Crear Caliral como certificador
  console.log('🏢 Creando Caliral...')
  const caliral = await db.certificador.create({
    data: { nombre: 'CALIRAL', esCaliral: true, activo: true },
  })

  // Crear usuario del sistema para la importación
  const systemUser = await db.usuario.upsert({
    where: { email: 'system@caliral.com' },
    update: {},
    create: {
      email: 'system@caliral.com',
      nombre: 'Sistema (GitHub Actions)',
      passwordHash: 'system-no-login',
      rol: 'ADMINISTRADOR',
    },
  })

  // 7. Insertar operaciones
  console.log('💾 Insertando operaciones en DB...')

  // Caches
  const productorCache = new Map<string, string>()
  const competidorCache = new Map<string, string>()
  const destinoCache = new Map<string, string>()
  const contenedorCache = new Map<string, string>()

  // Crear importación
  const imp = await db.importacion.create({
    data: {
      fileName: path.basename(xlsbPath),
      fileSize: fileBuffer.length,
      periodo: new Date().toISOString().slice(0, 7),
      uploadedById: systemUser.id,
      status: 'COMPLETADO',
      totalRows: operaciones.length,
      validRows: operaciones.length,
      duplicateRows: duplicados,
      errorRows: errFilas.length,
      hojasDetectadas: JSON.stringify(parsed.hojasNombres),
      columnasDetectadas: JSON.stringify(columnas),
      completedAt: new Date(),
    },
  })

  // Insertar operaciones en lotes
  const operacionesBatch: any[] = []
  for (const op of operaciones) {
    // Resolver productor
    let productorId = productorCache.get(op.productor)
    if (!productorId) {
      let productor = await db.productor.findFirst({ where: { nombre: op.productor } })
      if (!productor) {
        productor = await db.productor.create({ data: { nombre: op.productor } })
      }
      productorId = productor.id
      productorCache.set(op.productor, productorId)
    }

    // Resolver depósito (Caliral o competidor)
    let certificadorId: string | null = null
    let competidorId: string | null = null
    if (op.deposito.includes('CALIRAL')) {
      certificadorId = caliral.id
    } else {
      let competidor = await db.competidor.findFirst({ where: { nombre: op.deposito } })
      if (!competidor) {
        competidor = await db.competidor.create({ data: { nombre: op.deposito } })
      }
      competidorId = competidor.id
      competidorCache.set(op.deposito, competidorId)
    }

    // Resolver destino
    let destinoId: string | null = null
    if (op.destino) {
      destinoId = destinoCache.get(op.destino)
      if (!destinoId) {
        let destino = await db.destino.findFirst({ where: { nombre: op.destino } })
        if (!destino) {
          destino = await db.destino.create({ data: { nombre: op.destino, pais: op.destino } })
        }
        destinoId = destino.id
        destinoCache.set(op.destino, destinoId)
      }
    }

    // Resolver contenedor
    let contenedorId: string | null = null
    if (op.contenedor) {
      contenedorId = contenedorCache.get(op.contenedor)
      if (!contenedorId) {
        let contenedor = await db.contenedor.findFirst({ where: { codigo: op.contenedor } })
        if (!contenedor) {
          contenedor = await db.contenedor.create({ data: { codigo: op.contenedor } })
        }
        contenedorId = contenedor.id
        contenedorCache.set(op.contenedor, contenedorId)
      }
    }

    operacionesBatch.push({
      productorId,
      certificadorId,
      competidorId,
      destinoId,
      contenedorId,
      importacionId: imp.id,
      fecha: new Date(op.fecha),
      periodo: op.periodo,
      producto: op.producto,
      cantidad: op.cantidad,
      pesoKg: op.pesoKg,
      valorUsd: op.valorUsd,
    })
  }

  // Insertar en lotes de 500
  for (let i = 0; i < operacionesBatch.length; i += 500) {
    const lote = operacionesBatch.slice(i, i + 500)
    await db.operacion.createMany({ data: lote })
    process.stdout.write(`\r  Insertadas ${Math.min(i + 500, operacionesBatch.length)}/${operacionesBatch.length} operaciones`)
  }
  console.log('')

  // 8. Recalcular inteligencia
  console.log('🧠 Recalculando inteligencia comercial...')
  const { alertas } = await recalcularInteligenciaCompleta()
  console.log(`  ✓ ${alertas} alertas generadas`)

  // 9. Exportar datos estáticos
  console.log('📦 Exportando datos a JSON estático...')
  await exportStaticData()

  // 10. Limpiar archivo raw procesado
  if (fs.existsSync(xlsbPath)) {
    fs.unlinkSync(xlsbPath)
    console.log(`  ✓ Archivo raw eliminado: ${xlsbPath}`)
  }

  console.log('\n✅ Procesamiento completado!')
  console.log(`   • ${operaciones.length} operaciones`)
  console.log(`   • ${productorCache.size} productores`)
  console.log(`   • ${competidorCache.size} competidores`)
  console.log(`   • ${alertas} alertas`)
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
