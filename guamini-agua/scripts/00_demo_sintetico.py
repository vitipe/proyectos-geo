"""Demo: datos SINTÉTICOS para ver el mapa web sin Earth Engine.

Inventa lagunas que crecen en años húmedos y se achican en años secos.
No son mediciones; sirve para trabajar el mapa mientras tanto.

Uso:
    python scripts/00_demo_sintetico.py
    (desde la raíz) python armar_sitio.py && python -m http.server 8000 -d _site
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module  # noqa: E402

graficos = import_module("04_graficos")
config = graficos.config
rng = np.random.default_rng(7)

# Área aproximada (solo para la demo)
S, O, N, E = -37.45, -63.05, -36.55, -61.95
config.WEB_DATA.mkdir(parents=True, exist_ok=True)
with open(config.WEB_DATA / "limites.json", "w") as f:
    json.dump([[S, O], [N, E]], f)
rect = [[-62.95, -37.35], [-62.05, -37.35], [-62.05, -36.65], [-62.95, -36.65], [-62.95, -37.35]]
with open(config.WEB_DATA / "partido.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": [{"type": "Feature",
               "properties": {"nombre": "Partido (demo)"},
               "geometry": {"type": "Polygon", "coordinates": [rect]}}]}, f)

anios = np.arange(config.ANIO_INICIO, config.ANIO_FIN + 1)
humedad = (0.5 + 0.35 * np.exp(-((anios - 1986) / 2.5) ** 2) + 0.45 * np.exp(-((anios - 2002) / 2) ** 2)
           + 0.4 * np.exp(-((anios - 2017) / 1.5) ** 2) - 0.3 * np.exp(-((anios - 2009) / 1.5) ** 2)
           - 0.35 * np.exp(-((anios - 2023) / 1.2) ** 2) + rng.normal(0, 0.05, len(anios)))

ancho, alto = 700, 580
yy, xx = np.mgrid[0:alto, 0:ancho]
lagunas = [(0.45, 0.62, 60, 30), (0.62, 0.55, 45, 22), (0.30, 0.48, 35, 18), (0.75, 0.35, 28, 14)]
filas = []
for anio, h in zip(anios, humedad):
    perm = np.zeros((alto, ancho), bool)
    est = np.zeros((alto, ancho), bool)
    for cx, cy, rx, ry in lagunas:
        d = ((xx - cx * ancho) / (rx * h)) ** 2 + ((yy - cy * alto) / (ry * h)) ** 2
        perm |= d < 1
        est |= (d >= 1) & (d < 1.6 + h)
    charcos = rng.random((alto // 10, ancho // 10)) < 0.02 * h ** 3
    est |= np.kron(charcos, np.ones((10, 10), bool))[:alto, :ancho] & ~perm
    rgba = np.zeros((alto, ancho, 4))
    rgba[est] = [0x8e / 255, 0xca / 255, 0xe6 / 255, 1]
    rgba[perm] = [0x1d / 255, 0x4e / 255, 0x89 / 255, 1]
    plt.imsave(config.WEB_DATA / f"agua_{anio}.png", rgba)
    km2_px = 0.02
    filas.append({"anio": anio, "permanente_km2": perm.sum() * km2_px, "estacional_km2": est.sum() * km2_px,
                  "fuera_lagunas_km2": est.sum() * km2_px * 0.6, "cobertura_km2": 4800 * (0.8 if anio == 2012 else 1),
                  "area_partido_km2": 4800, "lluvia_mm": 650 + 450 * (h - 0.5) + rng.normal(0, 60)})

df = graficos.preparar(pd.DataFrame(filas))
graficos.exportar_web(df, demo=True)
graficos.graficar(df, config.DATOS / "agua_vs_lluvia_DEMO.png")
print("Listo. Desde la raíz: python armar_sitio.py && python -m http.server 8000 -d _site")
