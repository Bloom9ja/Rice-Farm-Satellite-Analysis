var farm = ee.FeatureCollection('projects/olam-nassarawa-rice/assets/Olam_Farm_Boundary');

Map.centerObject(farm, 14);

Map.addLayer(farm, {color: 'red'}, 'Olam Farm Boundary');

var season1_start = '2023-06-01';
var season1_end = '2023-11-30';

var season2_start = '2024-06-01';
var season2_end = '2024-11-30';

var season3_start = '2025-06-01';
var season3_end = '2025-11-30';

var s2 = ee.ImageCollection('Copernicus/S2_SR_HARMONIZED');

// CHECK IMAGE AVAILABILITY PER SEASON

var check_2023 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2023-06-01', '2023-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

var check_2024 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2024-06-01', '2024-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

var check_2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2025-06-01', '2025-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

print('Image count 2023:', check_2023.size());
print('Image count 2024:', check_2024.size());
print('Image count 2025:', check_2025.size());

// Also print the dates of available images so as to see exactly 
// which dates GEE has for the farm

var getDates = function(collection, label) {
  var dates = collection.map(function(img) {
    return img.set('date', img.date().format('YYYY-MM-dd'));
  });
  print(label + ' available dates:', dates.aggregate_array('date'));
};

getDates(check_2023, '2023');
getDates(check_2024, '2024');
getDates(check_2025, '2025');


// RECHECK WITH RELAXED CLOUD FILTER
// Increasing to 90% to see ALL available images
// regardless of cloud cover

var check_2023 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2023-06-01', '2023-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90));

var check_2024 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2024-06-01', '2024-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90));

var check_2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate('2025-06-01', '2025-11-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90));

print('Image count 2023 (90% threshold):', check_2023.size());
print('Image count 2024 (90% threshold):', check_2024.size());
print('Image count 2025 (90% threshold):', check_2025.size());

var getDates = function(collection, label) {
  var dates = collection.map(function(img) {
    return img.set('date', img.date().format('YYYY-MM-dd'));
  });
  print(label + ' available dates:', dates.aggregate_array('date'));
};

getDates(check_2023, '2023');
getDates(check_2024, '2024');
getDates(check_2025, '2025');

// --- Cloud Masking Function ---
// Uses Sentinel-2 Scene Classification Layer (SCL)
// Keeps only: vegetation(4), bare soil(5), water(6)
// Masks: clouds, shadows, haze is masked out
// Divides by 10000 to convert integers to 0-1 reflectance range

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.eq(4)
               .or(scl.eq(5))
               .or(scl.eq(6))
               .or(scl.eq(11));
  return image.updateMask(mask)
              .divide(10000)
              .copyProperties(image, ['system:time_start']);
}

// --- Index Computation Function ---
// NDVI: This measures the vegetation greenness and biomass
// NDMI: This measures the vegetation moisture content
// NDVI and NDMI are the best for a Rice farm as it needs lots of water
// NDVI = (Band8-Band4)/(Band8+Band4)
// NDVI Range: -1 to 1. Healthy Rice is often between 0.4 - 0.8
// NDMI = (Band8-Band11)/(Band8+Band11)

function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8','B4']).rename('NDVI');
  var ndmi = image.normalizedDifference(['B8','B11']).rename('NDMI');
  return image.addBands(ndvi).addBands(ndmi);
}

// -- The code below loads, processes image --
// 90% cloud threshold passes the scenes through and
// SCL then cleans the cloudy pixels
// S2_SR_HARMONIZED = Sentinel-2 Surface Reflectance

// --- 2023 ---
var s2_2023 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate(season1_start, season1_end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',90))
  .map(maskS2clouds)
  .map(addIndices);

// --- 2024 ---  
var s2_2024 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate(season2_start, season2_end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',90))
  .map(maskS2clouds)
  .map(addIndices);
  
// --- 2025 ---  
var s2_2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(farm)
  .filterDate(season3_start, season3_end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',90))
  .map(maskS2clouds)
  .map(addIndices);
  
// Code below confirms image counts after masking
print('Processed image count 2023:', s2_2023.size());
print('Processed image count 2024:', s2_2024.size());
print('Processed image count 2025:', s2_2025.size());

// Full season median composite for all 3 seasons
// Ensures complete spatial coverage and consistency across years

var map_2023 = s2_2023.median().clip(farm);
var map_2024 = s2_2024.median().clip(farm);
var map_2025 = s2_2025.median().clip(farm);

// Visualize result
// NDVI color: red = stressed/low to dark green = healthy/high
// NDMI color: red = dry to blue = moist

var ndviVis = {
  min: 0.0,
  max: 0.9,
  palette: ['red', 'yellow', 'lightgreen', 'green', 'darkgreen'],
  bands: ['NDVI']
};

var ndmiVis = {
  min: -0.2,
  max: 0.6,
  palette: ['red', 'orange', 'yellow', 'lightblue', 'blue'],
  bands: ['NDMI']
};

// This adds maps to layers

Map.addLayer(map_2023.select('NDVI'), ndviVis, 'NDVI 2023');
Map.addLayer(map_2024.select('NDVI'), ndviVis, 'NDVI 2024');
Map.addLayer(map_2025.select('NDVI'), ndviVis, 'NDVI 2025');
Map.addLayer(map_2023.select('NDMI'), ndmiVis, 'NDMI 2023');
Map.addLayer(map_2024.select('NDMI'), ndmiVis, 'NDMI 2024');
Map.addLayer(map_2025.select('NDMI'), ndmiVis, 'NDMI 2025');

// Time Series Charts
// Plot index values over time by using all images in the full season
// low at planting; rise through tillering; peak at heading;
// decline at senescence; sharp drop at harvest

function ndviChartOptions(year) {
  return {
    title: 'NDVI Time Series - Olam Rice Farm ' + year,
    hAxis: {title: 'Date'},
    vAxis: {title: 'NDVI', minValue: 0, maxValue:1},
    lineWitdth: 2,
    pointSize: 5,
    colors: ['1a9641']
  };
}

function ndmiChartOptions(year) {
  return {
    title: 'NDMI Time Series - Olam Rice Farm ' + year,
    hAxis: {title: 'Date'},
    vAxis: {title: 'NDMI', minValue: -0.5, maxValue: 1},
    lineWidth: 2,
    pointSize: 5,
    colors: ['2166ac']
  };
}

// NDVI time series; one per season

var ndvi_2023 = ui.Chart.image.series({
  imageCollection: s2_2023.select('NDVI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndviChartOptions('2023'));

var ndvi_2024 = ui.Chart.image.series({
  imageCollection: s2_2024.select('NDVI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndviChartOptions('2024'));

var ndvi_2025 = ui.Chart.image.series({
  imageCollection: s2_2025.select('NDVI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndviChartOptions('2025'));

// NDMI time series; one per season

var ndmi_2023 = ui.Chart.image.series({
  imageCollection: s2_2023.select('NDMI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndmiChartOptions('2023'));

var ndmi_2024 = ui.Chart.image.series({
  imageCollection: s2_2024.select('NDMI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndmiChartOptions('2024'));

var ndmi_2025 = ui.Chart.image.series({
  imageCollection: s2_2025.select('NDMI'),
  region: farm.geometry(),
  reducer: ee.Reducer.mean(),
  scale: 10,
  xProperty: 'system:time_start'
}).setOptions(ndmiChartOptions('2025'));

// Print NDVI charts to console
print('=== NDVI TIME SERIES ===');
print(ndvi_2023);
print(ndvi_2024);
print(ndvi_2025);

// Print NDMI charts to console
print('=== NDMI TIME SERIES ===');
print(ndmi_2023);
print(ndmi_2024);
print(ndmi_2025);

// Statistics (min, max and mean of NDVI & NDMI)

var statsReducer = ee.Reducer.min()
  .combine(ee.Reducer.max(), '', true)
  .combine(ee.Reducer.mean(), '', true);
  
var stats_2023 = map_2023.select(['NDVI', 'NDMI'])
.reduceRegion({
    reducer: statsReducer,
    geometry: farm.geometry(),
    scale: 10,
    maxPixels: 1e9
  });
  
var stats_2024 = map_2024.select(['NDVI', 'NDMI'])
  .reduceRegion({
    reducer: statsReducer,
    geometry: farm.geometry(),
    scale: 10,
    maxPixels: 1e9
  });
  
var stats_2025 = map_2025.select(['NDVI', 'NDMI'])
  .reduceRegion({
    reducer: statsReducer,
    geometry: farm.geometry(),
    scale: 10,
    maxPixels: 1e9
  });

print('=== STATISTICS ===');
print('Stats 2023:', stats_2023);
print('Stats 2024:', stats_2024);
print('Stats 2025:', stats_2025);

// Exporting Stats as CSV

var statsTable = ee.FeatureCollection([
  ee.Feature(null, stats_2023.set('season', '2023')),
  ee.Feature(null, stats_2024.set('season', '2024')),
  ee.Feature(null, stats_2025.set('season', '2025'))
]);

Export.table.toDrive({
  collection: statsTable,
  description: 'Olam_Farm_Statistics',
  folder: 'Olam_GEE_Exports',
  fileFormat: 'CSV'
});

// Export NDVI and NDMi as GeoTIFF to Drive

// NDVI exports

Export.image.toDrive({
  image: map_2023.select('NDVI'),
  description: 'NDVI_Olam_2023',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDVI_OlAM_2023',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: map_2024.select('NDVI'),
  description: 'NDVI_Olam_2024',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDVI_OlAM_2024',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: map_2025.select('NDVI'),
  description: 'NDVI_Olam_2025',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDVI_OlAM_2025',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

// NDMI exports

Export.image.toDrive({
  image: map_2023.select('NDMI'),
  description: 'NDMI_Olam_2023',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDMI_OlAM_2023',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: map_2024.select('NDMI'),
  description: 'NDMI_Olam_2024',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDMI_OlAM_2024',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: map_2025.select('NDMI'),
  description: 'NDMI_Olam_2025',
  folder: 'Olam_GEE_Exports',
  fileNamePrefix: 'NDMI_OlAM_2025',
  region: farm.geometry(),
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});

// Each property is a separate ee.Image on GEE
// Band name for surface layer is 'mean_0_20'
// Sand, Silt, Clay: values are already in percentage — NO transformation needed
// pH: divide by 10 to get real pH units

var sand = ee.Image('ISDASOIL/Africa/v1/sand_content')
             .select('mean_0_20').rename('sand_pct');

var silt = ee.Image('ISDASOIL/Africa/v1/silt_content')
             .select('mean_0_20').rename('silt_pct');

var clay = ee.Image('ISDASOIL/Africa/v1/clay_content')
             .select('mean_0_20').rename('clay_pct');

var ph   = ee.Image('ISDASOIL/Africa/v1/ph')
             .select('mean_0_20').divide(10).rename('ph');

// Combine into one multi-band image
var soilImage = sand.addBands(silt).addBands(clay).addBands(ph);

// Extract mean values over farm boundary
var soilStats = soilImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farm.geometry(),
  scale: 30,
  maxPixels: 1e9
});

print('=== SOIL PROPERTIES (0-20cm) ===');
print('Sand (%), Silt (%), Clay (%), pH:', soilStats);

// Export soil data as CSV
Export.table.toDrive({
  collection: ee.FeatureCollection([ee.Feature(null, soilStats)]),
  description: 'Olam_Farm_Soil_Properties',
  folder: 'Olam_GEE_Exports',
  fileFormat: 'CSV'
});
