# CLAUDE.md

Contexto para agentes que trabajen en este repo. Para el plan y el paso a paso
de cada proyecto, ver `README.md` y el README de cada carpeta.

## Qué es

Proyecto personal de Victor (geógrafo y desarrollador backend). Es un sitio
estático con varios mapas en Leaflet sobre Mar del Plata y el oeste bonaerense,
publicado en GitHub Pages. No hay build ni bundler, y el único backend son las
APIs públicas que consultan las páginas.

| Carpeta | Ruta en el sitio | Estado |
|---|---|---|
| `mdp-sombras/` | `/sombras/` | Funcional; nunca probado con datos reales de OSM |
| `mdp-playa-hoy/` | `/playa-hoy/` | Funcional; nunca probado con datos reales; constantes del modelo sin calibrar |
| `mdp-costa/` | `/mdp/` | Pipeline escrito pero nunca corrido; `web/data` tiene datos sintéticos |
| `guamini-agua/` | `/guamini/` | Pipeline escrito pero nunca corrido; `web/data` tiene datos sintéticos |
| `sitio/` | `/` | Portada y `comun.css` (tokens de color, modo oscuro, layout mapa + panel) |

## Correr y verificar

```
python3 armar_sitio.py && python3 -m http.server 8000 -d _site
```

`armar_sitio.py` copia `sitio/` y cada `*/web` a `_site/` (en `.gitignore`).
Es el mismo script que corre `.github/workflows/pages.yml` en cada push a `main`.

No hay suite de tests. Para verificar:
- JS: `node --check archivo.js`. `mdp-sombras/web/sombras.js` no depende de
  Leaflet y exporta con `module.exports`, así que se puede probar con Node.
- Python: `python3 -m py_compile` sobre los scripts.
- Mapas: las demos (`*/scripts/00_demo_sintetico.py`) regeneran `web/data`
  sin Earth Engine.

## Convenciones

- Todo en español: identificadores, comentarios, UI y docs. En la UI y los
  README, voseo rioplatense ("tocá", "elegí").
- JS vanilla en archivos `<script>` (sin módulos ES ni frameworks). Librerías
  por CDN con versión fija: Leaflet 1.9.4, Chart.js 4.4.1, SunCalc 1.9.0.
- Cada mapa es independiente en su carpeta `web/`, enlaza `../comun.css` y
  agrega su `style.css`. Rutas siempre relativas, porque el sitio se publica
  en un subpath (por ejemplo `vitipe.github.io/proyectos-geo/`).
- Python: un `config.py` por proyecto con todo lo ajustable; los scripts van
  numerados por paso (`01_…`, `02_…`); los `_*.py` son utilidades compartidas.
  Entorno conda `coastsat` (ver README raíz).
- Colores definidos como variables en `comun.css`, con modo oscuro. La regla
  `[hidden] { display: none !important; }` está ahí porque `.aviso` pisaba el `hidden`.

## Dependencias entre proyectos

`mdp-playa-hoy` no tiene datos ni geometría propios: carga
`../sombras/osm-mdp.js`, `../sombras/sombras.js` y `../sombras/data/`. Si se
cambia la API de `sombras.js` (`parsearOSM`, `altura`, `sol`, `sombraEdificio`,
`orientacionPlaya`, `exposicion`…), hay que revisar las dos páginas.

`osm-mdp.js` define la zona (Playa Grande a La Perla), la consulta a Overpass,
la carga del snapshot y de las alturas, y helpers de fecha con UTC−3 fijo.

## Datos

- **Sintéticos:** `mdp-costa/web/data` y `guamini-agua/web/data` vienen de las
  demos. Llevan `"demo": true` en `meta.json` / `serie.json`, y la página
  muestra un aviso. No presentarlos nunca como datos reales.
- **OSM:** `mdp-sombras/web/data/osm.json` todavía no existe. Si falta, la
  página consulta Overpass y guarda el resultado 30 días en localStorage
  (`sombras-osm-v2`). Si cambia la consulta, subir la versión de la clave.
- **Alturas:** `data/alturas.json` (pisos por id de OSM) se combina con las
  correcciones locales del navegador (`sombras-alturas`).
- **Earth Engine:** `GEE_PROJECT` es un placeholder en los dos `config.py`.
  CoastSat se clona en `proyectos-geo/CoastSat/` (ignorado), no se instala con pip.

## Supuestos del dominio que no hay que romper

- Línea de costa de OSM: el mar queda a la derecha del sentido de la línea.
  `orientacionPlaya` usa eso.
- SunCalc mide el azimut desde el sur hacia el oeste; la sombra apunta en esa
  dirección (ver `sol()` en `sombras.js`).
- Viento: la dirección de Open-Meteo indica de dónde viene, no hacia dónde va.
- Mar del Plata en EPSG:32721 (UTM 21S). Guaminí se filtra en FAO GAUL por
  `"Guamin"` mientras no se cargue el asset del IGN.

## Pendientes conocidos

- Agregar `.github/workflows/pages.yml` si todavía no está (el archivo existe
  pero no se pudo copiar con las herramientas remotas).
- `mdp-costa/datos/tramos.geojson`: los polígonos son aproximados; hay que
  ajustarlos antes de descargar imágenes.
- `CASBAS_LONLAT` y el nombre del dataset GHSL en `05_casbas_urbano.py`: verificar.
- Calibrar en enero 2027: el desnivel calle–arena en sombras y `F_TIERRA`,
  `VIENTO_COMODO` y `PUNTOS_POR_KMH` en `mdp-playa-hoy/web/app.js`.
