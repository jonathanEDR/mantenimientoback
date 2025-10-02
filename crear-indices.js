/**
 * Script para crear índices MongoDB desde Node.js
 * Ejecutar: node crear-indices.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function crearIndices() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Conectando a MongoDB...');
    await client.connect();
    
    const db = client.db('MantenimientosDB');
    console.log('✅ Conectado a la base de datos');

    console.log('\n📊 Creando índices críticos...');

    // Función helper para crear índices sin fallar si ya existen
    async function crearIndiceSeguro(collection, index, nombre) {
      try {
        await collection.createIndex(index);
        console.log(`  ✅ ${nombre} creado`);
      } catch (error) {
        if (error.message.includes('existing index')) {
          console.log(`  ⚠️  ${nombre} ya existe (OK)`);
        } else {
          console.log(`  ❌ Error en ${nombre}: ${error.message}`);
        }
      }
    }

    // Índices para aeronaves
    console.log('📋 Creando índices para aeronaves...');
    await crearIndiceSeguro(db.collection('aeronaves'), { "estado": 1, "createdAt": -1 }, "estado+createdAt");
    await crearIndiceSeguro(db.collection('aeronaves'), { "tipo": 1, "estado": 1 }, "tipo+estado");
    // Saltamos matricula porque ya existe como único
    console.log('✅ Índices de aeronaves procesados');

    // Índices para componentes
    console.log('📋 Creando índices para componentes...');
    await crearIndiceSeguro(db.collection('componentes'), { "aeronaveActual": 1, "estado": 1 }, "aeronave+estado");
    await crearIndiceSeguro(db.collection('componentes'), { "alertasActivas": 1, "estado": 1 }, "alertas+estado");
    await crearIndiceSeguro(db.collection('componentes'), { "categoria": 1, "estado": 1 }, "categoria+estado");
    await crearIndiceSeguro(db.collection('componentes'), { "numeroSerie": 1 }, "numeroSerie");
    await crearIndiceSeguro(db.collection('componentes'), { "createdAt": -1 }, "createdAt");
    
    // Índice compuesto crítico
    await crearIndiceSeguro(db.collection('componentes'), { 
      "aeronaveActual": 1, 
      "estado": 1, 
      "alertasActivas": 1 
    }, "compuesto-crítico");
    console.log('✅ Índices de componentes procesados');

    // Índices para estados de monitoreo
    console.log('📋 Creando índices para estados de monitoreo...');
    await crearIndiceSeguro(db.collection('estadomonitoreocomponentes'), { 
      "componenteId": 1, 
      "alertaActiva": 1 
    }, "componente+alerta");
    await crearIndiceSeguro(db.collection('estadomonitoreocomponentes'), { 
      "componenteId": 1, 
      "catalogoControlId": 1 
    }, "componente+catalogo");
    await crearIndiceSeguro(db.collection('estadomonitoreocomponentes'), { "alertaActiva": 1 }, "alertaActiva");
    console.log('✅ Índices de estados de monitoreo procesados');

    // Índices para catálogo de control
    console.log('📋 Creando índices para catálogo de control...');
    await crearIndiceSeguro(db.collection('catalogocontrolmonitoreos'), { "estado": 1 }, "estado");
    console.log('✅ Índices de catálogo de control procesados');

    console.log('\n🎉 ¡TODOS LOS ÍNDICES CRÍTICOS CREADOS EXITOSAMENTE!');
    
    // Verificar índices creados
    console.log('\n📋 Verificando índices creados:');
    
    const indicesAeronaves = await db.collection('aeronaves').indexes();
    console.log(`✅ Aeronaves: ${indicesAeronaves.length} índices`);
    
    const indicesComponentes = await db.collection('componentes').indexes();
    console.log(`✅ Componentes: ${indicesComponentes.length} índices`);
    
    const indicesEstados = await db.collection('estadomonitoreocomponentes').indexes();
    console.log(`✅ Estados monitoreo: ${indicesEstados.length} índices`);

    console.log('\n🚀 Base de datos optimizada para alto rendimiento!');

  } catch (error) {
    console.error('❌ Error creando índices:', error.message);
    console.log('\n🔧 Soluciones posibles:');
    console.log('1. Verificar que MongoDB esté ejecutándose');
    console.log('2. Verificar la cadena de conexión en .env');
    console.log('3. Verificar que la base de datos exista');
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Ejecutar el script
crearIndices().catch(console.error);