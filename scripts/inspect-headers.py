#!/usr/bin/env python3
"""Inspecciona TODAS las columnas de la fila 3 (headers reales) de cada hoja."""
import sys
from pyxlsb import open_workbook

xlsb_path = sys.argv[1]

with open_workbook(xlsb_path) as wb:
    for sheet_name in wb.sheets:
        print(f'\n=== Hoja: {sheet_name} ===')
        with wb.get_sheet(sheet_name) as sheet:
            for i, row in enumerate(sheet.rows()):
                if i == 3:
                    # Headers reales
                    headers = [str(c.v).strip() if c.v else '' for c in row]
                    print(f'Headers ({len(headers)} columnas):')
                    for j, h in enumerate(headers):
                        if h:
                            print(f'  [{j}] {h}')
                if i == 4:
                    # Primera fila de datos
                    print(f'\nPrimera fila de datos:')
                    for j, c in enumerate(row):
                        if c.v is not None:
                            print(f'  [{j}] {c.v}')
                    break
