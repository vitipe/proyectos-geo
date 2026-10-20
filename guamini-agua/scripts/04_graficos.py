"""Paso 4: gráfico de agua vs. lluvia y datos de la serie para la web.

Uso (después de bajar el CSV de Drive a datos/):
    python scripts/04_graficos.py
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def preparar(df):
    df = df.sort_values("anio").reset_index(drop=True)
    df["cobertura_pct"] = 100 * df["cobertura_km2"] / df["area_partido_km2"]
    return df


def exportar_web(df, demo=False):
    config.WEB_DATA.mkdir(parents=True, exist_ok=True)
    serie = {
        "demo": demo,
        "anios": df["anio"].astype(int).tolist(),
        "permanente_km2": df["permanente_km2"].round(1).tolist(),
        "estacional_km2": df["estacional_km2"].round(1).tolist(),
        "fuera_lagunas_km2": df["fuera_lagunas_km2"].round(1).tolist(),
        "lluvia_mm": df["lluvia_mm"].round(0).tolist(),
        "cobertura_pct": df["cobertura_pct"].round(0).tolist(),
    }
    with open(config.WEB_DATA / "serie.json", "w") as f:
        json.dump(serie, f)


def graficar(df, destino):
    fig, ax = plt.subplots(figsize=(11, 4.5), constrained_layout=True)
    ax.bar(df["anio"], df["permanente_km2"], color="#1d4e89", label="Agua permanente")
    ax.bar(df["anio"], df["estacional_km2"], bottom=df["permanente_km2"],
           color="#8ecae6", label="Agua estacional")
    ax.set_ylabel("Superficie de agua (km²)")
    ax.spines[["top"]].set_visible(False)
    ax2 = ax.twinx()
    ax2.plot(df["anio"], df["lluvia_mm"], color="#b45309", marker="o", ms=3, lw=1.5, label="Lluvia anual")
    ax2.set_ylabel("Lluvia (mm)")
    ax2.spines[["top"]].set_visible(False)
    baja = df[df["cobertura_pct"] < 90]
    for _, r in baja.iterrows():
        ax.annotate("*", (r["anio"], r["permanente_km2"] + r["estacional_km2"]),
                    ha="center", va="bottom", color="#a32d2d", fontsize=12)
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper left", frameon=False)
    ax.set_title("Partido de Guaminí: superficie de agua y lluvia por año", loc="left")
    if len(baja):
        fig.text(0.01, -0.02, "* años con menos del 90% del partido con observaciones suficientes",
                 fontsize=8, color="#5f5e5a")
    fig.savefig(destino, dpi=150, bbox_inches="tight")


if __name__ == "__main__":
    if not config.SERIE_CSV.exists():
        sys.exit(f"Falta {config.SERIE_CSV}. Bajalo de Drive (carpeta {config.CARPETA_DRIVE}).")
    df = preparar(pd.read_csv(config.SERIE_CSV))
    exportar_web(df)
    graficar(df, config.DATOS / "agua_vs_lluvia.png")
    print(df[["anio", "permanente_km2", "estacional_km2", "lluvia_mm", "cobertura_pct"]].round(1).to_string(index=False))
