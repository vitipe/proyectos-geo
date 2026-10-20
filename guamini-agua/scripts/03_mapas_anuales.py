"""Paso 3: una imagen PNG por año con el agua permanente y estacional, para la web.

Uso:
    python scripts/03_mapas_anuales.py                 # todos los años
    python scripts/03_mapas_anuales.py --anio 2017     # uno solo

Las imágenes salen en EPSG:3857 (la proyección del mapa web) y cubren el
partido más un buffer, para que se vean las lagunas vecinas.
"""
import argparse
import json
import urllib.request

from _gee import clases_anuales, config, contexto, iniciar, partido

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--anio", type=int, nargs="*")
p.add_argument("--ancho", type=int, default=1400, help="Ancho en píxeles de cada PNG")
args = p.parse_args()

iniciar()
config.WEB_DATA.mkdir(parents=True, exist_ok=True)

geom_partido = partido()
geom_ctx = contexto()
region = geom_ctx.bounds()

# Límites para Leaflet: [[sur, oeste], [norte, este]]
anillo = region.coordinates().getInfo()[0]
lons, lats = [c[0] for c in anillo], [c[1] for c in anillo]
limites = [[min(lats), min(lons)], [max(lats), max(lons)]]
with open(config.WEB_DATA / "limites.json", "w") as f:
    json.dump(limites, f)

contorno = geom_partido.simplify(100).getInfo()
with open(config.WEB_DATA / "partido.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"nombre": "Guaminí"}, "geometry": contorno}]}, f)

anios = args.anio or range(config.ANIO_INICIO, config.ANIO_FIN + 1)
for anio in anios:
    img, _ = clases_anuales(anio, geom_ctx)
    clase = img.select("estacional").add(img.select("permanente").multiply(2)).selfMask().clip(geom_ctx)
    url = clase.getThumbURL({
        "region": region,
        "dimensions": args.ancho,
        "crs": "EPSG:3857",
        "format": "png",
        "min": 1,
        "max": 2,
        "palette": ["8ecae6", "1d4e89"],   # estacional, permanente
    })
    destino = config.WEB_DATA / f"agua_{anio}.png"
    urllib.request.urlretrieve(url, destino)
    print(f"{anio} -> {destino.name}")
