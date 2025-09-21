import logger from './logger';

interface AuditoriaHoras {
  aeronaveId: string;
  matricula: string;
  horasAnteriores: number;
  horasNuevas: number;
  incremento: number;
  componentesAfectados: number;
  usuario?: string;
  timestamp: Date;
  detallesComponentes: Array<{
    componenteId: string;
    numeroSerie: string;
    nombre: string;
    actualizado: boolean;
    error?: string;
  }>;
}

interface AuditoriaEstado {
  aeronaveId: string;
  matricula: string;
  estadoAnterior: string;
  estadoNuevo: string;
  usuario?: string;
  timestamp: Date;
}

interface AuditoriaObservaciones {
  aeronaveId: string;
  matricula: string;
  observacionesAnteriores?: string;
  observacionesNuevas?: string;
  usuario?: string;
  timestamp: Date;
}

/**
 * Logger especializado para auditoría de operaciones críticas de inventario
 */
export class AuditoriaInventario {
  
  /**
   * Registra una actualización de horas con propagación
   */
  static logActualizacionHoras(auditoria: AuditoriaHoras): void {
    const logData = {
      evento: 'ACTUALIZACION_HORAS_CON_PROPAGACION',
      timestamp: auditoria.timestamp.toISOString(),
      aeronave: {
        id: auditoria.aeronaveId,
        matricula: auditoria.matricula
      },
      cambioHoras: {
        horasAnteriores: auditoria.horasAnteriores,
        horasNuevas: auditoria.horasNuevas,
        incremento: auditoria.incremento
      },
      propagacion: {
        componentesAfectados: auditoria.componentesAfectados,
        detallesComponentes: auditoria.detallesComponentes
      },
      usuario: auditoria.usuario || 'SISTEMA'
    };

    logger.info('AUDITORIA - Actualización de horas con propagación:', logData);

    // Log específico para componentes con errores
    const componentesConErrores = auditoria.detallesComponentes.filter(c => c.error);
    if (componentesConErrores.length > 0) {
      logger.warn('AUDITORIA - Componentes con errores en propagación:', {
        evento: 'ERRORES_PROPAGACION_HORAS',
        aeronave: auditoria.matricula,
        componentesConErrores
      });
    }

    // Log específico para incrementos significativos
    if (auditoria.incremento > 100) {
      logger.warn('AUDITORIA - Incremento significativo de horas:', {
        evento: 'INCREMENTO_HORAS_SIGNIFICATIVO',
        aeronave: auditoria.matricula,
        incremento: auditoria.incremento,
        requiresReview: true
      });
    }
  }

  /**
   * Registra un cambio de estado de aeronave
   */
  static logCambioEstado(auditoria: AuditoriaEstado): void {
    const logData = {
      evento: 'CAMBIO_ESTADO_AERONAVE',
      timestamp: auditoria.timestamp.toISOString(),
      aeronave: {
        id: auditoria.aeronaveId,
        matricula: auditoria.matricula
      },
      cambioEstado: {
        estadoAnterior: auditoria.estadoAnterior,
        estadoNuevo: auditoria.estadoNuevo
      },
      usuario: auditoria.usuario || 'SISTEMA'
    };

    logger.info('AUDITORIA - Cambio de estado de aeronave:', logData);

    // Log específico para cambios críticos
    if (auditoria.estadoNuevo === 'Fuera de Servicio' || auditoria.estadoNuevo === 'En Reparación') {
      logger.warn('AUDITORIA - Aeronave fuera de servicio:', {
        evento: 'AERONAVE_FUERA_SERVICIO',
        aeronave: auditoria.matricula,
        nuevoEstado: auditoria.estadoNuevo,
        requiresAttention: true
      });
    }
  }

  /**
   * Registra una actualización de observaciones
   */
  static logActualizacionObservaciones(auditoria: AuditoriaObservaciones): void {
    const logData = {
      evento: 'ACTUALIZACION_OBSERVACIONES',
      timestamp: auditoria.timestamp.toISOString(),
      aeronave: {
        id: auditoria.aeronaveId,
        matricula: auditoria.matricula
      },
      cambioObservaciones: {
        longitudAnterior: auditoria.observacionesAnteriores?.length || 0,
        longitudNueva: auditoria.observacionesNuevas?.length || 0,
        cambioSignificativo: Math.abs((auditoria.observacionesNuevas?.length || 0) - (auditoria.observacionesAnteriores?.length || 0)) > 100
      },
      usuario: auditoria.usuario || 'SISTEMA'
    };

    logger.info('AUDITORIA - Actualización de observaciones:', logData);
  }

  /**
   * Registra un evento de error crítico
   */
  static logErrorCritico(evento: string, aeronaveId: string, matricula: string, error: any, contexto?: any): void {
    const logData = {
      evento: 'ERROR_CRITICO_INVENTARIO',
      tipoError: evento,
      timestamp: new Date().toISOString(),
      aeronave: {
        id: aeronaveId,
        matricula: matricula
      },
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      contexto: contexto || {},
      requiresImmediateAttention: true
    };

    logger.error('AUDITORIA - Error crítico en inventario:', logData);
  }

  /**
   * Registra operaciones de mantenimiento preventivo disparadas por propagación de horas
   */
  static logAlertasMantenimiento(aeronaveId: string, matricula: string, alertas: any[]): void {
    if (alertas.length === 0) return;

    const logData = {
      evento: 'ALERTAS_MANTENIMIENTO_GENERADAS',
      timestamp: new Date().toISOString(),
      aeronave: {
        id: aeronaveId,
        matricula: matricula
      },
      alertas: alertas.map(alerta => ({
        componenteId: alerta.componenteId,
        numeroSerie: alerta.numeroSerie,
        nombre: alerta.nombre,
        categoria: alerta.categoria,
        proximosVencimientos: alerta.proximosVencimientos,
        requiereAtencion: alerta.proximosVencimientos.some((v: any) => v.restante <= 25)
      })),
      totalAlertas: alertas.length,
      alertasCriticas: alertas.filter(a => a.proximosVencimientos.some((v: any) => v.restante <= 25)).length
    };

    logger.warn('AUDITORIA - Alertas de mantenimiento generadas:', logData);
  }
}

export default AuditoriaInventario;