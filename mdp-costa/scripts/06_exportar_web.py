"""Paso 6: exportar resultados de todos los tramos al mapa web (web/data).

Uso:
    python scripts/06_exportar_web.py
    python scripts/06_exportar_web.py --tramo playa_grande centro
"""
from _comun import argumentos, config, elegir_tramos
from _exportar import exportar

args = argumentos(__doc__)
exportar(list(elegir_tramos(args)), config.SALIDAS, config.TRANSECTAS)
