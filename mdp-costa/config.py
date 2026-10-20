"""Configuración del proyecto mdp-costa.

Todo lo que se ajusta a mano está acá. Los scripts no tienen valores sueltos.
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

# --- Entorno -----------------------------------------------------------------
# Carpeta donde clonaste CoastSat: git clone https://github.com/kvos/CoastSat
# CoastSat no se instala con pip: se usa desde el repo clonado.
COASTSAT_DIR = RAIZ.parent / "CoastSat"

# Proyecto de Google Earth Engine (gcloud config get-value project)
GEE_PROJECT = "TU-PROYECTO-GEE"

# --- Rutas ---------------------------------------------------------------------
DATOS = RAIZ / "datos"
SALIDAS = RAIZ / "salidas"            # imágenes, costas y series por tramo
WEB_DATA = RAIZ / "web" / "data"

TRAMOS_GEOJSON = DATOS / "tramos.geojson"   # polígonos de descarga (WGS84)
LINEAS_BASE = DATOS / "lineas_base"         # <tramo>.geojson, una línea por tramo (WGS84)
TRANSECTAS = DATOS / "transectas"           # <tramo>.geojson, se generan con 03

# --- Imágenes ------------------------------------------------------------------
FECHAS = ["1984-01-01", "2026-12-31"]
SATELITES = ["L5", "L7", "L8", "L9", "S2"]
EPSG = 32721  # WGS 84 / UTM 21S, metros

# Parámetros de detección de CoastSat (ver example.py del repo para el detalle)
SETTINGS_COASTSAT = {
    "cloud_thresh": 0.1,
    "dist_clouds": 300,
    "output_epsg": EPSG,
    "check_detection": False,   # True la primera vez para revisar imagen por imagen
    "adjust_detection": False,
    "save_figure": True,
    "min_beach_area": 1000,
    "min_length_sl": 500,
    "cloud_mask_issue": False,
    "sand_color": "default",
    "pan_off": False,
    "s2cloudless_prob": 40,
}
# Distancia máxima (m) a la costa de referencia para aceptar una detección
MAX_DIST_REF = 100

# --- Transectas ----------------------------------------------------------------
ESPACIADO_TRANSECTAS = 100   # m entre transectas
LARGO_TRANSECTAS = 500       # m desde la línea base hacia el mar
# Lado del mar respecto del sentido en que dibujaste la línea base.
# Si la dibujás de sur a norte por tierra, el mar queda a la derecha.
LADO_MAR = "derecha"

SETTINGS_TRANSECTAS = {
    "along_dist": 25,
    "min_points": 3,
    "max_std": 15,
    "max_range": 30,
    "min_chainage": -100,
    "multiple_inter": "auto",
    "auto_prc": 0.1,
}
SETTINGS_OUTLIERS = {
    "otsu_threshold": [-0.5, 0],
    "max_cross_change": 40,
    "plot_fig": False,
}

# --- Marea ---------------------------------------------------------------------
# CSV con columnas: dates (UTC, ISO) y tide (m, referido a nivel medio).
# Si el archivo no existe, la corrección se saltea y se avisa.
MAREAS_CSV = DATOS / "mareas.csv"
COTA_REFERENCIA = 0.0        # m, cota a la que se "lleva" la línea de costa
PENDIENTE_PLAYA = 0.05       # A CALIBRAR por tramo (ver README, fase 4)

# --- Análisis ------------------------------------------------------------------
# Períodos para las tasas. El refulado de 1998 sirve para validar Playa Grande.
PERIODOS = {
    "total": (1984, 2026),
    "pre_1998": (1984, 1997),
    "post_1998": (1999, 2026),
}
MIN_PUNTOS_ANIO = 3   # detecciones mínimas en un año para calcular la mediana anual
MIN_PUNTOS_TASA = 20  # detecciones mínimas en un período para calcular la tasa
