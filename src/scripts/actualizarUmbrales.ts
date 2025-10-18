import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function actualizarUmbralesComponente() {
  try {
    await connectDB();
    
    const componenteId = '68f3c89f4fbc1cf3f5911bb7';
    
    logger.info('🔧 ACTUALIZANDO UMBRALES DEL COMPONENTE');
    logger.info('=====================================');
    
    // Nueva configuración según PROPUESTA 1
    const nuevosUmbrales = {
      morado: 10,   // Vencido por más de 10h
      rojo: 20,     // VERDE cuando > 20h restantes
      naranja: 15,  // NARANJA entre 11-15h  
      amarillo: 10, // ROJO cuando ≤ 10h
      verde: 0      // Siempre 0
    };
    
    const estado = await EstadoMonitoreoComponente.findOne({ componenteId });
    
    if (!estado) {
      logger.error('❌ Componente no encontrado');
      return;
    }
    
    logger.info(`📊 CONFIGURACIÓN ANTERIOR:`);
    if (estado.configuracionOverhaul?.semaforoPersonalizado?.umbrales) {
      const anterior = estado.configuracionOverhaul.semaforoPersonalizado.umbrales;
      logger.info(`   morado=${anterior.morado}, rojo=${anterior.rojo}, naranja=${anterior.naranja}, amarillo=${anterior.amarillo}`);
    }
    
    logger.info(`📊 NUEVA CONFIGURACIÓN (PROPUESTA 1):`);
    logger.info(`   morado=${nuevosUmbrales.morado}, rojo=${nuevosUmbrales.rojo}, naranja=${nuevosUmbrales.naranja}, amarillo=${nuevosUmbrales.amarillo}`);
    logger.info(`   🟢 VERDE: > ${nuevosUmbrales.rojo}h`);
    logger.info(`   🟡 AMARILLO: ${nuevosUmbrales.naranja + 1}-${nuevosUmbrales.rojo}h`);
    logger.info(`   🟠 NARANJA: ${nuevosUmbrales.amarillo + 1}-${nuevosUmbrales.naranja}h`);
    logger.info(`   🔴 ROJO: ≤ ${nuevosUmbrales.amarillo}h`);
    
    // Actualizar la configuración
    if (estado.configuracionOverhaul?.semaforoPersonalizado) {
      estado.configuracionOverhaul.semaforoPersonalizado.umbrales = nuevosUmbrales;
    } else {
      logger.error('❌ No hay configuración de semáforo personalizado');
      return;
    }
    
    // Guardar cambios
    estado.markModified('configuracionOverhaul.semaforoPersonalizado.umbrales');
    await estado.save();
    
    logger.info('✅ UMBRALES ACTUALIZADOS EXITOSAMENTE');
    
    // Verificar el resultado
    const TSO = estado.valorActual - estado.configuracionOverhaul.horasUltimoOverhaul;
    const horasRestantes = estado.configuracionOverhaul.intervaloOverhaul - (TSO % estado.configuracionOverhaul.intervaloOverhaul);
    
    let nuevoColor = 'VERDE';
    if (horasRestantes <= nuevosUmbrales.amarillo) {
      nuevoColor = 'ROJO';
    } else if (horasRestantes <= nuevosUmbrales.naranja) {
      nuevoColor = 'NARANJA';
    } else if (horasRestantes <= nuevosUmbrales.rojo) {
      nuevoColor = 'AMARILLO';
    }
    
    logger.info('\n🚦 RESULTADO ESPERADO:');
    logger.info(`   Con ${horasRestantes}h restantes → COLOR: ${nuevoColor}`);
    
    if (nuevoColor === 'VERDE') {
      logger.info('   🎉 ¡ÉXITO! Ahora debería mostrar VERDE como quería el usuario');
    } else {
      logger.warn(`   ⚠️ Aún muestra ${nuevoColor}, puede necesitar más ajustes`);
    }
    
    await disconnectDB();
    logger.info('\n✅ Actualización completada - Recarga el frontend para ver los cambios');
    
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

actualizarUmbralesComponente();