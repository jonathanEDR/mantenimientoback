import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function analizarPostOverhaul() {
  try {
    await connectDB();
    
    logger.info('🧪 ANÁLISIS: Componente que acaba de completar overhaul');
    
    // Simulamos el escenario exacto de la imagen
    const escenarioPostOverhaul = {
      valorActual: 60,      // TSN: 60h (horas totales del componente)
      intervaloOverhaul: 50,   // Cada 50h debe hacer overhaul (según configuración)
      cicloActual: 1,          // Acaba de completar el primer overhaul (ciclo 1 de 2)
      horasUltimoOverhaul: 50, // Hizo overhaul a las 50h (cuando completó el primer ciclo)
      maxCiclos: 2
    };
    
    // Cálculo actual del sistema
    const TSO = escenarioPostOverhaul.valorActual - escenarioPostOverhaul.horasUltimoOverhaul;
    const horasRestantesActual = escenarioPostOverhaul.intervaloOverhaul - (TSO % escenarioPostOverhaul.intervaloOverhaul);
    
    logger.info('\n📊 ESCENARIO POST-OVERHAUL:');
    logger.info(`  - TSN (horas totales componente): ${escenarioPostOverhaul.valorActual}h`);
    logger.info(`  - Intervalo overhaul: ${escenarioPostOverhaul.intervaloOverhaul}h`);
    logger.info(`  - Ciclo actual: ${escenarioPostOverhaul.cicloActual} de ${escenarioPostOverhaul.maxCiclos}`);
    logger.info(`  - Horas último overhaul: ${escenarioPostOverhaul.horasUltimoOverhaul}h`);
    logger.info(`  - TSO (Time Since Overhaul): ${TSO}h`);
    logger.info(`  - Horas restantes calculadas: ${horasRestantesActual}h`);
    
    // Análisis del problema
    logger.info('\n🔍 ANÁLISIS DEL PROBLEMA:');
    
    if (TSO === 0) {
      logger.info(`  ✅ TSO = 0h indica que ACABA de hacer overhaul`);
      logger.info(`  ✅ Debería tener ${escenarioPostOverhaul.intervaloOverhaul}h completas hasta el próximo`);
      logger.info(`  ❌ PERO el sistema calcula: ${horasRestantesActual}h restantes`);
    } else {
      logger.info(`  - TSO = ${TSO}h desde el último overhaul`);
      logger.info(`  - Horas hasta próximo overhaul: ${escenarioPostOverhaul.intervaloOverhaul - TSO}h`);
    }
    
    // Cálculo correcto esperado
    const horasRestantesCorrectas = escenarioPostOverhaul.intervaloOverhaul - TSO;
    
    logger.info('\n💡 CÁLCULO ESPERADO:');
    logger.info(`  - Horas restantes = intervalo - TSO`);
    logger.info(`  - Horas restantes = ${escenarioPostOverhaul.intervaloOverhaul} - ${TSO} = ${horasRestantesCorrectas}h`);
    
    // Determinar color del semáforo con ambos cálculos
    const umbrales = {
      rojo: 20,      
      amarillo: 30,  
      naranja: 40,
      verde: 999
    };
    
    function calcularColor(horas: number): string {
      if (horas <= 0) return 'MORADO/ROJO';
      if (horas <= umbrales.rojo) return 'ROJO';
      if (horas <= umbrales.amarillo) return 'AMARILLO';
      if (horas <= umbrales.naranja) return 'NARANJA';
      return 'VERDE';
    }
    
    const colorActual = calcularColor(horasRestantesActual);
    const colorCorrecto = calcularColor(horasRestantesCorrectas);
    
    logger.info('\n🚦 SEMÁFORO:');
    logger.info(`  - Color con cálculo actual (${horasRestantesActual}h): ${colorActual}`);
    logger.info(`  - Color con cálculo correcto (${horasRestantesCorrectas}h): ${colorCorrecto}`);
    
    if (colorActual !== colorCorrecto) {
      logger.warn(`  ❌ PROBLEMA DETECTADO: Debería ser ${colorCorrecto}, pero muestra ${colorActual}`);
    } else {
      logger.info(`  ✅ Colors coinciden correctamente`);
    }
    
    // Revisar si el problema está en el cálculo modular
    logger.info('\n🔧 ANÁLISIS DEL CÁLCULO MODULAR:');
    logger.info(`  - TSO % intervalo = ${TSO} % ${escenarioPostOverhaul.intervaloOverhaul} = ${TSO % escenarioPostOverhaul.intervaloOverhaul}`);
    logger.info(`  - intervalo - (TSO % intervalo) = ${escenarioPostOverhaul.intervaloOverhaul} - ${TSO % escenarioPostOverhaul.intervaloOverhaul} = ${horasRestantesActual}`);
    
    if (TSO === 0) {
      logger.info(`  🎯 CUANDO TSO = 0: 0 % 50 = 0, entonces 50 - 0 = 50h restantes`);
      logger.info(`  ✅ El cálculo modular es CORRECTO para TSO = 0`);
    }
    
    await disconnectDB();
    logger.info('\n✅ Análisis completado');
    
  } catch (error) {
    logger.error('❌ Error en análisis:', error);
    process.exit(1);
  }
}

analizarPostOverhaul();