#!/usr/bin/env python3
"""
Procesa el XLSB real de INAC (Cargas y Embarques de Carne).
Estructura: headers en fila 15, datos desde fila 16.
Columnas clave:
  [4] Nombre del Establecimiento Certificador (depósito - Caliral o competidor)
  [5] Nombre Establecimiento Productor
  [7] Fecha emitido COTE (número de serie Excel)
  [10] Contenedor - Serie y Nro.
  [23] País de Destino
  [42] Denominación de Mercadería (producto)
  [45] Cantidad de Envases
  [46] Peso Bruto
  [47] Peso Neto
"""
import sys
import os
import json
import csv
from pyxlsb import open_workbook
from datetime import datetime, date, timedelta

def parse_excel_date(val):
    """Convierte un número de serie de Excel a datetime."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val
    try:
        num = float(val)
        # Excel epoch: 1900-01-01 = 1 (con bug de 1900)
        # 45658 = 2024-12-01 aprox
        base = datetime(1899, 12, 30)
        result = base + timedelta(days=num)
        return result
    except:
        return None

def normalize_name(val):
    if not val:
        return ''
    s = str(val).strip()
    s = ' '.join(s.split())
    result = ''
    for c in s.upper():
        if c.isalnum() or c in ' ÁÉÍÓÚÑÜ.-':
            result += c
    return result

def parse_number(val):
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace('$', '').strip()
    try:
        return float(s)
    except:
        return 0

# Mapeo de columnas (basado en inspección del archivo real)
COLUMN_MAP = {
    'productor': 5,        # Nombre Establecimiento Productor
    'certificador': 4,     # Nombre del Establecimiento Certificador
    'fecha': 7,            # Fecha emitido COTE
    'destino': 23,         # País de Destino
    'contenedor': 10,      # Contenedor - Serie y Nro.
    'producto': 42,        # Denominación de Mercadería
    'cantidad': 45,        # Cantidad de Envases
    'peso_bruto': 46,      # Peso Bruto
    'peso_neto': 47,       # Peso Neto
    'nro_tramite': 0,      # Nro. Trámite
}

def main():
    xlsb_path = sys.argv[1]
    if not xlsb_path:
        print('Uso: python3 process-inac.py <archivo.xlsb> [output.csv]')
        sys.exit(1)

    output_csv = sys.argv[2] if len(sys.argv) > 2 else '/tmp/operaciones.csv'

    print(f'📁 Procesando: {xlsb_path}')
    print(f'📏 Tamaño: {os.path.getsize(xlsb_path) / 1024 / 1024:.2f} MB')

    operaciones = []
    hashes = set()
    duplicates = 0
    errors = 0
    total = 0

    with open_workbook(xlsb_path) as wb:
        print(f'✅ Workbook abierto: {len(wb.sheets)} hojas')
        print(f'   Hojas: {wb.sheets}')

        # Solo procesar la hoja Registros (donde están los embarques)
        with wb.get_sheet('Registros') as sheet:
            print(f'\n📋 Procesando hoja: Registros')
            header_row_found = False

            for row_idx, row in enumerate(sheet.rows()):
                # Buscar la fila de headers (contiene "Nro. Trámite")
                if not header_row_found:
                    first_val = str(row[0].v).strip() if row[0].v else ''
                    if first_val == 'Nro. Trámite':
                        header_row_found = True
                        print(f'   Headers encontrados en fila {row_idx}')
                    continue

                # Procesar fila de datos
                if row_idx % 10000 == 0:
                    print(f'   Procesadas {len(operaciones)} operaciones válidas ({total} filas leídas)...')

                total += 1

                try:
                    # Extraer valores por índice de columna
                    productor = normalize_name(row[COLUMN_MAP['productor']].v if COLUMN_MAP['productor'] < len(row) else None)
                    certificador = normalize_name(row[COLUMN_MAP['certificador']].v if COLUMN_MAP['certificador'] < len(row) else None)
                    fecha_raw = row[COLUMN_MAP['fecha']].v if COLUMN_MAP['fecha'] < len(row) else None

                    if not productor or not certificador or not fecha_raw:
                        errors += 1
                        continue

                    fecha = parse_excel_date(fecha_raw)
                    if not fecha:
                        errors += 1
                        continue

                    periodo = f'{fecha.year}-{fecha.month:02d}'

                    destino = normalize_name(row[COLUMN_MAP['destino']].v if COLUMN_MAP['destino'] < len(row) else None)
                    contenedor = str(row[COLUMN_MAP['contenedor']].v or '').strip().upper() if COLUMN_MAP['contenedor'] < len(row) else ''
                    producto = normalize_name(row[COLUMN_MAP['producto']].v if COLUMN_MAP['producto'] < len(row) else None)
                    cantidad = parse_number(row[COLUMN_MAP['cantidad']].v if COLUMN_MAP['cantidad'] < len(row) else None)
                    peso_bruto = parse_number(row[COLUMN_MAP['peso_bruto']].v if COLUMN_MAP['peso_bruto'] < len(row) else None)
                    peso_neto = parse_number(row[COLUMN_MAP['peso_neto']].v if COLUMN_MAP['peso_neto'] < len(row) else None)
                    nro_tramite = parse_number(row[COLUMN_MAP['nro_tramite']].v if COLUMN_MAP['nro_tramite'] < len(row) else None)

                    # Usar peso neto, si no hay, peso bruto
                    peso = peso_neto if peso_neto > 0 else peso_bruto

                    # Hash para duplicados
                    h = f'{productor}|{certificador}|{fecha.isoformat()}|{contenedor}|{nro_tramite}'
                    if h in hashes:
                        duplicates += 1
                        continue
                    hashes.add(h)

                    operaciones.append({
                        'productor': productor,
                        'deposito': certificador,
                        'fecha': fecha.isoformat(),
                        'periodo': periodo,
                        'producto': producto or '',
                        'cantidad': cantidad,
                        'pesoKg': peso,
                        'valorUsd': 0,
                        'destino': destino or '',
                        'contenedor': contenedor,
                        'nro_tramite': nro_tramite,
                    })

                except Exception as e:
                    errors += 1
                    if errors <= 3:
                        print(f'   ⚠️  Error fila {row_idx}: {e}')

    # Escribir CSV
    print(f'\n💾 Escribiendo CSV: {output_csv}')
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['productor', 'deposito', 'fecha', 'periodo', 'producto', 'cantidad', 'pesoKg', 'valorUsd', 'destino', 'contenedor', 'nro_tramite'])
        writer.writeheader()
        for op in operaciones:
            writer.writerow(op)

    print(f'\n✅ Procesamiento completado:')
    print(f'   Total filas: {total}')
    print(f'   Operaciones válidas: {len(operaciones)}')
    print(f'   Duplicados: {duplicates}')
    print(f'   Errores: {errors}')

    # Stats
    productores = set(op['productor'] for op in operaciones)
    depositos = set(op['deposito'] for op in operaciones)
    destinos = set(op['destino'] for op in operaciones if op['destino'])
    periodos = set(op['periodo'] for op in operaciones)

    print(f'   Productores únicos: {len(productores)}')
    print(f'   Depósitos certificadores: {len(depositos)}')
    print(f'   Destinos: {len(destinos)}')
    print(f'   Períodos: {len(periodos)} ({sorted(periodos)[0] if periodos else "?"} a {sorted(periodos)[-1] if periodos else "?"})')
    print(f'\n   Depósitos (primeros 30):')
    for d in sorted(depositos)[:30]:
        count = sum(1 for op in operaciones if op['deposito'] == d)
        print(f'     • {d}: {count} operaciones')

    # Guardar stats
    with open('/tmp/process-stats.json', 'w') as f:
        json.dump({
            'total': total,
            'validas': len(operaciones),
            'duplicados': duplicates,
            'errores': errors,
            'productores_unicos': len(productores),
            'depositos_unicos': len(depositos),
            'destinos_unicos': len(destinos),
            'periodos': sorted(periodos),
            'depositos_lista': sorted(depositos),
        }, f, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    main()
