/**
 * Script para corregir los umbrales del semáforo en estados de monitoreo
 * 
 * PROBLEMA IDENTIFICADO:
 * - Umbral ROJO = 18h (demasiado alto)
 * - Con 18h restantes muestra ROJO cuando debería ser AMARILLO
 * 
 * SOLUCIÓN:
 * - Ajustar umbrales a valores más lógicos y espaciados
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Configuración recomendada de umbrales
const UMBRALES_CORRECTOS = {
  morado: 10,   // Excede límite por más de 10h → SOBRE-CRÍTICO
  rojo: 5,      // Menos de 5h antes del límite → CRÍTICO
  naranja: 10,  // Menos de 10h antes del límite → ALTO
  amarillo: 20, // Menos de 20h antes del límite → MEDIO
  verde: 999    // Más de 20h antes del límite → OK
};

const DESCRIPCIONES = {
  morado: 'SOBRE-CRÍTICO - Excedido significativamente',
  rojo: 'Crítico - Overhaul requerido inmediatamente',
  naranja: 'Alto - Preparar overhaul próximo',
  amarillo: 'Medio - Monitorear cercanamente',
  verde: 'OK - Operación normal'
};

async function corregirUmbralesSemaforo() {
  try {
    console.log('🔧 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('✅ Conectado a MongoDB');

    const EstadoMonitoreoComponente = mongoose.connection.collection('estadosmonitoreocomponentes');

    // 1. Buscar todos los estados con overhaul habilitado
    console.log('\n🔍 Buscando estados con overhaul habilitado...');
    const estadosConOverhaul = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true,
      'configuracionOverhaul.semaforoPersonalizado.habilitado': true
    }).toArray();

    console.log(`📊 Encontrados ${estadosConOverhaul.length} estados con overhaul`);

    if (estadosConOverhaul.length === 0) {
      console.log('⚠️  No hay estados con overhaul para actualizar');
      return;
    }

    // 2. Mostrar umbrales actuales
    console.log('\n📋 UMBRALES ACTUALES:');
    estadosConOverhaul.forEach((estado, index) => {
      const componente = estado.componenteId;
      const control = estado.catalogoControlId;
      const umbrales = estado.configuracionOverhaul?.semaforoPersonalizado?.umbrales;
      
      console.log(`\n  ${index + 1}. Componente: ${componente}`);
      console.log(`     Control: ${control}`);
      console.log(`     Umbrales actuales:`, umbrales);
    });

    // 3. Confirmar actualización
    console.log('\n🎯 UMBRALES NUEVOS (RECOMENDADOS):');
    console.log(JSON.stringify(UMBRALES_CORRECTOS, null, 2));
    console.log('\n📝 DESCRIPCIONES NUEVAS:');
    console.log(JSON.stringify(DESCRIPCIONES, null, 2));

    console.log('\n⚠️  ¿Deseas actualizar los umbrales? (Presiona Ctrl+C para cancelar)');
    console.log('Esperando 5 segundos...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Actualizar umbrales
    console.log('\n🔄 Actualizando umbrales...');
    
    const resultado = await EstadoMonitoreoComponente.updateMany(
      {
        'configuracionOverhaul.habilitarOverhaul': true,
        'configuracionOverhaul.semaforoPersonalizado.habilitado': true
      },
      {
        $set: {
          'configuracionOverhaul.semaforoPersonalizado.umbrales': UMBRALES_CORRECTOS,
          'configuracionOverhaul.semaforoPersonalizado.descripciones': DESCRIPCIONES,
          'configuracionOverhaul.semaforoPersonalizado.fechaActualizacion': new Date()
        }
      }
    );

    console.log(`\n✅ Actualización completada:`);
    console.log(`   - Documentos coincidentes: ${resultado.matchedCount}`);
    console.log(`   - Documentos modificados: ${resultado.modifiedCount}`);

    // 5. Verificar cambios
    console.log('\n🔍 Verificando cambios...');
    const estadosActualizados = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true,
      'configuracionOverhaul.semaforoPersonalizado.habilitado': true
    }).toArray();

    console.log('\n📋 UMBRALES DESPUÉS DE ACTUALIZACIÓN:');
    estadosActualizados.forEach((estado, index) => {
      const componente = estado.componenteId;
      const control = estado.catalogoControlId;
      const umbrales = estado.configuracionOverhaul?.semaforoPersonalizado?.umbrales;
      
      console.log(`\n  ${index + 1}. Componente: ${componente}`);
      console.log(`     Control: ${control}`);
      console.log(`     Umbrales nuevos:`, umbrales);
      
      // Calcular color del semáforo con nuevos umbrales
      const valorActual = estado.valorActual;
      const valorLimite = estado.valorLimite;
      const horasRestantes = valorLimite - valorActual;
      
      let colorEsperado = 'VERDE';
      if (horasRestantes < 0 && Math.abs(horasRestantes) > umbrales.morado) {
        colorEsperado = 'MORADO';
      } else if (horasRestantes <= umbrales.rojo) {
        colorEsperado = 'ROJO';
      } else if (horasRestantes <= umbrales.naranja) {
        colorEsperado = 'NARANJA';
      } else if (horasRestantes <= umbrales.amarillo) {
        colorEsperado = 'AMARILLO';
      }
      
      console.log(`     Horas: ${valorActual}/${valorLimite} (${horasRestantes}h restantes)`);
      console.log(`     Color esperado: ${colorEsperado}`);
    });

    console.log('\n✅ Script completado exitosamente');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Conexión cerrada');
  }
}

// Ejecutar script
corregirUmbralesSemaforo();
