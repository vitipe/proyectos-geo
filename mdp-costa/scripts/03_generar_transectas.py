"""Paso 3: generar transectas perpendiculares a la línea base de cada tramo.

Antes: dibujá en geojson.io una línea por tierra, detrás de la playa, y guardala
como datos/lineas_base/<tramo>.geojson. Dibujala de sur a norte (el mar queda a
la derecha) o cambiá LADO_MAR en config.py.

Uso:
    python scripts/03_generar_transectas.py --tramo playa_grande
"""
import geopandas as gpd
from shapely.geometry import LineString

from _analisis import transectas_desde_linea
from _comun import argumentos, config, elegir_tramos

args = argumentos(__doc__)
config.TRANSECTAS.mkdir(parents=True, exist_ok=True)

for nombre in elegir_tramos(args):
    ruta_linea = config.LINEAS_BASE / f"{nombre}.geojson"
    if not ruta_linea.exists():
        print(f"[{nombre}] falta {ruta_linea}: dibujala primero.")
        continue

    linea = gpd.read_file(ruta_linea).to_crs(config.EPSG)
    geom = linea.geometry.iloc[0]
    if geom.geom_type == "MultiLineString":
        geom = max(geom.geoms, key=lambda g: g.length)

    transectas = transectas_desde_linea(
        geom, config.ESPACIADO_TRANSECTAS, config.LARGO_TRANSECTAS,
        lado=config.LADO_MAR, prefijo=f"{nombre}_",
    )
    gdf = gpd.GeoDataFrame(
        {"name": list(transectas)},
        geometry=[LineString(c) for c in transectas.values()],
        crs=config.EPSG,
    )
    salida = config.TRANSECTAS / f"{nombre}.geojson"
    gdf.to_file(salida, driver="GeoJSON")
    print(f"[{nombre}] {len(gdf)} transectas -> {salida}")
    print("  Abrilas en QGIS o geojson.io y verificá que arranquen en tierra y crucen la playa.")
