"""Paso 4: cruzar costas y transectas, limpiar valores atípicos y corregir por marea.

Uso:
    python scripts/04_series.py --tramo playa_grande

Salida: salidas/<tramo>/series.csv (fecha + distancia en m por transecta).
"""
import pickle
from datetime import timezone

import numpy as np
import pandas as pd

from _comun import argumentos, carpeta_tramo, config, elegir_tramos, usar_coastsat

args = argumentos(__doc__)
usar_coastsat()
from coastsat import SDS_tools, SDS_transects  # noqa: E402


def leer_mareas():
    if not config.MAREAS_CSV.exists():
        return None
    df = pd.read_csv(config.MAREAS_CSV)
    fechas = pd.to_datetime(df["dates"], utc=True)
    return [f.to_pydatetime() for f in fechas], df["tide"].to_numpy(dtype=float)


mareas = leer_mareas()
if mareas is None:
    print(f"Sin {config.MAREAS_CSV.name}: series SIN corrección por marea (ver README, fase 4).")

for nombre in elegir_tramos(args):
    carpeta = carpeta_tramo(nombre)
    ruta_output = carpeta / "output_limpio.pkl"
    ruta_trans = config.TRANSECTAS / f"{nombre}.geojson"
    if not ruta_output.exists() or not ruta_trans.exists():
        print(f"[{nombre}] faltan pasos previos (02 y 03).")
        continue

    with open(ruta_output, "rb") as f:
        output = pickle.load(f)
    transectas = SDS_tools.transects_from_geojson(str(ruta_trans))

    cross = SDS_transects.compute_intersection_QC(output, transectas, config.SETTINGS_TRANSECTAS)
    cross = SDS_transects.reject_outliers(cross, output, config.SETTINGS_OUTLIERS)

    fechas = [d if d.tzinfo else d.replace(tzinfo=timezone.utc) for d in output["dates"]]
    if mareas is not None:
        marea_img = SDS_tools.get_closest_datapoint(fechas, *mareas)
        correccion = (marea_img - config.COTA_REFERENCIA) / config.PENDIENTE_PLAYA
        cross = {k: v + correccion for k, v in cross.items()}

    df = pd.DataFrame({"dates": fechas, "satname": output["satname"]})
    for k, v in cross.items():
        df[k] = np.round(v, 2)
    df.to_csv(carpeta / "series.csv", index=False)
    print(f"[{nombre}] {len(df)} fechas x {len(cross)} transectas -> {carpeta / 'series.csv'}")
