# Línea de costa de Mar del Plata, 1984–hoy

## Objetivo

Medir cuánto avanzó o retrocedió la línea de costa en distintos tramos de Mar
del Plata desde 1984 y mostrarlo en un mapa web.

Preguntas guía:

1. ¿El norte del puerto se erosiona más que el sur? El puerto (inaugurado en
   1924) corta la deriva litoral, que va de sur a norte.
2. ¿Se ve el refulado de 1998 en Playa Grande? Es la validación del método:
   si la serie no muestra ese salto, algo está mal.
3. ¿Qué tramos están estables y cuáles cambiaron de tendencia después de 1998?

## Cómo funciona

```
tramos.geojson ─► 01 descarga ─► 02 detecta costas ─┐
                                                    ├─► 04 series ─► 05 tasas ─► 06 web
lineas_base/ ──► 03 transectas ─────────────────────┘
```

- **Detección:** CoastSat clasifica cada imagen y traza el borde arena/agua con
  precisión subpíxel (alrededor de 10 m).
- **Transectas:** líneas perpendiculares a la costa cada 100 m. En cada fecha se
  mide a qué distancia del origen (en tierra) cruza la línea de costa.
- **Tasas:** regresión lineal por transecta y período (m/año). Negativo es
  erosión, positivo es acumulación.
- **Mapa:** transectas coloreadas por tasa, línea de costa mediana de cada año
  y la serie de cada transecta al tocarla.

## Paso a paso

Todos los comandos se corren desde `mdp-costa/` con el entorno `coastsat` activo.
Conviene hacer cada fase completa con **un solo tramo** (`playa_grande`) y recién
después pasar al resto.

### Fase 1: tramos (30 min)

`datos/tramos.geojson` trae cinco polígonos **aproximados**: norte_a, norte_b,
centro, playa_grande y punta_mogotes.

1. Abrilo en https://geojson.io o QGIS sobre imagen satelital.
2. Ajustá cada polígono para que cubra la playa más 300–500 m de mar y de tierra.
3. Mantené cada polígono por debajo de unos 50 km²; CoastSat descarga el
   rectángulo que lo contiene.

**Para avanzar:** cada polígono contiene su playa completa y no mezcla tramos.

### Fase 2: descarga (1 h, la mayor parte esperando)

```
python scripts/01_descargar.py --solo-chequear
python scripts/01_descargar.py --tramo playa_grande
```

Las imágenes quedan en `salidas/playa_grande/`. Son livianas porque se recortan
en los servidores de Earth Engine.

**Para avanzar:** cientos de imágenes entre Landsat 5, 7, 8, 9 y Sentinel-2.

### Fase 3: detección de la línea de costa (2 sesiones)

```
python scripts/02_extraer_costas.py --tramo playa_grande --jpg --revisar
```

- La primera vez te pide dibujar una costa de referencia sobre una imagen. Se
  guarda y se reutiliza; sirve para descartar detecciones absurdas.
- Con `--revisar` aceptás o descartás cada detección. Hacelo con unas 50
  imágenes para entender qué falla, después cortá y corré sin `--revisar`.
- Si muchas detecciones fallan, probá en `config.py`: `sand_color`
  (`"default"`, `"latest"`, `"bright"`), `cloud_thresh` o `MAX_DIST_REF`.

**Para avanzar:** más del 80% de las detecciones siguen la orilla real y
`salidas/playa_grande/costas.geojson` se ve coherente en QGIS.

### Fase 4: transectas (30 min por tramo)

1. En geojson.io dibujá una línea **por tierra**, detrás de la playa (sobre la
   costanera, por ejemplo), **de sur a norte**. Guardala como
   `datos/lineas_base/playa_grande.geojson`.
   `_ejemplo_centro.geojson` muestra el formato.
2. Generá las transectas:
   ```
   python scripts/03_generar_transectas.py --tramo playa_grande
   ```
3. Revisalas en QGIS: tienen que arrancar en tierra y cruzar la playa hacia el
   mar. Si quedan al revés, cambiá `LADO_MAR` en `config.py`.

En playas entre espigones, borrá a mano las transectas que caen sobre un espigón.

### Fase 5: series, tasas y validación (2 sesiones)

```
python scripts/04_series.py --tramo playa_grande
python scripts/05_tendencias.py --tramo playa_grande
```

- **Validación del refulado:** abrí `salidas/playa_grande/anual.csv` y graficá
  algunas transectas. Tiene que aparecer un avance marcado alrededor de 1998.
  En `tendencias.csv`, la tasa `post_1998` debería ser más negativa que
  `pre_1998` si la arena aportada se fue perdiendo.
- **Marea (recomendado):** sin corrección, cada fecha mide la costa con una
  marea distinta. La amplitud media en Mar del Plata ronda los 0,9 m, y en una
  playa con pendiente 0,05 eso mueve la línea unos 18 m. Para corregir:
  1. Seguí `CoastSat/doc/FES2022_setup.md` para instalar el modelo de marea FES2022.
  2. Generá la marea de cada fecha (sección 5 de `CoastSat/example.py`) y guardala
     como `datos/mareas.csv` con columnas `dates` (UTC) y `tide` (m).
  3. Calibrá `PENDIENTE_PLAYA` por tramo: con datos de literatura o con
     `SDS_slope` de CoastSat (sección 7 de `example.py`).
  4. Volvé a correr 04 y 05. El script avisa si corre sin marea.

**Para avanzar:** el salto de 1998 aparece y las tasas tienen un orden de
magnitud razonable (decenas de centímetros a pocos metros por año).

### Fase 6: el resto de los tramos (2 sesiones)

Repetí las fases 2 a 5 para norte_a, norte_b, centro y punta_mogotes. Ya con
los parámetros ajustados, cada tramo es mayormente esperar.

### Fase 7: mapa web (1–2 sesiones)

```
python scripts/06_exportar_web.py
cd ..   # a la raíz de proyectos-geo
python armar_sitio.py && python -m http.server 8000 -d _site   # http://localhost:8000/mdp/
```

Esto reemplaza la demo por los datos reales. Para publicar, ver el README general.

## Archivos

| Archivo | Qué es |
|---|---|
| `config.py` | Rutas, satélites, EPSG (UTM 21S), parámetros de CoastSat, períodos |
| `datos/tramos.geojson` | Polígonos de descarga, aproximados |
| `datos/lineas_base/` | Líneas base que dibujás, una por tramo |
| `datos/transectas/` | Transectas generadas por 03 |
| `salidas/<tramo>/` | Imágenes, `costas.geojson`, `series.csv`, `tendencias.csv`, `anual.csv` |
| `scripts/_analisis.py` | Transectas, tendencias y líneas anuales (sin CoastSat, testeable) |
| `scripts/_exportar.py` | Armado de `web/data` |
| `scripts/00_demo_sintetico.py` | Datos inventados para probar el circuito y el mapa |

## Limitaciones a tener presentes

- **Precisión de unos 10 m.** En las playas céntricas, cortas y entre
  espigones, muchos cambios reales quedan dentro del error. Los tramos largos
  (norte y Punta Mogotes) muestran mejor la señal.
- **Acantilados.** CoastSat está optimizado para playas de arena. Al sur del
  faro de Punta Mogotes predominan los acantilados; si querés analizarlos, hace
  falta otro enfoque.
- **Marea y oleaje.** Sin corrección por marea las series tienen más ruido; las
  tasas de largo plazo suelen ser estables igual, pero los valores de un año
  puntual no.
- **Mezcla de satélites.** Landsat 7 tiene franjas sin datos desde 2003 y
  Sentinel-2 empieza en 2015. Revisá que no haya saltos en las series justo
  cuando entra o sale un satélite.

## Para seguir

- Comparar tus tasas con los trabajos publicados de la UNMdP sobre erosión costera.
- Cruzar la serie con temporales (sudestadas) para ver eventos de erosión puntual.
- Separar verano e invierno: las playas suelen ser más anchas en verano.
