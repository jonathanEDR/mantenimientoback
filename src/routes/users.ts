import express from 'express';
import User, { UserRole } from '../models/User';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission, hasPermission, getRolePermissions, auditAction } from '../middleware/roleAuth';
import { PermissionService } from '../services/PermissionService';
import { AuditService } from '../services/AuditService';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/users - Obtener todos los usuarios
router.get('/', requireAuth, requirePermission('VIEW_USERS'), async (req, res) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const filter: any = {};
    
    // Solo incluir usuarios inactivos si se especifica explícitamente
    if (includeInactive !== 'true') {
      filter.isActive = { $ne: false }; // Incluye usuarios sin isActive y con isActive: true
    }

    const usuarios = await User.find(filter, {
      password: 0 // Excluir contraseña por seguridad
    }).sort({ createdAt: -1 });

    logger.info(`Se encontraron ${usuarios.length} usuarios ${includeInactive === 'true' ? '(incluye inactivos)' : '(solo activos)'}`);

    res.json({
      success: true,
      data: usuarios,
      total: usuarios.length,
      filter: { includeInactive: includeInactive === 'true' }
    });

  } catch (error) {
    logger.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'USERS_FETCH_ERROR'
    });
  }
});

// GET /api/users/stats - Obtener estadísticas de usuarios
router.get('/stats', requireAuth, requirePermission('VIEW_USERS'), async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de usuarios');

    // Filtro para usuarios activos
    const activeFilter = { isActive: { $ne: false } };
    
    const [totalUsuarios, usuariosActivos, usuariosRecientes] = await Promise.all([
      User.countDocuments(),
      User.countDocuments(activeFilter),
      User.countDocuments({
        ...activeFilter,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    // Estadísticas por rol (solo usuarios activos)
    const usuariosPorRol: Record<UserRole, number> = {
      [UserRole.ADMINISTRADOR]: 0,
      [UserRole.MECANICO]: 0,
      [UserRole.COPILOTO]: 0,
      [UserRole.ESPECIALISTA]: 0
    };
    
    // Contar usuarios por rol (solo activos)
    for (const role of Object.values(UserRole)) {
      usuariosPorRol[role] = await User.countDocuments({ 
        role, 
        ...activeFilter 
      });
    }

    const stats = {
      totalUsuarios,
      usuariosActivos,
      usuariosInactivos: totalUsuarios - usuariosActivos,
      usuariosRecientes,
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

// PUT /api/users/:id/role - Cambiar rol de usuario (solo administradores) - MEJORADO
router.put('/:id/role', 
  requireAuth, 
  requirePermission('MANAGE_USERS'), 
  auditAction('CAMBIO_ROL_USUARIO'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newRole, reason } = req.body;
      const managerInfo = req.userInfo!;

      logger.info(`Usuario ${managerInfo.email} cambiando rol de usuario ${id} a ${newRole}`);

      // Validar que el nuevo rol es válido
      if (!Object.values(UserRole).includes(newRole)) {
        return res.status(400).json({
          success: false,
          message: 'Rol inválido',
          validRoles: Object.values(UserRole),
          timestamp: new Date().toISOString()
        });
      }

      // Obtener el usuario actual antes del cambio
      const usuario = await User.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Validar que se puede hacer el cambio
      const validation = PermissionService.validateRoleChange(
        usuario.role, 
        newRole, 
        managerInfo.role
      );

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.reason
        });
      }

      // Registrar el cambio en el historial antes de actualizar
      const previousRole = usuario.role;
      
      // Actualizar usuario con auditoría
      usuario.role = newRole;
      usuario.updatedBy = managerInfo.clerkId;
      
      // El middleware pre-save se encargará de agregar al historial
      await usuario.save();

      // Registrar auditoría del cambio de rol
      AuditService.logRoleChange({
        targetUserId: usuario._id.toString(),
        targetUserEmail: usuario.email,
        previousRole,
        newRole,
        changedBy: managerInfo.clerkId,
        changedByEmail: managerInfo.email,
        reason: reason || 'Cambio administrativo',
        ip: req.ip
      });

      logger.info(`Rol actualizado exitosamente: ${usuario.name} (${usuario.email}) -> ${previousRole} to ${newRole} por ${managerInfo.email}`);

      res.json({
        success: true,
        message: 'Rol actualizado exitosamente',
        user: {
          _id: usuario._id,
          name: usuario.name,
          email: usuario.email,
          role: usuario.role,
          clerkId: usuario.clerkId,
          updatedBy: managerInfo.email,
          updatedAt: new Date()
        },
        roleChange: {
          previousRole,
          newRole,
          changedBy: managerInfo.email,
          reason: reason || 'No especificado'
        },
        // NUEVA FUNCIONALIDAD: Información adicional para el frontend
        updateInfo: {
          shouldRefreshCache: true,
          affectedUserId: usuario._id.toString(),
          affectedUserClerkId: usuario.clerkId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error al cambiar rol:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  });

// GET /api/users/me/permissions - Obtener permisos del usuario actual (MEJORADO)
router.get('/me/permissions', requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).user.sub;
    
    // Usar el nuevo servicio de permisos
    const userPermissionInfo = await PermissionService.getUserPermissionInfo(clerkId);

    logger.debug(`Permisos obtenidos para usuario: ${userPermissionInfo.user.email} - Rol: ${userPermissionInfo.role}`);

    res.json({
      success: true,
      user: {
        ...userPermissionInfo.user,
        permissions: userPermissionInfo.permissionsObj
      },
      roleInfo: {
        role: userPermissionInfo.role,
        hierarchy: userPermissionInfo.roleHierarchy,
        allPermissions: userPermissionInfo.permissions
      }
    });

  } catch (error) {
    logger.error('Error al obtener permisos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;