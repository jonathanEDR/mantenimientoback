import express from 'express';
import User from '../models/User';
import logger from '../utils/logger';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission } from '../middleware/roleAuth';

const router = express.Router();

// Endpoint temporal para migrar usuarios
router.post('/migrate-users', requireAuth, async (req, res) => {
  try {
    logger.info('🚀 Iniciando migración de usuarios...');
    
    // Encontrar usuarios que no tienen isActive definido
    const usersToMigrate = await User.find({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null },
        { isActive: undefined }
      ]
    });
    
    logger.info(`📊 Encontrados ${usersToMigrate.length} usuarios para migrar`);
    
    const migratedUsers = [];
    
    for (const user of usersToMigrate) {
      try {
        user.isActive = true;
        
        // Si no tiene roleHistory, inicializarlo
        if (!user.roleHistory) {
          user.roleHistory = [];
        }
        
        await user.save();
        
        migratedUsers.push({
          email: user.email,
          role: user.role,
          clerkId: user.clerkId
        });
        
        logger.info(`✅ Usuario migrado: ${user.email} (${user.role})`);
      } catch (error) {
        logger.error(`❌ Error migrando usuario ${user.email}:`, error);
      }
    }
    
    // Verificar migración
    const totalActive = await User.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    
    logger.info('🎉 Migración completada');
    
    res.json({
      success: true,
      message: 'Migración de usuarios completada exitosamente',
      data: {
        totalUsers,
        totalActive,
        migratedCount: usersToMigrate.length,
        migratedUsers
      }
    });
    
  } catch (error) {
    logger.error('❌ Error en la migración:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la migración de usuarios',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;