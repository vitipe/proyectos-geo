"""Paso 1: consultar y descargar imágenes de cada tramo desde Earth Engine.

Uso:
    python scripts/01_descargar.py --solo-chequear          # cuántas imágenes hay
    python scripts/01_descargar.py --tramo playa_grande     # descarga un tramo
    python scripts/01_descargar.py                          # descarga todos
"""
from _comun import argumentos, config, elegir_tramos, inputs_tramo, usar_coastsat

args = argumentos(
    __doc__,
    lambda p: p.add_argument("--solo-chequear", action="store_true",
                             help="Solo lista imágenes disponibles, no descarga"),
)

usar_coastsat()
from coastsat import SDS_download, SDS_tools  # noqa: E402

SDS_download.authenticate_and_initialize(config.GEE_PROJECT)

for nombre, poligono in elegir_tramos(args).items():
    print(f"\n=== {nombre} ===")
    inputs = inputs_tramo(nombre, poligono, SDS_tools.smallest_rectangle)
    SDS_download.check_images_available(inputs)
    if not args.solo_chequear:
        SDS_download.retrieve_images(inputs)
