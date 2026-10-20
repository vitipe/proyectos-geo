"""Paso 2: detectar la línea de costa en cada imagen descargada.

Uso:
    python scripts/02_extraer_costas.py --tramo playa_grande --jpg     # primera vez: genera JPG para revisar
    python scripts/02_extraer_costas.py --tramo playa_grande --revisar # valida detección por detección
    python scripts/02_extraer_costas.py                                # corrida en lote

La primera corrida de cada tramo pide dibujar una costa de referencia sobre una
imagen. Queda guardada y las corridas siguientes la reutilizan.
"""
import pickle

from pyproj import CRS

from _comun import argumentos, carpeta_tramo, config, elegir_tramos, inputs_tramo, usar_coastsat


def extra(p):
    p.add_argument("--jpg", action="store_true", help="Guarda JPG preprocesados y un GIF")
    p.add_argument("--revisar", action="store_true", help="Muestra cada detección para aceptarla o no")


args = argumentos(__doc__, extra)

usar_coastsat()
from coastsat import SDS_download, SDS_preprocess, SDS_shoreline, SDS_tools  # noqa: E402

for nombre, poligono in elegir_tramos(args).items():
    print(f"\n=== {nombre} ===")
    inputs = inputs_tramo(nombre, poligono, SDS_tools.smallest_rectangle)
    metadata = SDS_download.get_metadata(inputs)

    settings = dict(config.SETTINGS_COASTSAT, inputs=inputs)
    if args.revisar:
        settings["check_detection"] = True

    if args.jpg:
        SDS_preprocess.save_jpg(metadata, settings, use_matplotlib=True)

    settings["reference_shoreline"] = SDS_preprocess.get_reference_sl(metadata, settings)
    settings["max_dist_ref"] = config.MAX_DIST_REF

    output = SDS_shoreline.extract_shorelines(metadata, settings)
    output = SDS_tools.remove_duplicates(output)
    output = SDS_tools.remove_inaccurate_georef(output, 10)

    salida = carpeta_tramo(nombre)
    with open(salida / "output_limpio.pkl", "wb") as f:
        pickle.dump(output, f)

    gdf = SDS_tools.output_to_gdf(output, "lines")
    if gdf is None:
        print("Sin costas detectadas: revisá el polígono y los parámetros.")
        continue
    gdf.crs = CRS(config.EPSG)
    gdf.to_file(salida / "costas.geojson", driver="GeoJSON", encoding="utf-8")
    print(f"{len(output['dates'])} costas guardadas en {salida}")
