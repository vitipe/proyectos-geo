"""Utilidades compartidas por los scripts numerados."""
import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402


def usar_coastsat():
    """Agrega el repo clonado de CoastSat al path de Python."""
    carpeta = Path(config.COASTSAT_DIR)
    if not (carpeta / "coastsat").is_dir():
        sys.exit(
            f"No encuentro CoastSat en {carpeta}.\n"
            "Clonalo con: git clone https://github.com/kvos/CoastSat\n"
            "y ajustá COASTSAT_DIR en config.py."
        )
    sys.path.insert(0, str(carpeta))


def leer_tramos():
    """Devuelve {nombre: polígono} desde tramos.geojson (formato CoastSat)."""
    with open(config.TRAMOS_GEOJSON, encoding="utf-8") as f:
        fc = json.load(f)
    tramos = {}
    for feat in fc["features"]:
        nombre = feat["properties"]["nombre"]
        tramos[nombre] = feat["geometry"]["coordinates"]
    return tramos


def argumentos(descripcion, extra=None):
    """Parser común: --tramo para elegir uno o varios tramos."""
    p = argparse.ArgumentParser(description=descripcion)
    p.add_argument("--tramo", nargs="*", help="Tramos a procesar (por defecto, todos)")
    if extra:
        extra(p)
    return p.parse_args()


def elegir_tramos(args):
    tramos = leer_tramos()
    if args.tramo:
        faltan = set(args.tramo) - set(tramos)
        if faltan:
            sys.exit(f"Tramos inexistentes: {', '.join(sorted(faltan))}. Hay: {', '.join(tramos)}")
        return {k: tramos[k] for k in args.tramo}
    return tramos


def inputs_tramo(nombre, poligono, smallest_rectangle):
    """Arma el diccionario inputs que espera CoastSat."""
    return {
        "polygon": smallest_rectangle(poligono),
        "dates": config.FECHAS,
        "sat_list": config.SATELITES,
        "sitename": nombre,
        "filepath": str(config.SALIDAS),
    }


def carpeta_tramo(nombre):
    p = Path(config.SALIDAS) / nombre
    p.mkdir(parents=True, exist_ok=True)
    return p
