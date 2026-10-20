"""Demo: genera datos SINTÉTICOS para ver el mapa web funcionando sin Earth Engine.

No usa imágenes reales. Sirve para probar el circuito transectas -> series ->
tendencias -> mapa, y para trabajar el diseño del mapa mientras tanto.

Uso:
    python scripts/00_demo_sintetico.py
    (desde la raíz) python armar_sitio.py && python -m http.server 8000 -d _site
"""
import geopandas as gpd
import numpy as np
import pandas as pd

from _analisis import leer_series, medianas_anuales, tendencias, transectas_desde_linea
from _comun import RAIZ, config
from _exportar import exportar, transectas_a_gdf

TRAMO = "centro"
SALIDAS_DEMO = RAIZ / "salidas_demo"
TRANSECTAS_DEMO = SALIDAS_DEMO / "transectas"
rng = np.random.default_rng(42)

linea = gpd.read_file(config.LINEAS_BASE / "_ejemplo_centro.geojson").to_crs(config.EPSG).geometry.iloc[0]
transectas = transectas_desde_linea(linea, config.ESPACIADO_TRANSECTAS, config.LARGO_TRANSECTAS,
                                    lado=config.LADO_MAR, prefijo=f"{TRAMO}_")
TRANSECTAS_DEMO.mkdir(parents=True, exist_ok=True)
transectas_a_gdf(transectas).to_file(TRANSECTAS_DEMO / f"{TRAMO}.geojson", driver="GeoJSON")

# Una "imagen" cada ~16 días, con huecos por nubes
fechas = pd.date_range("1984-03-01", "2026-06-30", freq="16D", tz="UTC")
fechas = fechas[rng.random(len(fechas)) > 0.45]
t = np.asarray(fechas.year + fechas.dayofyear / 365.25, dtype=float)

df = pd.DataFrame({"dates": fechas, "satname": "DEMO"})
n = len(transectas)
for i, nombre in enumerate(transectas):
    base = 180 + 25 * np.sin(i / 3)
    tasa = -0.6 + 0.9 * (i / n)                               # erosión al sur, leve avance al norte
    refulado = np.where(t >= 1998.5, 45 * np.exp(-(t - 1998.5) / 8), 0)  # pulso de arena en 1998
    estacional = 8 * np.sin(2 * np.pi * t)
    ruido = rng.normal(0, 9, len(t))
    serie = base + tasa * (t - 1984) + refulado + estacional + ruido
    serie[rng.random(len(t)) < 0.1] = np.nan
    df[nombre] = np.round(serie, 2)

carpeta = SALIDAS_DEMO / TRAMO
carpeta.mkdir(parents=True, exist_ok=True)
df.to_csv(carpeta / "series.csv", index=False)

df = leer_series(carpeta / "series.csv")
tendencias(df, config.PERIODOS, config.MIN_PUNTOS_TASA).to_csv(carpeta / "tendencias.csv", index=False)
medianas_anuales(df, config.MIN_PUNTOS_ANIO).round(2).to_csv(carpeta / "anual.csv")

exportar([TRAMO], SALIDAS_DEMO, TRANSECTAS_DEMO, demo=True)
print("Listo. Desde la raíz: python armar_sitio.py && python -m http.server 8000 -d _site")
