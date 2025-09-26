import express from 'express';
import { MonitoreoService } from '../services/MonitoreoService';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission } from '../middleware/roleAuth';
import logger from '../utils/logger';
import { IMonitoreoResponse, IConfiguracionAlerta } from '../types/monitoreo';

const router = express.Router();

/**
 * GET /api/monitoreo/aeronave/:matricula
 * Obtiene el resumen completo de monitoreo para una aeronave por su matrícula
 */
router.get('/aeronave/:matricula',
  requireAuth,
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      const { matricula } = req.params;
      const {
        porcentajeAlertaProxima,
        diasAnticipacion,
        horasMinimesTolerancia
      } = req.query;

      logger.info(`Obteniendo monitoreo para aeronave con matrícula: ${matricula}`);

      // Validar parámetros opcionales de configuración
      const config: Partial<IConfiguracionAlerta> = {};
      if (porcentajeAlertaProxima) {
        config.porcentajeAlertaProxima = parseInt(porcentajeAlertaProxima as string);
      }
      if (diasAnticipacion) {
        config.diasAnticipacion = parseInt(diasAnticipacion as string);
      }
      if (horasMinimesTolerancia) {
        config.horasMinimesTolerancia = parseInt(horasMinimesTolerancia as string);
      }

      const configuracionValidada = MonitoreoService.validarConfiguracion(config);

      // Buscar la aeronave por matrícula usando el servicio de monitoreo
      const resumen = await MonitoreoService.calcularAlertasAeronavePorMatricula(
        matricula,
        configuracionValidada
      );

      logger.info(`Monitoreo de aeronave ${matricula} obtenido exitosamente: ${resumen.alertas.length} alertas`);
      res.json({
        resumen,
        alertas: resumen.alertas
      });

    } catch (error) {
      logger.error(`Error al obtener monitoreo de aeronave ${req.params.matricula}:`, error);
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener monitoreo de aeronave',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/aeronave/:aeronaveId/alertas
 * Obtiene las alertas de monitoreo para una aeronave específica
 */
router.get('/aeronave/:aeronaveId/alertas', 
  requireAuth, 
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      const { aeronaveId } = req.params;
      const { 
        porcentajeAlertaProxima, 
        diasAnticipacion, 
        horasMinimesTolerancia 
      } = req.query;

      logger.info(`Obteniendo alertas para aeronave: ${aeronaveId}`);

      // Validar parámetros opcionales de configuración
      const config: Partial<IConfiguracionAlerta> = {};
      if (porcentajeAlertaProxima) {
        config.porcentajeAlertaProxima = parseInt(porcentajeAlertaProxima as string);
      }
      if (diasAnticipacion) {
        config.diasAnticipacion = parseInt(diasAnticipacion as string);
      }
      if (horasMinimesTolerancia) {
        config.horasMinimesTolerancia = parseInt(horasMinimesTolerancia as string);
      }

      const configuracionValidada = MonitoreoService.validarConfiguracion(config);
      const resumenAeronave = await MonitoreoService.calcularAlertasAeronave(
        aeronaveId, 
        configuracionValidada
      );

      const response: IMonitoreoResponse<typeof resumenAeronave> = {
        success: true,
        data: resumenAeronave,
        message: `Alertas calculadas para aeronave ${resumenAeronave.matricula}`,
        timestamp: new Date()
      };

      logger.info(`Alertas obtenidas exitosamente para aeronave: ${resumenAeronave.matricula}`);
      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo alertas de aeronave:', error);
      
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener alertas',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/flota
 * Obtiene el resumen de alertas para toda la flota (alias de /flota/resumen)
 */
router.get('/flota',
  requireAuth,
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      const { 
        porcentajeAlertaProxima, 
        diasAnticipacion, 
        horasMinimesTolerancia,
        soloConAlertas 
      } = req.query;

      logger.info('Obteniendo resumen de alertas de la flota');

      // Validar parámetros opcionales de configuración
      const config: Partial<IConfiguracionAlerta> = {};
      if (porcentajeAlertaProxima) {
        config.porcentajeAlertaProxima = parseInt(porcentajeAlertaProxima as string);
      }
      if (diasAnticipacion) {
        config.diasAnticipacion = parseInt(diasAnticipacion as string);
      }
      if (horasMinimesTolerancia) {
        config.horasMinimesTolerancia = parseInt(horasMinimesTolerancia as string);
      }

      const configuracionValidada = MonitoreoService.validarConfiguracion(config);
      let resumenFlota = await MonitoreoService.calcularResumenFlota(configuracionValidada);

      // Filtrar solo aeronaves con alertas si se solicita
      if (soloConAlertas === 'true') {
        resumenFlota.aeronaves = resumenFlota.aeronaves.filter(
          aeronave => aeronave.alertasCriticas > 0 || aeronave.alertasProximas > 0
        );
      }

      logger.info(`Resumen de flota obtenido exitosamente: ${resumenFlota.totalAeronaves} aeronaves procesadas`);
      res.json(resumenFlota);

    } catch (error) {
      logger.error('Error al obtener resumen de la flota:', error);
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener resumen de flota',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/flota/resumen
 * Obtiene el resumen de alertas para toda la flota
 */
router.get('/flota/resumen',
  requireAuth,
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      const { 
        porcentajeAlertaProxima, 
        diasAnticipacion, 
        horasMinimesTolerancia,
        soloConAlertas 
      } = req.query;

      logger.info('Obteniendo resumen de alertas de la flota');

      // Validar parámetros opcionales de configuración
      const config: Partial<IConfiguracionAlerta> = {};
      if (porcentajeAlertaProxima) {
        config.porcentajeAlertaProxima = parseInt(porcentajeAlertaProxima as string);
      }
      if (diasAnticipacion) {
        config.diasAnticipacion = parseInt(diasAnticipacion as string);
      }
      if (horasMinimesTolerancia) {
        config.horasMinimesTolerancia = parseInt(horasMinimesTolerancia as string);
      }

      const configuracionValidada = MonitoreoService.validarConfiguracion(config);
      let resumenFlota = await MonitoreoService.calcularResumenFlota(configuracionValidada);

      // Filtrar solo aeronaves con alertas si se solicita
      if (soloConAlertas === 'true') {
        resumenFlota.aeronaves = resumenFlota.aeronaves.filter(
          aeronave => aeronave.alertasCriticas > 0 || aeronave.alertasProximas > 0
        );
      }

      const response: IMonitoreoResponse<typeof resumenFlota> = {
        success: true,
        data: resumenFlota,
        message: `Resumen de flota calculado: ${resumenFlota.totalAlertasCriticas} críticas, ${resumenFlota.totalAlertasProximas} próximas`,
        timestamp: new Date()
      };

      logger.info(`Resumen de flota obtenido exitosamente: ${resumenFlota.totalAeronaves} aeronaves procesadas`);
      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo resumen de flota:', error);
      
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener resumen de flota',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/intervalos/activos
 * Obtiene los intervalos de control activos del catálogo
 */
router.get('/intervalos/activos',
  requireAuth,
  requirePermission('VIEW_CATALOGS'),
  async (req, res) => {
    try {
      logger.info('Obteniendo intervalos de control activos');

      const intervalos = await MonitoreoService.obtenerIntervalosActivos();

      const response: IMonitoreoResponse<typeof intervalos> = {
        success: true,
        data: intervalos,
        message: `${intervalos.length} intervalos de control activos encontrados`,
        timestamp: new Date()
      };

      logger.info(`Intervalos activos obtenidos: ${intervalos.length}`);
      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo intervalos activos:', error);
      
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener intervalos',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/aeronave/:aeronaveId/alertas/criticas
 * Obtiene solo las alertas críticas de una aeronave
 */
router.get('/aeronave/:aeronaveId/alertas/criticas',
  requireAuth,
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      const { aeronaveId } = req.params;
      
      logger.info(`Obteniendo alertas críticas para aeronave: ${aeronaveId}`);

      const resumenAeronave = await MonitoreoService.calcularAlertasAeronave(aeronaveId);
      const alertasCriticas = resumenAeronave.alertas.filter(
        alerta => alerta.estado === 'VENCIDO'
      );

      const response: IMonitoreoResponse<typeof alertasCriticas> = {
        success: true,
        data: alertasCriticas,
        message: `${alertasCriticas.length} alertas críticas encontradas para aeronave ${resumenAeronave.matricula}`,
        timestamp: new Date()
      };

      logger.info(`Alertas críticas obtenidas: ${alertasCriticas.length}`);
      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo alertas críticas:', error);
      
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener alertas críticas',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/monitoreo/estadisticas
 * Obtiene estadísticas generales del sistema de monitoreo
 */
router.get('/estadisticas',
  requireAuth,
  requirePermission('VIEW_MONITORING'),
  async (req, res) => {
    try {
      logger.info('Obteniendo estadísticas de monitoreo');

      const resumenFlota = await MonitoreoService.calcularResumenFlota();
      
      const estadisticas = {
        resumenGeneral: {
          totalAeronaves: resumenFlota.totalAeronaves,
          aeronavesConAlertas: resumenFlota.aeronavesConAlertas,
          aeronavesOperativas: resumenFlota.aeronaves.filter(a => a.alertasCriticas === 0).length,
          porcentajeOperatividad: resumenFlota.totalAeronaves > 0 
            ? ((resumenFlota.totalAeronaves - resumenFlota.aeronavesConAlertas) / resumenFlota.totalAeronaves) * 100 
            : 100
        },
        alertas: {
          totalCriticas: resumenFlota.totalAlertasCriticas,
          totalProximas: resumenFlota.totalAlertasProximas,
          distribucionPorAeronave: resumenFlota.aeronaves.map(a => ({
            matricula: a.matricula,
            criticas: a.alertasCriticas,
            proximas: a.alertasProximas,
            ok: a.alertasOk
          }))
        },
        generadoEn: new Date()
      };

      const response: IMonitoreoResponse<typeof estadisticas> = {
        success: true,
        data: estadisticas,
        message: 'Estadísticas de monitoreo generadas exitosamente',
        timestamp: new Date()
      };

      logger.info('Estadísticas de monitoreo obtenidas exitosamente');
      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo estadísticas de monitoreo:', error);
      
      const response: IMonitoreoResponse<null> = {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas',
        timestamp: new Date()
      };

      res.status(500).json(response);
    }
  }
);

export default router;