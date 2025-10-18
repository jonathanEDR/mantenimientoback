import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { connectDB, disconnectDB } from '../utils/db';
import logger from '../utils/logger';

async function propuestasConfiguracionUmbrales() {
  try {
    await connectDB();
    
    const componenteId = '68f3c89f4fbc1cf3f5911bb7';
    const estado = await EstadoMonitoreoComponente.findOne({ componenteId });
    
    if (!estado) {
      logger.error('Componente no encontrado');
      return;
    }
    
    const horasRestantes = 50; // Escenario actual del usuario
    const intervaloOverhaul = 50; // Cada 50h hace overhaul
    
    logger.info('🎯 PROPUESTAS DE CONFIGURACIÓN DE UMBRALES');
    logger.info('==========================================');
    logger.info(`Escenario: TSO=0h (recién completó overhaul), ${horasRestantes}h restantes para próximo overhaul`);
    
    const propuestas = [
      {
        nombre: 'CONFIGURACIÓN ACTUAL (Mostrando AMARILLO)',
        umbrales: { morado: 50, rojo: 50, naranja: 30, amarillo: 20, verde: 0 },
        descripcion: 'La que está configurada actualmente'
      },
      {
        nombre: 'PROPUESTA 1: Verde hasta 20h restantes',
        umbrales: { morado: 10, rojo: 20, naranja: 15, amarillo: 10, verde: 0 },
        descripcion: 'Como parece querer el usuario: VERDE cuando > 20h restantes'
      },
      {
        nombre: 'PROPUESTA 2: Más conservadora',
        umbrales: { morado: 15, rojo: 30, naranja: 25, amarillo: 15, verde: 0 },
        descripcion: 'VERDE cuando > 30h, AMARILLO 15-30h'
      },
      {
        nombre: 'PROPUESTA 3: Basada en porcentajes del intervalo',
        umbrales: { 
          morado: Math.round(intervaloOverhaul * 0.1), // 10% del intervalo = 5h
          rojo: Math.round(intervaloOverhaul * 0.4),    // 40% del intervalo = 20h  
          naranja: Math.round(intervaloOverhaul * 0.3), // 30% del intervalo = 15h
          amarillo: Math.round(intervaloOverhaul * 0.2), // 20% del intervalo = 10h
          verde: 0 
        },
        descripcion: 'Proporcional al intervalo de overhaul (50h)'
      }
    ];
    
    propuestas.forEach((propuesta, index) => {
      logger.info(`\n📋 ${propuesta.nombre}`);
      logger.info(`   ${propuesta.descripcion}`);
      logger.info(`   Umbrales: morado=${propuesta.umbrales.morado}, rojo=${propuesta.umbrales.rojo}, naranja=${propuesta.umbrales.naranja}, amarillo=${propuesta.umbrales.amarillo}`);
      
      // Calcular color con esta configuración
      let color = 'VERDE';
      if (horasRestantes < -propuesta.umbrales.morado) {
        color = 'MORADO';
      } else if (horasRestantes <= 0) {
        color = 'ROJO';
      } else if (horasRestantes <= propuesta.umbrales.amarillo) {
        color = 'ROJO';
      } else if (horasRestantes <= propuesta.umbrales.naranja) {
        color = 'NARANJA';
      } else if (horasRestantes <= propuesta.umbrales.rojo) {
        color = 'AMARILLO';
      }
      
      logger.info(`   🚦 Con ${horasRestantes}h restantes → COLOR: ${color}`);
      
      // Mostrar rangos de colores
      logger.info(`   📊 Rangos de colores:`);
      logger.info(`      🟢 VERDE: > ${propuesta.umbrales.rojo}h`);
      logger.info(`      🟡 AMARILLO: ${propuesta.umbrales.naranja + 1}-${propuesta.umbrales.rojo}h`);  
      logger.info(`      🟠 NARANJA: ${propuesta.umbrales.amarillo + 1}-${propuesta.umbrales.naranja}h`);
      logger.info(`      🔴 ROJO: ≤ ${propuesta.umbrales.amarillo}h`);
      logger.info(`      🟣 MORADO: < -${propuesta.umbrales.morado}h (vencido)`);
    });
    
    logger.info('\n💡 RECOMENDACIÓN:');
    logger.info('   Si quieres que muestre VERDE cuando recién completa overhaul (50h restantes),');
    logger.info('   usa la PROPUESTA 1 o ajusta los umbrales para que rojo > 50.');
    logger.info('   Por ejemplo: rojo=60, amarillo=20 → VERDE cuando > 60h restantes.');
    
    await disconnectDB();
    logger.info('\n✅ Análisis completado');
    
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

propuestasConfiguracionUmbrales();