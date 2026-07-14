/**
 * Parser XLSB client-side usando SheetJS.
 * Funciona en el browser sin necesidad de servidor.
 */

import * as XLSX from 'xlsx'

export interface ParsedRow {
  [key: string]: string | number | null
}

export interface ParsedSheet {
  hoja: string
  columnas: string[]
  filas: ParsedRow[]
}

export interface ParsedFile {
  hojas: ParsedSheet[]
  hojasNombres: string[]
}

// Mapeo de variantes de nombres de columnas (igual que el servidor)
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

export async function parseXLSBFile(file: File): Promise<ParsedFile> {
  // Leer archivo como ArrayBuffer (una sola vez)
  const buffer = await file.arrayBuffer()

  // Ceder el control al browser para que React pueda renderizar el progreso
  // antes de que XLSX.read bloquee el hilo principal (es síncrono)
  await new Promise((resolve) => setTimeout(resolve, 100))

  // XLSX.read con type:'array' espera un Uint8Array, NO un ArrayBuffer
  const data = new Uint8Array(buffer)

  console.log(`📊 Parseando archivo: ${file.name} (${file.size} bytes, ${data.length} Uint8Array length)`)

  // Parsing con timeout (45 segundos)
  const workbook = await new Promise<XLSX.WorkBook>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout: el archivo tardó más de 45 segundos en parsear. Tamaño: ${(file.size / 1024 / 1024).toFixed(2)} MB. Si es muy grande, intenta con un archivo más pequeño.`))
    }, 45000)

    // Usar setTimeout(0) para ceder el control antes del parsing síncrono pesado
    setTimeout(() => {
      try {
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          // Optimización: no leer fórmulas ni estilos
          cellFormula: false,
          cellHTML: false,
          cellStyles: false,
          sheetStubs: false,
        })
        clearTimeout(timeout)
        console.log(`✅ Workbook parseado: ${wb.SheetNames.length} hojas: ${wb.SheetNames.join(', ')}`)
        resolve(wb)
      } catch (err: any) {
        clearTimeout(timeout)
        console.error('❌ Error XLSX.read:', err)
        reject(new Error(`Error al parsear archivo: ${err.message || err}. ¿Es un archivo XLSB/XLSX válido?`))
      }
    }, 0)
  })

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

export function detectarColumnas(hojas: ParsedSheet[]): Record<string, string> {
  const mapeo: Record<string, string> = {}
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

export function validarEstructura(mapeo: Record<string, string>): { valida: boolean; errores: string[] } {
  const errores: string[] = []
  const obligatorias = ['productor', 'certificador', 'fecha', 'cantidad']

  for (const campo of obligatorias) {
    if (!mapeo[campo]) {
      errores.push(`Falta columna obligatoria: ${campo}`)
    }
  }

  return { valida: errores.length === 0, errores }
}

export function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return ''
  return String(nombre)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.\-]/g, '')
    .toUpperCase()
}

export function normalizarPeriodo(fecha: Date | string): string {
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Parsea una fecha desde varios formatos.
 */
function parseFecha(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === '') return null

  if (typeof raw === 'number') {
    // Excel date serial
    const date = XLSX.SSF.parse_date_code(raw)
    if (date) {
      return new Date(date.y, date.m - 1, date.d)
    }
    return null
  }

  const str = String(raw).trim()
  // Intentar DD/MM/YYYY o YYYY-MM-DD
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d

  // DD/MM/YYYY
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

export interface OperacionRaw {
  productor: string
  deposito: string
  fecha: string
  periodo: string
  producto: string | null
  cantidad: number
  pesoKg: number
  valorUsd: number
  destino: string | null
  contenedor: string | null
}

/**
 * Convierte las filas parseadas en operaciones normalizadas.
 */
export function procesarFilas(
  hojas: ParsedSheet[],
  columnas: Record<string, string>
): { operaciones: OperacionRaw[]; errores: string[]; duplicados: number } {
  const operaciones: OperacionRaw[] = []
  const errores: string[] = []
  const hashes = new Set<string>()
  let duplicados = 0

  let filaNum = 0
  for (const hoja of hojas) {
    for (const fila of hoja.filas) {
      filaNum++

      const productor = normalizarNombre(fila[columnas.productor] as string)
      const deposito = normalizarNombre(fila[columnas.certificador] as string)
      const fechaRaw = fila[columnas.fecha]

      if (!productor || !deposito || !fechaRaw) {
        if (errores.length < 20) {
          errores.push(`Fila ${filaNum}: faltan campos obligatorios`)
        }
        continue
      }

      const fecha = parseFecha(fechaRaw)
      if (!fecha) {
        if (errores.length < 20) {
          errores.push(`Fila ${filaNum}: fecha inválida "${fechaRaw}"`)
        }
        continue
      }

      const periodo = normalizarPeriodo(fecha)
      const cantidad = parseNumber(fila[columnas.cantidad])
      const pesoKg = columnas.peso ? parseNumber(fila[columnas.peso]) : 0
      const valorUsd = columnas.valor ? parseNumber(fila[columnas.valor]) : 0
      const producto = columnas.producto ? normalizarNombre(fila[columnas.producto] as string) : null
      const destino = columnas.destino ? normalizarNombre(fila[columnas.destino] as string) : null
      const contenedor = columnas.contenedor
        ? String(fila[columnas.contenedor] || '').trim().toUpperCase()
        : null

      // Hash para duplicados
      const hash = `${productor}|${deposito}|${fecha.toISOString()}|${cantidad}|${pesoKg}|${contenedor || ''}`
      if (hashes.has(hash)) {
        duplicados++
        continue
      }
      hashes.add(hash)

      operaciones.push({
        productor,
        deposito,
        fecha: fecha.toISOString(),
        periodo,
        producto,
        cantidad,
        pesoKg,
        valorUsd,
        destino,
        contenedor,
      })
    }
  }

  return { operaciones, errores, duplicados }
}
