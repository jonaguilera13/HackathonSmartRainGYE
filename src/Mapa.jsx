import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GUAYAQUIL, VOLUNTARIO, ZONAS_INUNDACION_DEMO, ZONAS_SEGURIDAD_DEMO } from './datos.js';
import { cargarGoogleMaps } from './rutas.js';

const htmlPin=(label,bg,selected=false)=>L.divIcon({
  className:'custom-pin',iconSize:[35,45],iconAnchor:[17,37],
  html:`<div class="pin-icon ${selected?'pin-selected':''}" style="--pin-color:${bg}">${label}</div>`,
});
const pos=p=>[p.lat,p.lng];
function LeafletMapa({solicitudes,seleccionada,origenRuta,destinoRuta,rutaPersonalizada,opciones,rutaActiva,verInundacion,verSeguridad,verSolicitudes,lluvia,elegirSolicitud,modoClick,elegirPuntoMapa,zonasSeguridad}){
  const contenedor=useRef(null),mapa=useRef(null),capa=useRef(null),prevSeleccion=useRef(null);
  useEffect(()=>{
    if(!contenedor.current||mapa.current)return;
    const map=L.map(contenedor.current,{zoomControl:false,preferCanvas:true}).setView(GUAYAQUIL,12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom:19,
    }).addTo(map);
    L.control.zoom({position:'bottomright'}).addTo(map);
    const layer=L.layerGroup().addTo(map);
    mapa.current=map;capa.current=layer;
    setTimeout(()=>{if(mapa.current===map)map.invalidateSize();},80);
    return ()=>{map.remove();mapa.current=null;capa.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapa.current;
    if(!map || !modoClick)return;
    const click = e => elegirPuntoMapa(modoClick,{lat:e.latlng.lat,lng:e.latlng.lng});
    map.on('click',click);
    map.getContainer().style.cursor='crosshair';
    return ()=>{map.off('click',click);map.getContainer().style.cursor='';};
  },[modoClick,elegirPuntoMapa]);
  useEffect(()=>{
    const map=mapa.current,layer=capa.current;
    if(!map||!layer)return;
    layer.clearLayers();
    const fuerza=.3+.7*lluvia/65;
    if(verInundacion)ZONAS_INUNDACION_DEMO.forEach(z=>L.circle(pos(z),{
      radius:z.radio,color:'#ff797e',weight:1.7,dashArray:'6 7',fillColor:'#fb5d78',fillOpacity:0.09+z.gravedad*fuerza*.18,
    }).bindTooltip(`${z.nombre} · LLUVIA SIMULADA`).addTo(layer));
    if(verSeguridad)(zonasSeguridad||ZONAS_SEGURIDAD_DEMO).forEach(z=>{
      const color=z.semaforo==='Rojo'?'#ef5e69':z.semaforo==='Verde'?'#22bc91':'#f2b64f';
      L.circle(pos(z),{radius:z.radio,color,weight:1.7,dashArray:'5 6',fillColor:color,fillOpacity:.08+z.gravedad*.11})
        .bindTooltip(`${z.semaforo} · ${z.nombre} · SEGURIDAD SIMULADA`).addTo(layer);
    });
    opciones.filter(r=>r.id!==rutaActiva).forEach(r=>L.polyline(r.camino.map(pos),{color:r.color,weight:4,opacity:.40,dashArray:'7 9'}).addTo(layer));
    const activa=opciones.find(r=>r.id===rutaActiva);
    if(activa){
      L.polyline(activa.camino.map(pos),{color:'#081827',weight:11,opacity:.80}).addTo(layer);
      L.polyline(activa.camino.map(pos),{color:activa.color,weight:6,opacity:1}).addTo(layer);
    }
    const pinInicio=origenRuta||VOLUNTARIO;
    L.marker(pos(pinInicio),{icon:htmlPin(rutaPersonalizada?'O':'V','#68b5ff'),zIndexOffset:100})
      .bindTooltip(rutaPersonalizada?'Origen seleccionado':'Voluntario · origen de demostración').addTo(layer);
    if(rutaPersonalizada&&destinoRuta)L.marker(pos(destinoRuta),{
      icon:htmlPin('D','#42d6aa'),zIndexOffset:110,
    }).bindTooltip('Destino seleccionado').addTo(layer);
    if(verSolicitudes)solicitudes.filter(s=>s.estado!=='Completada').forEach(s=>{
      const marcador=L.marker(pos(s),{icon:htmlPin(s.personas,'#ffbf68',s.id===seleccionada?.id),zIndexOffset:s.id===seleccionada?.id?200:20});
      marcador.bindTooltip(`${s.sector} · ${s.personas} personas · FICTICIO`);
      marcador.on('click',()=>elegirSolicitud(s.id));marcador.addTo(layer);
    });
    const clave=origenRuta&&destinoRuta?`${origenRuta.lat}/${origenRuta.lng}/${destinoRuta.lat}/${destinoRuta.lng}`:null;
    if(clave&&prevSeleccion.current!==clave){
      map.fitBounds([pos(origenRuta),pos(destinoRuta)],{padding:[62,62],maxZoom:13,animate:true});
      prevSeleccion.current=clave;
    }
  },[solicitudes,seleccionada,origenRuta,destinoRuta,rutaPersonalizada,opciones,rutaActiva,verInundacion,verSeguridad,verSolicitudes,lluvia,elegirSolicitud,zonasSeguridad]);
  return <div ref={contenedor} className={`map-canvas ${modoClick?'seleccionando-punto':''}`} aria-label="Mapa de Guayaquil: selecciona el origen o destino haciendo clic"/>;
}
function GoogleMapa({apiKey,solicitudes,seleccionada,origenRuta,destinoRuta,rutaPersonalizada,opciones,rutaActiva,verInundacion,verSeguridad,verSolicitudes,lluvia,elegirSolicitud,modoClick,elegirPuntoMapa,zonasSeguridad}){
  const div=useRef(null),map=useRef(null),elementos=useRef([]),prevRecorrido=useRef(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>{
    let cancelado=false;
    (async()=>{
      try{
        await cargarGoogleMaps(apiKey);
        if(cancelado||!div.current)return;
        const {Map}=await window.google.maps.importLibrary('maps');
        if(cancelado)return;
        map.current=new Map(div.current,{center:{lat:GUAYAQUIL[0],lng:GUAYAQUIL[1]},zoom:12,streetViewControl:false,fullscreenControl:false,mapTypeControl:false});
        setError('');setReady(true);
      }catch(e){if(!cancelado)setError(e.message);}
    })();
    return ()=>{cancelado=true;map.current=null;};
  },[apiKey]);
  useEffect(()=>{
    if(!map.current || !ready || !modoClick || !window.google?.maps)return;
    const instancia=map.current;
    instancia.setOptions({draggableCursor:'crosshair'});
    const oyente=instancia.addListener('click',e=>{
      if(e.latLng) elegirPuntoMapa(modoClick,{lat:e.latLng.lat(),lng:e.latLng.lng()});
    });
    return ()=>{oyente.remove();instancia.setOptions({draggableCursor:null});};
  },[modoClick,elegirPuntoMapa,ready]);
  useEffect(()=>{
    if(!map.current||!window.google?.maps)return;
    const g=window.google.maps;
    elementos.current.forEach(e=>e.setMap(null));elementos.current=[];
    function anadir(elemento){elemento.setMap(map.current);elementos.current.push(elemento);return elemento;}
    if(verInundacion)ZONAS_INUNDACION_DEMO.forEach(z=>anadir(new g.Circle({center:z,radius:z.radio,strokeColor:'#ff797e',strokeWeight:1.8,strokeOpacity:.85,fillColor:'#f35c73',fillOpacity:.10+.17*lluvia/65})));
    if(verSeguridad)(zonasSeguridad||ZONAS_SEGURIDAD_DEMO).forEach(z=>{const c=z.semaforo==='Rojo'?'#ef5e69':z.semaforo==='Verde'?'#22bc91':'#e8a34e';anadir(new g.Circle({center:z,radius:z.radio,strokeColor:c,strokeWeight:1.7,strokeOpacity:.8,fillColor:c,fillOpacity:.11}));});
    opciones.filter(r=>r.id!==rutaActiva).forEach(r=>anadir(new g.Polyline({path:r.camino,strokeColor:r.color,strokeOpacity:.42,strokeWeight:5})));
    const activa=opciones.find(r=>r.id===rutaActiva);
    if(activa){anadir(new g.Polyline({path:activa.camino,strokeColor:'#132333',strokeOpacity:.90,strokeWeight:11}));anadir(new g.Polyline({path:activa.camino,strokeColor:activa.color,strokeOpacity:1,strokeWeight:6}));}
    anadir(new g.Marker({position:origenRuta||VOLUNTARIO,title:rutaPersonalizada?'Origen seleccionado':'Voluntario ficticio',label:{text:rutaPersonalizada?'O':'V',color:'#FFFFFF',fontWeight:'bold'}}));
    if(rutaPersonalizada&&destinoRuta)anadir(new g.Marker({position:destinoRuta,title:'Destino seleccionado',label:{text:'D',color:'#FFFFFF',fontWeight:'bold'}}));
    if(verSolicitudes)solicitudes.filter(s=>s.estado!=='Completada').forEach(s=>{
      const marker=anadir(new g.Marker({position:s,title:`${s.sector} · solicitud ficticia`,label:{text:String(s.personas),color:'#FFFFFF'},icon:{path:g.SymbolPath.CIRCLE,fillColor:s.id===seleccionada?.id?'#19b98c':'#f1a44c',fillOpacity:1,scale:16,strokeColor:'#fff',strokeWeight:2}}));
      marker.addListener('click',()=>elegirSolicitud(s.id));
    });
    const clave=origenRuta&&destinoRuta?`${origenRuta.lat}/${origenRuta.lng}/${destinoRuta.lat}/${destinoRuta.lng}`:null;
    if(clave&&prevRecorrido.current!==clave){
      const bounds=new g.LatLngBounds();bounds.extend(origenRuta);bounds.extend(destinoRuta);
      map.current.fitBounds(bounds,74);prevRecorrido.current=clave;
    }
    return ()=>{elementos.current.forEach(e=>e.setMap(null));elementos.current=[];};
  },[solicitudes,seleccionada,origenRuta,destinoRuta,rutaPersonalizada,opciones,rutaActiva,verInundacion,verSeguridad,verSolicitudes,lluvia,elegirSolicitud,zonasSeguridad,ready]);
  return <><div ref={div} className={`map-canvas ${modoClick?'seleccionando-punto':''}`}/>{error&&<div className="google-error">{error}. Cambia a OpenStreetMap para continuar.</div>}</>;
}
export default function Mapa({proveedor,apiKey,...props}){
  return <div className="map-box">
    {proveedor==='google'&&apiKey?<GoogleMapa apiKey={apiKey} {...props}/>:<LeafletMapa {...props}/>}
    <div className="map-watermark"><span className="pulse"/> GUAYAQUIL · {proveedor==='google'?'GOOGLE MAPS':'OPENSTREETMAP'} <b> · CAPAS DE DEMOSTRACIÓN</b></div>
    {props.modoClick&&<div className="map-click-hint">Haz clic en el mapa para fijar el {props.modoClick === 'origen'?'ORIGEN':'DESTINO'}</div>}
    <div className="map-legend"><span><i style={{background:'#68b5ff'}}/>Origen</span><span><i style={{background:'#42d6aa'}}/>Destino</span><span><i style={{background:'#ffbf68'}}/>Auxilio</span><span><i style={{background:'#fa7884'}}/>Lluvia demo</span><span><i style={{background:'#ffc16a'}}/>Seguridad demo</span></div>
  </div>;
}
