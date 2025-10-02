// Script para crear índices MongoDB críticos para optimización de rendimiento
// Ejecutar este script después de aplicar las optimizaciones

console.log('🔧 Creando índices MongoDB críticos para optimización...');

// Conectar a MongoDB (ajustar la URL según tu configuración)
// Ejecutar estos comandos en MongoDB Compass, mongo shell, o como script

const indices = [
  // ÍNDICES PARA AERONAVES
  {
    collection: 'aeronaves',
    index: { "estado": 1, "createdAt": -1 },
    description: 'Optimiza filtros por estado y ordenamiento por fecha'
  },
  {
    collection: 'aeronaves', 
    index: { "tipo": 1, "estado": 1 },
    description: 'Optimiza estadísticas por tipo y estado'
  },
  {
    collection: 'aeronaves',
    index: { "matricula": 1 },
    description: 'Búsquedas por matrícula (único)'
  },

  // ÍNDICES PARA COMPONENTES
  {
    collection: 'componentes',
    index: { "aeronaveActual": 1, "estado": 1 },
    description: 'Consultas de componentes por aeronave y estado'
  },
  {
    collection: 'componentes',
    index: { "alertasActivas": 1, "estado": 1 },
    description: 'Filtros por alertas y estado'
  },
  {
    collection: 'componentes',
    index: { "categoria": 1, "estado": 1 },
    description: 'Estadísticas por categoría'
  },
  {
    collection: 'componentes',
    index: { "numeroSerie": 1 },
    description: 'Búsquedas por número de serie'
  },
  {
    collection: 'componentes',
    index: { "createdAt": -1 },
    description: 'Ordenamiento por fecha de creación'
  },

  // ÍNDICES PARA ESTADOS DE MONITOREO
  {
    collection: 'estadomonitoreocomponentes',
    index: { "componenteId": 1, "alertaActiva": 1 },
    description: 'Consultas batch de estados por componente'
  },
  {
    collection: 'estadomonitoreocomponentes',
    index: { "componenteId": 1, "catalogoControlId": 1 },
    description: 'Relación componente-control'
  },
  {
    collection: 'estadomonitoreocomponentes',
    index: { "alertaActiva": 1 },
    description: 'Filtros por alertas activas'
  },

  // ÍNDICES PARA CATÁLOGO CONTROL MONITOREO
  {
    collection: 'catalogocontrolmonitoreos',
    index: { "estado": 1 },
    description: 'Filtros por estado activo'
  },

  // ÍNDICES COMPUESTOS CRÍTICOS
  {
    collection: 'componentes',
    index: { 
      "aeronaveActual": 1, 
      "estado": 1, 
      "alertasActivas": 1 
    },
    description: 'Consulta compuesta crítica para dashboard'
  }
];

// Comandos MongoDB para ejecutar
console.log('\n📋 COMANDOS PARA EJECUTAR EN MONGODB:');
console.log('=====================================\n');

indices.forEach((item, index) => {
  console.log(`// ${index + 1}. ${item.description}`);
  console.log(`db.${item.collection}.createIndex(${JSON.stringify(item.index, null, 2)});`);
  console.log('');
});

// Script completo para copy-paste
console.log('\n🚀 SCRIPT COMPLETO PARA COPY-PASTE:');
console.log('===================================\n');

const script = indices.map(item => 
  `db.${item.collection}.createIndex(${JSON.stringify(item.index)});`
).join('\n');

console.log(script);

// Verificación de índices
console.log('\n\n✅ COMANDOS PARA VERIFICAR ÍNDICES:');
console.log('==================================\n');
console.log('// Ver índices de aeronaves');
console.log('db.aeronaves.getIndexes();\n');
console.log('// Ver índices de componentes');
console.log('db.componentes.getIndexes();\n');
console.log('// Ver índices de estados de monitoreo');
console.log('db.estadomonitoreocomponentes.getIndexes();\n');

export default indices;