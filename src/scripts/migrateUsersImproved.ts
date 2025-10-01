import mongoose from 'mongoose';
import User from '../models/User';
import logger from '../utils/logger';

// Configuración de conexión directa (sin usar dotenv para simplicidad)
const MONGODB_URI = 'mongodb://127.0.0.1:27017/MantenimientosDB';

async function migrateUsersToNewSchema() {
  try {
    logger.info('🚀 Iniciando migración automática de usuarios...');
    
    // Conectar directamente con la URI
    await mongoose.connect(MONGODB_URI);
    logger.info('✅ Conectado a MongoDB');

    // Buscar usuarios sin el campo isActive o con isActive null/undefined
    const usersToMigrate = await User.find({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null },
        { isActive: undefined }
      ]
    });

    logger.info(`📊 Usuarios a migrar: ${usersToMigrate.length}`);

    if (usersToMigrate.length === 0) {
      logger.info('✅ No hay usuarios que requieran migración');
      return;
    }

    // Migrar usuarios en lotes
    let migratedCount = 0;
    for (const user of usersToMigrate) {
      try {
        user.isActive = true;
        await user.save();
        migratedCount++;
        logger.info(`✅ Usuario migrado: ${user.email} (${user.role})`);
      } catch (error) {
        logger.error(`❌ Error migrando usuario ${user.email}:`, error);
      }
    }

    logger.info(`🎉 Migración completada: ${migratedCount}/${usersToMigrate.length} usuarios`);

    // Verificar resultado
    const remainingUsers = await User.countDocuments({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null },
        { isActive: undefined }
      ]
    });

    if (remainingUsers === 0) {
      logger.info('✅ Todos los usuarios han sido migrados correctamente');
    } else {
      logger.warn(`⚠️ ${remainingUsers} usuarios aún requieren migración`);
    }

  } catch (error) {
    logger.error('❌ Error en la migración:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('🔌 Desconectado de MongoDB');
  }
}

// Función auxiliar para verificar si la migración es necesaria
export async function checkMigrationStatus(): Promise<boolean> {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const usersNeedingMigration = await User.countDocuments({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null },
        { isActive: undefined }
      ]
    });

    await mongoose.disconnect();
    return usersNeedingMigration > 0;
  } catch (error) {
    logger.error('Error verificando estado de migración:', error);
    return false;
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  migrateUsersToNewSchema()
    .then(() => {
      logger.info('💻 Migración de usuarios finalizada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Migración de usuarios falló:', error);
      process.exit(1);
    });
}

export { migrateUsersToNewSchema };