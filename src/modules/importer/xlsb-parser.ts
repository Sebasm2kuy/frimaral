import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { recalcularInteligenciaCompleta, getCaliral } from '@/modules/intelligence/engine'

// ============================================================
// IMPORTADOR XLSB
// Lee archivos XLSB exportados desde INAC
// ============================================================

export interface ImportProgress {
  stage: string
  progress: number
  message: string
  hojas?: string[]
  columnasDetectadas?: Record<string, string>
  totalRows?: number
  validRows?: number
  duplicateRows?: number
  errorRows?: number
  errores?: string[]
}

// Mapeo de variantes de nombres de columnas esperadas en archivos INAC
const COLUMN_ALIASES: Record<string, string[]> = {
  productor: ['productor', 'productores', 'frigorifico', 'frigorificos', 'razon social', 'razon_social', 'empresa', 'establecimiento', 'cliente', 'nombre productor'],
  cuit_productor: ['cuit', 'cuit productor', 'rut', 'tax id', 'identificacion'],
  certificador: ['certificador', 'deposito', 'deposito frigorifico', 'certificadora', 'entidad certificadora', 'depósito'],
  competidor: ['competidor', 'otro deposito', 'competencia', 'otro certificador'],
  fecha: ['fecha', 'fecha operacion', 'fecha_embarque', 'fecha exportacion', 'fecha certificacion', 'dia'],
  periodo: ['periodo', 'mes', 'mes año', 'periodo fiscal'],
  producto: ['producto', 'tipo producto', 'categoria', 'descripcion producto', 'descripcion'],
  cantidad: ['cantidad', 'unidades', 'cabezas', 'cajas', 'piezas', 'volumen'],
  peso: ['peso', 'peso kg', 'peso bruto', 'kg', 'kilos', 'toneladas', 'peso neto'],
  valor: ['valor', 'valor usd', 'fob', 'valor fob', 'monto', 'precio total'],
  destino: ['destino', 'pais destino', 'pais', 'mercado', 'exportacion a'],
  contenedor: ['contenedor', 'container', 'numero contenedor', 'id contenedor'],
}

export interface ParsedRow {
  [key: string]: string | number | null
}

export interface ParsedSheet {
  hoja: string
  columnas: string[]
  filas: ParsedRow[]
}

// ============================================================
// LECTURA Y PARSEO DEL ARCHIVO
// ============================================================

export async function parseXLSB(buffer: ArrayBuffer): Promise<{
  hojas: ParsedSheet[]
  hojasNombres: string[]
}> {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const hojas: ParsedSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })

    if (json.length === 0) continue

    const columnas = Object.keys(json[0])
    const filas: ParsedRow[] = json.map((row) => {
      const parsed: ParsedRow = {}
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

  return { hojas, hojasNombres: workbook.SheetNames }
}

// ============================================================
// DETECCIÓN AUTOMÁTICA DE COLUMNAS
// ============================================================

export function detectarColumnas(hojas: ParsedSheet[]): Record<string, string> {
  const mapeo: Record<string, string> = {}

  // Tomar la primera hoja con datos
  const hojaPrincipal = hojas[0]
  if (!hojaPrincipal) return mapeo

  for (const [campo, alias] of Object.entries(COLUMN_ALIASES)) {
    for (const col of hojaPrincipal.columnas) {
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

// ============================================================
// VALIDACIÓN DE ESTRUCTURA
// ============================================================

export function validarEstructura(mapeo: Record<string, string>): { valida: boolean; errores: string[] } {
  const errores: string[] = []
  const obligatorias = ['productor', 'certificador', 'fecha', 'cantidad']

  for (const campo of obligatorias) {
    if (!mapeo[campo]) {
      errores.push(`Falta columna obligatoria: ${campo}. Columnas esperadas: ${COLUMN_ALIASES[campo].join(', ')}`)
    }
  }

  return { valida: errores.length === 0, errores }
}

// ============================================================
// NORMALIZACIÓN DE NOMBRES
// ============================================================

export function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return ''
  return String(nombre)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ\.\-]/g, '')
    .toUpperCase()
}

export function normalizarPeriodo(fecha: Date | string): string {
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// ============================================================
// ELIMINAR DUPLICADOS
// ============================================================

export function generarHashFila(fila: ParsedRow, mapeo: Record<string, string>): string {
  const partes = [
    normalizarNombre(fila[mapeo.productor] as string),
    normalizarNombre(fila[mapeo.certificador] as string),
    String(fila[mapeo.fecha] || ''),
    String(fila[mapeo.cantidad] || ''),
    String(fila[mapeo.peso] || ''),
    String(fila[mapeo.contenedor] || ''),
  ]
  return partes.join('|')
}

// ============================================================
// PROCESAMIENTO PRINCIPAL
// ============================================================

export interface ImportResult {
  importacionId: string
  totalRows: number
  validRows: number
  duplicateRows: number
  errorRows: number
  hojasDetectadas: string[]
  columnasDetectadas: Record<string, string>
  errores: string[]
  productoresProcesados: number
  competidoresProcesados: number
  alertasGeneradas: number
}

export async function procesarImportacion(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  usuarioId: string,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  onProgress?.({ stage: 'parsing', progress: 5, message: 'Leyendo archivo XLSB...' })

  // 1. Crear registro de importación
  const importacion = await db.importacion.create({
    data: {
      fileName,
      fileSize,
      periodo: new Date().toISOString().slice(0, 7),
      uploadedById: usuarioId,
      status: 'PROCESANDO',
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
      errorRows: 0,
    },
  })

  try {
    // 2. Parsear archivo
    onProgress?.({ stage: 'parsing', progress: 15, message: 'Parseando hojas del archivo...' })
    const { hojas, hojasNombres } = await parseXLSB(buffer)

    if (hojas.length === 0) {
      throw new Error('El archivo no contiene hojas con datos válidos.')
    }

    // 3. Detectar columnas
    onProgress?.({ stage: 'detecting', progress: 25, message: 'Detectando estructura de columnas...' })
    const columnasDetectadas = detectarColumnas(hojas)
    const { valida, errores } = validarEstructura(columnasDetectadas)

    await db.importacion.update({
      where: { id: importacion.id },
      data: {
        hojasDetectadas: JSON.stringify(hojasNombres),
        columnasDetectadas: JSON.stringify(columnasDetectadas),
        errores: errores.length > 0 ? JSON.stringify(errores) : null,
      },
    })

    if (!valida) {
      await db.importacion.update({
        where: { id: importacion.id },
        data: { status: 'ERROR', errorRows: 0, completedAt: new Date() },
      })
      throw new Error(`Estructura inválida: ${errores.join('; ')}`)
    }

    // 4. Obtener Caliral
    const caliral = await getCaliral()
    if (!caliral) {
      throw new Error('No se encontró el certificador Caliral configurado.')
    }

    // 5. Procesar filas
    onProgress?.({ stage: 'processing', progress: 35, message: 'Procesando filas y normalizando datos...' })

    let totalRows = 0
    let validRows = 0
    let duplicateRows = 0
    let errorRows = 0
    const erroresDetalle: string[] = []
    const hashes = new Set<string>()

    // Caches para evitar consultas repetidas
    const productorCache = new Map<string, string>()
    const competidorCache = new Map<string, string>()
    const destinoCache = new Map<string, string>()
    const contenedorCache = new Map<string, string>()

    // Filas a insertar (batch)
    const operacionesAInsertar: any[] = []

    for (const hoja of hojas) {
      const totalFilasHoja = hoja.filas.length
      for (let i = 0; i < hoja.filas.length; i++) {
        const fila = hoja.filas[i]
        totalRows++

        if (i % 100 === 0) {
          const hojaProgress = (hojas.indexOf(hoja) / hojas.length) * 50
          const filaProgress = (i / totalFilasHoja) * (50 / hojas.length)
          onProgress?.({
            stage: 'processing',
            progress: 35 + hojaProgress + filaProgress,
            message: `Procesando hoja "${hoja.hoja}": fila ${i + 1} de ${totalFilasHoja}`,
          })
        }

        try {
          // Validar campos obligatorios
          const nombreProductor = normalizarNombre(fila[columnasDetectadas.productor] as string)
          const nombreDeposito = normalizarNombre(fila[columnasDetectadas.certificador] as string)
          const fechaRaw = fila[columnasDetectadas.fecha]

          if (!nombreProductor || !nombreDeposito || !fechaRaw) {
            errorRows++
            if (erroresDetalle.length < 20) {
              erroresDetalle.push(`Fila ${totalRows}: faltan campos obligatorios`)
            }
            continue
          }

          // Parsear fecha
          let fecha: Date
          if (typeof fechaRaw === 'number') {
            // Excel date serial
            fecha = XLSX.SSF.parse_date_code(fechaRaw as number)
              ? new Date(Date.UTC(fechaRaw as number > 25569 ? ((fechaRaw as number) - 25569) * 86400 * 1000 : 0))
              : new Date(fechaRaw as number)
          } else {
            fecha = new Date(fechaRaw as string)
          }

          if (isNaN(fecha.getTime())) {
            errorRows++
            if (erroresDetalle.length < 20) {
              erroresDetalle.push(`Fila ${totalRows}: fecha inválida "${fechaRaw}"`)
            }
            continue
          }

          const periodo = normalizarPeriodo(fecha)

          // Normalizar cantidades
          const cantidad = parseFloat(String(fila[columnasDetectadas.cantidad] || '0').replace(/[^\d.-]/g, '')) || 0
          const pesoKg = columnasDetectadas.peso
            ? parseFloat(String(fila[columnasDetectadas.peso] || '0').replace(/[^\d.-]/g, '')) || 0
            : 0
          const valorUsd = columnasDetectadas.valor
            ? parseFloat(String(fila[columnasDetectadas.valor] || '0').replace(/[^\d.-]/g, '')) || 0
            : 0

          // Eliminar duplicados
          const hash = generarHashFila(fila, columnasDetectadas)
          if (hashes.has(hash)) {
            duplicateRows++
            continue
          }
          hashes.add(hash)

          // Resolver productor
          let productorId = productorCache.get(nombreProductor)
          if (!productorId) {
            let productor = await db.productor.findFirst({
              where: { nombre: nombreProductor },
            })
            if (!productor) {
              productor = await db.productor.create({
                data: { nombre: nombreProductor },
              })
            }
            productorId = productor.id
            productorCache.set(nombreProductor, productorId)
          }

          // Resolver depósito (Caliral o Competidor)
          let certificadorId: string | null = null
          let competidorId: string | null = null

          const nombreDepositoUpper = nombreDeposito.toUpperCase()
          if (nombreDepositoUpper.includes('CALIRAL')) {
            certificadorId = caliral.id
          } else {
            // Es competidor
            let competidor = await db.competidor.findFirst({
              where: { nombre: nombreDeposito },
            })
            if (!competidor) {
              competidor = await db.competidor.create({
                data: { nombre: nombreDeposito },
              })
            }
            competidorId = competidor.id
            competidorCache.set(nombreDeposito, competidorId)
          }

          // Resolver destino
          let destinoId: string | null = null
          if (columnasDetectadas.destino) {
            const nombreDestino = normalizarNombre(fila[columnasDetectadas.destino] as string)
            if (nombreDestino) {
              destinoId = destinoCache.get(nombreDestino)
              if (!destinoId) {
                let destino = await db.destino.findFirst({
                  where: { nombre: nombreDestino },
                })
                if (!destino) {
                  destino = await db.destino.create({
                    data: { nombre: nombreDestino, pais: nombreDestino },
                  })
                }
                destinoId = destino.id
                destinoCache.set(nombreDestino, destinoId)
              }
            }
          }

          // Resolver contenedor
          let contenedorId: string | null = null
          if (columnasDetectadas.contenedor) {
            const codigoCont = String(fila[columnasDetectadas.contenedor] || '').trim().toUpperCase()
            if (codigoCont) {
              contenedorId = contenedorCache.get(codigoCont)
              if (!contenedorId) {
                let contenedor = await db.contenedor.findFirst({
                  where: { codigo: codigoCont },
                })
                if (!contenedor) {
                  contenedor = await db.contenedor.create({
                    data: { codigo: codigoCont },
                  })
                }
                contenedorId = contenedor.id
                contenedorCache.set(codigoCont, contenedorId)
              }
            }
          }

          // Producto
          const producto = columnasDetectadas.producto
            ? normalizarNombre(fila[columnasDetectadas.producto] as string) || null
            : null

          operacionesAInsertar.push({
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

          validRows++
        } catch (err: any) {
          errorRows++
          if (erroresDetalle.length < 20) {
            erroresDetalle.push(`Fila ${totalRows}: ${err.message}`)
          }
        }
      }
    }

    // 6. Insertar operaciones en batch
    onProgress?.({ stage: 'inserting', progress: 80, message: `Insertando ${operacionesAInsertar.length} operaciones en base histórica...` })

    // Insertar en lotes de 1000
    for (let i = 0; i < operacionesAInsertar.length; i += 1000) {
      const lote = operacionesAInsertar.slice(i, i + 1000)
      await db.operacion.createMany({ data: lote })
    }

    // 7. Recalcular inteligencia
    onProgress?.({ stage: 'intelligence', progress: 90, message: 'Recalculando motor de inteligencia comercial...' })
    const { alertas } = await recalcularInteligenciaCompleta()

    // 8. Actualizar importación
    const status = errorRows > 0 && validRows > 0 ? 'PARCIAL' : validRows > 0 ? 'COMPLETADO' : 'ERROR'

    await db.importacion.update({
      where: { id: importacion.id },
      data: {
        status,
        totalRows,
        validRows,
        duplicateRows,
        errorRows,
        errores: erroresDetalle.length > 0 ? JSON.stringify(erroresDetalle) : null,
        completedAt: new Date(),
      },
    })

    onProgress?.({
      stage: 'done',
      progress: 100,
      message: `Importación completada: ${validRows} operaciones válidas, ${duplicateRows} duplicadas, ${errorRows} errores`,
      totalRows,
      validRows,
      duplicateRows,
      errorRows,
      hojas: hojasNombres,
      columnasDetectadas,
      errores: erroresDetalle,
    })

    return {
      importacionId: importacion.id,
      totalRows,
      validRows,
      duplicateRows,
      errorRows,
      hojasDetectadas: hojasNombres,
      columnasDetectadas,
      errores: erroresDetalle,
      productoresProcesados: productorCache.size,
      competidoresProcesados: competidorCache.size,
      alertasGeneradas: alertas,
    }
  } catch (error: any) {
    await db.importacion.update({
      where: { id: importacion.id },
      data: {
        status: 'ERROR',
        errores: JSON.stringify([error.message]),
        completedAt: new Date(),
      },
    })
    throw error
  }
}
