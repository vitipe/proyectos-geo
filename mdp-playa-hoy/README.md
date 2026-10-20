# ¿A qué playa voy?

Para el día y la hora que elijas, ordena las playas de Playa Grande a La Perla
según cuánto viento les llega y cuánto sol les queda, y muestra el mejor
horario de cada una en el día.

## Cómo funciona

1. **Pronóstico:** Open-Meteo, por hora, para tres días: viento (velocidad,
   dirección y ráfagas), temperatura, nubes y probabilidad de lluvia. Del modelo
   marino, altura de olas y temperatura del agua cuando están disponibles.
2. **Orientación de cada playa:** hacia dónde mira el mar, calculado con la línea
   de costa de OpenStreetMap. En OSM la costa se dibuja con el mar a la derecha,
   así que la normal derecha de los tramos cercanos apunta al mar. Si no hay
   línea de costa cerca, se usa el eje largo de la playa con el mar al este.
3. **Viento que se siente:** según el ángulo entre la dirección del viento y la
   orientación de la playa.
   - Del mar, de frente: se siente todo.
   - De costado: alrededor del 72%.
   - De tierra: alrededor del 45% (`F_TIERRA`), porque edificios y barranca frenan.
4. **Sol:** el porcentaje de playa en sombra de edificios, con el mismo modelo
   y las mismas alturas que el mapa de sombras.
5. **Puntaje (0–100):** combina el reparo del viento y el sol, con el peso que
   elijas en "Qué te importa más". Con el cielo cubierto, la sombra pesa menos.

El mismo pronóstico vale para todas las playas (están a pocos kilómetros); lo
que cambia entre ellas es la orientación y la sombra.

## Dependencias con el mapa de sombras

Esta página no tiene datos propios. Usa de `../sombras/`:

- `osm-mdp.js`: zona, consulta a OSM y alturas cargadas.
- `sombras.js`: geometría de sombras, orientación de playas y exposición al viento.
- `data/osm.json` y `data/alturas.json`: el snapshot y tus correcciones de altura.

Por eso se publican juntas en el mismo sitio. Si guardaste un snapshot nuevo de
OSM desde el mapa de sombras, esta página lo toma automáticamente, incluida la
línea de costa.

## Usarlo

```
python armar_sitio.py && python -m http.server 8000 -d _site
```

Abrí http://localhost:8000/playa-hoy/.

## Plan

### Fase 1: datos (junto con el mapa de sombras)

El snapshot de OSM que guardes en el mapa de sombras tiene que incluir la línea
de costa. La consulta ya la pide; si guardaste uno antes de este cambio, volvé a
descargarlo. Revisá en el ranking que cada playa diga hacia dónde mira de forma
razonable: Varese y Playa Grande quedan a los costados de Cabo Corrientes y
deberían tener orientaciones bien distintas.

### Fase 2: calibrar en enero (lo más interesante)

El modelo tiene tres números que solo se ajustan observando:

| Constante en `app.js` | Qué representa | Cómo ajustarla |
|---|---|---|
| `F_TIERRA` | Cuánto viento se siente cuando viene de tierra | Días con viento del oeste o noroeste: ¿la playa está tan tranquila como dice? |
| `VIENTO_COMODO` | km/h que no molestan | Tu tolerancia: subilo si con 12 km/h estás bien |
| `PUNTOS_POR_KMH` | Cuánto castiga cada km/h de más | Si el ranking cambia demasiado por poco viento, bajalo |

Una forma ordenada: cada tarde de enero anotá en una nota a qué playa fuiste,
la hora y un puntaje tuyo del 1 al 5. A fin de mes comparás con lo que decía la
página y ajustás los tres números.

### Fase 3: mejoras

- **Viento por playa:** las escolleras y espigones generan reparos locales que
  la orientación general no capta. Una tabla de correcciones por playa
  (por ejemplo, "Bristol con viento del sur: −20%") sale directo de tus notas de enero.
- **Temporales:** avisar cuando las ráfagas superan cierto umbral.
- **Notificación:** una GitHub Action que a las 16:30 calcule la mejor playa de
  la tarde y te mande un mensaje.

## Limitaciones

- Es un índice de comodidad, no una medición: la orientación captura el efecto
  principal, pero no los remolinos de los espigones ni el reparo de cada balneario.
- El pronóstico tiene la resolución del modelo de Open-Meteo, del orden de kilómetros.
- La temperatura del agua no está disponible en todos los puntos; si no viene,
  no se muestra.
