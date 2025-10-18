/**
 * SCRIPT DE CORRECCIÓN - OVERHAULS Y SEMÁFORO
 * 
 * Este script corrige los datos inconsistentes en la base de datos:
 * 1. Corrige horasUltimoOverhaul mal calculadas
 * 2. Agrega configuración de semáforo personalizado
 * 3. Recalcula TSO y estados correctamente
 */

import { connectDB, disconnectDB } from '../utils/db';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import Componente from '../models/Componente'; // ✅ Importar modelo correcto
import { CONFIGURACIONES_SEMAFORO_PREDEFINIDAS } from '../types/semaforoPersonalizado';
import logger from '../utils/logger';

interface ConfiguracionCorreccion {
  // Configuración de semáforo personalizado para los componentes
  umbralNaranja: number;  // 35-45h = NARANJA
  umbralAmarillo: number; // 25-35h = AMARILLO
  umbralRojo: number;     // 0-25h = ROJO
}

const CONFIG_DEFAULT: ConfiguracionCorreccion = {
  umbralNaranja: 45,   // NARANJA cuando quedan <= 45h
  umbralAmarillo: 35,  // AMARILLO cuando quedan <= 35h  
  umbralRojo: 25       // ROJO cuando quedan <= 25h
};

async function corregirEstadosOverhaul() {
  try {
    await connectDB();
    logger.info('🔧 Iniciando corrección de estados de overhaul...');

    // Buscar todos los componentes con overhaul habilitado
    const estadosConOverhaul = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true
    });

    logger.info(`📊 Encontrados ${estadosConOverhaul.length} estados con overhaul habilitado`);

    for (const estado of estadosConOverhaul) {
      
      // Verificar que tiene configuración de overhaul
      if (!estado.configuracionOverhaul) {
        logger.warn(`   ⚠️ Estado ${estado._id} no tiene configuración de overhaul, saltando...`);
        continue;
      }
      
      logger.info(`\n🔧 Procesando estado ID: ${estado._id}`);
      logger.info(`   Datos actuales:`);
      logger.info(`   - valorActual: ${estado.valorActual}h`);
      logger.info(`   - valorLimite: ${estado.valorLimite}h`);
      logger.info(`   - cicloActual: ${estado.configuracionOverhaul.cicloActual}`);
      logger.info(`   - horasUltimoOverhaul: ${estado.configuracionOverhaul.horasUltimoOverhaul}h`);
      logger.info(`   - intervaloOverhaul: ${estado.configuracionOverhaul.intervaloOverhaul}h`);

      // ========== PASO 1: CORREGIR horasUltimoOverhaul ==========
      const valorActual = estado.valorActual;
      const intervalo = estado.configuracionOverhaul.intervaloOverhaul;
      const cicloActual = estado.configuracionOverhaul.cicloActual;

      let horasUltimoOverhaulCorregido: number;

      if (cicloActual === 0) {
        // Primer ciclo - nunca ha tenido overhaul
        horasUltimoOverhaulCorregido = 0;
        logger.info(`   ✅ Ciclo 0: horasUltimoOverhaul = 0`);
      } else {
        // Ha tenido overhauls - calcular basándose en ciclos completados
        // El último overhaul fue cuando completó el ciclo anterior
        horasUltimoOverhaulCorregido = cicloActual * intervalo;
        logger.info(`   ✅ Ciclo ${cicloActual}: horasUltimoOverhaul = ${cicloActual} × ${intervalo} = ${horasUltimoOverhaulCorregido}h`);
      }

      // Verificar si la corrección es necesaria
      const horasAnterior = estado.configuracionOverhaul.horasUltimoOverhaul;
      if (horasAnterior !== horasUltimoOverhaulCorregido) {
        logger.warn(`   🔧 CORRIGIENDO: ${horasAnterior}h → ${horasUltimoOverhaulCorregido}h`);
        
        estado.configuracionOverhaul.horasUltimoOverhaul = horasUltimoOverhaulCorregido;
        
        // Recalcular próximo overhaul
        const proximoOverhaulEn = (cicloActual + 1) * intervalo;
        estado.configuracionOverhaul.proximoOverhaulEn = proximoOverhaulEn;
        
        logger.info(`   📅 Próximo overhaul en: ${proximoOverhaulEn}h`);
      }

      // ========== PASO 2: CALCULAR TSO CORRECTO ==========
      const TSO = valorActual - horasUltimoOverhaulCorregido;
      const horasRestantesOverhaul = intervalo - TSO;
      
      logger.info(`   📊 TSO (Time Since Overhaul): ${valorActual} - ${horasUltimoOverhaulCorregido} = ${TSO}h`);
      logger.info(`   ⏰ Horas restantes para overhaul: ${intervalo} - ${TSO} = ${horasRestantesOverhaul}h`);

      // ========== PASO 3: AGREGAR CONFIGURACIÓN DE SEMÁFORO ==========
      if (!estado.configuracionOverhaul.semaforoPersonalizado?.habilitado) {
        logger.info(`   🚦 Agregando configuración de semáforo personalizado...`);
        
        estado.configuracionOverhaul.semaforoPersonalizado = {
          habilitado: true,
          unidad: 'HORAS',
          umbrales: {
            morado: 10,    // 10h después del límite = MORADO
            rojo: CONFIG_DEFAULT.umbralRojo,      // <= 25h = ROJO
            naranja: CONFIG_DEFAULT.umbralNaranja, // <= 45h = NARANJA  
            amarillo: CONFIG_DEFAULT.umbralAmarillo, // <= 35h = AMARILLO
            verde: 100     // > 45h = VERDE
          },
          descripciones: {
            morado: 'SOBRE-CRÍTICO - Componente vencido en uso',
            rojo: 'Crítico - Acción inmediata requerida',
            naranja: 'Alto - Preparar overhaul próximo',
            amarillo: 'Medio - Monitorear progreso',
            verde: 'OK - Funcionando normal'
          },
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        };
        
        logger.info(`   ✅ Semáforo configurado con umbrales:`);
        logger.info(`      - ROJO: <= ${CONFIG_DEFAULT.umbralRojo}h`);
        logger.info(`      - NARANJA: <= ${CONFIG_DEFAULT.umbralNaranja}h`);
        logger.info(`      - AMARILLO: <= ${CONFIG_DEFAULT.umbralAmarillo}h`);
      }

      // ========== PASO 4: DETERMINAR COLOR ESPERADO ==========
      let colorEsperado = 'VERDE';
      if (horasRestantesOverhaul <= 0) {
        colorEsperado = horasRestantesOverhaul <= -10 ? 'MORADO' : 'ROJO';
      } else if (horasRestantesOverhaul <= CONFIG_DEFAULT.umbralRojo) {
        colorEsperado = 'ROJO';
      } else if (horasRestantesOverhaul <= CONFIG_DEFAULT.umbralAmarillo) {
        colorEsperado = 'AMARILLO';
      } else if (horasRestantesOverhaul <= CONFIG_DEFAULT.umbralNaranja) {
        colorEsperado = 'NARANJA';
      }
      
      logger.info(`   🎯 Color esperado del semáforo: ${colorEsperado}`);

      // ========== PASO 5: GUARDAR CAMBIOS ==========
      estado.markModified('configuracionOverhaul');
      await estado.save();
      
      logger.info(`   💾 Estado corregido y guardado`);
    }

    logger.info(`\n✅ Corrección completada para ${estadosConOverhaul.length} componentes`);

  } catch (error) {
    logger.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

// ========== FUNCIÓN PARA VALIDAR CORRECCIÓN ==========
async function validarCorreccion() {
  try {
    await connectDB();
    logger.info('\n🔍 Validando corrección...');

    const estados = await EstadoMonitoreoComponente.find({
      'configuracionOverhaul.habilitarOverhaul': true
    }).populate('componenteId', 'nombre numeroSerie');

    for (const estado of estados) {
      const nombreComponente = (estado.componenteId as any)?.nombre || 'Unknown';
      
      // Verificar que tiene configuración de overhaul
      if (!estado.configuracionOverhaul) {
        logger.warn(`   ⚠️ ${nombreComponente} no tiene configuración de overhaul, saltando...`);
        continue;
      }
      
      const valorActual = estado.valorActual;
      const horasUltimoOverhaul = estado.configuracionOverhaul.horasUltimoOverhaul;
      const intervalo = estado.configuracionOverhaul.intervaloOverhaul;
      const cicloActual = estado.configuracionOverhaul.cicloActual;

      const TSO = valorActual - horasUltimoOverhaul;
      const horasRestantes = intervalo - TSO;

      logger.info(`\n📊 ${nombreComponente}:`);
      logger.info(`   Valor actual: ${valorActual}h`);
      logger.info(`   Último overhaul: ${horasUltimoOverhaul}h`);
      logger.info(`   TSO: ${TSO}h`);
      logger.info(`   Horas restantes: ${horasRestantes}h`);
      logger.info(`   Semáforo habilitado: ${estado.configuracionOverhaul.semaforoPersonalizado?.habilitado || false}`);

      // Validar que TSO sea positivo y lógico
      if (TSO < 0) {
        logger.error(`   ❌ ERROR: TSO negativo (${TSO}h) - datos inconsistentes`);
      } else if (TSO > intervalo && horasRestantes < 0) {
        logger.warn(`   ⚠️  ADVERTENCIA: Componente necesita overhaul (${horasRestantes}h)`);
      } else {
        logger.info(`   ✅ Datos consistentes`);
      }
    }

  } catch (error) {
    logger.error('❌ Error durante la validación:', error);
  } finally {
    await disconnectDB();
  }
}

// Ejecutar corrección si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--validar')) {
    validarCorreccion();
  } else {
    corregirEstadosOverhaul()
      .then(() => {
        logger.info('🎉 Corrección completada exitosamente');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('💥 Error en corrección:', error);
        process.exit(1);
      });
  }
}

export { corregirEstadosOverhaul, validarCorreccion };