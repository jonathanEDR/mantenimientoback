import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function buscarEstadosConTSO_Cero() {
  try {
    await connectDB();
    
    logger.info('🔍 BUSCANDO estados con TSO = 0 (recién completaron overhaul)...');
    
    // Buscar todos los estados con overhaul habilitado
    const estados = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true
    });
    
    logger.info(`📦 Estados con overhaul encontrados: ${estados.length}`);
    
    const estadosConTSO_Cero = [];
    
    for (const estado of estados) {
      if (estado.configuracionOverhaul) {
        const TSO = estado.valorActual - estado.configuracionOverhaul.horasUltimoOverhaul;
        const horasRestantes = estado.configuracionOverhaul.intervaloOverhaul - (TSO % estado.configuracionOverhaul.intervaloOverhaul);
        
        // Buscar estados que recientemente completaron overhaul o tienen TSO bajo
        if (TSO >= 0 && TSO <= 10) {  // TSO muy bajo = recién hizo overhaul
          
          logger.info(`\n🎯 ESTADO CON TSO BAJO ENCONTRADO:`);
          logger.info(`  - ComponenteID: ${estado.componenteId}`);
          logger.info(`  - ID Estado: ${estado._id}`);
          logger.info(`  - valorActual: ${estado.valorActual}h`);
          logger.info(`  - horasUltimoOverhaul: ${estado.configuracionOverhaul.horasUltimoOverhaul}h`);
          logger.info(`  - TSO: ${TSO}h`);
          logger.info(`  - intervaloOverhaul: ${estado.configuracionOverhaul.intervaloOverhaul}h`);
          logger.info(`  - Horas restantes: ${horasRestantes}h`);
          logger.info(`  - Ciclo actual: ${estado.configuracionOverhaul.cicloActual}`);
          logger.info(`  - Fecha último overhaul: ${estado.configuracionOverhaul.fechaUltimoOverhaul}`);
          
          // Determinar color del semáforo
          let colorSemaforo = 'VERDE';
          if (horasRestantes <= 0) {
            colorSemaforo = 'MORADO/ROJO';
          } else if (horasRestantes <= 20) {
            colorSemaforo = 'AMARILLO';
          } else if (horasRestantes <= 30) {
            colorSemaforo = 'NARANJA';
          }
          
          logger.info(`  🚦 Color calculado: ${colorSemaforo}`);
          
          if (TSO === 0) {
            logger.info(`  ✅ TSO = 0: ACABA DE COMPLETAR OVERHAUL`);
            if (colorSemaforo !== 'VERDE') {
              logger.warn(`  ❌ PROBLEMA: Debería ser VERDE pero es ${colorSemaforo}`);
            }
          }
          
          estadosConTSO_Cero.push({
            componente: `ID-${estado.componenteId}`,
            TSO,
            horasRestantes,
            colorSemaforo
          });
        }
      }
    }
    
    logger.info(`\n📊 RESUMEN: ${estadosConTSO_Cero.length} estados con TSO <= 10h encontrados`);
    
    await disconnectDB();
    logger.info('\n✅ Búsqueda completada');
    
  } catch (error) {
    logger.error('❌ Error en búsqueda:', error);
    process.exit(1);
  }
}

buscarEstadosConTSO_Cero();