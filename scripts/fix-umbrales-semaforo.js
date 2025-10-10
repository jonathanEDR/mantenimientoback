/**
 * Script para verificar y corregir umbrales del semáforo
 * Versión 2: Con mejor detección de estados
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UMBRALES_CORRECTOS = {
  morado: 10,
  rojo: 5,
  naranja: 10,
  amarillo: 20,
  verde: 999
};

const DESCRIPCIONES = {
  morado: 'SOBRE-CRÍTICO - Excedido significativamente',
  rojo: 'Crítico - Overhaul requerido inmediatamente',
  naranja: 'Alto - Preparar overhaul próximo',
  amarillo: 'Medio - Monitorear cercanamente',
  verde: 'OK - Operación normal'
};

async function corregirUmbrales() {
  try {
    console.log('🔧 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('estadosmonitoreocomponentes');

    // Buscar TODOS los estados
    console.log('🔍 Buscando todos los estados...');
    const todosEstados = await collection.find({}).toArray();
    console.log(`📊 Total de estados encontrados: ${todosEstados.length}\n`);

    // Filtrar los que tienen configuración de overhaul
    const estadosConOverhaul = todosEstados.filter(e => 
      e.configuracionOverhaul && 
      e.configuracionOverhaul.habilitarOverhaul === true
    );

    console.log(`✅ Estados con overhaul habilitado: ${estadosConOverhaul.length}\n`);

    if (estadosConOverhaul.length === 0) {
      console.log('⚠️  No hay estados con overhaul configurado');
      await mongoose.connection.close();
      return;
    }

    // Mostrar estados encontrados
    console.log('📋 ESTADOS CON OVERHAUL:\n');
    for (let i = 0; i < estadosConOverhaul.length; i++) {
      const estado = estadosConOverhaul[i];
      const umbrales = estado.configuracionOverhaul?.semaforoPersonalizado?.umbrales;
      
      console.log(`${i + 1}. ID: ${estado._id}`);
      console.log(`   Componente ID: ${estado.componenteId}`);
      console.log(`   Valor: ${estado.valorActual}/${estado.valorLimite}h`);
      console.log(`   Horas restantes: ${estado.valorLimite - estado.valorActual}h`);
      console.log(`   Umbrales actuales:`, umbrales);
      console.log('');
    }

    // Actualizar
    console.log('🔄 Actualizando umbrales a valores recomendados...');
    console.log('Umbrales nuevos:', UMBRALES_CORRECTOS);
    console.log('');

    let actualizados = 0;
    for (const estado of estadosConOverhaul) {
      const resultado = await collection.updateOne(
        { _id: estado._id },
        {
          $set: {
            'configuracionOverhaul.semaforoPersonalizado.umbrales': UMBRALES_CORRECTOS,
            'configuracionOverhaul.semaforoPersonalizado.descripciones': DESCRIPCIONES,
            'configuracionOverhaul.semaforoPersonalizado.fechaActualizacion': new Date()
          }
        }
      );
      
      if (resultado.modifiedCount > 0) {
        actualizados++;
        console.log(`✅ Actualizado estado ${estado._id}`);
      }
    }

    console.log(`\n✅ Actualizados ${actualizados} estados\n`);

    // Verificar
    console.log('🔍 Verificando cambios...\n');
    const verificacion = await collection.find({
      'configuracionOverhaul.habilitarOverhaul': true
    }).toArray();

    for (const estado of verificacion) {
      const umbrales = estado.configuracionOverhaul?.semaforoPersonalizado?.umbrales;
      const horasRestantes = estado.valorLimite - estado.valorActual;
      
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
      
      console.log(`Estado ${estado._id}:`);
      console.log(`  Horas: ${estado.valorActual}/${estado.valorLimite} (${horasRestantes}h restantes)`);
      console.log(`  Umbrales: rojo=${umbrales.rojo}, naranja=${umbrales.naranja}, amarillo=${umbrales.amarillo}`);
      console.log(`  Color esperado: ${colorEsperado} ${colorEsperado === 'VERDE' ? '🟢' : colorEsperado === 'AMARILLO' ? '🟡' : colorEsperado === 'NARANJA' ? '🟠' : colorEsperado === 'ROJO' ? '🔴' : '🟣'}`);
      console.log('');
    }

    console.log('✅ Script completado exitosamente\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Conexión cerrada');
  }
}

corregirUmbrales();
