/**
 * Web Worker para parsear XLSB sin bloquear el hilo principal.
 *
 * Next.js con output:export no soporta `new Worker(new URL(...))` con rutas relativas
 * en GitHub Pages. Por eso usamos un Blob URL con el código del worker inline.
 *
 * El worker:
 * 1. Recibe el archivo como ArrayBuffer (transferable, sin copia)
 * 2. Importa XLSX desde CDN (los workers no pueden importar módulos del bundle)
 * 3. Parsea el XLSB fuera del hilo principal
 * 4. Envía mensajes de progreso al hilo principal
 * 5. Devuelve el resultado estructurado
 */

import * as XLSX from 'xlsx'

// Código del worker como string (se ejecuta en un hilo separado via Blob URL)
const WORKER_CODE = `
self.onmessage = async function(e) {
  const { buffer, fileName, fileSize } = e.data

  function postProgress(stage, pct, detail) {
    self.postMessage({ type: 'progress', stage, pct, detail })
  }

  try {
    postProgress('Importando XLSX desde CDN...', 5, 'Cargando librería')

    // Importar XLSX desde CDN (los workers no pueden usar los módulos del bundle)
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm').catch(() => {
      // Fallback: unpkg
      return import('https://unpkg.com/xlsx@0.18.5/xlsx.mjs')
    })

    postProgress('Leyendo archivo binario...', 10, fileSize + ' bytes')

    // El buffer ya viene como ArrayBuffer transferido
    const data = new Uint8Array(buffer)

    postProgress('Decodificando estructura XLSB...', 20, 'Esto puede tardar para archivos grandes')

    // Parsear con opciones optimizadas para velocidad
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      sheetStubs: false,
      sheetRows: 0, // 0 = todas las filas
      WTF: false,
    })

    const totalHojas = workbook.SheetNames.length
    postProgress('Workbook parseado: ' + totalHojas + ' hoja(s)', 50, workbook.SheetNames.join(', '))

    const hojas = []
    let hojaIndex = 0

    for (const sheetName of workbook.SheetNames) {
      hojaIndex++
      const sheet = workbook.Sheets[sheetName]

      postProgress('Procesando hoja ' + hojaIndex + '/' + totalHojas + ': ' + sheetName, 50 + (hojaIndex / totalHojas) * 30, '')

      const json = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false,
        dateNF: 'yyyy-mm-dd',
      })

      if (json.length === 0) continue

      const columnas = Object.keys(json[0])
      const filas = json.map(function(row) {
        const parsed = {}
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

      hojas.push({ hoja: sheetName, columnas: columnas, filas: filas })

      postProgress('Hoja ' + sheetName + ': ' + filas.length + ' filas procesadas', 50 + (hojaIndex / totalHojas) * 30, '')
    }

    postProgress('Serializando resultados...', 90, hojas.length + ' hojas')

    // Enviar resultado (structured clone - se copia, no se transfiere)
    self.postMessage({
      type: 'done',
      hojas: hojas,
      hojasNombres: workbook.SheetNames,
    })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err.message || String(err),
      stack: err.stack,
    })
  }
}
`

let workerInstance: Worker | null = null
let blobUrl: string | null = null

function getWorker(): Worker {
  if (workerInstance) return workerInstance

  // Crear Blob URL con el código del worker
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
  blobUrl = URL.createObjectURL(blob)
  workerInstance = new Worker(blobUrl)

  return workerInstance
}

export interface WorkerProgress {
  stage: string
  pct: number
  detail?: string
}

export interface WorkerResult {
  hojas: Array<{
    hoja: string
    columnas: string[]
    filas: Array<Record<string, string | number | null>>
  }>
  hojasNombres: string[]
}

/**
 * Parsea un archivo XLSB usando un Web Worker.
 * No bloquea el hilo principal, permite mostrar progreso real.
 */
export function parseXLSBFileWithWorker(
  file: File,
  onProgress?: (p: WorkerProgress) => void
): Promise<WorkerResult> {
  return new Promise(async (resolve, reject) => {
    const buffer = await file.arrayBuffer()
    const worker = getWorker()

    const timeout = setTimeout(() => {
      worker.terminate()
      workerInstance = null
      reject(new Error('Timeout: el archivo tardó más de 5 minutos en procesarse. Intenta con un archivo más pequeño o divide los datos.'))
    }, 5 * 60 * 1000) // 5 minutos

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data

      if (data.type === 'progress') {
        onProgress?.({
          stage: data.stage,
          pct: data.pct,
          detail: data.detail,
        })
      } else if (data.type === 'done') {
        clearTimeout(timeout)
        resolve({
          hojas: data.hojas,
          hojasNombres: data.hojasNombres,
        })
      } else if (data.type === 'error') {
        clearTimeout(timeout)
        reject(new Error(`Error en worker: ${data.message}`))
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      clearTimeout(timeout)
      reject(new Error(`Error del worker: ${e.message}`))
    }

    // Transferir el buffer (sin copia, más eficiente)
    worker.postMessage(
      {
        buffer,
        fileName: file.name,
        fileSize: file.size,
      },
      [buffer] // Transferable
    )
  })
}

// Re-exportar las funciones de detección que no necesitan worker
export {
  detectarColumnas,
  validarEstructura,
  procesarFilas,
  normalizarNombre,
  normalizarPeriodo,
} from './xlsb-client-parser'

export type { OperacionRaw, ParsedSheet, ParsedRow, ParsedFile } from './xlsb-client-parser'
