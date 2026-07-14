#!/usr/bin/env python3
"""Inspecciona las primeras 10 filas de la hoja Registros."""
import sys
from pyxlsb import open_workbook

xlsb_path = sys.argv[1]

with open_workbook(xlsb_path) as wb:
    with wb.get_sheet('Registros') as sheet:
        for i, row in enumerate(sheet.rows()):
            if i >= 10:
                break
            # Solo mostrar columnas no vacías
            vals = []
            for j, c in enumerate(row):
                if c.v is not None and str(c.v).strip():
                    vals.append(f'[{j}]{str(c.v)[:40]}')
            print(f'Fila {i}: {vals}')
