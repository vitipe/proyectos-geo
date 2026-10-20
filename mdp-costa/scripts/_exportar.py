"""Arma los archivos que consume el mapa web (web/data)."""
import json
from datetime import date

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, mapping

from _analisis import lineas_anuales
from _comun import config


def _redondear(coords, n=6):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(c, n) for c in coords]
    return [_redondear(c, n) for c in coords]


def _escribir_fc(gdf, ruta):
    gdf = gdf.to_crs(4326)
    feats = []
    for _, fila in gdf.iterrows():
        geom = mapping(fila.geometry)
        geom = {"type": geom["type"], "coordinates": _redondear(geom["coordinates"])}
        props = {k: (None if pd.isna(v) else v) for k, v in fila.drop("geometry").items()}
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False)


def exportar(nombres_tramos, carpeta_salidas, carpeta_transectas, demo=False):
    """Junta tendencias, transectas y medianas de todos los tramos para la web."""
    config.WEB_DATA.mkdir(parents=True, exist_ok=True)
    filas_trans, filas_lineas, series = [], [], {}
    anios = []

    for nombre in nombres_tramos:
        c = carpeta_salidas / nombre
        rutas = [carpeta_transectas / f"{nombre}.geojson", c / "tendencias.csv", c / "anual.csv"]
        if not all(r.exists() for r in rutas):
            print(f"[{nombre}] sin resultados completos, no se exporta.")
            continue

        trans = gpd.read_file(rutas[0]).to_crs(config.EPSG)
        tend = pd.read_csv(rutas[1])
        anual = pd.read_csv(rutas[2], index_col="anio")

        ancho = tend.pivot(index="transecta", columns="periodo", values="tasa_m_anio")
        ancho.columns = [f"tasa_{p}" for p in ancho.columns]
        r2 = tend[tend["periodo"] == "total"].set_index("transecta")["r2"].rename("r2_total")
        trans = trans.merge(ancho, left_on="name", right_index=True, how="left")
        trans = trans.merge(r2, left_on="name", right_index=True, how="left")
        trans["tramo"] = nombre
        filas_trans.append(trans)

        dict_trans = {r["name"]: list(r.geometry.coords) for _, r in trans.iterrows()}
        for anio, geom in lineas_anuales(anual, dict_trans):
            filas_lineas.append({"tramo": nombre, "anio": anio, "geometry": geom})
            anios.append(anio)

        for col in anual.columns:
            s = anual[col].dropna()
            series[col] = {"anios": [int(a) for a in s.index], "valores": [round(float(v), 1) for v in s]}

    if not filas_trans:
        print("Nada para exportar.")
        return

    _escribir_fc(pd.concat(filas_trans), config.WEB_DATA / "transectas.geojson")
    _escribir_fc(gpd.GeoDataFrame(filas_lineas, crs=config.EPSG), config.WEB_DATA / "costas_anuales.geojson")
    tramos = gpd.read_file(config.TRAMOS_GEOJSON)
    _escribir_fc(tramos[tramos["nombre"].isin(nombres_tramos)], config.WEB_DATA / "tramos.geojson")

    with open(config.WEB_DATA / "series.json", "w", encoding="utf-8") as f:
        json.dump(series, f)
    meta = {
        "demo": demo,
        "anio_min": min(anios),
        "anio_max": max(anios),
        "periodos": list(config.PERIODOS),
        "generado": date.today().isoformat(),
    }
    with open(config.WEB_DATA / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Datos web en {config.WEB_DATA}")


def transectas_a_gdf(transectas):
    return gpd.GeoDataFrame(
        {"name": list(transectas)},
        geometry=[LineString(c) for c in transectas.values()],
        crs=config.EPSG,
    )
