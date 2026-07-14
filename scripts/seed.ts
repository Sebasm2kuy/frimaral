// Script de seed: crea datos realistas del sector cárnico uruguayo
// Ejecutar: bun run /home/z/my-project/scripts/seed.ts

import { db } from '../src/lib/db'
import { hashPassword } from '../src/modules/auth/jwt'
import { recalcularInteligenciaCompleta } from '../src/modules/intelligence/engine'

async function main() {
  console.log('🚀 Iniciando seed de CALIRAL INSIGHT...')

  // Limpiar datos previos
  console.log('🧹 Limpiando datos previos...')
  await db.alerta.deleteMany({})
  await db.historico.deleteMany({})
  await db.operacion.deleteMany({})
  await db.importacion.deleteMany({})
  await db.contenedor.deleteMany({})
  await db.destino.deleteMany({})
  await db.competidor.deleteMany({})
  await db.certificador.deleteMany({})
  await db.productor.deleteMany({})
  await db.usuario.deleteMany({})

  // ============================================================
  // 1. USUARIOS
  // ============================================================
  console.log('👥 Creando usuarios...')
  const adminPass = await hashPassword('admin123')
  const comercialPass = await hashPassword('comercial123')
  const lectorPass = await hashPassword('lector123')

  const admin = await db.usuario.create({
    data: { email: 'admin@caliral.com', nombre: 'Administrador', passwordHash: adminPass, rol: 'ADMINISTRADOR' },
  })
  const comercial = await db.usuario.create({
    data: { email: 'comercial@caliral.com', nombre: 'Ejecutivo Comercial', passwordHash: comercialPass, rol: 'COMERCIAL' },
  })
  const lector = await db.usuario.create({
    data: { email: 'lector@caliral.com', nombre: 'Analista (Solo Lectura)', passwordHash: lectorPass, rol: 'LECTOR' },
  })

  // ============================================================
  // 2. CERTIFICADOR - CALIRAL
  // ============================================================
  console.log('🏢 Creando Caliral como certificador...')
  const caliral = await db.certificador.create({
    data: {
      nombre: 'CALIRAL',
      esCaliral: true,
      cuit: '21-12345678-9',
      activo: true,
    },
  })

  // ============================================================
  // 3. COMPETIDORES (Otros depósitos frigoríficos y certificadores)
  // ============================================================
  console.log('⚔️  Creando competidores...')
  const competidores = await Promise.all([
    db.competidor.create({ data: { nombre: 'FRIOPORT', cuit: '21-11111111-1', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'FRIGOPUY', cuit: '21-22222222-2', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'COLD STORAGE URUGUAY', cuit: '21-33333333-3', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'FRIPUR', cuit: '21-44444444-4', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'LORSUAL', cuit: '21-55555555-5', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'FRIGONAL', cuit: '21-66666666-6', pais: 'Uruguay' } }),
    db.competidor.create({ data: { nombre: 'ROSARIO INDUSTRIAL', cuit: '21-77777777-7', pais: 'Uruguay' } }),
  ])
  const [frioport, frigopuy, coldStorage, fripur, lorsual, frigonal, rosario] = competidores

  // ============================================================
  // 4. PRODUCTORES (Frigoríficos y establecimientos)
  // ============================================================
  console.log('🐄 Creando productores...')
  const productores = await Promise.all([
    db.productor.create({ data: { nombre: 'LAS MORAS SA', razonSocial: 'Frigorífico Las Moras SA', cuit: '21-10000001-1', pais: 'Uruguay', provincia: 'Canelones', localidad: 'San José' } }),
    db.productor.create({ data: { nombre: 'FRIBOY SA', razonSocial: 'Frigorífico Boyero SA', cuit: '21-10000002-2', pais: 'Uruguay', provincia: 'Florida', localidad: 'Florida' } }),
    db.productor.create({ data: { nombre: 'TACUAREMBO SA', razonSocial: 'Frigorífico Tacuarembó SA', cuit: '21-10000003-3', pais: 'Uruguay', provincia: 'Tacuarembó', localidad: 'Tacuarembó' } }),
    db.productor.create({ data: { nombre: 'CASA BLANCA SA', razonSocial: 'Frigorífico Casa Blanca SA', cuit: '21-10000004-4', pais: 'Uruguay', provincia: 'Canelones', localidad: 'Canelones' } }),
    db.productor.create({ data: { nombre: 'SAN JACINTO SA', razonSocial: 'Frigorífico San Jacinto SA', cuit: '21-10000005-5', pais: 'Uruguay', provincia: 'Canelones', localidad: 'San Jacinto' } }),
    db.productor.create({ data: { nombre: 'CARRASCO SA', razonSocial: 'Frigorífico Carrasco SA', cuit: '21-10000006-6', pais: 'Uruguay', provincia: 'Montevideo', localidad: 'Montevideo' } }),
    db.productor.create({ data: { nombre: 'SANTA ELENA SA', razonSocial: 'Frigorífico Santa Elena SA', cuit: '21-10000007-7', pais: 'Uruguay', provincia: 'Salto', localidad: 'Salto' } }),
    db.productor.create({ data: { nombre: 'LA CALERA SA', razonSocial: 'Frigorífico La Calera SA', cuit: '21-10000008-8', pais: 'Uruguay', provincia: 'Paysandú', localidad: 'Paysandú' } }),
    db.productor.create({ data: { nombre: 'PANDO SA', razonSocial: 'Frigorífico Pando SA', cuit: '21-10000009-9', pais: 'Uruguay', provincia: 'Canelones', localidad: 'Pando' } }),
    db.productor.create({ data: { nombre: 'MERCEDES SA', razonSocial: 'Frigorífico Mercedes SA', cuit: '21-10000010-0', pais: 'Uruguay', provincia: 'Soriano', localidad: 'Mercedes' } }),
    db.productor.create({ data: { nombre: 'PAYSANDU SA', razonSocial: 'Frigorífico Paysandú SA', cuit: '21-10000011-1', pais: 'Uruguay', provincia: 'Paysandú', localidad: 'Paysandú' } }),
    db.productor.create({ data: { nombre: 'RIO NEGRO SA', razonSocial: 'Frigorífico Río Negro SA', cuit: '21-10000012-2', pais: 'Uruguay', provincia: 'Río Negro', localidad: 'Fray Bentos' } }),
    db.productor.create({ data: { nombre: 'DURAZNO SA', razonSocial: 'Frigorífico Durazno SA', cuit: '21-10000013-3', pais: 'Uruguay', provincia: 'Durazno', localidad: 'Durazno' } }),
    db.productor.create({ data: { nombre: 'MINAS SA', razonSocial: 'Frigorífico Minas SA', cuit: '21-10000014-4', pais: 'Uruguay', provincia: 'Lavalleja', localidad: 'Minas' } }),
    db.productor.create({ data: { nombre: 'ROCHA SA', razonSocial: 'Frigorífico Rocha SA', cuit: '21-10000015-5', pais: 'Uruguay', provincia: 'Rocha', localidad: 'Rocha' } }),
  ])

  const [
    lasMoras, friboy, tacuarembo, casaBlanca, sanJacinto, carrasco, santaElena,
    laCalera, pando, mercedes, paysandu, rioNegro, durazno, minas, rocha
  ] = productores

  // ============================================================
  // 5. DESTINOS
  // ============================================================
  console.log('🌍 Creando destinos...')
  const destinos = await Promise.all([
    db.destino.create({ data: { nombre: 'CHINA', pais: 'China', region: 'Asia' } }),
    db.destino.create({ data: { nombre: 'ESTADOS UNIDOS', pais: 'Estados Unidos', region: 'América del Norte' } }),
    db.destino.create({ data: { nombre: 'UNION EUROPEA', pais: 'Unión Europea', region: 'Europa' } }),
    db.destino.create({ data: { nombre: 'BRASIL', pais: 'Brasil', region: 'América del Sur' } }),
    db.destino.create({ data: { nombre: 'CHILE', pais: 'Chile', region: 'América del Sur' } }),
    db.destino.create({ data: { nombre: 'ISRAEL', pais: 'Israel', region: 'Medio Oriente' } }),
    db.destino.create({ data: { nombre: 'JAPON', pais: 'Japón', region: 'Asia' } }),
    db.destino.create({ data: { nombre: 'COREA DEL SUR', pais: 'Corea del Sur', region: 'Asia' } }),
  ])

  // ============================================================
  // 6. IMPORTACIÓN (registro)
  // ============================================================
  console.log('📥 Creando registro de importación...')
  const importacion = await db.importacion.create({
    data: {
      fileName: 'INAC_Exportaciones_2023-2024.xlsb',
      fileSize: 1048576,
      periodo: '2024-12',
      uploadedById: admin.id,
      status: 'COMPLETADO',
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
      errorRows: 0,
      hojasDetectadas: JSON.stringify(['Operaciones']),
      columnasDetectadas: JSON.stringify({
        productor: 'Productor',
        certificador: 'Deposito',
        fecha: 'Fecha',
        cantidad: 'Cabezas',
        peso: 'PesoKg',
        valor: 'FOBusd',
        destino: 'Destino',
        contenedor: 'Contenedor',
        producto: 'Producto',
      }),
      completedAt: new Date(),
    },
  })

  // ============================================================
  // 7. OPERACIONES - Simular escenarios realistas
  // ============================================================
  console.log('📊 Generando operaciones históricas (simulando escenarios)...')

  const periodos = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  ]

  const productos = ['CORTES BOVINOS HACCP', 'CORTES OVINO HACCP', 'MOLIDO BOVINO', 'CUARTOS DELANTEROS', 'CUARTOS TRASEROS', 'HIGADO BOVINO', 'MENUDENCIAS']
  const tiposContenedor = [' Reefer 40"', 'Dry 20"', 'Reefer 20"']

  let contadores = { contenedor: 1 }
  const operacionesBatch: any[] = []

  // Generador helper
  function generarOperacion(opts: {
    productorId: string
    certificadorId?: string | null
    competidorId?: string | null
    periodo: string
    destinoId?: string
    importacionId: string
    cantidad?: number
    pesoKg?: number
    valorUsd?: number
    producto?: string
    contenedorCodigo?: string
  }) {
    const [year, month] = opts.periodo.split('-')
    const dia = Math.floor(Math.random() * 28) + 1
    const fecha = new Date(parseInt(year), parseInt(month) - 1, dia)
    const cantidad = opts.cantidad ?? Math.floor(Math.random() * 200) + 50
    const pesoKg = opts.pesoKg ?? cantidad * (180 + Math.random() * 40)
    const valorUsd = opts.valorUsd ?? pesoKg * (3.5 + Math.random() * 1.5)
    const producto = opts.producto ?? productos[Math.floor(Math.random() * productos.length)]
    const contenedor = opts.contenedorCodigo ?? `CONTU${String(contadores.contenedor++).padStart(6, '0')}`

    operacionesBatch.push({
      productorId: opts.productorId,
      certificadorId: opts.certificadorId ?? null,
      competidorId: opts.competidorId ?? null,
      destinoId: opts.destinoId ?? destinos[Math.floor(Math.random() * destinos.length)].id,
      contenedorId: null, // se resolverá abajo
      importacionId: opts.importacionId,
      fecha,
      periodo: opts.periodo,
      producto,
      cantidad,
      pesoKg,
      valorUsd,
    })
  }

  // Resolver contenedores después
  for (let i = 0; i < 5000; i++) {
    await db.contenedor.upsert({
      where: { codigo: `CONTU${String(i + 1).padStart(6, '0')}` },
      update: {},
      create: { codigo: `CONTU${String(i + 1).padStart(6, '0')}`, tipo: tiposContenedor[i % 3] },
    })
  }

  // Estrategia: cada productor tiene un patrón distinto
  // 1. LAS MORAS: Exclusivo con Caliral durante todo el año, pero últimamente也开始 compartiendo con Frioport
  // 2. FRIBOY: Compartido, Caliral + Frioport
  // 3. TACUAREMBO: Exclusivo Caliral
  // 4. CASA BLANCA: Exclusivo Caliral, perdido en últimos meses (migró a Frioport)
  // 5. SAN JACINTO: Compartido Caliral + Rosario
  // 6. CARRASCO: Exclusivo Caliral
  // 7. SANTA ELENA: Perdido (antes Caliral, ahora Fripur)
  // 8. LA CALERA: Recuperado (Caliral, dejó, volvió)
  // 9. PANDO: Exclusivo Caliral
  // 10. MERCEDES: Compartido Caliral + Friar
  // 11. PAYSANDU: Exclusivo Caliral
  // 12. RIO NEGRO: Solo competencia (nunca con Caliral)
  // 13. DURAZNO: Compartido creciente con Frioport
  // 14. MINAS: Exclusivo Caliral
  // 15. ROCHA: Exclusivo Caliral

  for (const periodo of periodos) {
    const monthIdx = periodos.indexOf(periodo)
    const primerSemestre = monthIdx < 6

    // LAS MORAS - exclusivo, pero en últimos 2 meses empieza a compartir con Frioport
    for (let i = 0; i < 8; i++) {
      generarOperacion({ productorId: lasMoras.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
    if (monthIdx >= 10) {
      // Noviembre y diciembre: empieza a usar Frioport
      for (let i = 0; i < 2; i++) {
        generarOperacion({ productorId: lasMoras.id, competidorId: frioport.id, periodo, importacionId: importacion.id })
      }
    }

    // FRIBOY - compartido Caliral + Frioport todo el año
    for (let i = 0; i < 5; i++) {
      generarOperacion({ productorId: friboy.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
    for (let i = 0; i < 3; i++) {
      generarOperacion({ productorId: friboy.id, competidorId: frioport.id, periodo, importacionId: importacion.id })
    }

    // TACUAREMBO - exclusivo Caliral, alto volumen
    for (let i = 0; i < 10; i++) {
      generarOperacion({ productorId: tacuarembo.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }

    // CASA BLANCA - exclusivo Caliral primeros 8 meses, luego perdido (migró a Frioport)
    if (monthIdx < 8) {
      for (let i = 0; i < 6; i++) {
        generarOperacion({ productorId: casaBlanca.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
      }
    } else {
      // Migró a Frioport
      for (let i = 0; i < 6; i++) {
        generarOperacion({ productorId: casaBlanca.id, competidorId: frioport.id, periodo, importacionId: importacion.id })
      }
    }

    // SAN JACINTO - compartido Caliral + Rosario
    for (let i = 0; i < 4; i++) {
      generarOperacion({ productorId: sanJacinto.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
    for (let i = 0; i < 2; i++) {
      generarOperacion({ productorId: sanJacinto.id, competidorId: rosario.id, periodo, importacionId: importacion.id })
    }

    // CARRASCO - exclusivo Caliral
    for (let i = 0; i < 7; i++) {
      generarOperacion({ productorId: carrasco.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }

    // SANTA ELENA - perdido (primero con Caliral, luego Fripur)
    if (monthIdx < 5) {
      for (let i = 0; i < 5; i++) {
        generarOperacion({ productorId: santaElena.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
      }
    } else {
      for (let i = 0; i < 5; i++) {
        generarOperacion({ productorId: santaElena.id, competidorId: fripur.id, periodo, importacionId: importacion.id })
      }
    }

    // LA CALERA - recuperado (Caliral primeros meses, luego Cold Storage, luego vuelve a Caliral)
    if (monthIdx < 4) {
      for (let i = 0; i < 4; i++) {
        generarOperacion({ productorId: laCalera.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
      }
    } else if (monthIdx < 9) {
      for (let i = 0; i < 4; i++) {
        generarOperacion({ productorId: laCalera.id, competidorId: coldStorage.id, periodo, importacionId: importacion.id })
      }
    } else {
      // Vuelve a Caliral en octubre, noviembre, diciembre
      for (let i = 0; i < 4; i++) {
        generarOperacion({ productorId: laCalera.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
      }
    }

    // PANDO - exclusivo Caliral
    for (let i = 0; i < 6; i++) {
      generarOperacion({ productorId: pando.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }

    // MERCEDES - compartido Caliral + LORSUAL
    for (let i = 0; i < 3; i++) {
      generarOperacion({ productorId: mercedes.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
    for (let i = 0; i < 2; i++) {
      generarOperacion({ productorId: mercedes.id, competidorId: lorsual.id, periodo, importacionId: importacion.id })
    }

    // PAYSANDU - exclusivo Caliral
    for (let i = 0; i < 5; i++) {
      generarOperacion({ productorId: paysandu.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }

    // RIO NEGRO - solo competencia (nunca con Caliral) - es cliente potencial
    for (let i = 0; i < 4; i++) {
      generarOperacion({ productorId: rioNegro.id, competidorId: frigonal.id, periodo, importacionId: importacion.id })
    }

    // DURAZNO - compartido creciente con Frioport (alto riesgo)
    for (let i = 0; i < 3; i++) {
      generarOperacion({ productorId: durazno.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
    // Frioport crece mes a mes
    for (let i = 0; i < Math.min(monthIdx + 1, 6); i++) {
      generarOperacion({ productorId: durazno.id, competidorId: frioport.id, periodo, importacionId: importacion.id })
    }

    // MINAS - exclusivo Caliral
    for (let i = 0; i < 4; i++) {
      generarOperacion({ productorId: minas.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }

    // ROCHA - exclusivo Caliral, pero reduce operaciones últimos meses (riesgo)
    if (monthIdx < 9) {
      for (let i = 0; i < 5; i++) {
        generarOperacion({ productorId: rocha.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
      }
    } else {
      // Reduce operaciones significativamente
      generarOperacion({ productorId: rocha.id, certificadorId: caliral.id, periodo, importacionId: importacion.id })
    }
  }

  console.log(`📦 Insertando ${operacionesBatch.length} operaciones...`)

  // Insertar en lotes de 500
  for (let i = 0; i < operacionesBatch.length; i += 500) {
    const lote = operacionesBatch.slice(i, i + 500)
    await db.operacion.createMany({ data: lote })
    process.stdout.write(`   Lote ${Math.floor(i / 500) + 1}/${Math.ceil(operacionesBatch.length / 500)}\r`)
  }
  console.log('\n')

  // Actualizar importación con métricas reales
  await db.importacion.update({
    where: { id: importacion.id },
    data: {
      totalRows: operacionesBatch.length,
      validRows: operacionesBatch.length,
    },
  })

  // ============================================================
  // 8. RECALCULAR INTELIGENCIA
  // ============================================================
  console.log('🧠 Recalculando inteligencia comercial...')
  const { alertas } = await recalcularInteligenciaCompleta()
  console.log(`   ✅ ${alertas} alertas generadas`)

  console.log('\n✅ Seed completado!\n')
  console.log('════════════════════════════════════════════════════════════')
  console.log('  CALIRAL INSIGHT - Credenciales de acceso:')
  console.log('════════════════════════════════════════════════════════════')
  console.log('  👑 Administrador:  admin@caliral.com / admin123')
  console.log('  💼 Comercial:      comercial@caliral.com / comercial123')
  console.log('  👁  Solo Lectura:   lector@caliral.com / lector123')
  console.log('════════════════════════════════════════════════════════════')
  console.log(`  📊 Datos cargados:`)
  console.log(`     • 15 productores (clientes)`)
  console.log(`     • 7 competidores (otros depósitos)`)
  console.log(`     • ${operacionesBatch.length} operaciones`)
  console.log(`     • 12 periodos (2024-01 a 2024-12)`)
  console.log(`     • ${alertas} alertas comerciales detectadas`)
  console.log('════════════════════════════════════════════════════════════\n')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error en seed:', error)
    process.exit(1)
  })
