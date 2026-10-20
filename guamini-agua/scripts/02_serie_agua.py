"""Paso 2: serie anual de superficie de agua y lluvia del partido.

Uso:
    python scripts/02_serie_agua.py --verificar-partido   # lista nombres de GAUL
    python scripts/02_serie_agua.py --anio 2017            # prueba rápida de un año
    python scripts/02_serie_agua.py                        # exporta la serie completa a Drive

La exportación corre en los servidores de Earth Engine. Seguila en
https://code.earthengine.google.com/tasks y, cuando termine, bajá el CSV de la
carpeta de Drive a datos/guamini_agua_serie.csv.
"""
import argparse

from _gee import config, ee, fila_anual, iniciar, listar_partidos, partido

COLUMNAS = ["anio", "permanente_km2", "estacional_km2", "total_km2", "fuera_lagunas_km2",
            "cobertura_km2", "area_partido_km2", "lluvia_mm", "n_imagenes"]

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--verificar-partido", action="store_true")
p.add_argument("--anio", type=int, help="Calcula un solo año y lo muestra (sin exportar)")
args = p.parse_args()

iniciar()

if args.verificar_partido:
    listar_partidos()
    geom = partido()
    print(f"\nÁrea del partido seleccionado: {geom.area(100).divide(1e6).getInfo():.0f} km²")
    raise SystemExit

geom = partido()

if args.anio:
    props = fila_anual(args.anio, geom).getInfo()["properties"]
    for c in COLUMNAS:
        v = props.get(c)
        print(f"{c:20s} {v:.1f}" if isinstance(v, float) else f"{c:20s} {v}")
    raise SystemExit

anios = range(config.ANIO_INICIO, config.ANIO_FIN + 1)
fc = ee.FeatureCollection([fila_anual(a, geom) for a in anios])
tarea = ee.batch.Export.table.toDrive(
    collection=fc,
    description="guamini_agua_serie",
    folder=config.CARPETA_DRIVE,
    fileNamePrefix="guamini_agua_serie",
    fileFormat="CSV",
    selectors=COLUMNAS,
)
tarea.start()
print(f"Exportación iniciada ({len(anios)} años). Tarea: {tarea.id}")
print("Seguila en https://code.earthengine.google.com/tasks")
