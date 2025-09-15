import express from 'express';
import User from '../models/User';
import { requireAuth } from '../middleware/clerkAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/users - Obtener todos los usuarios
router.get('/', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo lista de todos los usuarios');

    const usuarios = await User.find({}, {
      password: 0 // Excluir contraseña por seguridad
    }).sort({ createdAt: -1 });

    logger.info(`Se encontraron ${usuarios.length} usuarios`);

    res.json({
      success: true,
      data: usuarios,
      total: usuarios.length
    });

  } catch (error) {
    logger.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/users/stats - Obtener estadísticas de usuarios
router.get('/stats', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de usuarios');

    const totalUsuarios = await User.countDocuments();
    const usuariosRecientes = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 días
    });

    const stats = {
      totalUsuarios,
      usuariosRecientes,
      usuariosActivos: totalUsuarios // Por ahora todos son considerados activos
    };

    logger.info('Estadísticas de usuarios obtenidas:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

export default router;