// Simulador de sombras de edificios sobre las playas de Playa Grande a La Perla.
// Datos y utilidades compartidas en osm-mdp.js; geometría en sombras.js.

const { ZONA, CENTRO, CLAVE_ALTURAS, guardarLocal, descargar, hhmm, aMinutos, fechaHora, hoyISO } = window.OsmMdp;
const COLOR_FUENTE = {
  osm: { borde: "#888780", relleno: "#f1efe8", opacidad: 0.85 },
  manual: { borde: "#185fa5", relleno: "#b5d4f4", opacidad: 0.85 },
  estimada: { borde: "#ba7517", relleno: "#fac775", opacidad: 0.85 },
  lejos: { borde: "#a8a69e", relleno: "#d3d1c7", opacidad: 0.15 },   // sin dato, pero no llega a la playa
};
// Un edificio "importa" si, con esta altura, su sombra llegaría a la playa
// alguna tarde de verano con el sol a esta altura o más.
const PRUEBA = { pisos: 10, solMinimo: 15, dias: ["12-21", "01-20", "02-28"] };
// Hora a la que cada punto de arena pierde el sol: oscuro = sombra temprano, claro = sol hasta la puesta
const RAMPA_SOL = ["#5a3208", "#9a5a0a", "#d08f0c", "#f2bd22", "#ffe066"];
const ESCALA_ARENA_MIN = 120;   // minutos antes de la puesta que abarca la rampa
const RAMPA_RGB = RAMPA_SOL.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
function colorRampa(t) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMPA_RGB.length - 1);
  const k = Math.min(Math.floor(x), RAMPA_RGB.length - 2);
  return RAMPA_RGB[k].map((v, i) => Math.round(v + (RAMPA_RGB[k + 1][i] - v) * (x - k)));
}

const S = window.Sombras;
const proy = S.proyeccion(CENTRO[0], CENTRO[1]);
const $ = (id) => document.getElementById(id);

async function iniciar() {
  const avisar = (t) => ($("estado").textContent = t);
  const [{ osm, origen }, alturas] = await Promise.all([
    window.OsmMdp.cargarOSM("data/", avisar), window.OsmMdp.cargarAlturas("data/"),
  ]);
  const { edificios, playas } = S.parsearOSM(osm);
  $("estado").textContent = `${edificios.length} edificios y ${playas.length} playas de OpenStreetMap` +
    (origen === "overpass" ? " (descargados ahora)" : "");
  if (origen !== "snapshot") {
    $("guardar-osm").hidden = false;
    $("guardar-osm").onclick = () => descargar("osm.json", osm);
  }

  edificios.forEach((e) => (e.xy = e.ll.map(proy.aXY)));
  playas.forEach((p, i) => {
    p.xy = p.ll.map(proy.aXY);
    p.grilla = S.grillaPlaya(p.xy);
    p.puntos = p.grilla.puntos;
    p.etiqueta = p.nombre || `Playa ${i + 1}`;
  });
  playas.sort((a, b) => b.puntos.length - a.puntos.length);

  // Edificios cuya altura vale la pena cargar (ver PRUEBA)
  const soles = [];
  const anio = hoyISO().slice(0, 4);
  for (const dia of PRUEBA.dias) {
    const fecha = `${anio}-${dia}`;
    const puesta = aMinutos(SunCalc.getTimes(fechaHora(fecha, 12 * 60), CENTRO[0], CENTRO[1]).sunset);
    for (let m = 14 * 60; m < puesta; m += 20) soles.push(S.sol(SunCalc, fechaHora(fecha, m), CENTRO[0], CENTRO[1]));
  }
  const importan = S.puedenSombrear(edificios.map((e) => e.xy), playas.flatMap((p) => p.puntos), soles,
    PRUEBA.pisos * S.PISO_M, (PRUEBA.solMinimo * Math.PI) / 180);
  edificios.forEach((e, i) => (e.importa = importan[i]));

  // --- Mapa
  const mapa = L.map("mapa", { zoomSnap: 0.5 });
  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }
  ).addTo(mapa);
  const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap",
  });
  mapa.fitBounds([[ZONA.sur, ZONA.oeste], [ZONA.norte, ZONA.este]]);

  // Arena pintada según la hora en que pierde el sol, debajo de las sombras
  mapa.createPane("arena").style.zIndex = 380;
  const capaArena = L.layerGroup().addTo(mapa);
  playas.forEach((p) => {
    const g = p.grilla;
    p.lienzo = Object.assign(document.createElement("canvas"), { width: g.nx, height: g.ny });
    const limites = [proy.aLatLon([g.x0, g.y0]), proy.aLatLon([g.x0 + g.nx * g.paso, g.y0 + g.ny * g.paso])];
    p.arena = L.imageOverlay(p.lienzo.toDataURL(), limites, { pane: "arena", opacity: 0.85 }).addTo(capaArena);
  });

  mapa.createPane("sombras").style.zIndex = 390;
  mapa.getPane("sombras").style.opacity = 0.45;
  const rendererSombras = L.canvas({ pane: "sombras" });
  const capaSombras = L.layerGroup().addTo(mapa);
  L.control.layers(
    { "Satélite": satelite, "Calles": calles },
    { "Sol en la arena": capaArena, "Sombras a esa hora": capaSombras },
    { position: "topleft" }
  ).addTo(mapa);

  const capaPlayas = L.layerGroup().addTo(mapa);
  playas.forEach((p) => {
    p.capa = L.polygon(p.ll.map(([lon, lat]) => [lat, lon]), {
      color: "#ffd23f", weight: 2, dashArray: "5 4", fillOpacity: 0.05,
    }).addTo(capaPlayas);
    p.capa.on("click", (ev) => {
      elegirPlaya(p);
      const k = puntoEn(p, ev.latlng);
      if (k >= 0) L.popup().setLatLng(ev.latlng).setContent(textoSol(p.sinSol[k])).openOn(mapa);
    });
  });

  const capaEdificios = L.layerGroup().addTo(mapa);
  edificios.forEach((e) => {
    e.capa = L.polygon(e.ll.map(([lon, lat]) => [lat, lon]), { weight: 1, fillOpacity: 0.85 });
    e.capa.on("click", () => editarEdificio(e));
    e.capa.addTo(capaEdificios);
  });

  // --- Estado
  const estado = {
    fecha: hoyISO(),
    minutos: 18 * 60,
    desnivel: 0,
    defecto: 6,
    playa: playas[0] || null,
  };
  $("fecha").value = estado.fecha;
  $("hora").value = estado.minutos;

  function actualizarAlturas() {
    let conDato = 0;
    edificios.forEach((e) => {
      const a = S.altura(e.tags, alturas[e.id], estado.defecto);
      e.h = a.h;
      e.fuente = a.fuente;
      const c = COLOR_FUENTE[a.fuente === "estimada" && !e.importa ? "lejos" : a.fuente];
      e.capa.setStyle({ color: c.borde, fillColor: c.relleno, fillOpacity: c.opacidad });
      if (e.importa && a.fuente !== "estimada") conDato++;
    });
    const total = importan.filter(Boolean).length;
    $("progreso").textContent = `${conDato} de ${total} edificios que pueden dar sombra a la playa tienen altura.` +
      (total > conDato ? ` Faltan ${total - conDato}, en ámbar.` : "");
  }

  function sombrasEn(min) {
    const s = S.sol(SunCalc, fechaHora(estado.fecha, min), CENTRO[0], CENTRO[1]);
    if (s.altura <= 0) return { s, poligonos: null };
    const poligonos = edificios.map((e) => S.sombraEdificio(e.xy, e.h, s, estado.desnivel)).filter(Boolean);
    return { s, poligonos };
  }

  function porcentajes(poligonos) {
    if (!poligonos) return playas.map(() => 100);
    const indice = S.indexar(poligonos);
    return playas.map((p) => S.porcentajeSombra(p.puntos, indice));
  }

  // Curva de la tarde: de 14:00 a la puesta del sol, cada 10 minutos.
  // De paso, cada punto de arena guarda desde qué hora queda en sombra hasta la puesta (p.sinSol).
  let curva = { horas: [], valores: [] };
  function calcularCurva() {
    const tiempos = SunCalc.getTimes(fechaHora(estado.fecha, 12 * 60), CENTRO[0], CENTRO[1]);
    const puesta = aMinutos(tiempos.sunset);
    estado.puesta = puesta;
    const horas = [];
    for (let m = 14 * 60; m <= puesta + 10; m += 10) horas.push(m);
    const valores = playas.map(() => []);
    const ultimoSol = playas.map((p) => new Int16Array(p.puntos.length).fill(-1));
    horas.forEach((m, k) => {
      const { poligonos } = sombrasEn(m);
      const indice = poligonos && S.indexar(poligonos);
      playas.forEach((p, i) => {
        let n = 0;
        p.puntos.forEach((q, j) => {
          if (indice && !S.enSombra(q, indice)) ultimoSol[i][j] = k;
          else n++;
        });
        valores[i].push(p.puntos.length ? (100 * n) / p.puntos.length : null);
      });
    });
    // La última hora ya es después de la puesta, así que horas[k + 1] siempre existe
    playas.forEach((p, i) => (p.sinSol = Array.from(ultimoSol[i], (k) => horas[k + 1])));
    curva = { horas, valores };
    pintarArena();
  }

  // La escala cubre las últimas horas antes de la puesta: ahí pierde el sol la mayor parte de la arena
  function pintarArena() {
    const ini = Math.max(curva.horas[0], estado.puesta - ESCALA_ARENA_MIN);
    $("rampa-ini").textContent = `${hhmm(ini)} o antes`;
    $("rampa-fin").textContent = `${hhmm(estado.puesta)} (puesta)`;
    playas.forEach((p) => {
      const g = p.grilla;
      const ctx = p.lienzo.getContext("2d");
      const imagen = ctx.createImageData(g.nx, g.ny);
      g.celdas.forEach(([i, j], k) => {
        const o = ((g.ny - 1 - j) * g.nx + i) * 4;   // en la imagen, y crece hacia abajo
        imagen.data.set([...colorRampa((p.sinSol[k] - ini) / (estado.puesta - ini)), 255], o);
      });
      ctx.putImageData(imagen, 0, 0);
      p.arena.setUrl(p.lienzo.toDataURL());
    });
  }

  // Punto de la grilla más cercano al clic (en el borde de la playa el centro de la celda puede quedar afuera)
  function puntoEn(p, latlng) {
    const g = p.grilla;
    const [x, y] = proy.aXY([latlng.lng, latlng.lat]);
    const i = (x - g.x0) / g.paso - 0.5;
    const j = (y - g.y0) / g.paso - 0.5;
    let mejor = -1;
    let dMin = 4;   // hasta 2 celdas
    g.celdas.forEach(([a, b], k) => {
      const d = (a - i) ** 2 + (b - j) ** 2;
      if (d < dMin) { dMin = d; mejor = k; }
    });
    return mejor;
  }

  function textoSol(min) {
    if (min <= curva.horas[0]) return `Acá ya hay sombra a las ${hhmm(curva.horas[0])}.`;
    if (min > estado.puesta) return `Acá hay sol hasta la puesta (${hhmm(estado.puesta)}).`;
    return `Acá el sol se va cerca de las ${hhmm(min)}.`;
  }

  const desde = (i, umbral) => {
    const k = curva.valores[i].findIndex((v) => v >= umbral);
    return k >= 0 ? hhmm(curva.horas[k]) : "—";
  };

  function dibujarHora() {
    const { s, poligonos } = sombrasEn(estado.minutos);
    $("hora-valor").textContent = hhmm(estado.minutos);
    $("sol").textContent = s.altura > 0
      ? `Sol a ${Math.round((s.altura * 180) / Math.PI)}° de altura, desde el ${Math.round(s.rumboSolGrados)}°. Se pone a las ${hhmm(estado.puesta)}.`
      : `El sol ya se puso (${hhmm(estado.puesta)}).`;

    capaSombras.clearLayers();
    (poligonos || []).forEach((pol) => {
      L.polygon(pol.map(proy.aLatLon), {
        renderer: rendererSombras, pane: "sombras", stroke: false, fillColor: "#000", fillOpacity: 1,
        interactive: false,
      }).addTo(capaSombras);
    });

    const ahora = porcentajes(poligonos);
    $("playas").innerHTML = playas.map((p, i) => `
      <li data-i="${i}" class="${p === estado.playa ? "activa" : ""}">
        <span class="nombre">${p.etiqueta}</span>
        <span class="pct">${ahora[i] === null ? "—" : Math.round(ahora[i]) + "% en sombra"}</span>
        <span class="desde">Mitad en sombra desde ${desde(i, 50)} · casi toda desde ${desde(i, 90)}</span>
      </li>`).join("");
    $("playas").querySelectorAll("li").forEach((li) => (li.onclick = () => elegirPlaya(playas[li.dataset.i])));
    dibujarGrafico();
  }

  let grafico = null;
  function dibujarGrafico() {
    const i = playas.indexOf(estado.playa);
    if (i < 0) return;
    const marcas = curva.horas.map((m) => (Math.abs(m - estado.minutos) < 5 ? 5 : 0));
    const datos = {
      labels: curva.horas.map(hhmm),
      datasets: [{
        label: estado.playa.etiqueta,
        data: curva.valores[i].map((v) => (v === null ? null : Math.round(v))),
        borderColor: "#1d1d1b", backgroundColor: "#ffd23f", borderWidth: 1.5,
        pointRadius: marcas, pointBackgroundColor: "#e0b100", fill: false, tension: 0.2,
      }],
    };
    if (!grafico) {
      grafico = new Chart($("grafico"), {
        type: "line",
        data: datos,
        options: {
          maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, title: { display: true, text: estado.playa.etiqueta, align: "start" } },
          scales: {
            y: { min: 0, max: 100, title: { display: true, text: "% en sombra" } },
            x: { ticks: { maxTicksLimit: 8 } },
          },
        },
      });
    } else {
      grafico.data = datos;
      grafico.options.plugins.title.text = estado.playa.etiqueta;
      grafico.update();
    }
  }

  function elegirPlaya(p) {
    estado.playa = p;
    playas.forEach((q) => q.capa.setStyle({ weight: q === p ? 4 : 2 }));
    dibujarHora();
  }

  function editarEdificio(e) {
    const pisos = alturas[e.id] || "";
    const texto = { osm: "dato de OSM", manual: "cargada por vos", estimada: "sin dato, estimada" }[e.fuente];
    const html = `
      <div class="popup">
        <strong>${e.tags.name || e.id}</strong><br>
        Altura: ${Math.round(e.h)} m (${texto})<br>
        <label>Pisos <input type="number" min="1" max="60" value="${pisos}" style="width:64px"></label>
        <button type="button" class="ok">Guardar</button>
        ${alturas[e.id] ? '<button type="button" class="borrar">Quitar</button>' : ""}
      </div>`;
    const centro = e.capa.getBounds().getCenter();
    const pop = L.popup().setLatLng(centro).setContent(html).openOn(mapa);
    const el = pop.getElement();
    el.querySelector(".ok").onclick = () => {
      const n = parseInt(el.querySelector("input").value, 10);
      if (n > 0) {
        alturas[e.id] = n;
        guardarAlturas();
      }
    };
    const borrar = el.querySelector(".borrar");
    if (borrar) borrar.onclick = () => { delete alturas[e.id]; guardarAlturas(); };
  }

  function guardarAlturas() {
    guardarLocal(CLAVE_ALTURAS, alturas);
    mapa.closePopup();
    recalcularTodo();
  }

  function recalcularTodo() {
    actualizarAlturas();
    calcularCurva();
    dibujarHora();
  }

  // --- Controles
  let pendiente = false;
  const enCuadro = (fn) => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; fn(); });
  };
  $("hora").addEventListener("input", () => {
    estado.minutos = Number($("hora").value);
    enCuadro(dibujarHora);
  });
  $("fecha").addEventListener("change", () => {
    if (!$("fecha").value) return;
    estado.fecha = $("fecha").value;
    recalcularTodo();
  });
  $("hoy").addEventListener("click", () => {
    estado.fecha = hoyISO();
    estado.minutos = Math.min(Math.max(aMinutos(new Date()), 420), 1260);
    $("fecha").value = estado.fecha;
    $("hora").value = estado.minutos;
    recalcularTodo();
  });
  const ponerValor = (id, sufijo) => ($(`${id}-valor`).textContent = `${$(id).value} ${sufijo}`);
  $("desnivel").addEventListener("change", () => {
    estado.desnivel = Number($("desnivel").value);
    recalcularTodo();
  });
  $("desnivel").addEventListener("input", () => ponerValor("desnivel", "m"));
  $("defecto").addEventListener("change", () => {
    estado.defecto = Number($("defecto").value);
    recalcularTodo();
  });
  $("defecto").addEventListener("input", () => ponerValor("defecto", "m"));
  ponerValor("desnivel", "m");
  ponerValor("defecto", "m");
  $("rampa").style.background = `linear-gradient(to right, ${RAMPA_SOL.join(", ")})`;
  $("exportar-alturas").addEventListener("click", () => descargar("alturas.json", alturas));

  recalcularTodo();
  if (estado.playa) elegirPlaya(estado.playa);
}

iniciar().catch((e) => {
  $("estado").innerHTML = `<span class="aviso">No se pudieron cargar los datos: ${e.message}. ` +
    `Probá de nuevo en unos minutos o guardá un snapshot en data/osm.json.</span>`;
  console.error(e);
});
