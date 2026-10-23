# Agua en el partido de Guaminí, 1984–hoy

> **Para nodoagro no se usa esta carpeta.** El monitor publicado en
> www.nodoagro.com.ar/monitor/ vive en el repo `landing-ea` y usa Sentinel-2 sin
> Earth Engine, porque el proyecto GEE es no comercial. Este pipeline queda como
> referencia del método (frecuencia anual de MNDWI) para portar el histórico.

## Objetivo

Medir año por año la superficie de agua del partido (lagunas y campos
anegados), relacionarla con la lluvia y mostrarlo en un mapa web.

Preguntas guía:

1. ¿Cuánto cambia la superficie de agua entre años secos y húmedos?
2. En los años húmedos, ¿cuánta de esa agua está fuera de las lagunas, es decir,
   en campos anegados?
3. ¿Con cuánto retraso responde el agua a la lluvia? ¿Alcanza un año húmedo o
   hacen falta varios seguidos?

## Cómo funciona

```
Landsat 5/7/8/9 (Collection 2, nivel 2)
   └─ máscara de nubes y sombras (QA_PIXEL)
      └─ MNDWI = (verde − SWIR1) / (verde + SWIR1); agua si MNDWI > 0
         └─ frecuencia anual = observaciones con agua / observaciones válidas
            ├─ permanente: agua en ≥ 75% del año
            ├─ estacional: agua entre 25% y 75%
            └─ fuera de lagunas: agua donde JRC Global Surface Water dice que
               históricamente no hay laguna estable
CHIRPS ─► lluvia anual media del partido
```

Todo se procesa en los servidores de Earth Engine; solo bajás una tabla y una
imagen PNG por año.

## Paso a paso

Comandos desde `guamini-agua/`, con el entorno `coastsat` activo.

### Fase 1: el polígono del partido (30 min)

**Arranque rápido (FAO GAUL):**
```
python scripts/02_serie_agua.py --verificar-partido
```
Lista los partidos de Buenos Aires que hay en GAUL y el área del seleccionado.
El partido tiene alrededor de 4.800 km²; si el número está muy lejos, el filtro
agarró otra cosa.

**Versión definitiva (IGN):**
1. Bajá la capa de departamentos de https://www.ign.gob.ar (sección Capas SIG).
2. Filtrá Guaminí en QGIS y exportalo como shapefile.
3. En el Code Editor de Earth Engine: Assets → New → Shape files. Subilo.
4. Poné la ruta del asset en `ASSET_PARTIDO` de `config.py`.

### Fase 2: explorar en el Code Editor (1 sesión)

Pegá `scripts/01_explorar.js` en https://code.earthengine.google.com y corré.

- Probá un año húmedo (2017) y uno seco (2023).
- Mirá el histograma de MNDWI: el valle entre los dos picos es un buen umbral.
  Si queda lejos de 0, ajustá `UMBRAL_MNDWI` en `config.py`.
- Compará la capa de frecuencia con el color natural: lagunas conocidas,
  bajos anegados y nada de agua donde no la hay (sombras, suelo oscuro, rastrojos quemados).

**Para avanzar:** en el año húmedo se ven lagunas y bajos anegados razonables,
y en el seco casi solo las lagunas.

### Fase 3: probar un año desde Python (30 min)

```
python scripts/02_serie_agua.py --anio 2017
```

Calcula un año entero en vivo y muestra los km². Compará con lo que viste en
el Code Editor. Puede tardar un par de minutos.

### Fase 4: serie completa (1 sesión, la mayor parte esperando)

```
python scripts/02_serie_agua.py
```

Lanza una exportación a Drive (carpeta `guamini-agua`). Seguila en
https://code.earthengine.google.com/tasks. Cuando termine, bajá el CSV a
`datos/guamini_agua_serie.csv`.

### Fase 5: mapas anuales y gráfico (1 sesión)

```
python scripts/03_mapas_anuales.py --anio 2017    # probar uno
python scripts/03_mapas_anuales.py                # todos
python scripts/04_graficos.py
```

- `03` genera `web/data/agua_<año>.png`, `limites.json` y `partido.geojson`.
  Las imágenes cubren el partido más 10 km, para ver lagunas vecinas.
- `04` genera `web/data/serie.json` y `datos/agua_vs_lluvia.png`. Los años
  marcados con asterisco tienen cobertura parcial (por ejemplo 2012, solo con
  Landsat 7).

**Para avanzar:** los picos de agua coinciden con ciclos húmedos conocidos
(como 2017) y los mínimos con sequías.

### Fase 6: mapa web (1 sesión)

```
cd ..   # a la raíz de proyectos-geo
python armar_sitio.py && python -m http.server 8000 -d _site   # http://localhost:8000/guamini/
```

Con los datos reales en `web/data`, el aviso de demo desaparece. Para publicar,
ver el README general.

### Fase 7: Casbas (opcional)

Zoom al pueblo para relacionar crecimiento urbano y drenaje.

```
python scripts/05_casbas_urbano.py
```

- Calcula la superficie construida en un radio de 3 km cada 5 años desde 1975
  con GHSL. Confirmá en el catálogo de Earth Engine el nombre del dataset y la
  banda antes de correrlo, y verificá el punto `CASBAS_LONLAT`.
- Ideas para seguir: relieve con Copernicus GLO-30 o, si cubre la zona, el
  MDE-Ar del IGN (en un terreno tan plano, 30 m resuelve poco); agua con
  Sentinel-2 desde 2017 a 10 m para ver bajos dentro y alrededor del pueblo.

## Archivos

| Archivo | Qué es |
|---|---|
| `config.py` | Proyecto GEE, polígono, años, umbrales |
| `scripts/_gee.py` | Partido, Landsat armonizado, frecuencia de agua, clases, lluvia |
| `scripts/01_explorar.js` | Script para el Code Editor |
| `scripts/02_serie_agua.py` | Tabla anual (prueba de un año o exportación completa) |
| `scripts/03_mapas_anuales.py` | PNG por año para el mapa |
| `scripts/04_graficos.py` | Gráfico y `serie.json` para la web |
| `scripts/05_casbas_urbano.py` | Superficie construida en Casbas |
| `scripts/00_demo_sintetico.py` | Datos inventados para probar el mapa |

## Limitaciones a tener presentes

- **Agua bajo vegetación.** Un cultivo o pastizal anegado puede no verse como
  agua en MNDWI. La superficie anegada real puede ser mayor que la medida.
- **Umbral fijo.** MNDWI > 0 funciona bien en general, pero el agua muy turbia
  o muy somera puede quedar afuera. Revisalo en la fase 2.
- **Año calendario.** Una crecida de diciembre a marzo queda partida en dos
  años. Como extensión, probá año hidrológico (julio a junio).
- **Límite administrativo.** Las Encadenadas atraviesan varios partidos; una
  laguna cortada por el límite puede dar saltos raros. El mapa muestra el
  buffer para no perder ese contexto.
- **Referencia de lagunas.** JRC Global Surface Water llega hasta 2021. Para
  "fuera de lagunas" alcanza, pero no es una cartografía oficial de lagunas.

## Para seguir

- Correlación con retardo entre lluvia acumulada (1, 2 y 3 años) y agua.
- Índice de sequía (SPI) en lugar de lluvia anual.
- Sumar los partidos vecinos para ver toda la cuenca de las Encadenadas.
