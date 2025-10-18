import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function debugComponenteEspecifico() {
  try {
    await connectDB();
    
    // ID específico del componente del log
    const componenteId = '68f3c89f4fbc1cf3f5911bb7';
    
    logger.info(`🔍 DEBUG PROFUNDO - Componente ID: ${componenteId}`);
    
    const estado = await EstadoMonitoreoComponente.findOne({
      componenteId: componenteId
    });
    
    if (!estado) {
      logger.error(`❌ No se encontró estado para componente ${componenteId}`);
      return;
    }
    
    logger.info('\n📊 DATOS COMPLETOS DEL ESTADO:');
    logger.info(`  - _id: ${estado._id}`);
    logger.info(`  - componenteId: ${estado.componenteId}`);
    logger.info(`  - valorActual: ${estado.valorActual}h`);
    logger.info(`  - valorLimite: ${estado.valorLimite}h`);
    logger.info(`  - estado: ${estado.estado}`);
    
    if (estado.configuracionOverhaul?.habilitarOverhaul) {
      const config = estado.configuracionOverhaul;
      const TSO = estado.valorActual - config.horasUltimoOverhaul;
      
      logger.info('\n🔧 CONFIGURACIÓN OVERHAUL:');
      logger.info(`  - habilitarOverhaul: ${config.habilitarOverhaul}`);
      logger.info(`  - intervaloOverhaul: ${config.intervaloOverhaul}h`);
      logger.info(`  - cicloActual: ${config.cicloActual}`);
      logger.info(`  - horasUltimoOverhaul: ${config.horasUltimoOverhaul}h`);
      logger.info(`  - requiereOverhaul: ${config.requiereOverhaul}`);
      logger.info(`  - fechaUltimoOverhaul: ${config.fechaUltimoOverhaul}`);
      
      logger.info('\n🧮 CÁLCULOS TSO:');
      logger.info(`  - TSO = valorActual - horasUltimoOverhaul`);
      logger.info(`  - TSO = ${estado.valorActual} - ${config.horasUltimoOverhaul} = ${TSO}h`);
      
      // Calcular horas restantes usando la lógica del backend
      const horasRestantes = config.intervaloOverhaul - (TSO % config.intervaloOverhaul);
      
      logger.info('\n⏰ CÁLCULO HORAS RESTANTES:');
      logger.info(`  - TSO % intervalo = ${TSO} % ${config.intervaloOverhaul} = ${TSO % config.intervaloOverhaul}`);
      logger.info(`  - Horas restantes = ${config.intervaloOverhaul} - ${TSO % config.intervaloOverhaul} = ${horasRestantes}h`);
      
      // Verificar configuración del semáforo personalizado
      if (config.semaforoPersonalizado?.habilitado) {
        const umbrales = config.semaforoPersonalizado.umbrales;
        
        logger.info('\n🚦 CONFIGURACIÓN SEMÁFORO PERSONALIZADO:');
        logger.info(`  - habilitado: ${config.semaforoPersonalizado.habilitado}`);
        logger.info(`  - unidad: ${config.semaforoPersonalizado.unidad}`);
        logger.info(`  - UMBRALES:`);
        logger.info(`    • morado: ${umbrales.morado}`);
        logger.info(`    • rojo: ${umbrales.rojo}`);
        logger.info(`    • naranja: ${umbrales.naranja}`);
        logger.info(`    • amarillo: ${umbrales.amarillo}`);
        logger.info(`    • verde: ${umbrales.verde}`);
        
        // Simular la lógica del semáforo (backend)
        let colorBackend = 'VERDE';
        if (horasRestantes < -umbrales.morado) {
          colorBackend = 'MORADO';
        } else if (horasRestantes <= 0) {
          colorBackend = 'ROJO';
        } else if (horasRestantes <= umbrales.amarillo) {
          colorBackend = 'ROJO';
        } else if (horasRestantes <= umbrales.naranja) {
          colorBackend = 'NARANJA';
        } else if (horasRestantes <= umbrales.rojo) {
          colorBackend = 'AMARILLO';
        }
        
        logger.info('\n🎯 SIMULACIÓN LÓGICA BACKEND:');
        logger.info(`  - horasRestantes (${horasRestantes}h) <= ${umbrales.amarillo}h (amarillo)? ${horasRestantes <= umbrales.amarillo} → ${horasRestantes <= umbrales.amarillo ? 'ROJO' : 'NO'}`);
        logger.info(`  - horasRestantes (${horasRestantes}h) <= ${umbrales.naranja}h (naranja)? ${horasRestantes <= umbrales.naranja} → ${horasRestantes <= umbrales.naranja ? 'NARANJA' : 'NO'}`);
        logger.info(`  - horasRestantes (${horasRestantes}h) <= ${umbrales.rojo}h (rojo)? ${horasRestantes <= umbrales.rojo} → ${horasRestantes <= umbrales.rojo ? 'AMARILLO' : 'NO'}`);
        logger.info(`  - horasRestantes (${horasRestantes}h) > ${umbrales.rojo}h? ${horasRestantes > umbrales.rojo} → ${horasRestantes > umbrales.rojo ? 'VERDE' : 'NO'}`);
        
        logger.info(`\n🚦 COLOR CALCULADO (BACKEND): ${colorBackend}`);
        
        // Verificar si requiere overhaul
        if (config.requiereOverhaul) {
          logger.warn(`  ⚠️ REQUIERE OVERHAUL = true → Debería mostrar ROJO siempre`);
        }
        
      } else {
        logger.warn(`  ❌ NO tiene semáforo personalizado configurado`);
      }
      
    } else {
      logger.warn(`  ❌ NO tiene overhaul habilitado`);
    }
    
    await disconnectDB();
    logger.info('\n✅ Debug completado');
    
  } catch (error) {
    logger.error('❌ Error en debug:', error);
    process.exit(1);
  }
}

debugComponenteEspecifico();