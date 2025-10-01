import { connectDB, disconnectDB } from '../utils/db';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Script para migrar usuarios existentes al nuevo esquema
 * Agrega el campo isActive: true a todos los usuarios existentes
 */
async function migrateUsersToNewSchema() {
  try {
    await connectDB();
    
    logger.info('🚀 Iniciando migración de usuarios...');
    
    // Encontrar usuarios que no tienen isActive definido o es false/null
    const usersToMigrate = await User.find({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null },
        { isActive: undefined }
      ]
    });
    
    logger.info(`📊 Encontrados ${usersToMigrate.length} usuarios para migrar`);
    
    for (const user of usersToMigrate) {
      try {
        user.isActive = true;
        
        // Si no tiene roleHistory, inicializarlo
        if (!user.roleHistory) {
          user.roleHistory = [];
        }
        
        await user.save();
        
        logger.info(`✅ Usuario migrado: ${user.email} (${user.role})`);
      } catch (error) {
        logger.error(`❌ Error migrando usuario ${user.email}:`, error);
      }
    }
    
    // Verificar migración
    const totalActive = await User.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    
    logger.info('🎉 Migración completada');
    logger.info(`📊 Estadísticas finales:`);
    logger.info(`   - Total usuarios: ${totalUsers}`);
    logger.info(`   - Usuarios activos: ${totalActive}`);
    logger.info(`   - Usuarios migrados: ${usersToMigrate.length}`);
    
    if (totalActive === totalUsers) {
      logger.info('✅ Todos los usuarios están ahora activos');
    } else {
      logger.warn('⚠️  Algunos usuarios podrían necesitar revisión manual');
    }
    
  } catch (error) {
    logger.error('❌ Error en la migración:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateUsersToNewSchema()
    .then(() => {
      logger.info('🏁 Script de migración terminado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Script de migración falló:', error);
      process.exit(1);
    });
}

export default migrateUsersToNewSchema;