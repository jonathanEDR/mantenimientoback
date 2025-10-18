import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function verificarComponenteProblematico() {
  try {
    await connectDB();
    
    // Buscar el componente que tenía el problema original (valorActual=200h)
    const componenteProblematico = await EstadoMonitoreoComponente.findOne({
      valorActual: 200,
      'configuracionOverhaul.habilitarOverhaul': true
    });
    
    if (!componenteProblematico) {
      logger.error('❌ No se encontró el componente problemático');
      return;
    }
    
    logger.info('🔍 ANÁLISIS DEL COMPONENTE QUE TENÍA EL PROBLEMA ORIGINAL:');
    logger.info(`  ID: ${componenteProblematico._id}`);
    
    // Datos corregidos
    const valorActual = componenteProblematico.valorActual;
    const horasUltimoOverhaul = componenteProblematico.configuracionOverhaul!.horasUltimoOverhaul;
    const intervalo = componenteProblematico.configuracionOverhaul!.intervaloOverhaul;
    const ciclo = componenteProblematico.configuracionOverhaul!.cicloActual;
    
    // Cálculos
    const TSO = valorActual - horasUltimoOverhaul;
    const horasRestantes = intervalo - (TSO % intervalo);
    
    logger.info('\n📊 ESTADO ACTUAL (DESPUÉS DE LA CORRECCIÓN):');
    logger.info(`  - valorActual: ${valorActual}h`);
    logger.info(`  - horasUltimoOverhaul: ${horasUltimoOverhaul}h (antes era: 565h)`);
    logger.info(`  - intervaloOverhaul: ${intervalo}h`);
    logger.info(`  - cicloActual: ${ciclo}`);
    logger.info(`  - TSO: ${valorActual} - ${horasUltimoOverhaul} = ${TSO}h`);
    logger.info(`  - Horas restantes: ${intervalo} - (${TSO} % ${intervalo}) = ${horasRestantes}h`);
    
    // Determinar color del semáforo
    const umbrales = {
      rojo: 25,      
      amarillo: 35,  
      naranja: 45   
    };
    
    let colorSemaforo = 'VERDE';
    if (horasRestantes <= 0) {
      colorSemaforo = 'MORADO/ROJO';
    } else if (horasRestantes <= umbrales.rojo) {
      colorSemaforo = 'ROJO';
    } else if (horasRestantes <= umbrales.amarillo) {
      colorSemaforo = 'AMARILLO';
    } else if (horasRestantes <= umbrales.naranja) {
      colorSemaforo = 'NARANJA';
    }
    
    logger.info('\n🚦 SEMÁFORO CALCULADO:');
    logger.info(`  - Color: ${colorSemaforo}`);
    
    // El problema original: este componente debe estar vencido porque
    // TSO = 175h, pero intervalo es 25h, entonces está 7 ciclos por encima
    // 175 / 25 = 7 ciclos completos -> requiere overhaul hace mucho tiempo
    
    const ciclosCompletados = Math.floor(TSO / intervalo);
    const ciclosAtrasados = ciclosCompletados - ciclo;
    
    logger.info('\n⚠️ ANÁLISIS DE VENCIMIENTO:');
    logger.info(`  - Ciclos que debería haber completado: ${ciclosCompletados}`);
    logger.info(`  - Ciclos registrados: ${ciclo}`);
    logger.info(`  - Ciclos atrasados: ${ciclosAtrasados}`);
    
    if (ciclosAtrasados > 0) {
      logger.warn(`  ⚠️ COMPONENTE VENCIDO: Debe hacer overhaul desde hace ${ciclosAtrasados} ciclos`);
      logger.warn(`  ⚠️ Debería mostrar color ROJO o MORADO (crítico)`);
    }
    
    await disconnectDB();
    logger.info('\n✅ Análisis completado');
    
  } catch (error) {
    logger.error('❌ Error en análisis:', error);
    process.exit(1);
  }
}

verificarComponenteProblematico();