import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

// Simulamos el cálculo del semáforo con los nuevos datos corregidos
async function simularSemaforo() {
  try {
    await connectDB();
    
    logger.info('🧪 SIMULANDO ESCENARIO: Componente con 35-45h restantes para overhaul');
    
    // Configuramos un ejemplo que tenga entre 35-45h restantes
    const testCase = {
      valorActual: 60,      // Horas actuales del componente
      intervaloOverhaul: 100,  // Cada 100h debe hacer overhaul
      cicloActual: 0,       // Primer ciclo, nunca ha tenido overhaul
      horasUltimoOverhaul: 0   // Nunca ha tenido overhaul
    };
    
    const TSO = testCase.valorActual - testCase.horasUltimoOverhaul;
    const horasRestantes = testCase.intervaloOverhaul - TSO;
    
    logger.info('📊 Datos del escenario de prueba:');
    logger.info(`  - valorActual: ${testCase.valorActual}h`);
    logger.info(`  - intervaloOverhaul: ${testCase.intervaloOverhaul}h`);
    logger.info(`  - horasUltimoOverhaul: ${testCase.horasUltimoOverhaul}h`);
    logger.info(`  - TSO (Time Since Overhaul): ${TSO}h`);
    logger.info(`  - Horas restantes para overhaul: ${horasRestantes}h`);
    
    // Aplicamos la lógica del semáforo (como en SemaforoCalculatorService)
    const umbrales = {
      morado: 10,    // <= -10h = MORADO (vencido hace más de 10h)
      rojo: 25,      // <= 25h = ROJO
      amarillo: 35,  // <= 35h = AMARILLO  
      naranja: 45,   // <= 45h = NARANJA
      verde: 100     // > 45h = VERDE
    };
    
    let colorSemaforo = 'VERDE';
    let descripcion = 'OK - Funcionando normal';
    
    if (horasRestantes <= 0) {
      if (horasRestantes <= -umbrales.morado) {
        colorSemaforo = 'MORADO';
        descripcion = 'SOBRE-CRÍTICO - Componente vencido en uso';
      } else {
        colorSemaforo = 'ROJO';
        descripcion = 'Crítico - Acción inmediata requerida';
      }
    } else if (horasRestantes <= umbrales.rojo) {
      colorSemaforo = 'ROJO';
      descripcion = 'Crítico - Acción inmediata requerida';
    } else if (horasRestantes <= umbrales.amarillo) {
      colorSemaforo = 'AMARILLO';
      descripcion = 'Medio - Monitorear progreso';
    } else if (horasRestantes <= umbrales.naranja) {
      colorSemaforo = 'NARANJA';
      descripcion = 'Alto - Preparar overhaul próximo';
    }
    
    logger.info('\n🚦 RESULTADO DEL SEMÁFORO:');
    logger.info(`  - Color calculado: ${colorSemaforo}`);
    logger.info(`  - Descripción: ${descripcion}`);
    
    // Verificar los umbrales específicos
    logger.info('\n🎯 VERIFICACIÓN DE UMBRALES:');
    logger.info(`  - ${horasRestantes}h <= 25h (ROJO)? ${horasRestantes <= 25}`);
    logger.info(`  - ${horasRestantes}h <= 35h (AMARILLO)? ${horasRestantes <= 35}`);
    logger.info(`  - ${horasRestantes}h <= 45h (NARANJA)? ${horasRestantes <= 45}`);
    
    // Test específico para el rango 35-45h
    if (horasRestantes > 35 && horasRestantes <= 45) {
      logger.info(`  ✅ PERFECTO: ${horasRestantes}h está en el rango 35-45h y debe ser NARANJA`);
      if (colorSemaforo === 'NARANJA') {
        logger.info(`  ✅ ÉXITO: El semáforo muestra correctamente NARANJA`);
      } else {
        logger.error(`  ❌ ERROR: El semáforo muestra ${colorSemaforo} en lugar de NARANJA`);
      }
    }
    
    await disconnectDB();
    logger.info('\n✅ Simulación completada');
    
  } catch (error) {
    logger.error('❌ Error en simulación:', error);
    process.exit(1);
  }
}

simularSemaforo();