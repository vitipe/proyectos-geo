// Simulador de sombras de edificios sobre las playas de Playa Grande a La Perla.
// Datos y utilidades compartidas en osm-mdp.js; geometría en sombras.js.

const { ZONA, CENTRO, CLAVE_ALTURAS, guardarLocal, descargar, hhmm, aMinutos, fechaHora, hoyISO } = window.OsmMdp;
const COLOR_FUENTE = {
  osm: { borde: "#888780", relleno: "#f1efe8" },
  manual: { borde: "#185fa5", relleno: "#b5d4f4" },
  estimada: { borde: "#ba7517", relleno: "#fac775" },
};

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
    p.puntos = S.muestrear(p.xy);
    p.etiqueta = p.nombre || `Playa ${i + 1}`;
  });
  playas.sort((a, b) => b.puntos.length - a.puntos.length);

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
  mapa.fitBounds([[ZONA.sur, ZONA.oeste], [ZONA.norte, ZONA.este]]);

  mapa.createPane("sombras").style.zIndex = 390;
  mapa.getPane("sombras").style.opacity = 0.45;
  const rendererSombras = L.canvas({ pane: "sombras" });
  const capaSombras = L.layerGroup().addTo(mapa);

  const capaPlayas = L.layerGroup().addTo(mapa);
  playas.forEach((p) => {
    p.capa = L.polygon(p.ll.map(([lon, lat]) => [lat, lon]), {
      color: "#ffd23f", weight: 2, dashArray: "5 4", fillOpacity: 0.05,
    }).addTo(capaPlayas);
    p.capa.on("click", () => elegirPlaya(p));
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
    edificios.forEach((e) => {
      const a = S.altura(e.tags, alturas[e.id], estado.defecto);
      e.h = a.h;
      e.fuente = a.fuente;
      e.capa.setStyle({ color: COLOR_FUENTE[a.fuente].borde, fillColor: COLOR_FUENTE[a.fuente].relleno });
    });
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

  // Curva de la tarde: de 14:00 a la puesta del sol, cada 10 minutos
  let curva = { horas: [], valores: [] };
  function calcularCurva() {
    const tiempos = SunCalc.getTimes(fechaHora(estado.fecha, 12 * 60), CENTRO[0], CENTRO[1]);
    const puesta = aMinutos(tiempos.sunset);
    estado.puesta = puesta;
    const horas = [];
    for (let m = 14 * 60; m <= puesta + 10; m += 10) horas.push(m);
    const valores = playas.map(() => []);
    horas.forEach((m) => {
      porcentajes(sombrasEn(m).poligonos).forEach((v, i) => valores[i].push(v));
    });
    curva = { horas, valores };
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
  $("exportar-alturas").addEventListener("click", () => descargar("alturas.json", alturas));

  recalcularTodo();
  if (estado.playa) elegirPlaya(estado.playa);
}

iniciar().catch((e) => {
  $("estado").innerHTML = `<span class="aviso">No se pudieron cargar los datos: ${e.message}. ` +
    `Probá de nuevo en unos minutos o guardá un snapshot en data/osm.json.</span>`;
  console.error(e);
});
