//Gestiona información o niveles de riesgo de seguridad por sectores.
export function leerZonasCSV(texto){
  const lineas = texto.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);
  if(lineas.length<2)throw new Error('El CSV está vacío');
  const campos = lineas[0].split(',').map(s=>s.trim().toLowerCase());
  const requeridos=['nombre','lat','lng','radio','gravedad','semaforo'];
  if(requeridos.some(c=>!campos.includes(c)))throw new Error('Columnas necesarias: '+requeridos.join(', '));
  const idx=Object.fromEntries(requeridos.map(c=>[c,campos.indexOf(c)]));
  const zonas=lineas.slice(1).map((linea,i)=>{
    const cel=linea.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
    const z={id:`csv-${i}`,nombre:cel[idx.nombre]?.slice(0,80),lat:Number(cel[idx.lat]),lng:Number(cel[idx.lng]),radio:Number(cel[idx.radio]),gravedad:Number(cel[idx.gravedad]),semaforo:cel[idx.semaforo]};
    if(!z.nombre||z.lat < -2.55||z.lat > -1.90||z.lng < -80.15||z.lng > -79.65||!Number.isFinite(z.lat)||!Number.isFinite(z.lng)||!Number.isFinite(z.radio)||z.radio<50||z.radio>10000||!Number.isFinite(z.gravedad)||z.gravedad<0||z.gravedad>1||!['Rojo','Amarillo','Verde'].includes(z.semaforo)) throw new Error(`Fila ${i+2}: valores fuera de rango o semáforo inválido`);
    return z;
  });
  if(zonas.length>250)throw new Error('Importa como máximo 250 zonas');
  return zonas;
}
