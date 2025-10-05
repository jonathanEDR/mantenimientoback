import { Request, Response, NextFunction } from 'express';
import User, { UserRole } from '../models/User';
import { PermissionService } from '../services/PermissionService';
import { AuditService } from '../services/AuditService';
import logger from '../utils/logger';

// Extiende la interfaz Request para incluir información del usuario
declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
      userInfo?: {
        _id: string;
        clerkId: string;
        name: string;
        email: string;
        role: UserRole;
        isActive: boolean;
        lastLoginAt?: Date;
      };
    }
  }
}

// Definición de permisos por acción
export const PERMISSIONS = {
  // Gestión de usuarios
  MANAGE_USERS: [UserRole.ADMINISTRADOR],
  VIEW_USERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  
  // Gestión de componentes
  CREATE_COMPONENTS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  EDIT_COMPONENTS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  DELETE_COMPONENTS: [UserRole.ADMINISTRADOR],
  VIEW_COMPONENTS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  
  // Gestión de órdenes de trabajo
  CREATE_WORK_ORDERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  EDIT_WORK_ORDERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  DELETE_WORK_ORDERS: [UserRole.ADMINISTRADOR],
  VIEW_WORK_ORDERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  COMPLETE_WORK_ORDERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  
  // Gestión de inspecciones
  CREATE_INSPECTIONS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA],
  EDIT_INSPECTIONS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA],
  DELETE_INSPECTIONS: [UserRole.ADMINISTRADOR],
  VIEW_INSPECTIONS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  CERTIFY_INSPECTIONS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA],
  
  // Gestión de inventario
  CREATE_INVENTORY: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  EDIT_INVENTORY: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  DELETE_INVENTORY: [UserRole.ADMINISTRADOR],
  VIEW_INVENTORY: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  
  // Gestión de catálogos/herramientas
  CREATE_CATALOGS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  EDIT_CATALOGS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  DELETE_CATALOGS: [UserRole.ADMINISTRADOR],
  VIEW_CATALOGS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  MANAGE_CATALOGS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  
  // Dashboards y reportes
  VIEW_DASHBOARD: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  VIEW_ADVANCED_REPORTS: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA],
  
  // Monitoreo de flota
  VIEW_MONITORING: [UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.ESPECIALISTA, UserRole.COPILOTO],
  MANAGE_MONITORING: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  
  // Configuración del sistema
  SYSTEM_CONFIG: [UserRole.ADMINISTRADOR]
} as Record<string, UserRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

// Middleware mejorado para verificar si el usuario tiene un rol específico
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || 'unknown';
    
    try {
      // Verificar que el usuario esté autenticado (debe venir del middleware requireAuth)
      const userId = (req as any).user?.sub || (req as any).user?.userId;

      if (!userId) {
        logger.warn(`[roleAuth:${requestId}] Usuario no autenticado para ${req.method} ${req.path}`);
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED',
          timestamp: new Date().toISOString()
        });
      }

      // Buscar el usuario en la base de datos
      const user = await User.findOne({ clerkId: userId });

      if (!user) {
        logger.warn(`[roleAuth:${requestId}] Usuario no encontrado: ${userId} para ${req.path}`);
        return res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        logger.warn(`[roleAuth:${requestId}] Usuario inactivo: ${user.email}`);
        return res.status(403).json({ 
          error: 'Usuario inactivo',
          code: 'USER_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar si el usuario tiene uno de los roles permitidos
      if (!allowedRoles.includes(user.role)) {
        // Registrar intento de acceso no autorizado
        AuditService.logUnauthorizedAccess({
          userId: user.clerkId,
          userEmail: user.email,
          userRole: user.role,
          route: req.path,
          method: req.method,
          reason: `Rol insuficiente: ${user.role}. Requeridos: ${allowedRoles.join(', ')}`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        logger.warn(`[roleAuth:${requestId}] Acceso denegado. Usuario: ${user.email}, Rol: ${user.role}, Roles permitidos: ${allowedRoles.join(', ')}`);
        return res.status(403).json({ 
          error: `Acceso denegado. Roles permitidos: ${allowedRoles.join(', ')}. Tu rol: ${user.role}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          userRole: user.role,
          allowedRoles,
          timestamp: new Date().toISOString()
        });
      }

      // Actualizar último login si es necesario
      if (!user.lastLoginAt || (Date.now() - user.lastLoginAt.getTime() > 60000)) { // 1 minuto
        await User.findByIdAndUpdate(user._id, { 
          lastLoginAt: new Date() 
        }, { new: false });
      }

      // Agregar información del usuario a la request
      req.userRole = user.role;
      req.userInfo = {
        _id: user._id.toString(),
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      };

      const duration = Date.now() - startTime;
      logger.debug(`[roleAuth:${requestId}] Autorización exitosa para ${user.email} con rol ${user.role} (${duration}ms)`);

      next();
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[roleAuth:${requestId}] Error verificando roles (${duration}ms):`, error);
      res.status(500).json({ 
        error: 'Error interno del servidor al verificar permisos',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
};

// Middleware mejorado para verificar permisos específicos
export const requirePermission = (permission: PermissionKey) => {
  return requireRole(PERMISSIONS[permission]);
};

// Middleware avanzado para verificar múltiples permisos (AND/OR logic)
export const requireMultiplePermissions = (
  permissions: PermissionKey[], 
  requireAll: boolean = true
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || 'unknown';

    try {
      const userId = (req as any).user?.sub || (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const user = await User.findOne({ clerkId: userId, isActive: true });
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }

      const hasPermissions = permissions.map(permission => 
        PermissionService.hasRolePermission(user.role, permission)
      );

      const hasAccess = requireAll 
        ? hasPermissions.every(Boolean) 
        : hasPermissions.some(Boolean);

      if (!hasAccess) {
        logger.warn(`[requireMultiplePermissions:${requestId}] Acceso denegado. Usuario: ${user.email}, Permisos requeridos: ${permissions.join(', ')}, RequireAll: ${requireAll}`);
        return res.status(403).json({ 
          error: `Permisos insuficientes. Se requiere${requireAll ? 'n todos' : ' al menos uno de'}: ${permissions.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions: permissions,
          requireAll
        });
      }

      // Agregar información del usuario a la request
      req.userRole = user.role;
      req.userInfo = {
        _id: user._id.toString(),
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      };

      next();
    } catch (error) {
      logger.error(`[requireMultiplePermissions:${requestId}] Error:`, error);
      res.status(500).json({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Función helper mejorada para verificar si un rol tiene un permiso específico
export const hasPermission = (userRole: UserRole, permission: PermissionKey): boolean => {
  return PermissionService.hasRolePermission(userRole, permission);
};

// Función helper mejorada para obtener todos los permisos de un rol
export const getRolePermissions = (role: UserRole): PermissionKey[] => {
  return PermissionService.getPermissionsForRole(role);
};

// Nueva función helper para validar jerarquía de roles
export const canManageRole = (managerRole: UserRole, targetRole: UserRole): boolean => {
  const managerLevel = PermissionService.getRoleHierarchy(managerRole).level;
  const targetLevel = PermissionService.getRoleHierarchy(targetRole).level;
  
  // Solo se puede gestionar usuarios de nivel igual o inferior
  return managerLevel >= targetLevel;
};

// Middleware mejorado para auditoría de acciones
export const auditAction = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userInfo = req.userInfo;
    const requestId = req.headers['x-request-id'] || 'unknown';
    
    if (userInfo) {
      // Usar el nuevo servicio de auditoría
      AuditService.logRouteAccess({
        userId: userInfo.clerkId,
        userEmail: userInfo.email,
        userRole: userInfo.role,
        route: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      logger.info(`[audit:${requestId}] ${action} - Usuario: ${userInfo.email} (${userInfo.role}) - IP: ${req.ip} - UserAgent: ${req.get('User-Agent')?.substring(0, 100)}`);
    }
    
    next();
  };
};