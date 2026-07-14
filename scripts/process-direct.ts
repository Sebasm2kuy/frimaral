/**
 * Script directo para procesar el XLSB real de INAC.
 * Lee el archivo, lo procesa con el parser server-side, y genera los JSON.
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { db } from '../src/lib/db'
import { recalcularInteligenciaCompleta } from '../src/modules/intelligence/engine'
import { construirRadarComercial } from '../src/modules/intelligence/radar-builder'
import { getProductoresList, getCompetidoresList, getProductorDetalle, getCompetidorDetalle } from '../src/modules/intelligence/services'
import { getPeriodos, getCaliral } from '../src/modules/intelligence/engine'

// Mapeo de columnas (igual que el importer)
const COLUMN_ALIASES: Record<string, string[]> = {
  productor: ['productor', 'productores', 'frigorifico', 'frigorificos', 'razon social', 'razon_social', 'empresa', 'establecimiento', 'cliente', 'nombre productor', 'firm', 'exportador', 'remitente'],
  cuit_productor: ['cuit', 'cuit productor', 'rut', 'tax id', 'identificacion'],
  certificador: ['certificador', 'deposito', 'deposito frigorifico', 'certificadora', 'entidad certificadora', 'depósito', 'consignatario', 'certificadora'],
  competidor: ['competidor', 'otro deposito', 'competencia', 'otro certificador'],
  fecha: ['fecha', 'fecha operacion', 'fecha_embarque', 'fecha exportacion', 'fecha certificacion', 'dia', 'fecha embarque', 'fecha de embarque', 'fecha despacho'],
  periodo: ['periodo', 'mes', 'mes año', 'periodo fiscal'],
  producto: ['producto', 'tipo producto', 'categoria', 'descripcion producto', 'descripcion', 'tipo producto'],
  cantidad: ['cantidad', 'unidades', 'cabezas', 'cajas', 'piezas', 'volumen', 'peso piezas', 'kg', 'kilos', 'peso neto', 'peso', 'peso bruto'],
  peso: ['peso', 'peso kg', 'peso bruto', 'kg', 'kilos', 'toneladas', 'peso neto', 'peso total'],
  valor: ['valor', 'valor usd', 'fob', 'valor fob', 'monto', 'precio total', 'fob usd'],
  destino: ['destino', 'pais destino', 'pais', 'mercado', 'exportacion a', 'pais de destino'],
  contenedor: ['contenedor', 'container', 'numero contenedor', 'id contenedor', 'número contenedor'],
}

function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return ''
  return String(nombre)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.\-]/g, '')
    .toUpperCase()
}

function normalizarPeriodo(fecha: Date | string): string {
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function detectarColumnas(columnas: string[]): Record<string, string> {
  const mapeo: Record<string, string> = {}
  for (const [campo, alias] of Object.entries(COLUMN_ALIASES)) {
    for (const col of columnas) {
      const colNormalized = col.toLowerCase().trim()
      if (alias.some((a) => colNormalized === a || colNormalized.includes(a))) {
        if (!mapeo[campo]) {
          mapeo[campo] = col
        }
        break
      }
    }
  }
  return mapeo
}

function parseFecha(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw)
    if (date) return new Date(date.y, date.m - 1, date.d)
    return null
  }
  const str = String(raw).trim()
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, dd, mm, yyyy] = match
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  }
  return null
}

function parseNumber(raw: any): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return raw
  const str = String(raw).replace(/[^\d.-]/g, '')
  return parseFloat(str) || 0
}

async function main() {
  const xlsbPath = process.argv[2]
  if (!xlsbPath) {
    console.error('❌ Uso: bun run scripts/process-direct.ts <path-al-archivo.xlsb>')
    process.exit(1)
  }

  console.log(`📁 Procesando: ${xlsbPath}`)
  console.log(`📏 Tamaño: ${(fs.statSync(xlsbPath).size / 1024 / 1024).toFixed(2)} MB`)

  // 1. Leer archivo
  console.log('📖 Leyendo archivo...')
  const buffer = fs.readFileSync(xlsbPath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  // 2. Parsear XLSB
  console.log('📊 Parseando XLSB (puede tardar 30-60s)...')
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetStubs: false,
  })

  console.log(`✅ Workbook parseado: ${workbook.SheetNames.length} hojas`)
  console.log(`   Hojas: ${workbook.SheetNames.join(', ')}`)

  // 3. Procesar cada hoja
  const hojas: Array<{ hoja: string; columnas: string[]; filas: any[] }> = []
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n📋 Procesando hoja: ${sheetName}`)
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })

    console.log(`   ${json.length} filas encontradas`)

    if (json.length === 0) continue

    const columnas = Object.keys(json[0])
    console.log(`   Columnas: ${columnas.join(', ')}`)

    const filas = json.map((row: any) => {
      const parsed: any = {}
      for (const key of columnas) {
        const val = row[key]
        if (val === null || val === undefined || val === '') {
          parsed[key] = null
        } else if (typeof val === 'number') {
          parsed[key] = val
        } else {
          parsed[key] = String(val).trim()
        }
      }
      return parsed
    })

    hojas.push({ hoja: sheetName, columnas, filas })
  }

  // 4. Detectar columnas en la primera hoja con datos
  const hojaPrincipal = hojas[0]
  if (!hojaPrincipal) {
    console.error('❌ No se encontraron hojas con datos')
    process.exit(1)
  }

  console.log('\n🔍 Detectando columnas...')
  const columnasMapeo = detectarColumnas(hojaPrincipal.columnas)
  console.log('   Mapeo detectado:', columnasMapeo)

  // 5. Limpiar DB
  console.log('\n🧹 Limpiando DB previa...')
  await db.alerta.deleteMany({})
  await db.historico.deleteMany({})
  await db.operacion.deleteMany({})
  await db.contenedor.deleteMany({})
  await db.destino.deleteMany({})
  await db.competidor.deleteMany({})
  await db.certificador.deleteMany({})
  await db.productor.deleteMany({})
  await db.importacion.deleteMany({})

  // 6. Crear Caliral
  console.log('🏢 Creando Caliral...')
  const caliral = await db.certificador.create({
    data: { nombre: 'CALIRAL', esCaliral: true, activo: true },
  })

  // Crear usuario del sistema
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

  // 7. Crear importación
  console.log('📥 Creando registro de importación...')
  const importacion = await db.importacion.create({
    data: {
      fileName: path.basename(xlsbPath),
      fileSize: buffer.length,
      periodo: new Date().toISOString().slice(0, 7),
      uploadedById: systemUser.id,
      status: 'COMPLETADO',
      totalRows: hojas.reduce((acc, h) => acc + h.filas.length, 0),
      validRows: 0,
      duplicateRows: 0,
      errorRows: 0,
      hojasDetectadas: JSON.stringify(hojas.map(h => h.hoja)),
      columnasDetectadas: JSON.stringify(columnasMapeo),
      completedAt: new Date(),
    },
  })

  // 8. Procesar filas y crear operaciones
  console.log('\n⚙️  Procesando operaciones...')
  const productorCache = new Map<string, string>()
  const competidorCache = new Map<string, string>()
  const destinoCache = new Map<string, string>()
  const contenedorCache = new Map<string, string>()
  const hashes = new Set<string>()

  let totalOps = 0
  let validOps = 0
  let duplicateOps = 0
  let errorOps = 0
  const operacionesBatch: any[] = []

  for (const hoja of hojas) {
    console.log(`\n   Hoja "${hoja.hoja}": ${hoja.filas.length} filas`)
    for (let i = 0; i < hoja.filas.length; i++) {
      const fila = hoja.filas[i]
      totalOps++

      if (i % 5000 === 0 && i > 0) {
        console.log(`     Procesadas ${i}/${hoja.filas.length} filas...`)
      }

      try {
        // Buscar columnas (puede variar por hoja)
        const colMap = hoja.hoja === hojaPrincipal.hoja
          ? columnasMapeo
          : detectarColumnas(hoja.columnas)

        const nombreProductor = normalizarNombre(fila[colMap.productor] as string)
        const nombreDeposito = normalizarNombre(fila[colMap.certificador] as string)
        const fechaRaw = fila[colMap.fecha]

        if (!nombreProductor || !nombreDeposito || !fechaRaw) {
          errorOps++
          continue
        }

        const fecha = parseFecha(fechaRaw)
        if (!fecha) {
          errorOps++
          continue
        }

        const periodo = normalizarPeriodo(fecha)

        // Buscar columna de cantidad/peso - puede ser cualquiera
        const cantidad = colMap.cantidad ? parseNumber(fila[colMap.cantidad]) : 0
        const pesoKg = colMap.peso ? parseNumber(fila[colMap.peso]) : (colMap.cantidad ? parseNumber(fila[colMap.cantidad]) : 0)
        const valorUsd = colMap.valor ? parseNumber(fila[colMap.valor]) : 0
        const producto = colMap.producto ? normalizarNombre(fila[colMap.producto] as string) : null
        const destino = colMap.destino ? normalizarNombre(fila[colMap.destino] as string) : null
        const contenedor = colMap.contenedor ? String(fila[colMap.contenedor] || '').trim().toUpperCase() : null

        // Hash para duplicados
        const hash = `${nombreProductor}|${nombreDeposito}|${fecha.toISOString()}|${cantidad}|${pesoKg}|${contenedor || ''}`
        if (hashes.has(hash)) {
          duplicateOps++
          continue
        }
        hashes.add(hash)

        // Resolver productor
        let productorId = productorCache.get(nombreProductor)
        if (!productorId) {
          let productor = await db.productor.findFirst({ where: { nombre: nombreProductor } })
          if (!productor) {
            productor = await db.productor.create({ data: { nombre: nombreProductor } })
          }
          productorId = productor.id
          productorCache.set(nombreProductor, productorId)
        }

        // Resolver depósito
        let certificadorId: string | null = null
        let competidorId: string | null = null
        if (nombreDeposito.includes('CALIRAL')) {
          certificadorId = caliral.id
        } else {
          let competidor = await db.competidor.findFirst({ where: { nombre: nombreDeposito } })
          if (!competidor) {
            competidor = await db.competidor.create({ data: { nombre: nombreDeposito } })
          }
          competidorId = competidor.id
          competidorCache.set(nombreDeposito, competidorId)
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

        // Insertar en lotes de 1000
        if (operacionesBatch.length >= 1000) {
          await db.operacion.createMany({ data: operacionesBatch.splice(0, 1000) })
        }
      } catch (err) {
        errorOps++
      }
    }
  }

  // Insertar operaciones restantes
  if (operacionesBatch.length > 0) {
    await db.operacion.createMany({ data: operacionesBatch })
  }

  console.log(`\n✅ Operaciones procesadas:`)
  console.log(`   Total filas: ${totalOps}`)
  console.log(`   Válidas: ${validOps}`)
  console.log(`   Duplicadas: ${duplicateOps}`)
  console.log(`   Errores: ${errorOps}`)
  console.log(`   Productores únicos: ${productorCache.size}`)
  console.log(`   Competidores únicos: ${competidorCache.size}`)

  // Actualizar importación
  await db.importacion.update({
    where: { id: importacion.id },
    data: {
      validRows: validOps,
      duplicateRows: duplicateOps,
      errorRows: errorOps,
    },
  })

  // 9. Recalcular inteligencia
  console.log('\n🧠 Recalculando inteligencia comercial...')
  const { alertas } = await recalcularInteligenciaCompleta()
  console.log(`   ✅ ${alertas} alertas generadas`)

  // 10. Exportar JSON estáticos
  console.log('\n📦 Exportando datos a JSON estático...')
  await exportStaticData()

  // 11. Eliminar archivo raw
  if (fs.existsSync(xlsbPath)) {
    fs.unlinkSync(xlsbPath)
    console.log(`\n🗑️  Archivo raw eliminado: ${xlsbPath}`)
  }

  console.log('\n✅ ¡Procesamiento completado!')
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
  // Limpiar directorio
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
