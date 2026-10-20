"""Lógica de transectas, tendencias y líneas anuales.

Sin dependencias de CoastSat ni de Earth Engine, así se puede probar con datos
sintéticos (ver 00_demo_sintetico.py).
"""
import numpy as np
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point


# --- Transectas ------------------------------------------------------------------

def transectas_desde_linea(linea, espaciado, largo, lado="derecha", prefijo="T"):
    """Genera transectas perpendiculares a una línea base (coordenadas métricas).

    linea: shapely LineString dibujada por tierra, detrás de la playa.
    lado: dónde está el mar respecto del sentido de la línea ("derecha" o "izquierda").
    Devuelve {nombre: np.array([[x0, y0], [x1, y1]])} con el origen en tierra,
    el formato que usa CoastSat.
    """
    if lado not in ("derecha", "izquierda"):
        raise ValueError("lado debe ser 'derecha' o 'izquierda'")
    signo = 1 if lado == "derecha" else -1
    paso = min(espaciado / 2, linea.length / 4)
    transectas = {}
    distancias = np.arange(0, linea.length + 1e-6, espaciado)
    for i, d in enumerate(distancias):
        p = linea.interpolate(d)
        a = linea.interpolate(max(d - paso, 0))
        b = linea.interpolate(min(d + paso, linea.length))
        tx, ty = b.x - a.x, b.y - a.y
        norma = np.hypot(tx, ty)
        if norma == 0:
            continue
        tx, ty = tx / norma, ty / norma
        # normal a la derecha del sentido de avance: (ty, -tx)
        nx, ny = signo * ty, -signo * tx
        transectas[f"{prefijo}{i:03d}"] = np.array(
            [[p.x, p.y], [p.x + nx * largo, p.y + ny * largo]]
        )
    return transectas


# --- Series y tendencias ---------------------------------------------------------

def anio_decimal(fechas):
    """Fechas -> año decimal (1998.5 = mitad de 1998), como array de numpy."""
    fechas = pd.DatetimeIndex(pd.to_datetime(fechas, utc=True))
    largo_anio = np.where(fechas.is_leap_year, 366.0, 365.0)
    return np.asarray(fechas.year + (fechas.dayofyear - 1) / largo_anio, dtype=float)


def leer_series(ruta_csv):
    """Lee el CSV de series (columna dates + una columna por transecta)."""
    df = pd.read_csv(ruta_csv)
    df["dates"] = pd.to_datetime(df["dates"], utc=True)
    return df


def columnas_transectas(df):
    return [c for c in df.columns if c not in ("dates", "satname")]


def medianas_anuales(df, min_puntos):
    """Tabla anio x transecta con la mediana de las detecciones de cada año."""
    cols = columnas_transectas(df)
    anios = df["dates"].dt.year
    agrupado = df[cols].groupby(anios)
    mediana = agrupado.median()
    cuenta = agrupado.count()
    mediana = mediana.where(cuenta >= min_puntos)
    mediana.index.name = "anio"
    return mediana


def tendencias(df, periodos, min_puntos):
    """Tasa de cambio (m/año) por transecta y período, por regresión lineal.

    Valores positivos: la costa avanza hacia el mar (acumulación).
    Valores negativos: retrocede (erosión).
    """
    cols = columnas_transectas(df)
    t = anio_decimal(df["dates"])
    filas = []
    for nombre, (desde, hasta) in periodos.items():
        en_periodo = (t >= desde) & (t < hasta + 1)
        for col in cols:
            y = df[col].to_numpy(dtype=float)
            ok = en_periodo & ~np.isnan(y)
            n = int(ok.sum())
            fila = {"transecta": col, "periodo": nombre, "n": n,
                    "tasa_m_anio": np.nan, "r2": np.nan}
            if n >= min_puntos:
                x = np.asarray(t[ok], dtype=float)
                pendiente, ordenada = np.polyfit(x, y[ok], 1)
                pred = pendiente * x + ordenada
                ss_res = np.sum((y[ok] - pred) ** 2)
                ss_tot = np.sum((y[ok] - y[ok].mean()) ** 2)
                fila["tasa_m_anio"] = round(float(pendiente), 3)
                fila["r2"] = round(float(1 - ss_res / ss_tot), 3) if ss_tot > 0 else np.nan
            filas.append(fila)
    return pd.DataFrame(filas)


# --- Geometrías para el mapa -----------------------------------------------------

def punto_en_transecta(transecta, distancia):
    """Punto a `distancia` metros del origen, sobre la dirección de la transecta."""
    (x0, y0), (x1, y1) = transecta
    largo = np.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / largo, (y1 - y0) / largo
    return Point(x0 + ux * distancia, y0 + uy * distancia)


def lineas_anuales(medianas, transectas):
    """Une las posiciones medianas de cada año en una línea de costa.

    Corta la línea donde falta dato en una transecta, para no inventar tramos.
    Devuelve lista de (anio, MultiLineString).
    """
    nombres = sorted(n for n in transectas if n in medianas.columns)
    resultado = []
    for anio, fila in medianas.iterrows():
        partes, actual = [], []
        for n in nombres:
            d = fila[n]
            if np.isnan(d):
                if len(actual) >= 2:
                    partes.append(LineString(actual))
                actual = []
                continue
            p = punto_en_transecta(transectas[n], d)
            actual.append((p.x, p.y))
        if len(actual) >= 2:
            partes.append(LineString(actual))
        if partes:
            resultado.append((int(anio), MultiLineString(partes)))
    return resultado
