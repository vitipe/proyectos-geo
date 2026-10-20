// Mapa de agua por año. Lee data/ generado por los scripts 03 y 04 (o la demo).

const fmtKm2 = (v) => (v === null || v === undefined ? "sin dato" : `${Math.round(v).toLocaleString("es-AR")} km²`);
const fmtMm = (v) => (v === null || v === undefined ? "sin dato" : `${Math.round(v).toLocaleString("es-AR")} mm`);

async function cargar(nombre) {
  const r = await fetch(`data/${nombre}`);
  if (!r.ok) throw new Error(`No se pudo leer data/${nombre}`);
  return r.json();
}

async function iniciar() {
  const [serie, limites, partido] = await Promise.all([
    cargar("serie.json"), cargar("limites.json"), cargar("partido.geojson"),
  ]);
  document.getElementById("aviso-demo").hidden = !serie.demo;

  const mapa = L.map("mapa");
  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 18, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }
  );
  const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap",
  }).addTo(mapa);
  L.control.layers({ "Calles": calles, "Satélite": satelite }, null, { position: "topleft" }).addTo(mapa);
  mapa.fitBounds(limites);

  const capaAgua = L.imageOverlay(`data/agua_${serie.anios.at(-1)}.png`, limites, { opacity: 0.9 }).addTo(mapa);
  L.geoJSON(partido, { style: { color: "#a32d2d", weight: 2, fill: false } }).addTo(mapa);

  const slider = document.getElementById("anio");
  slider.min = serie.anios[0];
  slider.max = serie.anios.at(-1);
  slider.value = serie.anios.at(-1);

  const grafico = new Chart(document.getElementById("grafico"), {
    data: {
      labels: serie.anios,
      datasets: [
        { type: "bar", label: "Permanente", data: serie.permanente_km2, backgroundColor: "#1d4e89", stack: "agua", yAxisID: "y" },
        { type: "bar", label: "Estacional", data: serie.estacional_km2, backgroundColor: "#8ecae6", stack: "agua", yAxisID: "y" },
        { type: "line", label: "Lluvia", data: serie.lluvia_mm, borderColor: "#b45309", backgroundColor: "#b45309",
          borderWidth: 1.5, pointRadius: 0, tension: 0.25, yAxisID: "y2" },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { stacked: true, ticks: { maxTicksLimit: 8 } },
        y: { stacked: true, title: { display: true, text: "km² de agua" } },
        y2: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "mm" } },
      },
      onClick: (_, elementos) => {
        if (elementos.length) ponerAnio(serie.anios[elementos[0].index]);
      },
    },
  });

  function ponerAnio(a) {
    slider.value = a;
    document.getElementById("anio-valor").textContent = a;
    capaAgua.setUrl(`data/agua_${a}.png`);
    const i = serie.anios.indexOf(a);
    const cob = serie.cobertura_pct[i];
    document.getElementById("cifras").innerHTML =
      `<dt>Agua permanente</dt><dd>${fmtKm2(serie.permanente_km2[i])}</dd>` +
      `<dt>Agua estacional</dt><dd>${fmtKm2(serie.estacional_km2[i])}</dd>` +
      `<dt>Fuera de lagunas</dt><dd>${fmtKm2(serie.fuera_lagunas_km2[i])}</dd>` +
      `<dt>Lluvia del año</dt><dd>${fmtMm(serie.lluvia_mm[i])}</dd>` +
      (cob < 90 ? `<dt>Cobertura</dt><dd>${cob}% del partido (dato parcial)</dd>` : "");
    const alfa = serie.anios.map((x) => (x === a ? 1 : 0.45));
    grafico.data.datasets[0].backgroundColor = alfa.map((o) => `rgba(29,78,137,${o})`);
    grafico.data.datasets[1].backgroundColor = alfa.map((o) => `rgba(142,202,230,${o})`);
    grafico.update();
  }

  slider.addEventListener("input", () => ponerAnio(Number(slider.value)));
  ponerAnio(serie.anios.at(-1));
}

iniciar().catch((e) => {
  document.getElementById("panel").insertAdjacentHTML(
    "beforeend",
    `<p class="aviso">${e.message}. Corré primero los scripts (o la demo) y serví la carpeta web con un servidor local.</p>`
  );
  console.error(e);
});
