import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import Componente from '../models/Componente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function buscarTRRaa() {
  try {
    await connectDB();
    
    logger.info('🔍 BUSCANDO componente TRRaa en la base de datos...');
    
    // Buscar por nombre del componente
    const componentes = await Componente.find({
      nombre: /TRRaa/i
    }).select('nombre numeroSerie categoria');
    
    logger.info(`📦 Componentes encontrados con "TRRaa": ${componentes.length}`);
    
    for (const componente of componentes) {
      logger.info(`  - ${componente.nombre} (${componente.numeroSerie})`);
      
      // Buscar estado de monitoreo para este componente
      const estado = await EstadoMonitoreoComponente.findOne({
        componenteId: componente._id
      });
      
      if (estado) {
        logger.info(`\n🎯 ESTADO DE MONITOREO ENCONTRADO PARA ${componente.nombre}:`);
        logger.info(`  - ID: ${estado._id}`);
        logger.info(`  - valorActual: ${estado.valorActual}h`);
        logger.info(`  - valorLimite: ${estado.valorLimite}h`);
        
        if (estado.configuracionOverhaul?.habilitarOverhaul) {
          const config = estado.configuracionOverhaul;
          const TSO = estado.valorActual - config.horasUltimoOverhaul;
          const horasRestantes = config.intervaloOverhaul - (TSO % config.intervaloOverhaul);
          
          logger.info(`\n📊 CONFIGURACIÓN OVERHAUL:`);
          logger.info(`  - habilitarOverhaul: ${config.habilitarOverhaul}`);
          logger.info(`  - intervaloOverhaul: ${config.intervaloOverhaul}h`);
          logger.info(`  - cicloActual: ${config.cicloActual}`);
          logger.info(`  - ciclosOverhaul: ${config.ciclosOverhaul}`);
          logger.info(`  - horasUltimoOverhaul: ${config.horasUltimoOverhaul}h`);
          logger.info(`  - fechaUltimoOverhaul: ${config.fechaUltimoOverhaul}`);
          
          logger.info(`\n🧮 CÁLCULOS:`);
          logger.info(`  - TSO = valorActual - horasUltimoOverhaul = ${estado.valorActual} - ${config.horasUltimoOverhaul} = ${TSO}h`);
          logger.info(`  - TSO % intervalo = ${TSO} % ${config.intervaloOverhaul} = ${TSO % config.intervaloOverhaul}`);
          logger.info(`  - Horas restantes = ${config.intervaloOverhaul} - ${TSO % config.intervaloOverhaul} = ${horasRestantes}h`);
          
          // Determinar color del semáforo según umbrales de la imagen
          let colorSemaforo = 'VERDE';
          if (horasRestantes <= 0) {
            colorSemaforo = 'MORADO/ROJO';
          } else if (horasRestantes <= 20) {  // AMARILLO según configuración
            colorSemaforo = 'AMARILLO';
          } else if (horasRestantes <= 30) {  // NARANJA según configuración  
            colorSemaforo = 'NARANJA';
          }
          
          logger.info(`\n🚦 SEMÁFORO CALCULADO:`);
          logger.info(`  - Horas restantes: ${horasRestantes}h`);
          logger.info(`  - Color esperado: ${colorSemaforo}`);
          
          // Verificar configuración del semáforo personalizado
          if (config.semaforoPersonalizado?.habilitado) {
            logger.info(`\n🎨 SEMÁFORO PERSONALIZADO:`);
            logger.info(`  - Habilitado: ${config.semaforoPersonalizado.habilitado}`);
            logger.info(`  - Umbrales: ${JSON.stringify(config.semaforoPersonalizado.umbrales, null, 2)}`);
          }
        }
      } else {
        logger.warn(`  ❌ No se encontró estado de monitoreo para ${componente.nombre}`);
      }
    }
    
    await disconnectDB();
    logger.info('\n✅ Búsqueda completada');
    
  } catch (error) {
    logger.error('❌ Error en búsqueda:', error);
    process.exit(1);
  }
}

buscarTRRaa();