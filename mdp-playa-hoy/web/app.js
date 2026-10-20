// ¿A qué playa voy? Cruza el pronóstico de viento con la orientación de cada playa
// y la sombra de los edificios, y arma un ranking para la hora elegida.
// Reutiliza los datos y la geometría de la página de sombras (../sombras/).

const { CENTRO, ZONA, hhmm, aMinutos, fechaHora, hoyISO, sumarDias } = window.OsmMdp;
const S = window.Sombras;
const proy = S.proyeccion(CENTRO[0], CENTRO[1]);
const $ = (id) => document.getElementById(id);
const DATOS_SOMBRAS = "../sombras/data/";

// --- Supuestos del modelo (calibrables) ---------------------------------------
// Fracción del viento que se siente según de dónde viene respecto de la playa:
// 1 si viene del mar de frente, F_TIERRA si viene de tierra, intermedio de costado.
const F_TIERRA = 0.45;
const VIENTO_COMODO = 8;      // km/h efectivos que no molestan
const PUNTOS_POR_KMH = 3;     // cuánto resta cada km/h por encima de eso
const ALTURA_DEFECTO = 6;     // m para edificios sin dato (como en el mapa de sombras)
const HORAS_GRAFICO = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const COLORES_PLAYA = ["#185fa5", "#d85a30", "#1d9e75", "#7f77dd", "#ba7517", "#d4537e"];

const PUNTOS_CARDINALES = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const cardinal = (g) => PUNTOS_CARDINALES[Math.round((((g % 360) + 360) % 360) / 22.5) % 16];
const clase = (p) => (p >= 70 ? "bueno" : p >= 45 ? "regular" : "malo");
const COLOR_CLASE = {
  bueno: { borde: "#3b6d11", relleno: "#97c459" },
  regular: { borde: "#854f0b", relleno: "#ef9f27" },
  malo: { borde: "#993c1d", relleno: "#f0997b" },
};

// --- Pronóstico -------------------------------------------------------------------

async function pedirJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${new URL(url).hostname} respondió ${r.status}`);
  return r.json();
}

async function cargarPronostico() {
  const comun = { timezone: "America/Argentina/Buenos_Aires", forecast_days: 3 };
  const tiempo = await pedirJSON("https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    ...comun,
    latitude: CENTRO[0], longitude: CENTRO[1], wind_speed_unit: "kmh",
    hourly: "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability",
  }));
  // El modelo marino necesita un punto en el agua: un poco al este de la costa
  const puntoMar = { latitude: CENTRO[0], longitude: ZONA.este + 0.03 };
  let mar = null;
  for (const variables of ["wave_height,sea_surface_temperature", "wave_height"]) {
    try {
      mar = await pedirJSON("https://marine-api.open-meteo.com/v1/marine?" +
        new URLSearchParams({ ...comun, ...puntoMar, hourly: variables }));
      break;
    } catch {
      /* se prueba con menos variables; si falla todo, se sigue sin datos del mar */
    }
  }
  return { tiempo: tiempo.hourly, mar: mar ? mar.hourly : null };
}

function datosHora(pron, fecha, hora) {
  const clave = `${fecha}T${String(hora).padStart(2, "0")}:00`;
  const i = pron.tiempo.time.indexOf(clave);
  if (i < 0) return null;
  const t = pron.tiempo;
  const j = pron.mar ? pron.mar.time.indexOf(clave) : -1;
  return {
    temp: t.temperature_2m[i],
    sensacion: t.apparent_temperature[i],
    viento: t.wind_speed_10m[i],
    vientoDesde: t.wind_direction_10m[i],
    rafagas: t.wind_gusts_10m[i],
    nubes: t.cloud_cover[i],
    lluvia: t.precipitation_probability[i],
    olas: j >= 0 ? pron.mar.wave_height?.[j] : null,
    agua: j >= 0 ? pron.mar.sea_surface_temperature?.[j] ?? null : null,
  };
}

// --- Modelo ----------------------------------------------------------------------

function evaluar(playa, cond, sombra, prioridad) {
  const exp = S.exposicion(playa.rumboMar, cond.vientoDesde);
  const efectivo = cond.viento * (F_TIERRA + (1 - F_TIERRA) * (1 + exp.coseno) / 2);
  const puntosViento = Math.max(0, Math.min(100, 100 - Math.max(0, efectivo - VIENTO_COMODO) * PUNTOS_POR_KMH));
  const puntosSol = sombra === null ? 0 : 100 - sombra;
  const w = prioridad / 100;
  const pesoSol = (1 - w) * (1 - (cond.nubes ?? 0) / 100);   // con cielo cubierto la sombra importa menos
  const puntaje = (w + pesoSol) > 0 ? (w * puntosViento + pesoSol * puntosSol) / (w + pesoSol) : puntosViento;
  return { exp, efectivo, puntosViento, puntosSol, sombra, puntaje: Math.round(puntaje) };
}

async function iniciar() {
  const avisar = (t) => ($("estado").textContent = t);
  avisar("Cargando pronóstico y datos de las playas…");
  const [{ osm }, alturas, pron] = await Promise.all([
    window.OsmMdp.cargarOSM(DATOS_SOMBRAS, avisar),
    window.OsmMdp.cargarAlturas(DATOS_SOMBRAS),
    cargarPronostico(),
  ]);
  const { edificios, playas, costas } = S.parsearOSM(osm);
  if (!playas.length) throw new Error("no hay playas en los datos de OpenStreetMap");

  const costasXY = costas.map((c) => c.ll.map(proy.aXY));
  edificios.forEach((e) => {
    e.xy = e.ll.map(proy.aXY);
    e.h = S.altura(e.tags, alturas[e.id], ALTURA_DEFECTO).h;
  });
  playas.forEach((p, i) => {
    p.xy = p.ll.map(proy.aXY);
    p.puntos = S.muestrear(p.xy, 1500);
    p.etiqueta = p.nombre || `Playa ${i + 1}`;
    const o = S.orientacionPlaya(p.xy, costasXY);
    p.rumboMar = o.rumbo;
    p.fuenteRumbo = o.fuente;
    p.color = COLORES_PLAYA[i % COLORES_PLAYA.length];
  });
  avisar(`${playas.length} playas · pronóstico actualizado ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" })}`);

  // --- Mapa
  const mapa = L.map("mapa", { zoomSnap: 0.5 });
  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }
  ).addTo(mapa);
  const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap",
  });
  L.control.layers({ "Satélite": satelite, "Calles": calles }, null, { position: "topleft" }).addTo(mapa);

  mapa.createPane("sombras").style.zIndex = 390;
  mapa.getPane("sombras").style.opacity = 0.4;
  const rendererSombras = L.canvas({ pane: "sombras" });
  const capaSombras = L.layerGroup().addTo(mapa);

  playas.forEach((p) => {
    p.capa = L.polygon(p.ll.map(([lon, lat]) => [lat, lon]), { weight: 2, fillOpacity: 0.55 }).addTo(mapa);
    p.capa.bindTooltip("", { permanent: true, direction: "right", className: "etiqueta-playa", offset: [8, 0] });
    p.capa.on("click", () => { estado.elegida = p; dibujar(); });
  });
  mapa.fitBounds(L.featureGroup(playas.map((p) => p.capa)).getBounds(), { padding: [40, 40] });

  const controlViento = L.control({ position: "topright" });
  controlViento.onAdd = () => L.DomUtil.create("div", "viento");
  controlViento.addTo(mapa);

  // --- Estado
  const ahora = aMinutos(new Date());
  const estado = {
    fecha: hoyISO(),
    minutos: ahora < 18 * 60 ? 18 * 60 : Math.min(Math.ceil(ahora / 30) * 30, 21 * 60),
    prioridad: 60,
    elegida: null,
    verSombras: true,
  };
  if (ahora > 21 * 60) {
    estado.fecha = sumarDias(estado.fecha, 1);
    estado.minutos = 18 * 60;
  }

  // Sombra por playa, con caché por fecha y minuto
  const cacheSombras = new Map();
  function sombrasEn(fecha, min) {
    const clave = `${fecha} ${min}`;
    if (cacheSombras.has(clave)) return cacheSombras.get(clave);
    const s = S.sol(SunCalc, fechaHora(fecha, min), CENTRO[0], CENTRO[1]);
    let poligonos = null;
    let porPlaya = playas.map(() => null);
    if (s.altura > 0) {
      poligonos = edificios.map((e) => S.sombraEdificio(e.xy, e.h, s, 0)).filter(Boolean);
      const indice = S.indexar(poligonos);
      porPlaya = playas.map((p) => S.porcentajeSombra(p.puntos, indice));
    }
    const r = { s, poligonos, porPlaya };
    cacheSombras.set(clave, r);
    return r;
  }

  function evaluarTodas(fecha, min) {
    const cond = datosHora(pron, fecha, Math.min(23, Math.round(min / 60)));
    if (!cond) return null;
    const { porPlaya, poligonos, s } = sombrasEn(fecha, min);
    const res = playas.map((p, i) => ({ playa: p, ...evaluar(p, cond, porPlaya[i], estado.prioridad) }));
    return { cond, res, poligonos, s };
  }

  // --- Dibujo
  function dibujarDias() {
    const hoy = hoyISO();
    const opciones = [["Hoy", hoy], ["Mañana", sumarDias(hoy, 1)], ["Pasado", sumarDias(hoy, 2)]];
    $("dias").innerHTML = opciones.map(([t, f]) =>
      `<button type="button" data-f="${f}" aria-pressed="${f === estado.fecha}">${t}</button>`).join("");
    $("dias").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      estado.fecha = b.dataset.f;
      dibujarDias();
      dibujar();
      dibujarGrafico();
    }));
  }

  function dibujar() {
    $("hora-valor").textContent = hhmm(estado.minutos);
    const ev = evaluarTodas(estado.fecha, estado.minutos);
    if (!ev) {
      $("recomendacion").innerHTML = `<p class="porque">No hay pronóstico para ese día y hora.</p>`;
      return;
    }
    const { cond, res, poligonos, s } = ev;
    const orden = res.slice().sort((a, b) => b.puntaje - a.puntaje);
    const mejor = orden[0];
    if (!estado.elegida) estado.elegida = mejor.playa;

    const sinSol = s.altura <= 0;
    $("recomendacion").innerHTML = `
      <p class="titulo">${sinSol ? "Ya no hay sol a esa hora" : "Mejor opción"}</p>
      <p class="playa">${mejor.playa.etiqueta}</p>
      <p class="porque">${razon(mejor, cond)}</p>`;

    $("condiciones").innerHTML =
      `<dt>Viento</dt><dd>${Math.round(cond.viento)} km/h del ${cardinal(cond.vientoDesde)}, ráfagas de ${Math.round(cond.rafagas)}</dd>` +
      `<dt>Temperatura</dt><dd>${Math.round(cond.temp)}° (sensación ${Math.round(cond.sensacion)}°)</dd>` +
      `<dt>Nubes</dt><dd>${cond.nubes}%</dd>` +
      (cond.olas !== null && cond.olas !== undefined ? `<dt>Olas</dt><dd>${cond.olas.toFixed(1)} m</dd>` : "") +
      (cond.agua !== null && cond.agua !== undefined ? `<dt>Agua</dt><dd>${Math.round(cond.agua)}°</dd>` : "");
    const alerta = cond.lluvia >= 50 ? `${cond.lluvia}% de probabilidad de lluvia a esa hora.` : "";
    $("alerta").hidden = !alerta;
    $("alerta").textContent = alerta;

    $("ranking").innerHTML = orden.map((r) => `
      <li data-id="${r.playa.id}" class="${r.playa === estado.elegida ? "activa" : ""}">
        <span class="puntaje p-${clase(r.puntaje)}">${r.puntaje}</span>
        <span class="nombre">${r.playa.etiqueta}</span>
        <span class="detalle">Viento ${r.exp.tipo} · ${Math.round(r.efectivo)} km/h efectivos ·
          ${r.sombra === null ? "sin sol" : Math.round(r.sombra) + "% en sombra"}</span>
      </li>`).join("");
    $("ranking").querySelectorAll("li").forEach((li) => (li.onclick = () => {
      estado.elegida = playas.find((p) => p.id === li.dataset.id);
      dibujar();
      dibujarGrafico();
    }));

    res.forEach((r) => {
      const c = COLOR_CLASE[clase(r.puntaje)];
      r.playa.capa.setStyle({
        color: c.borde, fillColor: c.relleno, weight: r.playa === estado.elegida ? 4 : 2,
      });
      r.playa.capa.setTooltipContent(`${r.playa.etiqueta} · ${r.puntaje}`);
    });

    capaSombras.clearLayers();
    if (estado.verSombras && poligonos) {
      poligonos.forEach((pol) => L.polygon(pol.map(proy.aLatLon), {
        renderer: rendererSombras, pane: "sombras", stroke: false, fillColor: "#000", fillOpacity: 1, interactive: false,
      }).addTo(capaSombras));
    }

    const hacia = (cond.vientoDesde + 180) % 360;
    document.querySelector(".viento").innerHTML = `
      <svg width="36" height="36" viewBox="-18 -18 36 36" aria-hidden="true">
        <g transform="rotate(${hacia})"><path d="M0,13 L0,-5" stroke="#185fa5" stroke-width="2.5"/><path d="M0,-14 L6,-4 L-6,-4 Z" fill="#185fa5"/></g>
      </svg>${Math.round(cond.viento)} km/h<br>del ${cardinal(cond.vientoDesde)}`;
    actualizarMarcaGrafico();
  }

  function razon(r, cond) {
    const partes = [];
    if (r.exp.tipo === "de tierra") partes.push(`el viento del ${cardinal(cond.vientoDesde)} le llega desde tierra, queda más reparada`);
    else if (r.exp.tipo === "de costado") partes.push(`el viento le pega de costado (${Math.round(r.efectivo)} km/h efectivos)`);
    else partes.push(`el viento le llega del mar (${Math.round(r.efectivo)} km/h efectivos), pero es la mejor combinación`);
    if (r.sombra !== null) {
      partes.push(r.sombra < 10 ? "sin sombra de edificios" : `${Math.round(r.sombra)}% de la playa en sombra`);
    }
    if (cond.nubes >= 70) partes.push("cielo cubierto, así que la sombra pesa poco");
    const texto = partes.join("; ");
    return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
  }

  // --- Gráfico: puntaje por hora para cada playa
  let grafico = null;
  function dibujarGrafico() {
    const series = playas.map(() => []);
    HORAS_GRAFICO.forEach((h) => {
      const ev = evaluarTodas(estado.fecha, h * 60);
      playas.forEach((_, i) => series[i].push(ev ? ev.res[i].puntaje : null));
    });
    const datos = {
      labels: HORAS_GRAFICO.map((h) => `${h}h`),
      datasets: playas.map((p, i) => ({
        label: p.etiqueta, data: series[i], borderColor: p.color, backgroundColor: p.color,
        borderWidth: p === estado.elegida ? 3 : 1.5, pointRadius: 0, tension: 0.25,
      })),
    };
    if (grafico) {
      grafico.data = datos;
      grafico.update();
    } else {
      grafico = new Chart($("grafico"), {
        type: "line",
        data: datos,
        options: {
          maintainAspectRatio: false, animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } },
          scales: { y: { min: 0, max: 100, title: { display: true, text: "puntaje" } } },
          onClick: (_, el) => {
            if (!el.length) return;
            estado.minutos = HORAS_GRAFICO[el[0].index] * 60;
            $("hora").value = estado.minutos;
            dibujar();
          },
        },
      });
    }
    actualizarMarcaGrafico();
  }

  function actualizarMarcaGrafico() {
    if (!grafico) return;
    const h = estado.minutos / 60;
    grafico.data.datasets.forEach((ds) => {
      ds.pointRadius = HORAS_GRAFICO.map((x) => (Math.abs(x - h) < 0.5 ? 4 : 0));
    });
    grafico.update();
  }

  // --- Controles
  $("hora").value = estado.minutos;
  $("hora").addEventListener("input", () => {
    estado.minutos = Number($("hora").value);
    dibujar();
  });
  const mostrarPrioridad = () => {
    const v = Number($("prioridad").value);
    $("prioridad-valor").textContent = v >= 70 ? "el viento" : v <= 30 ? "el sol" : "las dos cosas";
  };
  $("prioridad").addEventListener("input", mostrarPrioridad);
  $("prioridad").addEventListener("change", () => {
    estado.prioridad = Number($("prioridad").value);
    dibujar();
    dibujarGrafico();
  });
  $("ver-sombras").addEventListener("change", () => {
    estado.verSombras = $("ver-sombras").checked;
    dibujar();
  });
  mostrarPrioridad();
  dibujarDias();
  dibujar();
  dibujarGrafico();
}

iniciar().catch((e) => {
  $("estado").innerHTML = `<span class="aviso">No se pudo cargar: ${e.message}. Probá de nuevo en unos minutos.</span>`;
  console.error(e);
});
