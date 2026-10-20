"""Paso 5: tasas de cambio por transecta y medianas anuales.

Uso:
    python scripts/05_tendencias.py --tramo playa_grande

Salidas en salidas/<tramo>/:
    tendencias.csv   tasa (m/año), n y r2 por transecta y período
    anual.csv        mediana anual de la posición por transecta
"""
from _analisis import leer_series, medianas_anuales, tendencias
from _comun import argumentos, carpeta_tramo, config, elegir_tramos

args = argumentos(__doc__)

for nombre in elegir_tramos(args):
    carpeta = carpeta_tramo(nombre)
    ruta = carpeta / "series.csv"
    if not ruta.exists():
        print(f"[{nombre}] falta series.csv (paso 04).")
        continue
    df = leer_series(ruta)

    tend = tendencias(df, config.PERIODOS, config.MIN_PUNTOS_TASA)
    tend.to_csv(carpeta / "tendencias.csv", index=False)
    medianas_anuales(df, config.MIN_PUNTOS_ANIO).round(2).to_csv(carpeta / "anual.csv")

    total = tend[tend["periodo"] == "total"]["tasa_m_anio"].dropna()
    if len(total):
        print(f"[{nombre}] tasa total: mediana {total.median():.2f} m/año "
              f"(mín {total.min():.2f}, máx {total.max():.2f}) en {len(total)} transectas")
