import * as XLSX from 'xlsx'
import { parseXLSBFile, detectarColumnas, validarEstructura, procesarFilas } from '../src/lib/xlsb-client-parser'
import * as fs from 'fs'

// Crear un XLSX de prueba
const data = [
  { Productor: 'LAS MORAS', Deposito: 'CALIRAL', Fecha: '2024-01-15', Cantidad: 100, PesoKg: 25000, Destino: 'CHINA' },
  { Productor: 'FRIBOY', Deposito: 'FRIOPORT', Fecha: '2024-01-20', Cantidad: 80, PesoKg: 18000, Destino: 'BRASIL' },
  { Productor: 'TACUAREMBO', Deposito: 'CALIRAL', Fecha: '2024-02-10', Cantidad: 120, PesoKg: 30000, Destino: 'CHINA' },
]

const ws = XLSX.utils.json_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Operaciones')

// Escribir como XLSX
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
fs.writeFileSync('/tmp/test.xlsx', buf)
console.log('✅ Archivo test.xlsx creado:', buf.length, 'bytes')

// Probar el parser
async function main() {
  const fileBuffer = fs.readFileSync('/tmp/test.xlsx')
  const file = new File([fileBuffer], 'test.xlsx')
  console.log('📂 Parseando...')
  const parsed = await parseXLSBFile(file)
  console.log('✅ Hojas:', parsed.hojasNombres)
  console.log('✅ Filas:', parsed.hojas[0].filas.length)

  const columnas = detectarColumnas(parsed.hojas)
  console.log('✅ Columnas detectadas:', columnas)

  const { valida, errores } = validarEstructura(columnas)
  console.log('✅ Estructura válida:', valida, errores)

  const { operaciones, duplicados } = procesarFilas(parsed.hojas, columnas)
  console.log('✅ Operaciones:', operaciones.length, 'Duplicados:', duplicados)
  console.log('✅ Primera operación:', operaciones[0])
}

main().catch(e => { console.error('❌', e); process.exit(1) })
