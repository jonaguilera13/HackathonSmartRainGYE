//Calcula o gestiona rutas alternativas, rápidas o seguras.
import { ZONAS_INUNDACION_DEMO, ZONAS_SEGURIDAD_DEMO } from './datos.js';

const R = 6371000;
export function metros(a,b) {
  const v=x=>x*Math.PI/180;
  const dLat=v(b.lat-a.lat),dLng=v(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(v(a.lat))*Math.cos(v(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}
function exposicionPunto(p, zonas) {
  return Math.max(0,...zonas.map(z=>Math.max(0,1-metros(p,z)/z.radio)*z.gravedad));
}
export function evaluarRiesgo(camino,mm,zonasSeguridad=ZONAS_SEGURIDAD_DEMO) {
  if(!camino || camino.length<2) return {lluvia:0,seguridad:0,total:0};
  let sumaL=0,sumaS=0,sumaRoja=0,totalM=0;
  for(let i=1;i<camino.length;i++) {
    const a=camino[i-1],b=camino[i],d=metros(a,b);
    if(!d)continue;

    const n=Math.max(1,Math.ceil(d/150));
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,p={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
      sumaL+=exposicionPunto(p,ZONAS_INUNDACION_DEMO)*d/n;
      sumaS+=exposicionPunto(p,zonasSeguridad)*d/n;
      if (zonasSeguridad.some(z=>z.semaforo==='Rojo' && metros(p,z)<z.radio)) sumaRoja+=d/n;
    }
    totalM+=d;
  }
  const lluvia=totalM?Math.min(100,Math.round(sumaL/totalM*(.35+.65*mm/65)*100)):0;
  const seguridad=totalM?Math.min(100,Math.round(sumaS/totalM*100)):0;
  return {lluvia,seguridad,total:Math.round(lluvia*.65+seguridad*.35),exposicionRoja:totalM?Math.round(100*sumaRoja/totalM):0};
}
function distanciaCamino(path) {return path.slice(1).reduce((s,p,i)=>s+metros(path[i],p),0)}
function esquematica(a,b,desvio,escala) {

  const dx=b.lng-a.lng,dy=b.lat-a.lat;
  const out=[];
  for(let i=0;i<=20;i++) {
    const t=i/20,curva=Math.sin(Math.PI*t)*desvio*escala;
    out.push({lat:a.lat+dy*t+dx*curva,lng:a.lng+dx*t-dy*curva});
  }
  return out;
}
export function rutasDeEjemplo(inicio,fin) {

  const km=metros(inicio,fin)/1000;
  const amplitud=0.34;
  return [
    {id:'e0',camino:esquematica(inicio,fin,0,amplitud),km:km*1.36,minutos:Math.max(4,Math.round(km*3.9))},
    {id:'e1',camino:esquematica(inicio,fin,1,amplitud),km:km*1.54,minutos:Math.max(6,Math.round(km*4.6))},
    {id:'e2',camino:esquematica(inicio,fin,-1.2,amplitud),km:km*1.78,minutos:Math.max(8,Math.round(km*5.5))},
  ];
}
export async function rutasOSRM(origen,destino,signal) {

  const base='https://router.project-osrm.org/route/v1/driving/';
  const coords=`${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;
  const url=base+coords+'?overview=full&geometries=geojson&steps=false&alternatives=3';
  const res=await fetch(url,{signal});
  if(!res.ok)throw new Error('Proveedor de rutas temporalmente inaccesible');
  const data=await res.json();
  if(data.code!=='Ok'||!data.routes?.length)throw new Error('No hay ruta vial disponible');
  return data.routes.map((ruta,i)=>({id:'o'+i,camino:ruta.geometry.coordinates.map(([lng,lat])=>({lat,lng})),km:ruta.distance/1000,minutos:Math.max(1,Math.round(ruta.duration/60))}));
}

export async function rutasConBackend(origen,destino,signal) {
  const q = new URLSearchParams({latInicio:String(origen.lat),lngInicio:String(origen.lng),latFin:String(destino.lat),lngFin:String(destino.lng)});
  try {
    const r=await fetch(`/api/rutas?${q}`,{signal,headers:{Accept:'application/json'}});
    if(r.ok && r.headers.get('content-type')?.includes('application/json')) {
      const dato=await r.json();
      if(Array.isArray(dato.rutas) && dato.rutas.length)return {rutas:dato.rutas,fuente:'OSRM vía API REST'};
    }
  } catch(e) {if(e.name==='AbortError')throw e;}
  return {rutas:await rutasOSRM(origen,destino,signal),fuente:'OSRM (real, demo)'};
}
let googleCargado=null;
export async function cargarGoogleMaps(key) {
  if(window.google?.maps?.importLibrary)return window.google;
  if(googleCargado)return googleCargado;
  googleCargado=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.async=true;
    script.onload=()=> window.google?.maps?.importLibrary ? resolve(window.google) : reject(new Error('No se pudo activar Google Maps'));
    script.onerror=()=>{googleCargado=null;reject(new Error('No se pudo descargar Google Maps'));};
    document.head.appendChild(script);
  });
  return googleCargado;
}
export async function rutasGoogle(origen,destino) {
  const {Route}=await window.google.maps.importLibrary('routes');
  const result=await Route.computeRoutes({
    origin:{lat:origen.lat,lng:origen.lng},
    destination:{lat:destino.lat,lng:destino.lng},
    travelMode:'DRIVING',
    computeAlternativeRoutes:true,
    fields:['path','durationMillis','distanceMeters','routeLabels'],
  });
  if(!result.routes?.length)throw new Error('Google no encontró rutas en este recorrido');
  return result.routes.map((route,i)=>{
    const camino=Array.from(route.path||[]).map(p=>({lat:typeof p.lat==='function'?p.lat():p.lat,lng:typeof p.lng==='function'?p.lng():p.lng}));
    return {id:'g'+i,camino,km:(route.distanceMeters||distanciaCamino(camino))/1000,minutos:Math.max(1,Math.round((route.durationMillis||0)/60000))};
  }).filter(r=>r.camino.length>=2);
}
export function estimarDemora(minutosBase, riesgo) {
  const factorLluvia = 0.55 * riesgo.lluvia / 100;
  const factorPrecaucion = 0.12 * riesgo.seguridad / 100;
  return Math.max(1, Math.ceil(minutosBase * (1 + factorLluvia + factorPrecaucion)));
}

export function compararRutas(candidatas, mm, zonasSeguridad=ZONAS_SEGURIDAD_DEMO) {
  if (!candidatas?.length) return [];

  const evaluadas = candidatas.map(ruta => {
    const riesgo = evaluarRiesgo(ruta.camino, mm, zonasSeguridad);
    return {
      ...ruta,
      riesgo,
      minutosEstimados: estimarDemora(ruta.minutos, riesgo),
    };
  });
  const tiempoOrdenado = [...evaluadas].sort((a,b) =>
    a.minutosEstimados - b.minutosEstimados || a.riesgo.total - b.riesgo.total
  );
  const masRapida = tiempoOrdenado[0];
  const usadas = new Set([masRapida.id]);
  const resultado = [{...masRapida, tipo:'rapida', nombre:'Más rápida', color:'#63aeff'}];

  if (evaluadas.length > 1) {
    const masSeguraDisponible = [...evaluadas]
      .filter(r => !usadas.has(r.id))
      .sort((a,b) => a.riesgo.exposicionRoja - b.riesgo.exposicionRoja || a.riesgo.total - b.riesgo.total || a.minutosEstimados - b.minutosEstimados)[0];
    usadas.add(masSeguraDisponible.id);
    const mejora = masSeguraDisponible.riesgo.exposicionRoja < masRapida.riesgo.exposicionRoja || (masSeguraDisponible.riesgo.exposicionRoja === masRapida.riesgo.exposicionRoja && masSeguraDisponible.riesgo.total < masRapida.riesgo.total);
    resultado.push({
      ...masSeguraDisponible,
      tipo: mejora ? 'segura' : 'comparacion',
      nombre: mejora ? 'Más segura' : 'Otra alternativa',
      color:'#42d6aa',
    });
  }

  const restantes = evaluadas.filter(r => !usadas.has(r.id));
  if (restantes.length) {
    const minT = Math.min(...evaluadas.map(r=>r.minutosEstimados));
    const maxT = Math.max(...evaluadas.map(r=>r.minutosEstimados));
    const minR = Math.min(...evaluadas.map(r=>r.riesgo.total));
    const maxR = Math.max(...evaluadas.map(r=>r.riesgo.total));
    const puntuacion = r => 0.5 * (r.minutosEstimados - minT) / (maxT - minT || 1)
      + 0.5 * (r.riesgo.total - minR) / (maxR - minR || 1);
    const entre = (x,a,b) => x>=Math.min(a,b) && x<=Math.max(a,b);
    const realmenteIntermedias = restantes.filter(r=>
      entre(r.minutosEstimados, masRapida.minutosEstimados, resultado[1].minutosEstimados)
      && entre(r.riesgo.total, masRapida.riesgo.total, resultado[1].riesgo.total)
    );
    const grupo = realmenteIntermedias.length ? realmenteIntermedias : restantes;
    const equilibrada = [...grupo].sort((a,b)=>puntuacion(a)-puntuacion(b))[0];
    resultado.push({
      ...equilibrada,
      tipo:'extra',
      nombre:realmenteIntermedias.length?'Alternativa intermedia':'Alternativa adicional',
      color:'#ffba67',
    });
  }
  return resultado;
}
