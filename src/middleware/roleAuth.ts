import { Request, Response, NextFunction } from 'express';
import User, { UserRole } from '../models/User';

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
      };
    }
  }
}

// Definición de permisos por acción
export const PERMISSIONS = {
  // Gestión de usuarios
  MANAGE_USERS: [UserRole.ADMINISTRADOR],
  VIEW_USERS: [UserRole.ADMINISTRADOR, UserRole.MECANICO],
  
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
  
  // Configuración del sistema
  SYSTEM_CONFIG: [UserRole.ADMINISTRADOR]
} as Record<string, UserRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

// Middleware para verificar si el usuario tiene un rol específico
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar que el usuario esté autenticado (debe venir del middleware requireAuth)
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Buscar el usuario en la base de datos
      const user = await User.findOne({ clerkId: userId });
      if (!user) {
        return res.status(404).json({ 
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verificar si el usuario tiene uno de los roles permitidos
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          error: `Acceso denegado. Roles permitidos: ${allowedRoles.join(', ')}. Tu rol: ${user.role}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          userRole: user.role,
          allowedRoles
        });
      }

      // Agregar información del usuario a la request
      req.userRole = user.role;
      req.userInfo = {
        _id: user._id.toString(),
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role
      };

      next();
    } catch (error) {
      console.error('[roleAuth] Error verificando roles:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor al verificar permisos',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Middleware para verificar permisos específicos
export const requirePermission = (permission: PermissionKey) => {
  return requireRole(PERMISSIONS[permission]);
};

// Función helper para verificar si un rol tiene un permiso específico
export const hasPermission = (userRole: UserRole, permission: PermissionKey): boolean => {
  return PERMISSIONS[permission].includes(userRole);
};

// Función helper para obtener todos los permisos de un rol
export const getRolePermissions = (role: UserRole): PermissionKey[] => {
  return Object.keys(PERMISSIONS).filter(permission => 
    PERMISSIONS[permission as PermissionKey].includes(role)
  ) as PermissionKey[];
};