export async function consultarPronostico(lat, lng, signal) {
  const argumentos = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  try {
    const respuesta = await fetch(`/api/pronostico?${argumentos}`, { signal, headers:{Accept:'application/json'} });
    if (respuesta.ok && respuesta.headers.get('content-type')?.includes('application/json')) {
      const dato = await respuesta.json();
      if (Number.isFinite(dato.mmHora)) return dato;
    }
  } catch (error) {
    if (error.name === 'AbortError') throw error;
  }
  const parametros = new URLSearchParams({
    latitude:String(lat), longitude:String(lng),
    current:'precipitation,rain,showers,weather_code',
    hourly:'precipitation,precipitation_probability',
    forecast_days:'1', timezone:'America/Guayaquil',
  });
  const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`,{signal});
  if (!respuesta.ok) throw new Error('No fue posible consultar el pronóstico');
  const dato = await respuesta.json();
  const mm = dato.current?.precipitation;
  if (!Number.isFinite(mm)) throw new Error('El proveedor no entregó lluvia actual');
  return {
    mmHora: Math.max(0, mm),
    hora: dato.current?.time || 'Sin hora',
    fuente: 'Open-Meteo (modelo meteorológico)',
    descripcion: 'Lluvia de la hora actual. No indica calles inundadas ni proviene de INAMHI.',
    proximasHoras: (dato.hourly?.time || []).slice(0,8).map((t,i)=>({
      hora:t,
      mm: dato.hourly?.precipitation?.[i] ?? null,
      probabilidad: dato.hourly?.precipitation_probability?.[i] ?? null,
    })),
  };
}
