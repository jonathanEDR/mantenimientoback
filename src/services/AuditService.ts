import logger from '../utils/logger';

/**
 * Servicio de auditoría para rastrear cambios y accesos relacionados con roles
 */
export class AuditService {
  
  /**
   * Registra el acceso a una ruta protegida
   */
  static logRouteAccess(data: {
    userId: string;
    userEmail: string;
    userRole: string;
    route: string;
    method: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    requiredPermissions?: string[];
  }) {
    logger.info('[AUDIT] Acceso a ruta protegida', {
      type: 'ROUTE_ACCESS',
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      route: data.route,
      method: data.method,
      ip: data.ip,
      userAgent: data.userAgent?.substring(0, 100), // Limitar longitud
      success: data.success,
      requiredPermissions: data.requiredPermissions,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra cambios de roles de usuario
   */
  static logRoleChange(data: {
    targetUserId: string;
    targetUserEmail: string;
    previousRole: string;
    newRole: string;
    changedBy: string;
    changedByEmail: string;
    reason?: string;
    ip?: string;
  }) {
    logger.warn('[AUDIT] Cambio de rol de usuario', {
      type: 'ROLE_CHANGE',
      targetUserId: data.targetUserId,
      targetUserEmail: data.targetUserEmail,
      previousRole: data.previousRole,
      newRole: data.newRole,
      changedBy: data.changedBy,
      changedByEmail: data.changedByEmail,
      reason: data.reason || 'No especificado',
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra acciones administrativas críticas
   */
  static logAdminAction(data: {
    userId: string;
    userEmail: string;
    userRole: string;
    action: string;
    target?: string;
    details?: any;
    ip?: string;
    success: boolean;
  }) {
    const logLevel = data.success ? 'info' : 'error';
    
    logger[logLevel]('[AUDIT] Acción administrativa', {
      type: 'ADMIN_ACTION',
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      action: data.action,
      target: data.target,
      details: data.details,
      ip: data.ip,
      success: data.success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra intentos de acceso no autorizado
   */
  static logUnauthorizedAccess(data: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    route: string;
    method: string;
    requiredPermissions?: string[];
    reason: string;
    ip?: string;
    userAgent?: string;
  }) {
    logger.warn('[AUDIT] Intento de acceso no autorizado', {
      type: 'UNAUTHORIZED_ACCESS',
      userId: data.userId || 'unknown',
      userEmail: data.userEmail || 'unknown',
      userRole: data.userRole || 'unknown',
      route: data.route,
      method: data.method,
      requiredPermissions: data.requiredPermissions,
      reason: data.reason,
      ip: data.ip,
      userAgent: data.userAgent?.substring(0, 100),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra inicio y cierre de sesión
   */
  static logAuthEvent(data: {
    userId: string;
    userEmail: string;
    userRole: string;
    event: 'LOGIN' | 'LOGOUT';
    ip?: string;
    userAgent?: string;
    success: boolean;
  }) {
    logger.info('[AUDIT] Evento de autenticación', {
      type: 'AUTH_EVENT',
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      event: data.event,
      ip: data.ip,
      userAgent: data.userAgent?.substring(0, 100),
      success: data.success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra cambios en permisos o configuraciones del sistema
   */
  static logSystemConfigChange(data: {
    userId: string;
    userEmail: string;
    userRole: string;
    configType: string;
    previousValue?: any;
    newValue?: any;
    ip?: string;
  }) {
    logger.warn('[AUDIT] Cambio en configuración del sistema', {
      type: 'SYSTEM_CONFIG_CHANGE',
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      configType: data.configType,
      previousValue: data.previousValue,
      newValue: data.newValue,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra acceso a datos sensibles
   */
  static logSensitiveDataAccess(data: {
    userId: string;
    userEmail: string;
    userRole: string;
    dataType: string;
    dataId?: string;
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE';
    ip?: string;
  }) {
    logger.info('[AUDIT] Acceso a datos sensibles', {
      type: 'SENSITIVE_DATA_ACCESS',
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      dataType: data.dataType,
      dataId: data.dataId,
      action: data.action,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtiene estadísticas de auditoría (para implementación futura)
   */
  static async getAuditStats() {
    // Placeholder para futuras implementaciones con base de datos
    logger.info('[AUDIT] Solicitadas estadísticas de auditoría');
    
    return {
      message: 'Sistema de estadísticas de auditoría disponible en logs',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Genera reporte de actividad por usuario (para implementación futura)
   */
  static async generateUserActivityReport(userId: string) {
    logger.info(`[AUDIT] Generando reporte de actividad para usuario: ${userId}`);
    
    return {
      message: 'Reporte de actividad disponible en logs',
      userId,
      timestamp: new Date().toISOString()
    };
  }
}