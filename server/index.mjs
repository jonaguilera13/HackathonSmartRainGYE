import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rutasOSRM } from '../src/rutas.js';

const PUERTO = Number(process.env.API_PORT || 8787);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(RAIZ, 'dist');
const JSON_HEADERS = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const validLat = lat => Number.isFinite(lat) && lat >= -2.55 && lat <= -1.9;
const validLng = lng => Number.isFinite(lng) && lng >= -80.15 && lng <= -79.65;
function responder(res, codigo, cuerpo){res.writeHead(codigo,JSON_HEADERS);res.end(JSON.stringify(cuerpo));}
function obtenerPunto(busqueda, sufijo){const lat=Number(busqueda.searchParams.get('lat'+sufijo));const lng=Number(busqueda.searchParams.get('lng'+sufijo));if(!validLat(lat)||!validLng(lng))throw new Error('Coordenadas fuera de la zona de demostración');return {lat,lng};}
async function pronostico(lat,lng){

  if(process.env.INAMHI_FORECAST_URL){
    const url = new URL(process.env.INAMHI_FORECAST_URL);
    if(url.protocol!=='https:') throw new Error('La pasarela de INAMHI debe usar HTTPS');
    url.searchParams.set('lat',String(lat));url.searchParams.set('lng',String(lng));
    const respuesta = await fetch(url,{signal:AbortSignal.timeout(9000)});
    if(!respuesta.ok) throw new Error('Pasarela autorizada INAMHI no disponible');
    const json = await respuesta.json();
    if(!Number.isFinite(json.precipitacion_mm_h))throw new Error('Respuesta INAMHI incompatible. Se espera precipitacion_mm_h numérico');
    return {mmHora:Math.max(0,json.precipitacion_mm_h),hora:json.hora||null,
      fuente:'Pasarela INAMHI configurada por el operador',
      descripcion:'Datos entregados por la pasarela indicada por el operador. No equivalen a transitabilidad.'};
  }
  const args=new URLSearchParams({latitude:String(lat),longitude:String(lng),current:'precipitation,rain,showers,weather_code',hourly:'precipitation,precipitation_probability',forecast_days:'1',timezone:'America/Guayaquil'});
  const respuesta=await fetch(`https://api.open-meteo.com/v1/forecast?${args}`,{signal:AbortSignal.timeout(10000)});
  if(!respuesta.ok)throw new Error('Proveedor meteorológico no disponible');
  const dato=await respuesta.json();
  if(!Number.isFinite(dato.current?.precipitation))throw new Error('Dato meteorológico no disponible');
  return {mmHora:Math.max(0,dato.current.precipitation),hora:dato.current.time,
    fuente:'Open-Meteo (modelo meteorológico)',
    descripcion:'Estimación meteorológica de la hora actual, NO INAMHI ni inundación confirmada.',
    proximasHoras:(dato.hourly?.time||[]).slice(0,8).map((hora,i)=>({hora,mm:dato.hourly.precipitation[i],probabilidad:dato.hourly.precipitation_probability?.[i]??null}))};
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
async function servirWeb(res, pathname){
  let archivo = path.resolve(DIST, `.${decodeURIComponent(pathname==='/'?'/index.html':pathname)}`);
  if(archivo!==DIST && !archivo.startsWith(DIST+path.sep)){res.writeHead(403);res.end();return;}
  try{
    const dato=await readFile(archivo);
    res.writeHead(200, {'Content-Type':MIME[path.extname(archivo)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(dato);
  }catch{res.writeHead(404);res.end('Archivo no encontrado. Ejecuta npm run build primero.');}
}
http.createServer(async(req,res)=>{
  if(req.method!=='GET'){return responder(res,405,{error:'Método no permitido'});}
  let url;
  try{url=new URL(req.url,'http://localhost');}catch{return responder(res,400,{error:'URL inválida'});}
  try {
    if(url.pathname==='/api/estado')return responder(res,200,{app:'SmartRainGYE',modo:'demostracion',seguridad:'simulada',ecu911:'sin conexion',inamhi:process.env.INAMHI_FORECAST_URL?'pasarela configurada':'sin conexion'});
    if(url.pathname==='/api/pronostico'){const punto=obtenerPunto(url,'');return responder(res,200,await pronostico(punto.lat,punto.lng));}
    if(url.pathname==='/api/rutas'){
      const inicio=obtenerPunto(url,'Inicio'),fin=obtenerPunto(url,'Fin');
      const rutas=await rutasOSRM(inicio,fin,AbortSignal.timeout(13000));
      return responder(res,200,{fuente:'OSRM (rutas viales)',rutas});
    }
    if(url.pathname.startsWith('/api/'))return responder(res,404,{error:'Endpoint no disponible'});
    return await servirWeb(res,url.pathname);
  }catch(e){return responder(res,e.message?.includes('fuera de la zona')?400:502,{error:e.message||'Error de proveedor'});}
}).listen(PUERTO,()=>console.log(`SmartRainGYE API en http://localhost:${PUERTO}`));
