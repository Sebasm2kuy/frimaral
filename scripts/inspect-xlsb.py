#!/usr/bin/env python3
"""Inspecciona las primeras filas de cada hoja del XLSB para encontrar los headers reales."""
import sys
from pyxlsb import open_workbook

xlsb_path = sys.argv[1]

with open_workbook(xlsb_path) as wb:
    for sheet_name in wb.sheets:
        print(f'\n=== Hoja: {sheet_name} ===')
        with wb.get_sheet(sheet_name) as sheet:
            for i, row in enumerate(sheet.rows()):
                if i >= 5:
                    break
                vals = [str(c.v)[:30] if c.v else '—' for c in row[:20]]
                print(f'  Fila {i}: {vals}')
