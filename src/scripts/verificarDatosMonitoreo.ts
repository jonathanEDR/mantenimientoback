import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function verificarDatos() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/MantenimientosDB');
    
    // Verificar componentes instalados
    const componentes = await mongoose.connection.collection('componentes')
      .find({ estado: 'INSTALADO' })
      .limit(5)
      .toArray();
    
    console.log('\n📦 Componentes instalados:');
    componentes.forEach((c: any) => {
      console.log(`  - ${c.numeroSerie} (${c.nombre}) - Aeronave: ${c.aeronaveActual || 'No asignada'}`);
      console.log(`    Categoría: ${c.categoria}, Horas: ${c.horasVuelo || 0}h`);
    });
    
    // Verificar controles de monitoreo
    const controles = await mongoose.connection.collection('catalogocontrolmonitoreos')
      .find({})
      .toArray();
    
    console.log('\n🎛️ Controles de monitoreo disponibles:');
    controles.forEach((c: any) => {
      console.log(`  - ${c.descripcionCodigo}: ${c.horaInicial}h - ${c.horaFinal}h`);
    });
    
    // Verificar estados de monitoreo existentes
    const estados = await mongoose.connection.collection('estadosmonitoreocomponentes')
      .find({})
      .limit(3)
      .toArray();
    
    console.log(`\n📊 Estados de monitoreo configurados: ${estados.length}`);
    if (estados.length > 0) {
      estados.forEach((e: any) => {
        console.log(`  - Componente ${e.componenteId}, Control: ${e.controlId}`);
      });
    } else {
      console.log('  ⚠️ No hay estados de monitoreo configurados');
    }
    
    // Verificar aeronaves
    const aeronaves = await mongoose.connection.collection('aeronaves')
      .find({})
      .toArray();
    
    console.log(`\n✈️ Aeronaves registradas: ${aeronaves.length}`);
    aeronaves.forEach((a: any) => {
      console.log(`  - ${a.matricula} (${a.tipo})`);
    });
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verificarDatos();