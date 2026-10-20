# Proyectos geo: Mar del Plata y el oeste bonaerense

Un solo sitio con varios mapas. Cada mapa vive en su carpeta, con sus datos y su
código, y comparte con los demás solo la hoja de estilos (`sitio/comun.css`) y la
portada (`sitio/index.html`). Los dos análisis satelitales usan el mismo método de
base (separar agua de tierra con el índice MNDWI y seguir ese borde en el tiempo),
el mismo entorno de Python y el mismo proyecto de Earth Engine.

| Proyecto | Pregunta | Herramienta principal |
|---|---|---|
| [`mdp-costa/`](mdp-costa/README.md) | ¿Cuánto se movió la línea de costa al norte y al sur del puerto desde 1984? | CoastSat (Python + Earth Engine) |
| [`guamini-agua/`](guamini-agua/README.md) | ¿Cómo varía el agua en lagunas y campos del partido con los ciclos de lluvia? | Earth Engine (Python + Code Editor) |
| [`mdp-sombras/`](mdp-sombras/README.md) | ¿Hasta qué hora hay sol en Playa Grande, Varese, Bristol y La Perla? | OpenStreetMap + SunCalc, todo en el navegador |
| [`mdp-playa-hoy/`](mdp-playa-hoy/README.md) | ¿A qué playa voy hoy, según el viento y el sol? | Open-Meteo + el modelo de sombras |

## Plan general

| Cuándo | Qué | Tiempo estimado |
|---|---|---|
| Ahora | Fase 0: cuentas, entorno y demos | 2–3 h |
| Cuando quieras | Sombras y playa de hoy: datos de OSM y alturas | 2–3 sesiones |
| Noviembre–diciembre, desde Casbas | Guaminí fases 1–6 | 4–5 sesiones de 2–3 h |
| Enero, en Mar del Plata | Mar del Plata fases 1–7; calibrar sombras y viento en la playa | 6–8 sesiones de 2–3 h |
| Febrero | Publicar el sitio, fase Casbas urbano | 2–3 sesiones |

Guaminí va primero a propósito: es solo Earth Engine, no descarga imágenes y
sirve para dejar andando la cuenta, la autenticación y el mapa web. En enero
llegás a Mar del Plata con todo eso resuelto y te enfocás en la costa.

## Fase 0: preparar el entorno (una sola vez)

1. **Earth Engine.** Creá un proyecto en https://signup.earthengine.google.com/
   registrado para uso no comercial. Anotá el nombre del proyecto.
2. **gcloud CLI.** Instalalo desde https://cloud.google.com/sdk/docs/install y corré
   `gcloud init`. Con `gcloud config get-value project` ves el nombre del proyecto.
3. **Entorno de Python.** Instalá Miniforge (https://github.com/conda-forge/miniforge)
   y creá el entorno que pide CoastSat; también sirve para Guaminí:
   ```
   mamba create -n coastsat
   mamba activate coastsat
   mamba install python=3.11 geopandas gdal -y
   mamba install earthengine-api scikit-image matplotlib astropy notebook -y
   pip install pyqt5 imageio-ffmpeg
   mamba install pyfes -y
   mamba install pyyaml -y
   ```
4. **CoastSat.** Clonalo dentro de esta carpeta (no se instala con pip):
   ```
   cd proyectos-geo
   git clone https://github.com/kvos/CoastSat
   ```
5. **Configuración.** Poné el nombre del proyecto de Earth Engine en
   `GEE_PROJECT` de `mdp-costa/config.py` y de `guamini-agua/config.py`.
6. **Demos.** Comprobá que los mapas web funcionan con datos sintéticos:
   ```
   python mdp-costa/scripts/00_demo_sintetico.py
   python guamini-agua/scripts/00_demo_sintetico.py
   python armar_sitio.py && python -m http.server 8000 -d _site   # http://localhost:8000
   ```
   Los mapas ya vienen con la demo generada; el aviso amarillo indica que no son datos reales.
7. **Git.** `git init` en esta carpeta y primer commit. El `.gitignore` ya excluye
   imágenes descargadas, salidas intermedias y el clon de CoastSat.

## Publicar

`armar_sitio.py` junta la portada y los mapas en `_site/`:

| Ruta | Mapa |
|---|---|
| `/` | Portada (`sitio/index.html`) |
| `/sombras/` | `mdp-sombras/web` |
| `/playa-hoy/` | `mdp-playa-hoy/web` (usa datos y código de `/sombras/`) |
| `/mdp/` | `mdp-costa/web` |
| `/guamini/` | `guamini-agua/web` |

`.github/workflows/pages.yml` corre ese mismo script y publica en GitHub Pages
cada vez que hacés push a `main`. En el repo de GitHub: Settings → Pages →
Source: GitHub Actions.

Para sumar un mapa nuevo: creá su carpeta con un `web/` que enlace
`../comun.css`, agregalo a `MAPAS` en `armar_sitio.py` y sumá su tarjeta en la portada.

Antes de publicar, regenerá `web/data` con datos reales (paso 06 en Mar del
Plata, pasos 03 y 04 en Guaminí) para que el aviso de demo desaparezca. Si en
algún momento un proyecto necesita backend propio, va en otro repo y la
portada lo enlaza.

## Estructura

```
proyectos-geo/
├── CoastSat/                 # clon de CoastSat (lo agregás vos, ignorado por git)
├── mdp-costa/
│   ├── config.py             # todo lo ajustable
│   ├── datos/                # tramos, líneas base, transectas, mareas
│   ├── scripts/              # 00 demo, 01–06 pasos, _*.py utilidades
│   └── web/                  # mapa (Leaflet + Chart.js) y data/
├── guamini-agua/
│   ├── config.py
│   ├── datos/                # CSV de Drive y gráficos
│   ├── scripts/              # 00 demo, 01 Code Editor, 02–05 pasos
│   └── web/
├── mdp-sombras/
│   └── web/                  # simulador; osm-mdp.js y sombras.js se comparten; data/ guarda OSM y alturas
├── mdp-playa-hoy/
│   └── web/                  # ranking de playas; lee ../sombras/
├── sitio/                    # portada y estilos compartidos
├── armar_sitio.py            # arma _site/ (local y en GitHub Actions)
└── .github/workflows/pages.yml
```
