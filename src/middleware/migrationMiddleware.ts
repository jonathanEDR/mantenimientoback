import { Request, Response, NextFunction } from 'express';
import { checkMigrationStatus, migrateUsersToNewSchema } from '../scripts/migrateUsersImproved';
import logger from '../utils/logger';

// Cache para evitar verificaciones frecuentes
let lastMigrationCheck = 0;
let migrationInProgress = false;
const MIGRATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * Middleware para asegurar migración automática de usuarios
 * Se ejecuta de manera asíncrona para no bloquear requests
 */
export const ensureUserMigration = async (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  
  // Verificar si es tiempo de revisar migración
  if (!migrationInProgress && (now - lastMigrationCheck) > MIGRATION_CHECK_INTERVAL) {
    lastMigrationCheck = now;
    
    // Ejecutar verificación en background
    setImmediate(async () => {
      try {
        migrationInProgress = true;
        const needsMigration = await checkMigrationStatus();
        
        if (needsMigration) {
          logger.info('🔄 Iniciando migración automática de usuarios en background...');
          await migrateUsersToNewSchema();
          logger.info('✅ Migración automática completada');
        }
      } catch (error) {
        logger.error('❌ Error en migración automática:', error);
      } finally {
        migrationInProgress = false;
      }
    });
  }
  
  next();
};

/**
 * Middleware para forzar migración en rutas críticas de usuarios
 * Se ejecuta de manera síncrona solo en rutas específicas
 */
export const forceUserMigrationSync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!migrationInProgress) {
      migrationInProgress = true;
      const needsMigration = await checkMigrationStatus();
      
      if (needsMigration) {
        logger.warn('⚠️ Ejecutando migración síncrona requerida para operación crítica');
        await migrateUsersToNewSchema();
      }
    }
    next();
  } catch (error) {
    logger.error('❌ Error en migración síncrona:', error);
    // No fallar la request, continuar sin migración
    next();
  } finally {
    migrationInProgress = false;
  }
};