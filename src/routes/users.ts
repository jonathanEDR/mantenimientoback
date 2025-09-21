import express from 'express';
import User, { UserRole } from '../models/User';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission, hasPermission, getRolePermissions } from '../middleware/roleAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/users - Obtener todos los usuarios
router.get('/', requireAuth, requirePermission('VIEW_USERS'), async (req, res) => {
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
router.get('/stats', requireAuth, requirePermission('VIEW_USERS'), async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de usuarios');

    const totalUsuarios = await User.countDocuments();
    const usuariosRecientes = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 días
    });

    // Estadísticas por rol
    const usuariosPorRol: Record<UserRole, number> = {
      [UserRole.ADMINISTRADOR]: 0,
      [UserRole.MECANICO]: 0,
      [UserRole.COPILOTO]: 0,
      [UserRole.ESPECIALISTA]: 0
    };
    
    for (const role of Object.values(UserRole)) {
      usuariosPorRol[role] = await User.countDocuments({ role });
    }

    const stats = {
      totalUsuarios,
      usuariosRecientes,
      usuariosActivos: totalUsuarios, // Por ahora todos son considerados activos
      usuariosPorRol
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

// PUT /api/users/:id/role - Cambiar rol de usuario (solo administradores)
router.put('/:id/role', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    logger.info(`Cambiando rol de usuario ${id} a ${newRole}`);

    // Validar que el nuevo rol es válido
    if (!Object.values(UserRole).includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido',
        validRoles: Object.values(UserRole)
      });
    }

    const usuario = await User.findByIdAndUpdate(
      id,
      { role: newRole },
      { new: true, runValidators: true }
    );

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    logger.info(`Rol actualizado exitosamente: ${usuario.name} -> ${newRole}`);

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      user: usuario
    });

  } catch (error) {
    logger.error('Error al cambiar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/users/me/permissions - Obtener permisos del usuario actual
router.get('/me/permissions', requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).user.sub;
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    const permissions = getRolePermissions(user.role);
    
    // Convertir array de permisos a objeto booleano
    const permissionsObj = {
      canManageUsers: hasPermission(user.role, 'MANAGE_USERS'),
      canViewUsers: hasPermission(user.role, 'VIEW_USERS'),
      canCreateComponents: hasPermission(user.role, 'CREATE_COMPONENTS'),
      canEditComponents: hasPermission(user.role, 'EDIT_COMPONENTS'),
      canDeleteComponents: hasPermission(user.role, 'DELETE_COMPONENTS'),
      canViewComponents: hasPermission(user.role, 'VIEW_COMPONENTS'),
      canCreateWorkOrders: hasPermission(user.role, 'CREATE_WORK_ORDERS'),
      canEditWorkOrders: hasPermission(user.role, 'EDIT_WORK_ORDERS'),
      canDeleteWorkOrders: hasPermission(user.role, 'DELETE_WORK_ORDERS'),
      canViewWorkOrders: hasPermission(user.role, 'VIEW_WORK_ORDERS'),
      canCompleteWorkOrders: hasPermission(user.role, 'COMPLETE_WORK_ORDERS'),
      canCreateInspections: hasPermission(user.role, 'CREATE_INSPECTIONS'),
      canEditInspections: hasPermission(user.role, 'EDIT_INSPECTIONS'),
      canDeleteInspections: hasPermission(user.role, 'DELETE_INSPECTIONS'),
      canViewInspections: hasPermission(user.role, 'VIEW_INSPECTIONS'),
      canCertifyInspections: hasPermission(user.role, 'CERTIFY_INSPECTIONS'),
      canCreateInventory: hasPermission(user.role, 'CREATE_INVENTORY'),
      canEditInventory: hasPermission(user.role, 'EDIT_INVENTORY'),
      canDeleteInventory: hasPermission(user.role, 'DELETE_INVENTORY'),
      canViewInventory: hasPermission(user.role, 'VIEW_INVENTORY'),
      canCreateCatalogs: hasPermission(user.role, 'CREATE_CATALOGS'),
      canEditCatalogs: hasPermission(user.role, 'EDIT_CATALOGS'),
      canDeleteCatalogs: hasPermission(user.role, 'DELETE_CATALOGS'),
      canViewCatalogs: hasPermission(user.role, 'VIEW_CATALOGS'),
      canViewDashboard: hasPermission(user.role, 'VIEW_DASHBOARD'),
      canViewAdvancedReports: hasPermission(user.role, 'VIEW_ADVANCED_REPORTS'),
      canAccessSystemConfig: hasPermission(user.role, 'SYSTEM_CONFIG')
    };

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        permissions: permissionsObj
      }
    });

  } catch (error) {
    logger.error('Error al obtener permisos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
});

export default router;