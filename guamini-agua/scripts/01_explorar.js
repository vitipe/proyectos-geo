// Paso 1: exploración visual en el Code Editor de Earth Engine
// (https://code.earthengine.google.com). Pegá este script y tocá Run.
// Sirve para ver un año, revisar el umbral de MNDWI y comprobar el polígono
// antes de correr la serie completa en Python.

var ANIO = 2017;            // probá un año húmedo (2017) y uno seco (2023)
var UMBRAL_MNDWI = 0.0;
var MIN_OBS = 6;

// --- Partido (FAO GAUL). Si subiste el del IGN, reemplazá por tu asset.
var partido = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM0_NAME', 'Argentina'))
  .filter(ee.Filter.eq('ADM1_NAME', 'Buenos Aires'))
  .filter(ee.Filter.stringContains('ADM2_NAME', 'Guamin'));
print('Partido encontrado:', partido.aggregate_array('ADM2_NAME'));
var geom = partido.geometry();

// --- Landsat armonizado
var NOMBRES = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];
function preparar(bandas) {
  return function (img) {
    var qa = img.select('QA_PIXEL');
    var nubes = qa.bitwiseAnd(1 << 1).neq(0)
      .or(qa.bitwiseAnd(1 << 3).neq(0))
      .or(qa.bitwiseAnd(1 << 4).neq(0))
      .or(qa.bitwiseAnd(1 << 5).neq(0));
    var sr = img.select(bandas, NOMBRES).multiply(0.0000275).add(-0.2);
    return sr.updateMask(nubes.not()).updateMask(img.select('QA_RADSAT').eq(0))
      .copyProperties(img, ['system:time_start']);
  };
}
var L57 = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];
var L89 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
function col(id, bandas) {
  return ee.ImageCollection(id).filterBounds(geom)
    .filterDate(ANIO + '-01-01', (ANIO + 1) + '-01-01').map(preparar(bandas));
}
var landsat = col('LANDSAT/LT05/C02/T1_L2', L57)
  .merge(col('LANDSAT/LE07/C02/T1_L2', L57))
  .merge(col('LANDSAT/LC08/C02/T1_L2', L89))
  .merge(col('LANDSAT/LC09/C02/T1_L2', L89));
print('Imágenes en ' + ANIO + ':', landsat.size());

// --- Agua
var mndwi = landsat.map(function (i) { return i.normalizedDifference(['green', 'swir1']).rename('mndwi'); });
var agua = mndwi.map(function (i) { return i.gt(UMBRAL_MNDWI).rename('agua'); });
var nObs = agua.count();
var frec = agua.sum().divide(nObs.max(1)).updateMask(nObs.gte(MIN_OBS));

// --- Capas
Map.centerObject(geom, 9);
Map.addLayer(landsat.median().clip(geom), {bands: ['red', 'green', 'blue'], min: 0, max: 0.25}, 'Color natural (mediana)');
Map.addLayer(mndwi.median().clip(geom), {min: -0.6, max: 0.6, palette: ['8c510a', 'f6e8c3', '5ab4ac', '01665e']}, 'MNDWI mediana', false);
Map.addLayer(frec.clip(geom), {min: 0, max: 1, palette: ['ffffff', '8ecae6', '1d4e89']}, 'Frecuencia de agua ' + ANIO);
Map.addLayer(ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').clip(geom),
  {min: 0, max: 100, palette: ['ffffcc', '41b6c4', '0c2c84']}, 'JRC ocurrencia histórica', false);
Map.addLayer(ee.Image().paint(partido, 0, 2), {palette: ['ffffff']}, 'Límite del partido');

// --- Histograma de MNDWI: el valle entre los dos picos es un buen umbral
print(ui.Chart.image.histogram({
  image: mndwi.median(), region: geom, scale: 120, maxBuckets: 120
}).setOptions({title: 'MNDWI mediana ' + ANIO + ' (agua a la derecha)'}));
