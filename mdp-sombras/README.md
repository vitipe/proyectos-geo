# ¿Hasta qué hora hay sol en la playa?

Simulador de la sombra de los edificios sobre Playa Grande, Varese, Bristol y La Perla.
Elegís fecha y hora y el mapa dibuja las sombras; para cada playa calcula qué
porcentaje está en sombra y desde qué hora la mitad, o casi toda, queda sin sol.

## Cómo funciona

1. **Datos:** edificios (`building`, `building:part`), playas (`natural=beach`)
   y línea de costa de OpenStreetMap, de Playa Grande a La Perla.
2. **Altura de cada edificio,** en este orden: la que cargaste vos, `height` de
   OSM, `building:levels` × 3 m, o una altura por defecto (ajustable).
3. **Sol:** SunCalc da la altura y el azimut para la fecha, la hora y el lugar.
   El largo de la sombra es `(altura + desnivel) / tan(altura del sol)`.
4. **Sombra de cada edificio:** la envolvente convexa de la planta y la planta
   desplazada en la dirección opuesta al sol.
5. **Porcentaje de playa en sombra:** se reparten unos 2.500 puntos dentro de cada
   playa y se cuenta cuántos caen bajo alguna sombra. La curva de la tarde se
   calcula cada 10 minutos, desde las 14:00 hasta la puesta del sol.

Todo corre en el navegador. No hay servidor ni preprocesamiento.

## Usarlo

Desde la raíz de `proyectos-geo`:

```
python armar_sitio.py && python -m http.server 8000 -d _site
```

Abrí http://localhost:8000/sombras/. Lee el snapshot de `web/data/osm.json`; si
falta, descarga los datos de OpenStreetMap con Overpass (unos segundos) y los
guarda en el navegador por 30 días.

Publicado en https://vitipe.github.io/proyectos-geo/sombras/.

## Plan

### Fase 1: datos reales (hecha en octubre de 2026)

`web/data/osm.json` es un snapshot de OpenStreetMap con 1.144 edificios, 9 playas
y la línea de costa. Con él la página carga al instante y no depende de Overpass.

Para actualizarlo (por ejemplo, después de subir alturas a OSM), desde la raíz del repo:

```
node -p 'require("./mdp-sombras/web/osm-mdp.js").OsmMdp.CONSULTA' \
  | curl -s -f -A "proyectos-geo (github.com/vitipe/proyectos-geo)" --data-urlencode data@- \
      https://overpass-api.de/api/interpreter \
  | python3 -c 'import json,sys; json.dump(json.load(sys.stdin), sys.stdout, separators=(",",":"), ensure_ascii=False)' \
  > mdp-sombras/web/data/osm.json
```

Overpass rechaza el User-Agent por defecto de curl (responde 406), por eso va el `-A`.
También sirve el botón **Guardar datos OSM**, que aparece cuando la página no encuentra el snapshot.

Pendiente: dos playas no tienen nombre en OSM y aparecen como "Playa N":
`way/1251478745` (al sur de Playa Grande, -38.0392, -57.5365) y `way/1338991102`
(al este de Las Toscas, -38.0076, -57.5340). Lo mejor es ponerles nombre en OSM y
regenerar el snapshot.

### Fase 2: alturas de los edificios que importan (1–2 sesiones)

Las sombras sobre la playa las proyectan sobre todo las torres de las primeras
cuadras. Los edificios en ámbar no tienen altura en OSM.

En el snapshot de octubre de 2026, de los edificios a menos de 250 m de cada
playa tenían altura: Playa Grande 0 de 108, La Perla 11 de 156, Bristol 45 de 131,
Varese 75 de 149 y Las Toscas 64 de 161. Conviene empezar por Playa Grande y La Perla.

1. Tocá cada edificio en ámbar de las primeras dos o tres cuadras y cargá sus
   pisos. Podés contarlos con Street View o en persona. Alcanza con los de 4 pisos
   o más: los bajos andan bien con la altura por defecto (6 m).
2. Tocá **Exportar alturas** y guardá el archivo como `mdp-sombras/web/data/alturas.json`.
   Así quedan en el repo y en el sitio publicado, no solo en tu navegador. Las
   correcciones del navegador son por sitio: lo que cargues en localhost no
   aparece en vitipe.github.io, y al revés.
3. Opcional y recomendable: subí esos `building:levels` a OpenStreetMap. Mejora
   el mapa para todos y en el próximo snapshot ya vienen incluidos.

### Fase 3: calibrar en la playa (enero)

El modelo supone el terreno plano, pero la arena está más baja que la calle.

1. Un día de sol, anotá la hora a la que la sombra llega a un punto fijo que
   reconozcas (una bajada, un balneario, un espigón).
2. En la página, poné esa fecha y hora y mové **Desnivel** hasta que la sombra
   llegue al mismo punto.
3. Repetí en las tres playas. Si el valor cambia mucho entre playas, conviene
   hacer el desnivel por playa (ver ideas).

### Fase 4: publicar

Cada push a `main` lo publica en https://vitipe.github.io/proyectos-geo/sombras/.
Si sumás alturas, commiteá `data/alturas.json` y se actualiza solo. Desde el
celular sirve para decidir a qué playa ir después del trabajo.

## Archivos

| Archivo | Qué es |
|---|---|
| `web/osm-mdp.js` | Zona, consulta a Overpass, carga del snapshot y de las alturas. Compartido con `/playa-hoy/` |
| `web/sombras.js` | Geometría: parseo de OSM, alturas, sol, sombras, muestreo, orientación de playas y viento. Sin Leaflet, se puede probar con Node. Compartido con `/playa-hoy/` |
| `web/app.js` | Mapa, controles, curva de la tarde, edición de alturas |
| `web/data/osm.json` | Snapshot de OSM (fase 1; ver el comando para regenerarlo) |
| `web/data/alturas.json` | Pisos cargados a mano (fase 2) |

## Limitaciones

- **Alturas.** El resultado es tan bueno como las alturas. Con pisos × 3 m se
  subestiman las plantas bajas altas y los remates.
- **Plantas no convexas.** Un edificio en L o en U proyecta una sombra un poco
  más grande de lo real. En la escala de la playa casi no cambia el resultado.
- **Terreno plano** salvo por el desnivel general, que se calibra a mano.
- **Sin árboles, toldos ni carpas de balneario.** Es la sombra de los edificios.

## Ideas para seguir

- Desnivel por playa en lugar de uno general.
- Sumar Punta Mogotes ampliando la zona.
- Modo "verano completo": un mapa de calor con las horas de sol de cada punto
  de la playa entre diciembre y febrero.
