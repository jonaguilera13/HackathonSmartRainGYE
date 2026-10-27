export const GUAYAQUIL = [-2.1794, -79.9000];
export const VOLUNTARIO = { lat: -2.1482, lng: -79.9012, sector: 'Kennedy Norte (origen ilustrativo)' };
export const LUGARES = [
  { id:'centro', nombre:'Centro / Malecón', lat:-2.1913, lng:-79.8848 },
  { id:'urdesa', nombre:'Urdesa', lat:-2.1701, lng:-79.9121 },
  { id:'sauces', nombre:'Sauces', lat:-2.1320, lng:-79.8905 },
  { id:'alborada', nombre:'Alborada', lat:-2.1383, lng:-79.8981 },
  { id:'mapasingue', nombre:'Mapasingue', lat:-2.1555, lng:-79.9292 },
  { id:'sur', nombre:'Sur / 25 de Julio', lat:-2.2383, lng:-79.9048 },
  { id:'suburbio', nombre:'Suburbio', lat:-2.1995, lng:-79.9338 },
  { id:'samanes', nombre:'Samanes', lat:-2.1075, lng:-79.9034 },
];
export const LUGARES_RUTA = [
  { id:'kennedy', nombre:'Kennedy Norte', lat:VOLUNTARIO.lat, lng:VOLUNTARIO.lng },
  ...LUGARES,
];

export const SOLICITUDES_INICIALES = [
  { id:'SR-1024', sector:'Urdesa', lat:-2.1701, lng:-79.9121, personas:2, prioridad:'Alta', detalle:'Familia requiere traslado a un punto de encuentro.', minutos:4, estado:'Pendiente', ficticia:true },
  { id:'SR-1025', sector:'Centro / Malecón', lat:-2.1913, lng:-79.8848, personas:1, prioridad:'Urgente', detalle:'Solicita transporte por calles anegadas (escenario ficticio).', minutos:7, estado:'Pendiente', ficticia:true },
  { id:'SR-1026', sector:'Sauces', lat:-2.1320, lng:-79.8905, personas:3, prioridad:'Media', detalle:'Tres personas necesitan acercarse a un refugio simulado.', minutos:11, estado:'Pendiente', ficticia:true },
  { id:'SR-1027', sector:'Mapasingue', lat:-2.1555, lng:-79.9292, personas:2, prioridad:'Alta', detalle:'Grupo requiere transporte voluntario.', minutos:15, estado:'Pendiente', ficticia:true },
];

export const ZONAS_INUNDACION_DEMO = [
  { id:'I1', nombre:'Escenario inundación A', lat:-2.1758, lng:-79.9082, radio:2250, gravedad:0.90 },
  { id:'I2', nombre:'Escenario inundación B', lat:-2.1375, lng:-79.8957, radio:1900, gravedad:0.82 },
  { id:'I3', nombre:'Escenario inundación C', lat:-2.2020, lng:-79.9212, radio:1850, gravedad:0.76 },
];
export const ZONAS_SEGURIDAD_DEMO = [
  { id:'S1', nombre:'Rojo demo A', lat:-2.1660, lng:-79.9140, radio:1750, gravedad:0.90, semaforo:'Rojo' },
  { id:'S2', nombre:'Amarillo demo B', lat:-2.1460, lng:-79.8995, radio:1300, gravedad:0.52, semaforo:'Amarillo' },
  { id:'S3', nombre:'Verde demo C', lat:-2.2222, lng:-79.9065, radio:1400, gravedad:0, semaforo:'Verde' },
];
export const ESCENARIOS = [
  {id:'baja', nombre:'Lluvia leve', mm:12, color:'#54e1b0'},
  {id:'media', nombre:'Lluvia fuerte', mm:35, color:'#ffce76'},
  {id:'alta', nombre:'Lluvia extrema', mm:65, color:'#fc7e86'},
];
export const ANIOS_DEMO = [
  {year:'2020',mm:545},{year:'2021',mm:682},{year:'2022',mm:613},
  {year:'2023',mm:774},{year:'2024',mm:706},{year:'2025',mm:824},
];
