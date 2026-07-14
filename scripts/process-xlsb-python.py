#!/usr/bin/env python3
"""
Procesa el XLSB real de INAC usando pyxlsb (eficiente en memoria).
Genera un CSV que luego se procesa con el motor de inteligencia.
"""
import sys
import os
import json
import csv
from pyxlsb import open_workbook
from datetime import datetime, date

def parse_value(val):
    """Normaliza un valor de celda a string/number/None."""
    if val is None or val == '':
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return str(val).strip()

def normalize_name(val):
    """Normaliza un nombre: uppercase, sin caracteres especiales."""
    if not val:
        return ''
    s = str(val).strip()
    s = ' '.join(s.split())
    # Mantener alfanumérico, espacios, acentos, puntos, guiones
    result = ''
    for c in s.upper():
        if c.isalnum() or c in ' ÁÉÍÓÚÑÜ.-':
            result += c
    return result

def parse_date(val):
    """Parsea una fecha desde string, datetime o número de Excel."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val
    s = str(val).strip()
    # ISO format
    try:
        return datetime.fromisoformat(s)
    except:
        pass
    # DD/MM/YYYY
    parts = s.split('/')
    if len(parts) == 3:
        try:
            dd, mm, yyyy = int(parts[0]), int(parts[1]), int(parts[2])
            return datetime(yyyy, mm, dd)
        except:
            pass
    # YYYY-MM-DD
    parts = s.split('-')
    if len(parts) == 3:
        try:
            yyyy, mm, dd = int(parts[0]), int(parts[1]), int(parts[2])
            return datetime(yyyy, mm, dd)
        except:
            pass
    return None

def parse_number(val):
    """Parsea un número desde string o number."""
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace('$', '').replace('USD', '').strip()
    try:
        return float(s)
    except:
        return 0

# Mapeo de columnas
COLUMN_ALIASES = {
    'productor': ['productor', 'productores', 'frigorifico', 'frigorificos', 'razon social', 'razon_social', 'empresa', 'establecimiento', 'cliente', 'nombre productor', 'firm', 'exportador', 'remitente', 'razón social'],
    'cuit_productor': ['cuit', 'cuit productor', 'rut', 'tax id', 'identificacion'],
    'certificador': ['certificador', 'deposito', 'deposito frigorifico', 'certificadora', 'entidad certificadora', 'depósito', 'consignatario', 'deposito frigorífico'],
    'competidor': ['competidor', 'otro deposito', 'competencia', 'otro certificador'],
    'fecha': ['fecha', 'fecha operacion', 'fecha_embarque', 'fecha exportacion', 'fecha certificacion', 'dia', 'fecha embarque', 'fecha de embarque', 'fecha despacho', 'fecha de despacho', 'fecha de operacion'],
    'periodo': ['periodo', 'mes', 'mes año', 'periodo fiscal'],
    'producto': ['producto', 'tipo producto', 'categoria', 'descripcion producto', 'descripcion', 'tipo de producto'],
    'cantidad': ['cantidad', 'unidades', 'cabezas', 'cajas', 'piezas', 'volumen', 'peso piezas', 'kg', 'kilos', 'peso neto', 'peso', 'peso bruto', 'peso (kg)', 'peso total'],
    'peso': ['peso', 'peso kg', 'peso bruto', 'kg', 'kilos', 'toneladas', 'peso neto', 'peso total', 'peso (kg)'],
    'valor': ['valor', 'valor usd', 'fob', 'valor fob', 'monto', 'precio total', 'fob usd', 'fob (usd)'],
    'destino': ['destino', 'pais destino', 'pais', 'mercado', 'exportacion a', 'pais de destino', 'país destino', 'país'],
    'contenedor': ['contenedor', 'container', 'numero contenedor', 'id contenedor', 'número contenedor'],
}

def detect_columns(headers):
    """Detecta las columnas del archivo."""
    mapping = {}
    headers_lower = [str(h).lower().strip() if h else '' for h in headers]
    for field, aliases in COLUMN_ALIASES.items():
        for i, h in enumerate(headers_lower):
            for alias in aliases:
                if h == alias or alias in h:
                    if field not in mapping:
                        mapping[field] = headers[i]
                    break
    return mapping

def main():
    xlsb_path = sys.argv[1]
    if not xlsb_path:
        print('Uso: python3 process-xlsb-python.py <archivo.xlsb> [output.csv]')
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

        for sheet_name in wb.sheets:
            print(f'\n📋 Procesando hoja: {sheet_name}')
            with wb.get_sheet(sheet_name) as sheet:
                headers = None
                col_map = None
                sheet_rows = 0

                for row_idx, row in enumerate(sheet.rows()):
                    if row_idx == 0:
                        # Primera fila: headers
                        headers = [c.v for c in row]
                        print(f'   Headers: {headers}')
                        col_map = detect_columns(headers)
                        print(f'   Mapeo: {col_map}')
                        continue

                    if row_idx % 10000 == 0 and row_idx > 0:
                        print(f'   Procesadas {row_idx} filas...')

                    # Mapear fila a dict
                    row_dict = {}
                    for i, cell in enumerate(row):
                        if i < len(headers):
                            row_dict[headers[i]] = parse_value(cell.v)

                    sheet_rows += 1
                    total += 1

                    try:
                        nombre_productor = normalize_name(row_dict.get(col_map.get('productor', '')))
                        nombre_deposito = normalize_name(row_dict.get(col_map.get('certificador', '')))
                        fecha_raw = row_dict.get(col_map.get('fecha', ''))

                        if not nombre_productor or not nombre_deposito or not fecha_raw:
                            errors += 1
                            continue

                        fecha = parse_date(fecha_raw)
                        if not fecha:
                            errors += 1
                            continue

                        periodo = f'{fecha.year}-{fecha.month:02d}'

                        # Cantidad y peso - pueden ser la misma columna
                        cantidad = parse_number(row_dict.get(col_map.get('cantidad', '')))
                        peso = parse_number(row_dict.get(col_map.get('peso', '')))
                        valor = parse_number(row_dict.get(col_map.get('valor', '')))
                        producto = normalize_name(row_dict.get(col_map.get('producto', '')))
                        destino = normalize_name(row_dict.get(col_map.get('destino', '')))
                        contenedor = str(row_dict.get(col_map.get('contenedor', '')) or '').strip().upper()

                        # Hash para duplicados
                        h = f'{nombre_productor}|{nombre_deposito}|{fecha.isoformat()}|{cantidad}|{peso}|{contenedor}'
                        if h in hashes:
                            duplicates += 1
                            continue
                        hashes.add(h)

                        operaciones.append({
                            'productor': nombre_productor,
                            'deposito': nombre_deposito,
                            'fecha': fecha.isoformat(),
                            'periodo': periodo,
                            'producto': producto or '',
                            'cantidad': cantidad,
                            'pesoKg': peso if peso else cantidad,
                            'valorUsd': valor,
                            'destino': destino or '',
                            'contenedor': contenedor,
                        })

                    except Exception as e:
                        errors += 1
                        if errors <= 5:
                            print(f'   ⚠️  Error fila {row_idx}: {e}')

                print(f'   Hoja "{sheet_name}": {sheet_rows} filas procesadas')

    # Escribir CSV
    print(f'\n💾 Escribiendo CSV: {output_csv}')
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['productor', 'deposito', 'fecha', 'periodo', 'producto', 'cantidad', 'pesoKg', 'valorUsd', 'destino', 'contenedor'])
        writer.writeheader()
        for op in operaciones:
            writer.writerow(op)

    print(f'\n✅ Procesamiento completado:')
    print(f'   Total filas: {total}')
    print(f'   Operaciones válidas: {len(operaciones)}')
    print(f'   Duplicados: {duplicates}')
    print(f'   Errores: {errors}')

    # Stats de productores y depósitos
    productores = set(op['productor'] for op in operaciones)
    depositos = set(op['deposito'] for op in operaciones)
    print(f'   Productores únicos: {len(productores)}')
    print(f'   Depósitos únicos: {len(depositos)}')
    print(f'   Depósitos: {", ".join(sorted(depositos)[:20])}')

    # Escribir stats a JSON
    with open('/tmp/process-stats.json', 'w') as f:
        json.dump({
            'total': total,
            'validas': len(operaciones),
            'duplicados': duplicates,
            'errores': errors,
            'productores': len(productores),
            'depositos': list(depositos),
            'hojas': wb.sheets if hasattr(wb, 'sheets') else [],
        }, f, indent=2)

if __name__ == '__main__':
    main()
