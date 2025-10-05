import User, { UserRole } from '../models/User';
import logger from '../utils/logger';
import { PERMISSIONS, PermissionKey } from '../middleware/roleAuth';

/**
 * Servicio centralizado para gestión de permisos de usuario
 * Maneja los 4 roles existentes de manera más eficiente
 */
export class PermissionService {
  
  /**
   * Cache de permisos por rol para optimizar consultas
   */
  private static permissionCache = new Map<UserRole, PermissionKey[]>();
  
  /**
   * Obtiene todos los permisos para un rol específico
   */
  static getPermissionsForRole(role: UserRole): PermissionKey[] {
    // Verificar cache primero
    if (this.permissionCache.has(role)) {
      return this.permissionCache.get(role)!;
    }
    
    // Calcular permisos
    const permissions = Object.keys(PERMISSIONS).filter(permission => 
      PERMISSIONS[permission as PermissionKey].includes(role)
    ) as PermissionKey[];
    
    // Guardar en cache
    this.permissionCache.set(role, permissions);
    
    logger.debug(`Permisos calculados para rol ${role}:`, permissions);
    return permissions;
  }
  
  /**
   * Verifica si un usuario tiene un permiso específico
   */
  static async hasUserPermission(clerkId: string, permission: PermissionKey): Promise<boolean> {
    try {
      let user = await User.findOne({ clerkId, isActive: true });
      
      // Compatibilidad con usuarios existentes
      if (!user) {
        user = await User.findOne({ clerkId });
      }
      
      if (!user) {
        logger.warn(`Usuario no encontrado: ${clerkId}`);
        return false;
      }
      
      return this.hasRolePermission(user.role, permission);
    } catch (error) {
      logger.error('Error verificando permiso de usuario:', error);
      return false;
    }
  }
  
  /**
   * Verifica si un rol tiene un permiso específico
   */
  static hasRolePermission(role: UserRole, permission: PermissionKey): boolean {
    return PERMISSIONS[permission]?.includes(role) || false;
  }
  
  /**
   * Obtiene información completa de permisos para un usuario
   */
  static async getUserPermissionInfo(clerkId: string) {
    try {
      // Buscar usuario directamente
      const user = await User.findOne({ clerkId });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar que el usuario esté activo
      if (!user.isActive) {
        throw new Error('Usuario inactivo');
      }
      
      const permissions = this.getPermissionsForRole(user.role);
      
      // Convertir a objeto booleano para el frontend
      const permissionsObj = this.convertPermissionsToObject(user.role);
      
      return {
        user: user.toObject(),
        role: user.role,
        permissions: permissions,
        permissionsObj: permissionsObj,
        roleHierarchy: this.getRoleHierarchy(user.role)
      };
    } catch (error) {
      logger.error('Error obteniendo información de permisos:', error);
      throw error;
    }
  }
  
  /**
   * Convierte permisos a objeto booleano para el frontend
   */
  static convertPermissionsToObject(role: UserRole) {
    return {
      // Gestión de usuarios
      canManageUsers: this.hasRolePermission(role, 'MANAGE_USERS'),
      canViewUsers: this.hasRolePermission(role, 'VIEW_USERS'),
      
      // Gestión de componentes
      canCreateComponents: this.hasRolePermission(role, 'CREATE_COMPONENTS'),
      canEditComponents: this.hasRolePermission(role, 'EDIT_COMPONENTS'),
      canDeleteComponents: this.hasRolePermission(role, 'DELETE_COMPONENTS'),
      canViewComponents: this.hasRolePermission(role, 'VIEW_COMPONENTS'),
      
      // Gestión de órdenes de trabajo
      canCreateWorkOrders: this.hasRolePermission(role, 'CREATE_WORK_ORDERS'),
      canEditWorkOrders: this.hasRolePermission(role, 'EDIT_WORK_ORDERS'),
      canDeleteWorkOrders: this.hasRolePermission(role, 'DELETE_WORK_ORDERS'),
      canViewWorkOrders: this.hasRolePermission(role, 'VIEW_WORK_ORDERS'),
      canCompleteWorkOrders: this.hasRolePermission(role, 'COMPLETE_WORK_ORDERS'),
      
      // Gestión de inspecciones
      canCreateInspections: this.hasRolePermission(role, 'CREATE_INSPECTIONS'),
      canEditInspections: this.hasRolePermission(role, 'EDIT_INSPECTIONS'),
      canDeleteInspections: this.hasRolePermission(role, 'DELETE_INSPECTIONS'),
      canViewInspections: this.hasRolePermission(role, 'VIEW_INSPECTIONS'),
      canCertifyInspections: this.hasRolePermission(role, 'CERTIFY_INSPECTIONS'),
      
      // Gestión de inventario
      canCreateInventory: this.hasRolePermission(role, 'CREATE_INVENTORY'),
      canEditInventory: this.hasRolePermission(role, 'EDIT_INVENTORY'),
      canDeleteInventory: this.hasRolePermission(role, 'DELETE_INVENTORY'),
      canViewInventory: this.hasRolePermission(role, 'VIEW_INVENTORY'),
      
      // Gestión de catálogos
      canCreateCatalogs: this.hasRolePermission(role, 'CREATE_CATALOGS'),
      canEditCatalogs: this.hasRolePermission(role, 'EDIT_CATALOGS'),
      canDeleteCatalogs: this.hasRolePermission(role, 'DELETE_CATALOGS'),
      canViewCatalogs: this.hasRolePermission(role, 'VIEW_CATALOGS'),
      canManageCatalogs: this.hasRolePermission(role, 'MANAGE_CATALOGS'),
      
      // Dashboards y reportes
      canViewDashboard: this.hasRolePermission(role, 'VIEW_DASHBOARD'),
      canViewAdvancedReports: this.hasRolePermission(role, 'VIEW_ADVANCED_REPORTS'),
      
      // Monitoreo
      canViewMonitoring: this.hasRolePermission(role, 'VIEW_MONITORING'),
      canManageMonitoring: this.hasRolePermission(role, 'MANAGE_MONITORING'),
      
      // Configuración del sistema
      canAccessSystemConfig: this.hasRolePermission(role, 'SYSTEM_CONFIG')
    };
  }
  
  /**
   * Obtiene la jerarquía de roles (útil para entender niveles de acceso)
   */
  static getRoleHierarchy(role: UserRole): { level: number; description: string } {
    const hierarchies = {
      [UserRole.ADMINISTRADOR]: { level: 4, description: 'Acceso administrativo completo' },
      [UserRole.MECANICO]: { level: 3, description: 'Gestión de mantenimiento y componentes' },
      [UserRole.ESPECIALISTA]: { level: 2, description: 'Inspecciones y análisis especializado' },
      [UserRole.COPILOTO]: { level: 1, description: 'Acceso de consulta operativa' }
    };
    
    return hierarchies[role];
  }
  
  /**
   * Valida si un cambio de rol es permitido
   */
  static validateRoleChange(
    currentUserRole: UserRole, 
    targetRole: UserRole, 
    requestedByRole: UserRole
  ): { valid: boolean; reason?: string } {
    // Solo administradores pueden cambiar roles
    if (requestedByRole !== UserRole.ADMINISTRADOR) {
      return { valid: false, reason: 'Solo los administradores pueden cambiar roles' };
    }
    
    // No se puede quitar el rol de administrador a sí mismo si es el único administrador
    // Esta validación se puede implementar más adelante con una consulta a la DB
    
    return { valid: true };
  }
  
  /**
   * Limpia el cache de permisos (útil después de cambios en la configuración)
   */
  static clearPermissionCache(): void {
    this.permissionCache.clear();
    logger.info('Cache de permisos limpiado');
  }
  
  /**
   * Obtiene estadísticas de permisos por rol
   */
  static getPermissionStats() {
    const stats = Object.values(UserRole).map(role => ({
      role,
      permissionCount: this.getPermissionsForRole(role).length,
      hierarchy: this.getRoleHierarchy(role)
    }));
    
    return stats;
  }
}