import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Activity, ArrowRight, Bell, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, CloudRain, Compass, Database, Droplets, ExternalLink, HandHeart, HeartHandshake, History, Info, Layers, LifeBuoy, LoaderCircle, FileUp, Map, MapPin, Navigation, Plus, RefreshCcw, Route, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Users, Waves, X } from 'lucide-react';
import Mapa from './Mapa.jsx';
import { ANIOS_DEMO, ESCENARIOS, GUAYAQUIL, LUGARES, LUGARES_RUTA, SOLICITUDES_INICIALES, VOLUNTARIO } from './datos.js';
import { rutasOSRM, rutasGoogle, rutasDeEjemplo, compararRutas, cargarGoogleMaps } from './rutas.js';
import { cargarHistoricoLluvia, analizarCsvCHIRPS, datosCHIRPSPorSector } from './historico.js';
import { consultarPronostico } from './pronostico.js';
import { leerZonasCSV } from './seguridad.js';
import { ZONAS_SEGURIDAD_DEMO } from './datos.js';

const NOMBRES_PRIORIDAD={Urgente:'urgent',Alta:'high',Media:'medium'};
function FormularioAuxilio({cerrar,crear}){
  const [sector,setSector]=useState('centro');
  const [personas,setPersonas]=useState('2');
  const [detalle,setDetalle]=useState('Necesito transporte hacia un lugar de encuentro.');
  const [prioridad,setPrioridad]=useState('Alta');
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)cerrar();}}>
    <form className="modal" onSubmit={e=>{e.preventDefault();const lugar=LUGARES.find(l=>l.id===sector);crear({sector:lugar.nombre,lat:lugar.lat,lng:lugar.lng,personas:Math.max(1,Math.min(8,Number(personas))),prioridad,detalle:detalle.slice(0,200)});}}>
      <button type="button" className="icon-button modal-x" aria-label="Cerrar" onClick={cerrar}><X size={20}/></button>
      <div className="modal-symbol"><LifeBuoy size={25}/></div><h2>Crear solicitud de auxilio</h2>
      <p className="muted">Simula cómo una persona pediría transporte en Guayaquil. <b>No se envía a ECU 911, voluntarios ni servicios reales.</b></p>
      <label>Sector de recogida<select value={sector} onChange={e=>setSector(e.target.value)}>{LUGARES.map(l=><option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
      <div className="modal-two"><label>Personas<select value={personas} onChange={e=>setPersonas(e.target.value)}>{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label><label>Prioridad<select value={prioridad} onChange={e=>setPrioridad(e.target.value)}><option>Media</option><option>Alta</option><option>Urgente</option></select></label></div>
      <label>Mensaje (solo demostración)<textarea value={detalle} onChange={e=>setDetalle(e.target.value)} maxLength={200} rows={3}/></label>
      <div className="warning-soft">Ante una emergencia real llama al <strong>9-1-1</strong>. No uses esta demo para pedir rescate.</div>
      <button className="primary-button" type="submit"><Send size={17}/> Registrar solicitud de ejemplo</button>
    </form>
  </div>;
}
function ConfigGoogle({cerrar,confirmar,anterior}){
  const [key,setKey]=useState(anterior||'');
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)cerrar()}}><form className="modal" onSubmit={e=>{e.preventDefault();confirmar(key.trim())}}>
    <button type="button" className="icon-button modal-x" onClick={cerrar}><X size={20}/></button><div className="modal-symbol blue"><Map size={24}/></div><h2>Conectar Google Maps</h2>
    <p className="muted">Esta modalidad usa la <strong>Maps JavaScript API</strong> y <strong>Routes API</strong> para buscar vías de Guayaquil. Google exige clave válida con facturación habilitada y restricciones HTTP referrer.</p>
    <label>API key (solo permanece en esta pestaña)<input value={key} onChange={e=>setKey(e.target.value)} placeholder="AIza..." autoComplete="off"/></label>
    <p className="small-note">Una clave de navegador no es secreta: restríngela por dominio y por API en Google Cloud. La demo nunca incluye una clave predeterminada.</p>
    <button type="submit" className="primary-button" disabled={!key.trim()}><Map size={17}/> Activar Google Maps y rutas</button>
    <a href="https://developers.google.com/maps/documentation/javascript/routes/get-alternative-routes" target="_blank" rel="noreferrer" className="standalone-link">Documentación oficial <ExternalLink size={13}/></a>
  </form></div>;
}
function Grafico({datos,esReal}){
  const max=Math.max(1,...datos.map(d=>d.mm));
  return <div className="chart-bars" aria-label="Lluvia acumulada enero a mayo, milímetros por año">
    {datos.map(d=><div className="chart-col" key={d.year}><div className="chart-value">{d.mm}</div><div className="chart-track"><div className="chart-fill" style={{height:`${Math.max(5,d.mm/max*100)}%`}}/></div><span>{d.year.slice(-2)}</span></div>)}
    <div className="chart-unit">mm · ene–may{!esReal?' · ILUSTRATIVO':''}</div>
  </div>;
}
const formatNum=(n,dec=1)=>Number.isFinite(n)?n.toFixed(dec):'—';
function App(){
  const [solicitudes,setSolicitudes]=useState(SOLICITUDES_INICIALES);
  const [voluntario,setVoluntario]=useState(false),[seleccionId,setSeleccionId]=useState(SOLICITUDES_INICIALES[0].id);
  const [lluviaId,setLluviaId]=useState('media');
  const [verInundacion,setVerInundacion]=useState(true),[verSeguridad,setVerSeguridad]=useState(true),[verSolicitudes,setVerSolicitudes]=useState(true);
  const [proveedor,setProveedor]=useState('osm'),[apiKey,setApiKey]=useState(''),[configGoogle,setConfigGoogle]=useState(false);
  const [crearAuxilio,setCrearAuxilio]=useState(false),[toast,setToast]=useState('');
  const [modoRuta,setModoRuta]=useState('auxilio');
  const [origenElegido,setOrigenElegido]=useState('kennedy');
  const [destinoElegido,setDestinoElegido]=useState('centro');
  const [puntosManuales,setPuntosManuales]=useState({origen:null,destino:null});
  const [modoClick,setModoClick]=useState('');
  const [zonasSeguridad,setZonasSeguridad]=useState(ZONAS_SEGURIDAD_DEMO);
  const [pronostico,setPronostico]=useState(null),[esperandoPronostico,setEsperandoPronostico]=useState(false);
  const [errorPronostico,setErrorPronostico]=useState('');
  const [candidatas,setCandidatas]=useState([]),[origenRutas,setOrigenRutas]=useState(''),[cargandoRutas,setCargandoRutas]=useState(false);
  const [rutaId,setRutaId]=useState('');
  const [historico,setHistorico]=useState(ANIOS_DEMO),[historicoReal,setHistoricoReal]=useState(false),[cargandoHistorico,setCargandoHistorico]=useState(false),[errorHistorico,setErrorHistorico]=useState('');
  const [lugarHistorico,setLugarHistorico]=useState('centro');
  const [archivoChirps,setArchivoChirps]=useState(null),[tipoHistorico,setTipoHistorico]=useState('demo');
  const [pestana,setPestana]=useState('movilidad');
  const escenario=ESCENARIOS.find(e=>e.id===lluviaId);
  const pendientes=solicitudes.filter(s=>s.estado!=='Completada');
  const seleccionada=pendientes.find(s=>s.id===seleccionId)||pendientes[0]||null;
  const cantidadPersonas=pendientes.reduce((s,a)=>s+a.personas,0);
  const personal = modoRuta === 'personal';
  const inicioRuta = personal ? (puntosManuales.origen || LUGARES_RUTA.find(l=>l.id===origenElegido)) : VOLUNTARIO;
  const finRuta = personal ? (puntosManuales.destino || LUGARES_RUTA.find(l=>l.id===destinoElegido)) : seleccionada;
  const puedeCalcular = personal ? Boolean(inicioRuta && finRuta && Math.hypot(inicioRuta.lat-finRuta.lat,inicioRuta.lng-finRuta.lng)>0.0001) : Boolean(voluntario && seleccionada);
  const inicioNombre = personal ? inicioRuta?.nombre : 'Kennedy Norte';
  const finNombre = personal ? finRuta?.nombre : seleccionada?.sector;
  const rutas=useMemo(()=>compararRutas(candidatas,escenario.mm,zonasSeguridad),[candidatas,escenario.mm,zonasSeguridad]);
  const rutaActual=rutas.find(r=>r.id===rutaId)||rutas[0]||null;
  const tieneViales=['Google Maps (real)','OSRM (real, demo)'].includes(origenRutas);
  const mostrarMensaje=useCallback(t=>setToast(t),[]);
  const elegirPuntoMapa=useCallback((tipo,punto)=>{
    if(!['origen','destino'].includes(tipo))return;
    if(punto.lat < -2.55 || punto.lat > -1.9 || punto.lng < -80.15 || punto.lng > -79.65){setToast('Elige un punto dentro del área de Guayaquil.');return;}
    setPuntosManuales(v=>({...v,[tipo]:{...punto,nombre:`Punto manual (${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)})`}}));
    setModoClick('');setRutaId('');
  },[]);
  const elegirSolicitud=useCallback(id=>{setSeleccionId(id);setVoluntario(true);setModoRuta('auxilio');setRutaId('')},[]);

  useEffect(()=>{
    if(!puedeCalcular){setCandidatas([]);setOrigenRutas('');setCargandoRutas(false);return;}
    const abort=new AbortController();let valido=true;
    (async()=>{
      // Evita mostrar un recorrido anterior al cambiar los lugares.
      setCandidatas([]);setOrigenRutas('');
      setCargandoRutas(true);setRutaId('');
      try{
        let r,fuente;
        if(proveedor==='google'&&apiKey){
          await cargarGoogleMaps(apiKey);
          r=await rutasGoogle(inicioRuta,finRuta);fuente='Google Maps (real)';
        }else{
          r=await rutasOSRM(inicioRuta,finRuta,abort.signal);fuente='OSRM (real, demo)';
        }
        if(valido){setCandidatas(r);setOrigenRutas(fuente);}
      }catch(e){
        if(!valido||e.name==='AbortError')return;
        setCandidatas(rutasDeEjemplo(inicioRuta,finRuta));setOrigenRutas('Esquema de reserva (NO vial)');
        mostrarMensaje('No se pudieron consultar rutas reales. Se muestran líneas ilustrativas, NO navegables.');
      }finally{if(valido)setCargandoRutas(false)}
    })();
    return ()=>{valido=false;abort.abort()};
  },[puedeCalcular,modoRuta,seleccionada?.id,inicioRuta?.lat,inicioRuta?.lng,finRuta?.lat,finRuta?.lng,proveedor,apiKey,mostrarMensaje]);

  async function traerPronostico(){
    setEsperandoPronostico(true);setErrorPronostico('');
    try{setPronostico(await consultarPronostico(inicioRuta.lat,inicioRuta.lng));}
    catch(e){setErrorPronostico(e.message||'No se pudo obtener meteorología');}
    finally{setEsperandoPronostico(false)}
  }
  async function cargarZonas(evento){
    const archivo=evento.target.files?.[0];if(!archivo)return;
    try{setZonasSeguridad(leerZonasCSV(await archivo.text()));mostrarMensaje('Zonas de seguridad de CSV importadas. Verifica la procedencia de los datos.');}
    catch(e){mostrarMensaje('CSV inválido: '+e.message)}
    finally{evento.target.value='';}
  }
  async function obtenerLluvia(){
    setCargandoHistorico(true);setErrorHistorico('');const lugar=LUGARES.find(l=>l.id===lugarHistorico);
    try{
      const datos=await cargarHistoricoLluvia(lugar.lat,lugar.lng);
      if(!datos.length)throw new Error('No se encontraron valores');
      setHistorico(datos);setHistoricoReal(true);setTipoHistorico('open-meteo');mostrarMensaje('Histórico meteorológico obtenido de Open-Meteo. No representa anegamientos.');
    }catch(e){setErrorHistorico(e.message+' · Se mantienen cifras de demostración.');setHistorico(ANIOS_DEMO);setHistoricoReal(false);setTipoHistorico('demo')}
    finally{setCargandoHistorico(false)}
  }
  async function importarChirps(evento){
    const f=evento.target.files?.[0];if(!f)return;
    try{const registros=analizarCsvCHIRPS(await f.text());setArchivoChirps(registros);const datos=datosCHIRPSPorSector(registros,lugarHistorico);
      if(!datos.length){setErrorHistorico('CSV importado. Elige Centro, Urdesa, Sauces, Mapasingue o Sur para ver resultados CHIRPS.');return;}
      setHistorico(datos);setHistoricoReal(true);setTipoHistorico('chirps');setErrorHistorico('');mostrarMensaje('CSV CHIRPS cargado localmente (Google Earth Engine).');}
    catch(e){setErrorHistorico(e.message)}
    finally{evento.target.value='';}
  }
  function cambiarLugarHistorico(id){setLugarHistorico(id);
    const datos=archivoChirps?datosCHIRPSPorSector(archivoChirps,id):[];
    if(datos.length){setHistorico(datos);setHistoricoReal(true);setTipoHistorico('chirps');setErrorHistorico('');}
    else {setHistorico(ANIOS_DEMO);setHistoricoReal(false);setTipoHistorico('demo');}
  }
  function activarVoluntario(){
    if(!voluntario)setModoRuta('auxilio');
    setVoluntario(v=>!v);
    mostrarMensaje(!voluntario?`${pendientes.length} solicitudes ficticias disponibles en Guayaquil.`:'Modo voluntario desactivado.');
  }
  function nuevoAuxilio(datos){
    const id='SR-'+String(1100+solicitudes.length);
    setSolicitudes(l=>[{...datos,id,minutos:0,estado:'Pendiente',ficticia:true},...l]);
    setSeleccionId(id);setCrearAuxilio(false);setVoluntario(true);setModoRuta('auxilio');mostrarMensaje(`Solicitud ${id} creada SOLO en este navegador.`);
  }
  function aceptar(){
    if(!seleccionada)return;
    setSolicitudes(l=>l.map(s=>s.id===seleccionada.id?{...s,estado:'Asignada'}:s));mostrarMensaje('Solicitud asignada únicamente en esta demostración.');
  }
  function completar(){
    if(!seleccionada)return;
    const siguiente=pendientes.find(s=>s.id!==seleccionada.id);
    setSolicitudes(l=>l.map(s=>s.id===seleccionada.id?{...s,estado:'Completada'}:s));
    if(siguiente)setSeleccionId(siguiente.id);mostrarMensaje('Recogida marcada como completada (demo).');
  }
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-symbol"><CloudRain size={29}/></div><div><div className="brand-name">Smart<span>Rain</span><sup>GYE</sup></div></div></div>
      <div className="nav-label">PLATAFORMA</div>
      <button className={`nav-link ${pestana==='movilidad'?'active':''}`} onClick={()=>{setPestana('movilidad');document.getElementById('mapa')?.scrollIntoView({behavior:'smooth'})}}><Compass size={19}/> Centro de control <span className="nav-tick"/></button>
      <button className="nav-link" onClick={()=>{setVoluntario(true);document.getElementById('solicitudes')?.scrollIntoView({behavior:'smooth'})}}><HeartHandshake size={19}/> Solicitudes <b className="side-count">{pendientes.length}</b></button>
      <button className="nav-link" onClick={()=>{setCrearAuxilio(true)}}><LifeBuoy size={19}/> Solicitar auxilio</button>
      <button className="nav-link" onClick={()=>document.getElementById('analisis')?.scrollIntoView({behavior:'smooth'})}><History size={19}/> Análisis de lluvia</button>
      <div className="nav-label second">FUENTES Y CONEXIONES</div>
      <button className="nav-link" onClick={()=>setConfigGoogle(true)}><Map size={19}/> Google Maps <span className="tiny-tag">API</span></button>
      <a className="nav-link" href="https://visualizador-oeco.up.railway.app/mapa?anio=2026" target="_blank" rel="noreferrer"><ShieldCheck size={19}/> OECO (fuente) <ExternalLink size={13}/></a>
      <a className="nav-link" href="https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY" target="_blank" rel="noreferrer"><Database size={19}/> Google Earth CHIRPS <ExternalLink size={13}/></a>
      <div className="sidebar-bottom"><div className="sidebar-weather"><span className="signal"><span/> ESCENARIO DE PRUEBA</span><div className="sidebar-weather-line"><CloudRain size={27}/><strong>{escenario.nombre}</strong></div><p>{escenario.mm} mm/h hipotéticos.<br/>No es un pronóstico oficial.</p></div><div className="sidebar-copy">Nu Zeta · ESPOL · Hackathon<br/>Guayaquil, Ecuador · 2026</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">SmartRainGYE <strong>Centro de movilidad</strong></div><div className="topbar-right"><span className="flag"><span/> PROTOTIPO DEMO</span><span className="avatar">SR</span></div></header>
      <div className="page">
        <div className="hero"><div><h1>SmartRainGYE<br/></h1><div className="hero-buttons"><button className="primary-button" onClick={activarVoluntario}><HandHeart size={18}/>{voluntario?'Modo voluntario activado':'Quiero recoger personas'}<ArrowRight size={17}/></button><button className="outline-button" onClick={()=>setCrearAuxilio(true)}><LifeBuoy size={17}/> Solicitar auxilio</button></div></div><div className="alert-widget"><div className="alert-icon"><Waves size={23}/></div><div><small>ALERTA DEL ESCENARIO</small><b>{lluviaId==='alta'?'Alta':lluviaId==='media'?'Moderada':'Baja'}</b><span>Condición hipotética · {escenario.mm} mm/h</span></div></div></div>
        <div className="stats"><div className="stat"><div className="stat-icon peach"><Bell size={20}/></div><div><small>Solicitudes de auxilio</small><b>{String(pendientes.length).padStart(2,'0')}</b><span>Casos creados en demo</span></div></div><div className="stat"><div className="stat-icon amber"><Users size={21}/></div><div><small>Personas que requieren ayuda</small><b>{String(cantidadPersonas).padStart(2,'0')}</b><span>En solicitudes locales</span></div></div><div className="stat"><div className="stat-icon lilac"><Layers size={21}/></div><div><small>Capas de riesgo</small><b>02</b><span>Lluvia + seguridad demo</span></div></div><div className="stat"><div className="stat-icon mint"><Route size={20}/></div><div><small>Alternativas encontradas</small><b>{puedeCalcular?String(rutas.length).padStart(2,'0'):'—'}</b><span>{tieneViales?'Rutas de proveedor externo':'Vista de demostración'}</span></div></div></div>
        <div className="dashboard" id="mapa">
          <section className="map-column">
            <div className="section-head"><div><h2>Mapa Guayaquil <span className="section-badge">Zona Geografica</span></h2><p>Solicitudes, capas de amenaza y alternativas de recorrido sobre la ciudad.</p></div><div className="heading-icon"><Navigation size={20}/></div></div>
            <div className="planificador">
              <div className="planificador-modos" role="group" aria-label="Tipo de ruta">
                <button className={!personal?'activo':''} onClick={()=>setModoRuta('auxilio')}><HeartHandshake size={16}/> Recoger personas</button>
                <button className={personal?'activo':''} onClick={()=>setModoRuta('personal')}><Navigation size={16}/> Planificar mi viaje</button>
              </div>
              {personal ? <>
                <div className="planificador-campos">
                  <label>Origen
                    <select value={origenElegido} onChange={e=>{setOrigenElegido(e.target.value);setPuntosManuales(p=>({...p,origen:null}));setRutaId('')}}>
                      {LUGARES_RUTA.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </label>
                  <label>Destino
                    <select value={destinoElegido} onChange={e=>{setDestinoElegido(e.target.value);setPuntosManuales(p=>({...p,destino:null}));setRutaId('')}}>
                      {LUGARES_RUTA.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </label>
                </div>
                <div className="manual-map-buttons">
                  <button className={modoClick==='origen'?'marcando':''} onClick={()=>setModoClick(m=>m==='origen'?'':'origen')}><MapPin size={15}/> {modoClick==='origen'?'Haz clic para origen':'Marcar origen en el mapa'}</button>
                  <button className={modoClick==='destino'?'marcando':''} onClick={()=>setModoClick(m=>m==='destino'?'':'destino')}><MapPin size={15}/> {modoClick==='destino'?'Haz clic para destino':'Marcar destino en el mapa'}</button>
                  {(puntosManuales.origen||puntosManuales.destino)&&<button onClick={()=>{setPuntosManuales({origen:null,destino:null});setModoClick('');}}>Limpiar puntos manuales</button>}
                </div>
                <p className="planificador-aviso">{modoClick?`Ahora haz clic en el mapa para elegir ${modoClick}.`:'Puedes usar las listas o seleccionar cualquier punto del mapa dentro del área de Guayaquil.'}</p>
                <div className="manual-point-summary">Origen: {inicioNombre} · Destino: {finNombre}</div>
              </> : <p className="planificador-aviso">Conserva el modo voluntario: activa «Quiero recoger personas» y selecciona una solicitud.</p>}
            </div>
            <div className="external-data-panel">
              <div><b>Pronóstico meteorológico</b><p>Consulta Open-Meteo o, si está configurada, una pasarela autorizada de INAMHI.</p></div>
              <button onClick={traerPronostico} disabled={esperandoPronostico}>{esperandoPronostico?'Consultando…':'Consultar lluvia actual'}</button>
              {pronostico&&<p><b>{pronostico.mmHora} mm/h</b> · {pronostico.fuente}. No confirma inundaciones; ajusta el simulador manualmente.</p>}
              {errorPronostico&&<p role="alert">{errorPronostico}</p>}
              <label className="csv-upload">Cargar zonas de seguridad desde CSV (fuentes verificadas por el usuario)
                <input type="file" accept=".csv,text/csv" onChange={cargarZonas}/>
              </label>
              <p>El riesgo de seguridad es ilustrativo salvo carga manual de datos; no hay integración directa con ECU 911 o Segura EP. Google Earth Engine se importa mediante el CSV CHIRPS.</p>
            </div>
            <div className="map-card"><div className="map-control"><div className="map-provider"><span className="map-provider-pulse"/> BASE CARTOGRÁFICA <strong>{proveedor==='google'?'GOOGLE MAPS':'OPENSTREETMAP'}</strong></div><div className="map-controls-right"><button className={`mini-control ${verInundacion?'on':''}`} onClick={()=>setVerInundacion(!verInundacion)} title="Capa hipotética de lluvia"><Droplets size={14}/> Lluvia</button><button className={`mini-control ${verSeguridad?'on':''}`} onClick={()=>setVerSeguridad(!verSeguridad)}><ShieldCheck size={14}/> Seguridad</button><button className={`mini-control ${verSolicitudes?'on':''}`} onClick={()=>setVerSolicitudes(!verSolicitudes)}><Users size={14}/> Personas</button></div></div>
              <Mapa proveedor={proveedor} apiKey={apiKey} solicitudes={solicitudes} seleccionada={!personal&&voluntario?seleccionada:null} origenRuta={puedeCalcular?inicioRuta:null} destinoRuta={puedeCalcular?finRuta:null} rutaPersonalizada={personal} opciones={puedeCalcular?rutas:[]} rutaActiva={rutaActual?.id} verInundacion={verInundacion} verSeguridad={verSeguridad} verSolicitudes={verSolicitudes&&voluntario} lluvia={escenario.mm} elegirSolicitud={elegirSolicitud} modoClick={personal?modoClick:''} elegirPuntoMapa={elegirPuntoMapa} zonasSeguridad={zonasSeguridad}/>
              <div className="map-foot"><Info size={15}/><span><b>Mapa geográfico real.</b> Círculos de peligro, solicitudes y puntuaciones son <b>simulados</b>. {origenRutas||(personal?'Selecciona un origen y destino diferentes.':'Activa voluntariado para consultar recorridos.')}</span><button onClick={()=>setConfigGoogle(true)}>Google Maps <ChevronRight size={14}/></button></div></div>
            <div className="route-header"><div><h2>Rutas recomendadas</h2><p>Origen: {inicioNombre||'—'} → {finNombre||'selecciona una solicitud'}</p></div><div className="source-label">{cargandoRutas?<><LoaderCircle className="spin" size={15}/> Calculando</>:(origenRutas||'Esperando origen')}</div></div>
            {!puedeCalcular?<div className="route-empty"><Route size={27}/><div><strong>{personal?'Selecciona dos lugares diferentes':'Activa «Quiero recoger personas»'}</strong><span>Se mostrarán hasta tres rutas diferentes si el proveedor las devuelve.</span></div>{!personal&&<button onClick={activarVoluntario}>Activar <ArrowRight size={14}/></button>}</div>:rutas.length? <><div className="route-grid">{rutas.map(r=><button key={r.id} onClick={()=>setRutaId(r.id)} className={`route-card ${rutaActual?.id===r.id?'selected':''}`} style={{'--route-color':r.color}}><div className="route-card-title"><i/>{r.nombre}{rutaActual?.id===r.id&&<CheckCircle2 size={16}/>}</div><div className="route-main"><b>{formatNum(r.minutosEstimados,0)}<small>min*</small></b><span>{formatNum(r.km)} km</span></div><div className="route-risk"><span>Índice de riesgo de prueba</span><strong>{r.riesgo.total}/100</strong></div><div className="risk-bar"><div style={{width:`${r.riesgo.total}%`}}/></div><div className="route-micro">Tiempo vial base: {r.minutos} min · Lluvia {r.riesgo.lluvia} · Seguridad {r.riesgo.seguridad}</div></button>)}</div><div className="route-note"><ShieldCheck size={18}/><span>{tieneViales?'Los trazados provienen de '+origenRutas+'. ':'Las líneas son esquemáticas, no siguen necesariamente las calles. '}*La demora incluye un ajuste hipotético por lluvia y precaución.</span></div></>:<div className="route-empty"><LoaderCircle size={22} className={cargandoRutas?'spin':''}/><div><strong>{cargandoRutas?'Consultando rutas disponibles…':'No se encontró una solicitud activa'}</strong><span>Si falla el proveedor, se dibujarán alternativas esquemáticas claramente etiquetadas.</span></div></div>}
          </section>
          <aside className="right-column" id="solicitudes"><div className={`volunteer-box ${voluntario?'enabled':''}`}><div className="v-head"><div className="v-icon"><HeartHandshake size={24}/></div><span>RED DE AYUDA VOLUNTARIA</span></div><h2>{voluntario?'¡Listo para ayudar!':'¿Puedes ayudar a alguien?'}</h2><p>{voluntario?'Selecciona una solicitud y visualiza las rutas disponibles.':'Presiona el botón para ver personas que necesitan transporte en la simulación.'}</p><button className="volunteer-cta" onClick={activarVoluntario}>{voluntario?<><CheckCircle2 size={18}/> Voluntariado activo</>:<><HandHeart size={18}/> Quiero recoger personas <ArrowRight size={17}/></>}</button><small>Participación voluntaria · Datos inventados · Sin GPS</small></div>
            <div className="request-panel"><div className="request-title"><div><h2>Solicitudes cercanas <span>{pendientes.length}</span></h2><p>{voluntario?'Selecciona a quién recoger':'Se habilitan al activar voluntariado'}</p></div><button className="add-button" onClick={()=>setCrearAuxilio(true)} title="Crear solicitud ficticia"><Plus size={18}/></button></div>
              {voluntario?<div className="requests">{pendientes.map(s=><button onClick={()=>elegirSolicitud(s.id)} key={s.id} className={`request-item ${seleccionada?.id===s.id?'picked':''}`}><div className="request-top"><span className="request-code">{s.id}</span><span className={`priority ${NOMBRES_PRIORIDAD[s.prioridad]}`}>{s.prioridad}</span></div><div className="request-name"><MapPin size={16}/><b>{s.sector}</b><ChevronRight size={16}/></div><div className="request-desc"><Users size={13}/>{s.personas} {s.personas===1?'persona':'personas'} · Hace {s.minutos} min{ s.estado==='Asignada'?' · ASIGNADA':''}</div></button>)}{!pendientes.length&&<div className="empty-requests">Todas las solicitudes de ejemplo fueron completadas.</div>}</div>:<div className="locked"><span><MapPin size={24}/></span><b>Hay {pendientes.length} solicitudes de ejemplo</b><p>Activa «Quiero recoger personas» para mostrar los puntos en el mapa.</p></div>}
              {voluntario&&seleccionada&&<div className="request-details"><div className="detail-heading">SOLICITUD ELEGIDA <span className={`priority ${NOMBRES_PRIORIDAD[seleccionada.prioridad]}`}>{seleccionada.prioridad}</span></div><h3>{seleccionada.sector}</h3><p>{seleccionada.detalle}</p><div className="detail-metas"><span><Users size={15}/>{seleccionada.personas} personas</span><span><Navigation size={15}/>{rutas[0]?formatNum(rutas[0].km)+' km*':'—'}</span></div><button onClick={seleccionada.estado==='Asignada'?completar:aceptar} className="accept-button">{seleccionada.estado==='Asignada'?<><Check size={17}/> Marcar recogida (demo)</>:<>Aceptar solicitud (demo)<ArrowRight size={17}/></>}</button><small>* Distancia según proveedor de ruta o esquema.</small></div>}
            </div>
          </aside>
        </div>
        <div className="analysis" id="analisis"><section className="analysis-card rain-card"><div className="analysis-head"><div className="analysis-icon rain"><CloudRain size={19}/></div><div><h3>Simulador de lluvia</h3><p>Modifica el escenario de inundación ilustrativo.</p></div><span className="mode-tag">SIMULACIÓN</span></div><div className="rain-options">{ESCENARIOS.map(e=><button key={e.id} className={lluviaId===e.id?'chosen':''} onClick={()=>setLluviaId(e.id)}><span>{e.nombre.split(' ')[1]}</span><b>{e.mm} mm/h</b></button>)}</div><p className="card-note">Esta lluvia hipotética modifica el peso de riesgo en las rutas. No es una predicción meteorológica.</p></section>
        <section className="analysis-card historical-card"><div className="analysis-head"><div className="analysis-icon hist"><History size={19}/></div><div><h3>Histórico de lluvias</h3><p>Enero–mayo de 2020 a 2025 · Guayaquil</p></div><span className={`mode-tag ${historicoReal?'real':''}`}>{tipoHistorico==='chirps'?'CHIRPS CSV':historicoReal?'OPEN-METEO':'DATOS DEMO'}</span></div><div className="history-actions"><select aria-label="Sector para consultar histórico" value={lugarHistorico} onChange={e=>cambiarLugarHistorico(e.target.value)}>{LUGARES.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select><button onClick={obtenerLluvia} disabled={cargandoHistorico}>{cargandoHistorico?<LoaderCircle size={15} className="spin"/>:<RefreshCcw size={15}/>} Consultar datos reales</button></div><div className="chirps-import"><label className="import-label"><FileUp size={14}/> Importar CSV de Google Earth CHIRPS<input type="file" accept=".csv,text/csv" onChange={importarChirps}/></label></div><Grafico datos={historico} esReal={historicoReal}/><p className="card-note">{tipoHistorico==='chirps'?'Fuente: archivo CHIRPS proporcionado por ti y exportado desde Google Earth Engine. Lluvia, NO inundaciones.':historicoReal?'Fuente: Open-Meteo Historical Weather API (reanálisis). No mide inundaciones.':'Las barras son cifras inventadas hasta que consultes Open-Meteo o importes un CSV CHIRPS.'}</p>{errorHistorico&&<p className="history-error">{errorHistorico}</p>}<a href="https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY" target="_blank" rel="noreferrer" className="source-link">Dataset Google Earth Engine CHIRPS <ExternalLink size={13}/></a></section>
        <section className="analysis-card safety-card"><div className="analysis-head"><div className="analysis-icon safety"><ShieldCheck size={19}/></div><div><h3>Seguridad y delitos</h3><p>OECO y semáforo para explicar el concepto</p></div><span className="mode-tag">FUENTE + DEMO</span></div><div className="safety-metric"><div><small>Muertes violentas · Guayaquil</small><b>1.098</b><span>2026, enero–junio (captura OECO)</span></div><div className="metric-icon"><Activity size={25}/></div></div><div className="risk-legend"><span><i className="red"/> Rojo: evitar (demo)</span><span><i className="yellow"/> Amarillo: precaución (demo)</span><span><i className="green"/> Verde: menor exposición (demo)</span></div><p className="card-note">Las cifras OECO son agregadas por cantón; NO permiten definir seguridad calle por calle. No hay conexión con el ECU 911.</p><a href="https://visualizador-oeco.up.railway.app/mapa?anio=2026" target="_blank" rel="noreferrer" className="source-link">Abrir mapa interactivo OECO <ExternalLink size={13}/></a></section></div>
      </div>
    </main>
    {crearAuxilio&&<FormularioAuxilio cerrar={()=>setCrearAuxilio(false)} crear={nuevoAuxilio}/>}
    {configGoogle&&<ConfigGoogle anterior={apiKey} cerrar={()=>setConfigGoogle(false)} confirmar={key=>{setApiKey(key);setProveedor('google');setConfigGoogle(false);mostrarMensaje('Google Maps seleccionado. Se requiere una API key válida y servicios habilitados.')}}/>}
    {proveedor==='google'&&<button className="map-back" onClick={()=>{setProveedor('osm');mostrarMensaje('Volviste a OpenStreetMap.')}}><Map size={15}/> Cambiar a mapa sin clave</button>}
    {toast&&<div className="toast" role="status"><Info size={17}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="Cerrar aviso"><X size={17}/></button></div>}
  </div>;
}
export default App;
