"""Configuración del proyecto guamini-agua."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

# --- Entorno -----------------------------------------------------------------
GEE_PROJECT = "TU-PROYECTO-GEE"      # el mismo que en mdp-costa
CARPETA_DRIVE = "guamini-agua"       # carpeta de Drive donde Earth Engine deja los CSV

# --- Rutas ---------------------------------------------------------------------
DATOS = RAIZ / "datos"
WEB_DATA = RAIZ / "web" / "data"
SERIE_CSV = DATOS / "guamini_agua_serie.csv"     # lo bajás de Drive después del paso 02
CASBAS_CSV = DATOS / "casbas_urbano.csv"

# --- Área de estudio -------------------------------------------------------------
# Opción A (recomendada): límite del IGN subido como asset a tu proyecto de GEE.
#   Ejemplo: "projects/TU-PROYECTO-GEE/assets/partido_guamini"
ASSET_PARTIDO = None
# Opción B (arranque rápido): FAO GAUL nivel 2, filtrando por este texto.
GAUL_TEXTO_PARTIDO = "Guamin"        # cubre "Guaminí" y "Guamini"
BUFFER_CONTEXTO_M = 10_000           # solo para el mapa: muestra lagunas vecinas

# Casbas, para la fase urbana (verificá el punto en el mapa)
CASBAS_LONLAT = (-62.502, -36.758)
CASBAS_RADIO_M = 3_000

# --- Serie temporal ----------------------------------------------------------------
ANIO_INICIO = 1984
ANIO_FIN = 2025            # último año completo
USAR_L7 = True             # Landsat 7 rellena 1999-2012, con bandas faltantes desde 2003

# --- Clasificación de agua ---------------------------------------------------------
UMBRAL_MNDWI = 0.0         # MNDWI > umbral = agua. Revisalo con 01_explorar.js
MIN_OBS = 6                # observaciones válidas mínimas por píxel y por año
FREC_MIN = 0.25            # agua en al menos el 25% de las observaciones del año
FREC_PERMANENTE = 0.75     # agua en al menos el 75%: agua permanente ese año
OCURRENCIA_LAGUNA = 50     # JRC Global Surface Water: >50% histórico = laguna "estable"

ESCALA_M = 30
