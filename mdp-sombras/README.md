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

Abrí http://localhost:8000/sombras/. La primera vez descarga los datos de
OpenStreetMap con Overpass (unos segundos) y los guarda en el navegador por 30 días.

## Plan

### Fase 1: datos reales (1 sesión)

1. Abrí la página y esperá la descarga de Overpass.
2. Tocá **Guardar datos OSM** y mové el archivo a `mdp-sombras/web/data/osm.json`.
   Desde ese momento la página usa el snapshot: carga al instante y no depende de Overpass.
3. Revisá el mapa: ¿las playas de OSM coinciden con las que conocés? Si alguna
   no tiene nombre en OSM, aparece como "Playa 1", "Playa 2", etc.

### Fase 2: alturas de los edificios que importan (1–2 sesiones)

Las sombras sobre la playa las proyectan sobre todo las torres de las primeras
cuadras. Los edificios en ámbar no tienen altura en OSM.

1. Tocá cada edificio en ámbar de las primeras dos o tres cuadras y cargá sus
   pisos. Podés contarlos con Street View o en persona.
2. Tocá **Exportar alturas** y guardá el archivo como `mdp-sombras/web/data/alturas.json`.
   Así quedan en el repo y en el sitio publicado, no solo en tu navegador.
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

Con `data/osm.json` y `data/alturas.json` en el repo, el push a `main` lo
publica en `/sombras/`. Desde el celular sirve para decidir a qué playa ir
después del trabajo.

## Archivos

| Archivo | Qué es |
|---|---|
| `web/osm-mdp.js` | Zona, consulta a Overpass, carga del snapshot y de las alturas. Compartido con `/playa-hoy/` |
| `web/sombras.js` | Geometría: parseo de OSM, alturas, sol, sombras, muestreo, orientación de playas y viento. Sin Leaflet, se puede probar con Node. Compartido con `/playa-hoy/` |
| `web/app.js` | Mapa, controles, curva de la tarde, edición de alturas |
| `web/data/osm.json` | Snapshot de OSM (lo generás en la fase 1) |
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
