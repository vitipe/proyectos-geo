"""Funciones de Earth Engine compartidas: área de estudio, Landsat y agua."""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

import config  # noqa: E402
import ee  # noqa: E402

BANDAS_L57 = ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7"]
BANDAS_L89 = ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"]
NOMBRES = ["blue", "green", "red", "nir", "swir1", "swir2"]


def iniciar():
    try:
        ee.Initialize(project=config.GEE_PROJECT)
    except Exception:
        ee.Authenticate()
        ee.Initialize(project=config.GEE_PROJECT)


# --- Área de estudio -------------------------------------------------------------

def _gaul_buenos_aires():
    return (ee.FeatureCollection("FAO/GAUL/2015/level2")
            .filter(ee.Filter.eq("ADM0_NAME", "Argentina"))
            .filter(ee.Filter.eq("ADM1_NAME", "Buenos Aires")))


def partido():
    """Geometría del partido: asset del IGN si está configurado, si no FAO GAUL."""
    if config.ASSET_PARTIDO:
        return ee.FeatureCollection(config.ASSET_PARTIDO).geometry()
    fc = _gaul_buenos_aires().filter(
        ee.Filter.stringContains("ADM2_NAME", config.GAUL_TEXTO_PARTIDO))
    return fc.geometry()


def contexto():
    """Partido más un buffer, para mostrar lagunas vecinas en el mapa."""
    return partido().buffer(config.BUFFER_CONTEXTO_M, 100)


def listar_partidos():
    """Imprime los nombres de GAUL para verificar el filtro."""
    nombres = _gaul_buenos_aires().aggregate_array("ADM2_NAME").getInfo()
    print("\n".join(sorted(nombres)))


# --- Landsat Collection 2, nivel 2 ----------------------------------------------------

def _preparar(bandas):
    def f(img):
        qa = img.select("QA_PIXEL")
        nubes = (qa.bitwiseAnd(1 << 1).neq(0)          # nube dilatada
                 .Or(qa.bitwiseAnd(1 << 3).neq(0))     # nube
                 .Or(qa.bitwiseAnd(1 << 4).neq(0))     # sombra de nube
                 .Or(qa.bitwiseAnd(1 << 5).neq(0)))    # nieve
        saturado = img.select("QA_RADSAT").neq(0)
        sr = img.select(bandas, NOMBRES).multiply(0.0000275).add(-0.2)
        sr = sr.updateMask(nubes.Not()).updateMask(saturado.Not())
        return ee.Image(sr.copyProperties(img, ["system:time_start", "SPACECRAFT_ID"]))
    return f


def landsat(inicio, fin, geom):
    """Landsat 5, 7, 8 y 9 armonizados a nombres comunes de bandas."""
    fuentes = [("LANDSAT/LT05/C02/T1_L2", BANDAS_L57),
               ("LANDSAT/LC08/C02/T1_L2", BANDAS_L89),
               ("LANDSAT/LC09/C02/T1_L2", BANDAS_L89)]
    if config.USAR_L7:
        # Sin L7, 2012 queda vacío: L5 terminó en 2011 y L8 empezó en 2013
        fuentes.insert(1, ("LANDSAT/LE07/C02/T1_L2", BANDAS_L57))
    col = None
    for cid, bandas in fuentes:
        c = (ee.ImageCollection(cid).filterBounds(geom)
             .filterDate(inicio, fin).map(_preparar(bandas)))
        col = c if col is None else col.merge(c)
    return col


# --- Agua ----------------------------------------------------------------------

def mndwi(img):
    return img.normalizedDifference(["green", "swir1"]).rename("mndwi")


def frecuencia_agua(anio, geom):
    """Fracción de observaciones válidas del año en que cada píxel fue agua."""
    col = landsat(f"{anio}-01-01", f"{anio + 1}-01-01", geom)
    agua = col.map(lambda img: mndwi(img).gt(config.UMBRAL_MNDWI).rename("agua"))
    n_obs = agua.count().unmask(0).rename("n_obs")
    n_agua = agua.sum().unmask(0)
    frec = (n_agua.divide(n_obs.max(1)).rename("frecuencia")
            .updateMask(n_obs.gte(config.MIN_OBS)))
    return frec, n_obs, col.size()


def clases_anuales(anio, geom):
    """Bandas 0/1: permanente, estacional, total, fuera_lagunas y cobertura."""
    frec, n_obs, n_img = frecuencia_agua(anio, geom)
    total = frec.gte(config.FREC_MIN)
    permanente = frec.gte(config.FREC_PERMANENTE)
    estacional = total.And(permanente.Not())
    laguna_hist = (ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
                   .gte(config.OCURRENCIA_LAGUNA).unmask(0))
    fuera = total.And(laguna_hist.Not())
    cobertura = n_obs.gte(config.MIN_OBS)
    img = ee.Image.cat([
        permanente.rename("permanente"),
        estacional.rename("estacional"),
        total.rename("total"),
        fuera.rename("fuera_lagunas"),
        cobertura.rename("cobertura"),
    ]).unmask(0)
    return img, n_img


def lluvia_anual(anio, geom):
    """Lluvia anual media del área (mm), CHIRPS diario."""
    return (ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
            .filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
            .select("precipitation").sum()
            .reduceRegion(ee.Reducer.mean(), geom, 5000, maxPixels=1e9)
            .get("precipitation"))


def fila_anual(anio, geom):
    """Un ee.Feature con las superficies (km²) y la lluvia de un año."""
    img, n_img = clases_anuales(anio, geom)
    areas = (img.multiply(ee.Image.pixelArea()).divide(1e6)
             .reduceRegion(reducer=ee.Reducer.sum(), geometry=geom,
                           scale=config.ESCALA_M, maxPixels=1e11, tileScale=4))
    return ee.Feature(None, {
        "anio": anio,
        "permanente_km2": areas.get("permanente"),
        "estacional_km2": areas.get("estacional"),
        "total_km2": areas.get("total"),
        "fuera_lagunas_km2": areas.get("fuera_lagunas"),
        "cobertura_km2": areas.get("cobertura"),
        "area_partido_km2": geom.area(100).divide(1e6),
        "lluvia_mm": lluvia_anual(anio, geom),
        "n_imagenes": n_img,
    })
