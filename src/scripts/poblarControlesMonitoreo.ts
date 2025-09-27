import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function poblarControlesMonitoreo() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/MantenimientosDB');
    
    const controles = [
      {
        descripcionCodigo: 'TRR',
        horaInicial: 0,
        horaFinal: 60,
        estado: 'ACTIVO',
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      },
      {
        descripcionCodigo: 'TSNmmmmmm',
        horaInicial: 2,
        horaFinal: 80,
        estado: 'ACTIVO', 
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      },
      {
        descripcionCodigo: 'TRRaa',
        horaInicial: 0,
        horaFinal: 105,
        estado: 'ACTIVO',
        createdAt: new Date(), 
        updatedAt: new Date(),
        __v: 0
      }
    ];
    
    console.log('🎛️ Creando controles de monitoreo...');
    
    // Limpiar controles existentes
    await mongoose.connection.collection('catalogocontrolmonitoreos').deleteMany({});
    
    // Insertar nuevos controles
    const resultado = await mongoose.connection.collection('catalogocontrolmonitoreos')
      .insertMany(controles);
    
    console.log(`✅ Insertados ${resultado.insertedCount} controles de monitoreo:`);
    controles.forEach(c => {
      console.log(`  - ${c.descripcionCodigo}: ${c.horaInicial}h - ${c.horaFinal}h`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

poblarControlesMonitoreo();