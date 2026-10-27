var sectores = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-79.8848,-2.1913]),{sector:'Centro'}),
  ee.Feature(ee.Geometry.Point([-79.9121,-2.1701]),{sector:'Urdesa'}),
  ee.Feature(ee.Geometry.Point([-79.8905,-2.1320]),{sector:'Sauces'}),
  ee.Feature(ee.Geometry.Point([-79.9292,-2.1555]),{sector:'Mapasingue'}),
  ee.Feature(ee.Geometry.Point([-79.9048,-2.2383]),{sector:'Sur'}),
]);
var anios=ee.List.sequence(2020,2025);
var datos=ee.FeatureCollection(anios.map(function(anio){
  anio=ee.Number(anio);
  var inicio=ee.Date.fromYMD(anio,1,1);
  var fin=ee.Date.fromYMD(anio,6,1);
  var lluvia=ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(inicio,fin).select('precipitation').sum();
  return lluvia.sampleRegions({collection:sectores,scale:5500,geometries:false})
    .map(function(f){return f.set('year',anio).set('precipitation_mm',f.get('precipitation'));});
})).flatten();
print('Resumen CHIRPS por sector y año',datos);
Map.centerObject(sectores,11);
Map.addLayer(sectores,{color:'cyan'},'Sectores referenciales');
Export.table.toDrive({collection:datos,description:'CHIRPS_Guayaquil_2020_2025',fileFormat:'CSV',selectors:['sector','year','precipitation_mm']});
