import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function crearEstadosMonitoreo() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/MantenimientosDB');
    
    // Obtener componentes instalados
    const componentes = await mongoose.connection.collection('componentes')
      .find({ estado: 'INSTALADO' })
      .toArray();
    
    // Obtener controles disponibles
    const controles = await mongoose.connection.collection('catalogocontrolmonitoreos')
      .find({})
      .toArray();
    
    console.log(`📦 Componentes encontrados: ${componentes.length}`);
    console.log(`🎛️ Controles disponibles: ${controles.length}`);
    
    if (componentes.length === 0 || controles.length === 0) {
      console.log('❌ No hay datos suficientes para crear estados de monitoreo');
      return;
    }
    
    const estadosACrear: any[] = [];
    const ahora = new Date();
    
    // Para cada componente, crear estados de monitoreo con cada control
    for (const componente of componentes) {
      for (const control of controles) {
        // Crear valores ejemplo basados en el tipo de control
        let valorActual = 0;
        let limiteAdvertencia = 0;
        let limiteCritico = 0;
        
        switch (control.descripcionCodigo) {
          case 'TRR': // Time to Removal/Replacement
            valorActual = Math.floor(Math.random() * 300); // 0-300 horas
            limiteAdvertencia = control.horaFinal * 0.8; // 80% del límite
            limiteCritico = control.horaFinal;
            break;
            
          case 'TSNmmmmmm': // Time Since New
            valorActual = Math.floor(Math.random() * 50); // 0-50 horas
            limiteAdvertencia = control.horaFinal * 0.9; // 90% del límite  
            limiteCritico = control.horaFinal;
            break;
            
          case 'TRRaa': // Time to Removal Alternative
            valorActual = Math.floor(Math.random() * 80); // 0-80 horas
            limiteAdvertencia = control.horaFinal * 0.75; // 75% del límite
            limiteCritico = control.horaFinal;
            break;
        }
        
        const estado = {
          componenteId: componente._id,
          controlId: control._id,
          valorActual: valorActual,
          limiteAdvertencia: limiteAdvertencia,
          limiteCritico: limiteCritico,
          estado: 'ACTIVO',
          ultimaActualizacion: ahora,
          observaciones: `Estado inicial generado para ${control.descripcionCodigo}`,
          createdAt: ahora,
          updatedAt: ahora
        };
        
        estadosACrear.push(estado);
      }
    }
    
    console.log(`\n🔄 Creando ${estadosACrear.length} estados de monitoreo...`);
    
    // Insertar los estados
    const resultado = await mongoose.connection.collection('estadosmonitoreocomponentes')
      .insertMany(estadosACrear);
    
    console.log(`✅ Insertados ${resultado.insertedCount} estados de monitoreo`);
    
    // Mostrar algunos ejemplos
    console.log('\n📊 Ejemplos creados:');
    for (let i = 0; i < Math.min(3, estadosACrear.length); i++) {
      const estado = estadosACrear[i];
      const componente = componentes.find(c => c._id.toString() === estado.componenteId.toString());
      const control = controles.find(c => c._id.toString() === estado.controlId.toString());
      
      console.log(`  - ${componente?.numeroSerie} (${componente?.nombre})`);
      console.log(`    Control: ${control?.descripcionCodigo}`);
      console.log(`    Valor actual: ${estado.valorActual}h`);
      console.log(`    Límites: ${estado.limiteAdvertencia}h (adv) / ${estado.limiteCritico}h (crit)`);
      console.log(`    Estado: ${estado.valorActual >= estado.limiteCritico ? '🔴 CRÍTICO' : 
                     estado.valorActual >= estado.limiteAdvertencia ? '🟡 ADVERTENCIA' : '🟢 OK'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

crearEstadosMonitoreo();