import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function verificarCorreccion() {
  try {
    await connectDB();
    
    const estados = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true
    }).select('valorActual configuracionOverhaul');
    
    logger.info('\n🔍 ESTADO ACTUAL DESPUÉS DE LA CORRECCIÓN:\n');
    
    estados.forEach((estado, i) => {
      const tso = estado.valorActual - estado.configuracionOverhaul!.horasUltimoOverhaul;
      const intervalo = estado.configuracionOverhaul!.intervaloOverhaul;
      const restantes = intervalo - (tso % intervalo);
      
      logger.info(`Componente ${i+1}:`);
      logger.info(`  - valorActual: ${estado.valorActual}h`);
      logger.info(`  - horasUltimoOverhaul: ${estado.configuracionOverhaul!.horasUltimoOverhaul}h`);
      logger.info(`  - intervaloOverhaul: ${intervalo}h`);
      logger.info(`  - cicloActual: ${estado.configuracionOverhaul!.cicloActual}`);
      logger.info(`  - TSO calculado: ${tso}h`);
      logger.info(`  - Horas hasta overhaul: ${restantes}h`);
      logger.info(`  - Semáforo habilitado: ${estado.configuracionOverhaul?.semaforoPersonalizado?.habilitado || false}`);
      logger.info('');
    });
    
    await disconnectDB();
    logger.info('✅ Verificación completada');
    
  } catch (error) {
    logger.error('❌ Error en verificación:', error);
    process.exit(1);
  }
}

verificarCorreccion();