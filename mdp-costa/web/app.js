// Mapa de cambio de la línea de costa. Lee los archivos de data/ que genera
// scripts/06_exportar_web.py (o 00_demo_sintetico.py).

const CORTES = [-1.5, -0.75, -0.25, 0.25, 0.75, 1.5];
const COLORES = ["#b2182b", "#d6604d", "#f4a582", "#bdbdbd", "#92c5de", "#4393c3", "#2166ac"];
const NOMBRES_PERIODO = { total: "Todo el período", pre_1998: "Antes de 1998", post_1998: "Después de 1998" };

const colorTasa = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "#7a7a7a";
  let i = 0;
  while (i < CORTES.length && v >= CORTES[i]) i++;
  return COLORES[i];
};

const fmt = (v) => (v === null || v === undefined ? "sin dato" : `${v > 0 ? "+" : ""}${v.toFixed(2)} m/año`);

async function cargar(nombre) {
  const r = await fetch(`data/${nombre}`);
  if (!r.ok) throw new Error(`No se pudo leer data/${nombre}`);
  return r.json();
}

async function iniciar() {
  const [meta, tramos, transectas, costas, series] = await Promise.all([
    cargar("meta.json"), cargar("tramos.geojson"), cargar("transectas.geojson"),
    cargar("costas_anuales.geojson"), cargar("series.json"),
  ]);

  document.getElementById("aviso-demo").hidden = !meta.demo;

  const mapa = L.map("mapa", { zoomControl: true });
  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }
  ).addTo(mapa);
  const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  });
  L.control.layers({ "Satélite": satelite, "Calles": calles }, null, { position: "topleft" }).addTo(mapa);

  const capaTramos = L.geoJSON(tramos, {
    style: { color: "#ffffff", weight: 1, opacity: 0.6, fill: false, dashArray: "4 4" },
  }).addTo(mapa);
  mapa.fitBounds(capaTramos.getBounds(), { padding: [20, 20] });

  // --- Transectas coloreadas por tasa
  const selPeriodo = document.getElementById("periodo");
  meta.periodos.forEach((p) => selPeriodo.add(new Option(NOMBRES_PERIODO[p] || p, p)));
  let periodo = meta.periodos[0];
  let seleccionada = null;

  const capaTransectas = L.geoJSON(transectas, {
    style: (f) => ({ color: colorTasa(f.properties[`tasa_${periodo}`]), weight: 4, opacity: 0.95 }),
    onEachFeature: (f, capa) => {
      capa.on("click", () => mostrarDetalle(f, capa));
      capa.bindTooltip(() => `${f.properties.name}: ${fmt(f.properties[`tasa_${periodo}`])}`, { sticky: true });
    },
  }).addTo(mapa);

  selPeriodo.addEventListener("change", () => {
    periodo = selPeriodo.value;
    capaTransectas.setStyle((f) => ({ color: colorTasa(f.properties[`tasa_${periodo}`]) }));
    if (seleccionada) seleccionada.setStyle({ weight: 7 });
  });
  dibujarLeyenda();

  // --- Líneas de costa por año
  const anioInicial = meta.anio_min;
  const deAnio = (a) => ({ ...costas, features: costas.features.filter((f) => f.properties.anio === a) });
  L.geoJSON(deAnio(anioInicial), {
    style: { color: "#ffffff", weight: 2, opacity: 0.9, dashArray: "6 5" },
    interactive: false,
  }).addTo(mapa);
  let capaAnio = null;
  const slider = document.getElementById("anio");
  slider.min = meta.anio_min;
  slider.max = meta.anio_max;
  slider.value = meta.anio_max;
  document.getElementById("anio-inicial").textContent = anioInicial;

  const ponerAnio = (a) => {
    document.getElementById("anio-valor").textContent = a;
    if (capaAnio) mapa.removeLayer(capaAnio);
    capaAnio = L.geoJSON(deAnio(a), {
      style: { color: getComputedStyle(document.documentElement).getPropertyValue("--anio-actual").trim() || "#ffd23f", weight: 3 },
      interactive: false,
    }).addTo(mapa);
    if (grafico) marcarAnio(a);
  };
  slider.addEventListener("input", () => ponerAnio(Number(slider.value)));

  // --- Detalle de una transecta
  let grafico = null;
  function mostrarDetalle(f, capa) {
    if (seleccionada) capaTransectas.resetStyle(seleccionada);
    seleccionada = capa;
    capa.setStyle({ weight: 7 });
    const p = f.properties;
    document.querySelector("#detalle .vacio").hidden = true;
    document.getElementById("detalle-contenido").hidden = false;
    document.getElementById("detalle-titulo").textContent = p.name;
    document.getElementById("detalle-tasas").innerHTML = meta.periodos
      .map((per) => `<dt>${NOMBRES_PERIODO[per] || per}</dt><dd>${fmt(p[`tasa_${per}`])}</dd>`)
      .join("") + `<dt>R² total</dt><dd>${p.r2_total ?? "sin dato"}</dd>`;

    const s = series[p.name] || { anios: [], valores: [] };
    if (grafico) grafico.destroy();
    grafico = new Chart(document.getElementById("grafico"), {
      type: "line",
      data: {
        labels: s.anios,
        datasets: [{
          label: "Posición mediana anual (m desde la línea base)",
          data: s.valores,
          borderColor: "#185fa5",
          backgroundColor: "#185fa5",
          borderWidth: 1.5,
          pointRadius: 2,
          tension: 0.2,
        }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { title: { display: true, text: "m desde la línea base" } },
        },
      },
    });
    marcarAnio(Number(slider.value));
  }

  function marcarAnio(a) {
    const ds = grafico.data.datasets[0];
    ds.pointRadius = grafico.data.labels.map((x) => (x === a ? 6 : 2));
    ds.pointBackgroundColor = grafico.data.labels.map((x) => (x === a ? "#e0b100" : "#185fa5"));
    grafico.update();
  }

  ponerAnio(meta.anio_max);
}

function dibujarLeyenda() {
  const el = document.getElementById("leyenda");
  el.innerHTML = COLORES.map((c) => `<div class="caja" style="background:${c}"></div>`).join("") +
    `<div class="extremos"><span>Erosión</span><span>Estable</span><span>Acumulación</span></div>` +
    `<div class="extremos"><span>&lt; −1,5 m/año</span><span>±0,25</span><span>&gt; +1,5 m/año</span></div>`;
}

iniciar().catch((e) => {
  document.getElementById("panel").insertAdjacentHTML(
    "beforeend",
    `<p class="aviso">${e.message}. Corré primero los scripts (o la demo) y serví la carpeta web con un servidor local.</p>`
  );
  console.error(e);
});
