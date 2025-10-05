/**
 * Script para limpiar componentes con configuración antigua
 * Identifica y corrige componentes mal configurados como "Aeronave"
 */

import mongoose from 'mongoose';
import Componente, { ComponenteCategoria } from '../models/Componente';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import logger from '../utils/logger';
import { connectDB } from '../utils/db';

interface ComponenteProblematico {
  _id: string;
  nombre: string;
  categoria: string;
  numeroSerie: string;
  problema: string;
}

async function identificarComponentesProblematicos(): Promise<ComponenteProblematico[]> {
  logger.info('🔍 Identificando componentes con configuración problemática...');
  
  const problemasEncontrados: ComponenteProblematico[] = [];
  
  // 1. Buscar componentes con nombres que no deberían ser componentes
  const nombresProblematicos = [
    'aeronave', 'helicoptero', 'avion', 'aircraft', 'helicopter', 'plane'
  ];
  
  for (const nombreProblematico of nombresProblematicos) {
    const componentes = await Componente.find({
      nombre: { $regex: new RegExp(nombreProblematico, 'i') }
    });
    
    componentes.forEach(comp => {
      problemasEncontrados.push({
        _id: comp._id.toString(),
        nombre: comp.nombre,
        categoria: comp.categoria,
        numeroSerie: comp.numeroSerie,
        problema: `Nombre problemático: "${comp.nombre}" - Las aeronaves no deben ser componentes`
      });
    });
  }
  
  // 2. Buscar componentes con categorías problemáticas o incorrectas
  const categoriasValidas = Object.values(ComponenteCategoria);
  const componentesCategoriasInvalidas = await Componente.find({
    categoria: { $nin: categoriasValidas }
  });
  
  componentesCategoriasInvalidas.forEach(comp => {
    problemasEncontrados.push({
      _id: comp._id.toString(),
      nombre: comp.nombre,
      categoria: comp.categoria,
      numeroSerie: comp.numeroSerie,
      problema: `Categoría inválida: "${comp.categoria}" - No existe en el enum ComponenteCategoria`
    });
  });
  
  return problemasEncontrados;
}

async function limpiarComponentesProblematicos(componentes: ComponenteProblematico[], ejecutar: boolean = false) {
  logger.info('🧹 Analizando limpieza de componentes problemáticos...');
  
  for (const comp of componentes) {
    logger.info(`\n📋 Componente problemático encontrado:`);
    logger.info(`   ID: ${comp._id}`);
    logger.info(`   Nombre: ${comp.nombre}`);
    logger.info(`   Categoría: ${comp.categoria}`);
    logger.info(`   Serie: ${comp.numeroSerie}`);
    logger.info(`   Problema: ${comp.problema}`);
    
    if (ejecutar) {
      // Verificar si tiene estados de monitoreo asociados
      const estadosAsociados = await EstadoMonitoreoComponente.find({ componenteId: comp._id });
      
      if (estadosAsociados.length > 0) {
        logger.warn(`   ⚠️  ADVERTENCIA: Tiene ${estadosAsociados.length} estados de monitoreo asociados`);
        logger.info(`   📝 Eliminando estados de monitoreo asociados...`);
        
        // Eliminar estados de monitoreo primero
        await EstadoMonitoreoComponente.deleteMany({ componenteId: comp._id });
        logger.info(`   ✅ ${estadosAsociados.length} estados de monitoreo eliminados`);
      }
      
      // Eliminar el componente
      await Componente.findByIdAndDelete(comp._id);
      logger.info(`   ✅ Componente eliminado de la base de datos`);
    } else {
      logger.info(`   🔍 MODO SIMULACIÓN - No se realizaron cambios`);
    }
  }
}

async function verificarIntegridadDespuesLimpieza() {
  logger.info('\n🔍 Verificando integridad después de la limpieza...');
  
  // Verificar que no hay estados huérfanos
  const estadosHuerfanos = await EstadoMonitoreoComponente.aggregate([
    {
      $lookup: {
        from: 'componentes',
        localField: 'componenteId',
        foreignField: '_id',
        as: 'componente'
      }
    },
    {
      $match: {
        componente: { $size: 0 }
      }
    }
  ]);
  
  if (estadosHuerfanos.length > 0) {
    logger.warn(`⚠️  Encontrados ${estadosHuerfanos.length} estados de monitoreo huérfanos`);
    // Opcional: eliminar estados huérfanos
    // await EstadoMonitoreoComponente.deleteMany({ _id: { $in: estadosHuerfanos.map(e => e._id) } });
  } else {
    logger.info('✅ No se encontraron estados de monitoreo huérfanos');
  }
  
  // Estadísticas finales
  const totalComponentes = await Componente.countDocuments();
  const totalEstados = await EstadoMonitoreoComponente.countDocuments();
  
  logger.info(`📊 Estadísticas finales:`);
  logger.info(`   - Total componentes: ${totalComponentes}`);
  logger.info(`   - Total estados de monitoreo: ${totalEstados}`);
}

async function main() {
  try {
    // Conectar a la base de datos
    await connectDB();
    logger.info('🔗 Conectado a la base de datos');
    
    // 1. Identificar componentes problemáticos
    const componentesProblematicos = await identificarComponentesProblematicos();
    
    if (componentesProblematicos.length === 0) {
      logger.info('✅ ¡Perfecto! No se encontraron componentes problemáticos');
      return;
    }
    
    logger.info(`\n⚠️  Encontrados ${componentesProblematicos.length} componentes problemáticos:`);
    
    // 2. Mostrar qué se va a limpiar (modo simulación)
    await limpiarComponentesProblematicos(componentesProblematicos, false);
    
    // 3. Preguntar si ejecutar la limpieza real
    logger.info(`\n❓ Para ejecutar la limpieza real, ejecuta:`);
    logger.info(`   EJECUTAR_LIMPIEZA=true npm run limpiar-componentes-antiguos`);
    
    const ejecutarLimpieza = process.env.EJECUTAR_LIMPIEZA === 'true';
    
    if (ejecutarLimpieza) {
      logger.info('\n🚀 Ejecutando limpieza real...');
      await limpiarComponentesProblematicos(componentesProblematicos, true);
      await verificarIntegridadDespuesLimpieza();
      logger.info('\n✅ Limpieza completada exitosamente');
    } else {
      logger.info('\n💡 Ejecuta con EJECUTAR_LIMPIEZA=true para realizar la limpieza');
    }
    
  } catch (error) {
    logger.error('❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('🔌 Desconectado de la base de datos');
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    logger.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

export { main as limpiarComponentesAntiguos };