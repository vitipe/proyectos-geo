"""Fase 2: crecimiento de la superficie construida alrededor de Casbas.

Usa GHSL (JRC/GHSL/P2023A/GHS_BUILT_S), superficie construida cada 5 años
desde 1975, en celdas de 100 m. Antes de correrlo, confirmá el nombre del
dataset y de la banda en el catálogo de Earth Engine. Las épocas 2025 y 2030
son proyecciones, por eso el script corta en 2020.

Uso:
    python scripts/05_casbas_urbano.py
"""
import csv

from _gee import config, ee, iniciar

DATASET = "JRC/GHSL/P2023A/GHS_BUILT_S"
BANDA = "built_surface"
EPOCAS = range(1975, 2021, 5)

iniciar()
zona = ee.Geometry.Point(list(config.CASBAS_LONLAT)).buffer(config.CASBAS_RADIO_M)

filas = []
for anio in EPOCAS:
    img = ee.Image(f"{DATASET}/{anio}").select(BANDA)
    m2 = img.reduceRegion(ee.Reducer.sum(), zona, 100, maxPixels=1e9).get(BANDA).getInfo()
    filas.append({"anio": anio, "construido_ha": round((m2 or 0) / 1e4, 1)})
    print(f"{anio}: {filas[-1]['construido_ha']} ha")

config.DATOS.mkdir(parents=True, exist_ok=True)
with open(config.CASBAS_CSV, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["anio", "construido_ha"])
    w.writeheader()
    w.writerows(filas)
print(f"-> {config.CASBAS_CSV}")
