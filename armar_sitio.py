"""Arma el sitio completo en _site/ (lo mismo que hace GitHub Actions).

Uso:
    python armar_sitio.py
    python -m http.server 8000 -d _site     # http://localhost:8000
"""
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SITIO = RAIZ / "_site"
MAPAS = {
    "sombras": RAIZ / "mdp-sombras" / "web",
    "playa-hoy": RAIZ / "mdp-playa-hoy" / "web",   # usa ../sombras/ (datos y geometría)
    "mdp": RAIZ / "mdp-costa" / "web",
    "guamini": RAIZ / "guamini-agua" / "web",
}

if SITIO.exists():
    shutil.rmtree(SITIO)
shutil.copytree(RAIZ / "sitio", SITIO)
for ruta, origen in MAPAS.items():
    shutil.copytree(origen, SITIO / ruta)
    print(f"/{ruta}/  <- {origen.relative_to(RAIZ)}")
print(f"Sitio armado en {SITIO}")
