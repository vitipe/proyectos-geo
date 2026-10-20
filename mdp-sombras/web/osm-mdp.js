// Datos compartidos por "Sombras en la playa" y "¿A qué playa ir hoy?":
// zona, consulta a OpenStreetMap, alturas cargadas a mano y utilidades de fecha.
// Las dos páginas leen el mismo snapshot (sombras/data/osm.json) y las mismas alturas.

(function (raiz) {
  // De Playa Grande a La Perla, con margen hacia tierra para las torres
  const ZONA = { sur: -38.04, oeste: -57.556, norte: -37.984, este: -57.52 };
  const CENTRO = [(ZONA.sur + ZONA.norte) / 2, (ZONA.oeste + ZONA.este) / 2];
  const OVERPASS = "https://overpass-api.de/api/interpreter";
  const caja = `${ZONA.sur},${ZONA.oeste},${ZONA.norte},${ZONA.este}`;
  const CONSULTA = `[out:json][timeout:90];
(
  way["building"](${caja});
  relation["building"](${caja});
  way["building:part"](${caja});
  way["natural"="beach"](${caja});
  relation["natural"="beach"](${caja});
  way["natural"="coastline"](${caja});
);
out geom;`;
  const CLAVE_ALTURAS = "sombras-alturas";
  const CLAVE_CACHE = "sombras-osm-v2";   // cambia si cambia la consulta
  const DIAS_CACHE = 30;
  const OFFSET_AR = -3;                   // Argentina, sin horario de verano

  function leerLocal(clave, defecto) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : defecto;
    } catch {
      return defecto;
    }
  }

  function guardarLocal(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* sin almacenamiento disponible: se pierde al recargar */
    }
  }

  function descargar(nombre, objeto) {
    const blob = new Blob([JSON.stringify(objeto)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: nombre });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // base: carpeta donde está osm.json ("data/" desde sombras, "../sombras/data/" desde otra página)
  async function cargarOSM(base, avisar = () => {}) {
    const local = await fetch(`${base}osm.json`).catch(() => null);
    if (local && local.ok) return { osm: await local.json(), origen: "snapshot" };
    const cache = leerLocal(CLAVE_CACHE, null);
    if (cache && Date.now() - cache.fecha < DIAS_CACHE * 86400 * 1000) return { osm: cache.osm, origen: "cache" };
    avisar("Descargando edificios y playas de OpenStreetMap (puede tardar unos segundos)…");
    const r = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: CONSULTA }) });
    if (!r.ok) throw new Error(`Overpass respondió ${r.status}`);
    const osm = await r.json();
    guardarLocal(CLAVE_CACHE, { fecha: Date.now(), osm });
    return { osm, origen: "overpass" };
  }

  async function cargarAlturas(base) {
    const r = await fetch(`${base}alturas.json`).catch(() => null);
    const archivo = r && r.ok ? await r.json() : {};
    return { ...archivo, ...leerLocal(CLAVE_ALTURAS, {}) };
  }

  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const aMinutos = (d) => {
    const local = new Date(d.getTime() + OFFSET_AR * 3600 * 1000);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
  };
  const fechaHora = (fecha, min) => new Date(`${fecha}T${hhmm(min)}:00-03:00`);
  const hoyISO = () => new Date(Date.now() + OFFSET_AR * 3600 * 1000).toISOString().slice(0, 10);
  const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * 86400 * 1000).toISOString().slice(0, 10);

  raiz.OsmMdp = {
    ZONA, CENTRO, CONSULTA, CLAVE_ALTURAS,
    leerLocal, guardarLocal, descargar, cargarOSM, cargarAlturas,
    hhmm, aMinutos, fechaHora, hoyISO, sumarDias,
  };
})(this);
