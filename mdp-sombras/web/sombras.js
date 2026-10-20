// Geometría de sombras, sin dependencias de Leaflet (se puede probar con Node).
// Coordenadas internas en metros, en un plano local centrado en la zona.

(function (raiz) {
  const PISO_M = 3;
  const SOMBRA_MAX_M = 1500;

  function proyeccion(lat0, lon0) {
    const mLat = 110574;
    const mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
    return {
      aXY: ([lon, lat]) => [(lon - lon0) * mLon, (lat - lat0) * mLat],
      aLatLon: ([x, y]) => [lat0 + y / mLat, lon0 + x / mLon],
    };
  }

  const igual = (a, b) => a[0] === b[0] && a[1] === b[1];
  const cerrado = (ll) => ll.length >= 4 && igual(ll[0], ll.at(-1));

  // Las relaciones suelen traer el borde exterior partido en varias vías.
  // Encadena las abiertas por sus extremos (invirtiéndolas si hace falta);
  // lo que no llega a cerrar se descarta.
  function unirAnillos(lineas) {
    const anillos = lineas.filter(cerrado);
    const sueltas = lineas.filter((l) => !cerrado(l));
    while (sueltas.length) {
      let actual = sueltas.shift();
      let unio = true;
      while (!cerrado(actual) && unio) {
        unio = false;
        for (let i = 0; i < sueltas.length; i++) {
          const l = sueltas[i];
          if (igual(actual.at(-1), l[0])) actual = actual.concat(l.slice(1));
          else if (igual(actual.at(-1), l.at(-1))) actual = actual.concat(l.slice(0, -1).reverse());
          else continue;
          sueltas.splice(i, 1);
          unio = true;
          break;
        }
      }
      if (cerrado(actual)) anillos.push(actual);
    }
    return anillos;
  }

  // Elementos de Overpass ("out geom") -> edificios y playas con anillos [lon, lat]
  function parsearOSM(osm) {
    const edificios = [];
    const playas = [];
    const costas = [];
    for (const el of osm.elements || []) {
      const t = el.tags || {};
      if (t.natural === "coastline" && el.type === "way" && el.geometry) {
        // En OSM la línea de costa se dibuja con la tierra a la izquierda y el mar a la derecha
        costas.push({ id: `way/${el.id}`, ll: el.geometry.map((p) => [p.lon, p.lat]) });
        continue;
      }
      const aLL = (g) => g.map((p) => [p.lon, p.lat]);
      let anillos = [];
      if (el.type === "way" && el.geometry) anillos = [aLL(el.geometry)].filter(cerrado);
      else if (el.type === "relation" && el.members) {
        // rol vacío: miembros viejos sin etiquetar, que OSM toma como "outer"
        const exteriores = el.members.filter((m) => (m.role === "outer" || m.role === "") && m.geometry);
        anillos = unirAnillos(exteriores.map((m) => aLL(m.geometry)));
      }
      anillos.forEach((ll, i) => {
        const id = `${el.type}/${el.id}${anillos.length > 1 ? "#" + i : ""}`;
        if (t.building || t["building:part"]) edificios.push({ id, tags: t, ll });
        else if (t.natural === "beach") playas.push({ id, nombre: t.name || null, ll });
      });
    }
    return { edificios, playas, costas };
  }

  function altura(tags, pisosManual, alturaDefecto) {
    if (pisosManual) return { h: pisosManual * PISO_M, fuente: "manual" };
    const h = parseFloat(tags.height);
    if (h > 0) return { h, fuente: "osm" };
    const n = parseFloat(tags["building:levels"]);
    if (n > 0) {
      const techo = parseFloat(tags["roof:levels"]) || 0;
      return { h: (n + techo) * PISO_M, fuente: "osm" };
    }
    return { h: alturaDefecto, fuente: "estimada" };
  }

  // Posición del sol con SunCalc -> dirección de la sombra (rumbo desde el norte, horario)
  // SunCalc mide el azimut desde el sur hacia el oeste; la sombra apunta justo a ese rumbo.
  function sol(suncalc, fecha, lat, lon) {
    const p = suncalc.getPosition(fecha, lat, lon);
    const rumboSol = ((p.azimuth + Math.PI) * 180) / Math.PI % 360;
    return { altura: p.altitude, rumboSombra: p.azimuth, rumboSolGrados: rumboSol };
  }

  function envolvente(puntos) {
    const p = puntos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const inf = [];
    for (const q of p) {
      while (inf.length >= 2 && cruz(inf.at(-2), inf.at(-1), q) <= 0) inf.pop();
      inf.push(q);
    }
    const sup = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (sup.length >= 2 && cruz(sup.at(-2), sup.at(-1), q) <= 0) sup.pop();
      sup.push(q);
    }
    return inf.slice(0, -1).concat(sup.slice(0, -1));
  }

  // Sombra de un edificio: envolvente convexa de la planta y la planta desplazada.
  // Es exacta para plantas convexas y algo generosa para plantas en L o en U.
  function sombraEdificio(xy, h, s, desnivel) {
    if (s.altura <= 0) return null;
    const largo = Math.min((h + desnivel) / Math.tan(s.altura), SOMBRA_MAX_M);
    const dx = Math.sin(s.rumboSombra) * largo;
    const dy = Math.cos(s.rumboSombra) * largo;
    const desplazada = xy.map(([x, y]) => [x + dx, y + dy]);
    return envolvente(xy.concat(desplazada));
  }

  function dentro([x, y], pol) {
    let adentro = false;
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const [xi, yi] = pol[i];
      const [xj, yj] = pol[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
    }
    return adentro;
  }

  function caja(pol) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pol) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  // Puntos de muestreo dentro de una playa, con paso adaptado al tamaño
  function muestrear(xy, objetivo = 2500) {
    const [x0, y0, x1, y1] = caja(xy);
    const paso = Math.max(2, Math.sqrt(((x1 - x0) * (y1 - y0)) / objetivo));
    const puntos = [];
    for (let x = x0 + paso / 2; x < x1; x += paso) {
      for (let y = y0 + paso / 2; y < y1; y += paso) {
        if (dentro([x, y], xy)) puntos.push([x, y]);
      }
    }
    return puntos;
  }

  // Índice de grilla para no testear cada punto contra todas las sombras
  function indexar(poligonos, celda = 40) {
    const mapa = new Map();
    poligonos.forEach((pol, i) => {
      const [x0, y0, x1, y1] = caja(pol);
      for (let cx = Math.floor(x0 / celda); cx <= Math.floor(x1 / celda); cx++) {
        for (let cy = Math.floor(y0 / celda); cy <= Math.floor(y1 / celda); cy++) {
          const k = cx + "," + cy;
          if (!mapa.has(k)) mapa.set(k, []);
          mapa.get(k).push(i);
        }
      }
    });
    return { mapa, celda, poligonos };
  }

  function enSombra(p, indice) {
    const k = Math.floor(p[0] / indice.celda) + "," + Math.floor(p[1] / indice.celda);
    const candidatos = indice.mapa.get(k);
    if (!candidatos) return false;
    return candidatos.some((i) => dentro(p, indice.poligonos[i]));
  }

  function porcentajeSombra(puntos, indice) {
    if (!puntos.length) return null;
    let n = 0;
    for (const p of puntos) if (enSombra(p, indice)) n++;
    return (100 * n) / puntos.length;
  }


  // --- Orientación de playas y viento ----------------------------------------

  const sinCierre = (xy) =>
    xy.length > 1 && xy[0][0] === xy.at(-1)[0] && xy[0][1] === xy.at(-1)[1] ? xy.slice(0, -1) : xy;

  function centroide(xy) {
    const pts = sinCierre(xy);
    const n = pts.length;
    return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n];
  }

  function distanciaSegmento([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  const rumbo = (x, y) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;

  // Rumbo hacia el mar (grados desde el norte, horario) visto desde la playa.
  // Usa la línea de costa de OSM cercana; si no hay, el eje largo de la playa
  // con el mar hacia el este (válido para la costa de Mar del Plata).
  function orientacionPlaya(playaXY, costasXY, radio = 400) {
    const c = centroide(playaXY);
    let nx = 0, ny = 0;
    for (const linea of costasXY) {
      for (let i = 0; i < linea.length - 1; i++) {
        const a = linea[i], b = linea[i + 1];
        const d = distanciaSegmento(c, a, b);
        if (d >= radio) continue;
        const lx = b[0] - a[0], ly = b[1] - a[1];
        const largo = Math.hypot(lx, ly);
        if (!largo) continue;
        const peso = largo * (1 - d / radio);
        nx += (ly / largo) * peso;   // normal a la derecha del sentido de la línea
        ny += (-lx / largo) * peso;
      }
    }
    if (Math.hypot(nx, ny) > 0) return { rumbo: rumbo(nx, ny), fuente: "costa" };

    const pts = sinCierre(playaXY).map(([x, y]) => [x - c[0], y - c[1]]);
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += x * x; syy += y * y; sxy += x * y; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);   // eje principal
    let px = -Math.sin(ang), py = Math.cos(ang);         // perpendicular al eje
    if (px < 0) { px = -px; py = -py; }                  // mar hacia el este
    return { rumbo: rumbo(px, py), fuente: "estimada" };
  }

  // Cuánto le pega el viento a una playa según de dónde viene.
  // vientoDesde: dirección meteorológica (de dónde sopla), en grados.
  function exposicion(rumboMar, vientoDesde) {
    const delta = (((vientoDesde - rumboMar) % 360) + 540) % 360 - 180;
    const coseno = Math.cos((delta * Math.PI) / 180);
    const tipo = coseno > 0.5 ? "del mar" : coseno < -0.5 ? "de tierra" : "de costado";
    return { coseno, tipo, delta };
  }

  const api = {
    PISO_M, proyeccion, parsearOSM, altura, sol, envolvente, sombraEdificio,
    dentro, muestrear, indexar, porcentajeSombra, centroide, orientacionPlaya, exposicion,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Sombras = api;
})(this);
