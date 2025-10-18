/**
 * ÍNDICES CRÍTICOS PARA OPTIMIZACIÓN - EJECUTAR INMEDIATAMENTE
 * 
 * INSTRUCCIONES:
 * 1. Conectar a tu base de datos MongoDB
 * 2. Copiar y pegar estos comandos en MongoDB Compass, mongo shell o MongoDB CLI
 * 3. Ejecutar uno por uno o como script completo
 */

// ========================================
// ÍNDICES CRÍTICOS - COPIAR Y PEGAR
// ========================================

// Aeronaves - Optimización principal
db.aeronaves.createIndex({"estado":1,"createdAt":-1});
db.aeronaves.createIndex({"tipo":1,"estado":1});
db.aeronaves.createIndex({"matricula":1});

// Componentes - Crítico para rendimiento
db.componentes.createIndex({"aeronaveActual":1,"estado":1});
db.componentes.createIndex({"alertasActivas":1,"estado":1});
db.componentes.createIndex({"categoria":1,"estado":1});
db.componentes.createIndex({"numeroSerie":1});
db.componentes.createIndex({"createdAt":-1});

// Estados de monitoreo - Elimina consultas N+1
db.estadomonitoreocomponentes.createIndex({"componenteId":1,"alertaActiva":1});
db.estadomonitoreocomponentes.createIndex({"componenteId":1,"catalogoControlId":1});
db.estadomonitoreocomponentes.createIndex({"alertaActiva":1});

// Catálogo de control
db.catalogocontrolmonitoreos.createIndex({"estado":1});

// Índice compuesto crítico para dashboard
db.componentes.createIndex({"aeronaveActual":1,"estado":1,"alertasActivas":1});

// ========================================
// VERIFICAR ÍNDICES CREADOS
// ========================================

// Verificar aeronaves
db.aeronaves.getIndexes();

// Verificar componentes  
db.componentes.getIndexes();

// Verificar estados de monitoreo
db.estadomonitoreocomponentes.getIndexes();

console.log("✅ Índices MongoDB creados exitosamente para optimización de rendimiento");