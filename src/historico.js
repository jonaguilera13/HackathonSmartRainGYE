export async function cargarHistoricoLluvia(lat,lng,signal){
  const base='https://archive-api.open-meteo.com/v1/archive';
  const args=new URLSearchParams({latitude:String(lat),longitude:String(lng),start_date:'2020-01-01',end_date:'2025-12-31',daily:'precipitation_sum',timezone:'America/Guayaquil'});
  const resp=await fetch(`${base}?${args}`,{signal});
  if(!resp.ok)throw new Error('No se pudieron consultar los datos meteorológicos');
  const json=await resp.json();
  if(!json.daily?.time?.length)throw new Error('No llegaron datos históricos');
  const resumen=new Map();
  json.daily.time.forEach((dia,i)=>{
    const mm=json.daily.precipitation_sum?.[i];
    if(!Number.isFinite(mm))return;
    const mes=+dia.slice(5,7);
    if(mes>5)return;
    const anio=dia.slice(0,4),base=resumen.get(anio)||{year:anio,mm:0,diasIntensos:0,dias:0};
    base.mm+=mm; base.dias++; if(mm>=20)base.diasIntensos++;
    resumen.set(anio,base);
  });
  return [...resumen.values()].map(v=>({...v,mm:Math.round(v.mm)})).sort((a,b)=>a.year.localeCompare(b.year));
}

export function analizarCsvCHIRPS(texto){
  const lineas=texto.trim().split(/\r?\n/).filter(Boolean).map(l=>l.replace(/\r$/,''));
  if(lineas.length<2)throw new Error('El CSV CHIRPS está vacío');
  const cabeceras=lineas[0].split(',').map(s=>s.trim().replace(/^"|"$/g,''));
  const iSector=cabeceras.indexOf('sector'),iYear=cabeceras.indexOf('year'),iMm=cabeceras.indexOf('precipitation_mm');
  if(Math.min(iSector,iYear,iMm)<0)throw new Error('El CSV debe contener sector, year y precipitation_mm');
  const registros=lineas.slice(1).map(l=>{
    const campos=l.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
    return {sector:campos[iSector],year:campos[iYear],mm:Number(campos[iMm])};
  }).filter(f=>f.sector&&/^20\d\d$/.test(f.year)&&Number.isFinite(f.mm)&&f.mm>=0);
  if(!registros.length)throw new Error('El CSV no contiene valores de lluvia válidos');
  return registros;
}
export function datosCHIRPSPorSector(registros,id){
  const sector={centro:'Centro',urdesa:'Urdesa',sauces:'Sauces',mapasingue:'Mapasingue',sur:'Sur'}[id];
  if(!sector)return [];
  return registros.filter(r=>r.sector.toLowerCase()===sector.toLowerCase()).sort((a,b)=>a.year.localeCompare(b.year));
}
