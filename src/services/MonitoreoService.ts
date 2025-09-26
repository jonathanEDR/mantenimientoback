import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';
import Aeronave from '../models/Aeronave';
import logger from '../utils/logger';
import {
  IAlertaMonitoreo,
  IResumenMonitoreoAeronave,
  IResumenFlota,
  IConfiguracionAlerta,
  EstadoAlerta,
  TipoAlerta
} from '../types/monitoreo';

export class MonitoreoService {
  // Configuración por defecto
  private static readonly CONFIG_DEFECTO: IConfiguracionAlerta = {
    porcentajeAlertaProxima: 10, // Alerta cuando quede 10% del intervalo
    diasAnticipacion: 30, // 30 días de anticipación
    horasMinimesTolerancia: 5 // 5 horas de tolerancia antes de marcar como vencido
  };

  /**
   * Calcula las alertas para una aeronave específica
   */
  static async calcularAlertasAeronave(
    aeronaveId: string, 
    config: IConfiguracionAlerta = MonitoreoService.CONFIG_DEFECTO
  ): Promise<IResumenMonitoreoAeronave> {
    try {
      // Calculando alertas para aeronave...

      // Obtener la aeronave
      const aeronave = await Aeronave.findById(aeronaveId);
      if (!aeronave) {
        throw new Error(`Aeronave con ID ${aeronaveId} no encontrada`);
      }

      // Obtener todos los intervalos de control activos
      const intervalosControl = await CatalogoControlMonitoreo.find({ 
        estado: 'ACTIVO' 
      }).sort({ horaInicial: 1 });

      if (intervalosControl.length === 0) {
        logger.warn('No se encontraron intervalos de control activos');
        return {
          aeronaveId: aeronave._id.toString(),
          matricula: aeronave.matricula,
          horasVueloActuales: aeronave.horasVuelo,
          alertas: [],
          totalAlertas: 0,
          alertasCriticas: 0,
          alertasProximas: 0,
          alertasOk: 0,
          ultimaActualizacion: new Date()
        };
      }

      // Calcular alertas para cada intervalo
      const alertas: IAlertaMonitoreo[] = [];
      
      for (const intervalo of intervalosControl) {
        const alerta = MonitoreoService.calcularAlertaIntervalo(
          aeronave.horasVuelo,
          intervalo,
          config
        );
        alertas.push(alerta);
      }

      // Calcular estadísticas
      const alertasCriticas = alertas.filter(a => a.estado === EstadoAlerta.VENCIDO).length;
      const alertasProximas = alertas.filter(a => a.estado === EstadoAlerta.PROXIMO).length;
      const alertasOk = alertas.filter(a => a.estado === EstadoAlerta.OK).length;

      const resumen: IResumenMonitoreoAeronave = {
        aeronaveId: aeronave._id.toString(),
        matricula: aeronave.matricula,
        horasVueloActuales: aeronave.horasVuelo,
        alertas,
        totalAlertas: alertas.length,
        alertasCriticas,
        alertasProximas,
        alertasOk,
        ultimaActualizacion: new Date()
      };

      // Alertas calculadas exitosamente
      
      return resumen;

    } catch (error) {
      logger.error('Error calculando alertas para aeronave:', error);
      throw error;
    }
  }

  /**
   * Calcula las alertas para una aeronave específica por su matrícula
   */
  static async calcularAlertasAeronavePorMatricula(
    matricula: string, 
    config: IConfiguracionAlerta = MonitoreoService.CONFIG_DEFECTO
  ): Promise<IResumenMonitoreoAeronave> {
    try {
      // Calculando alertas por matrícula...

      // Obtener la aeronave por matrícula
      const aeronave = await Aeronave.findOne({ matricula: matricula });
      if (!aeronave) {
        throw new Error(`Aeronave con matrícula ${matricula} no encontrada`);
      }

      // Usar el método existente con el ID de la aeronave
      return await MonitoreoService.calcularAlertasAeronave(aeronave._id.toString(), config);

    } catch (error) {
      logger.error(`Error calculando alertas para aeronave con matrícula ${matricula}:`, error);
      throw error;
    }
  }

  /**
   * Calcula el resumen de alertas para toda la flota
   */
  static async calcularResumenFlota(
    config: IConfiguracionAlerta = MonitoreoService.CONFIG_DEFECTO
  ): Promise<IResumenFlota> {
    try {
      logger.info('Calculando resumen de alertas para toda la flota');

      // Obtener todas las aeronaves operativas
      const aeronaves = await Aeronave.find({
        estado: { $in: ['Operativo', 'En Mantenimiento'] }
      }).sort({ matricula: 1 });

      if (aeronaves.length === 0) {
        return {
          totalAeronaves: 0,
          aeronavesConAlertas: 0,
          totalAlertasCriticas: 0,
          totalAlertasProximas: 0,
          aeronaves: [],
          generadoEn: new Date()
        };
      }

      // Calcular alertas para cada aeronave
      const resumenesAeronaves: IResumenMonitoreoAeronave[] = [];
      
      for (const aeronave of aeronaves) {
        try {
          const resumenAeronave = await MonitoreoService.calcularAlertasAeronave(
            aeronave._id.toString(),
            config
          );
          resumenesAeronaves.push(resumenAeronave);
        } catch (error) {
          logger.error(`Error calculando alertas para aeronave ${aeronave.matricula}:`, error);
          // Continuar con las demás aeronaves
        }
      }

      // Calcular estadísticas globales
      const totalAlertasCriticas = resumenesAeronaves.reduce(
        (sum, r) => sum + r.alertasCriticas, 0
      );
      const totalAlertasProximas = resumenesAeronaves.reduce(
        (sum, r) => sum + r.alertasProximas, 0
      );
      const aeronavesConAlertas = resumenesAeronaves.filter(
        r => r.alertasCriticas > 0 || r.alertasProximas > 0
      ).length;

      const resumenFlota: IResumenFlota = {
        totalAeronaves: aeronaves.length,
        aeronavesConAlertas,
        totalAlertasCriticas,
        totalAlertasProximas,
        aeronaves: resumenesAeronaves,
        generadoEn: new Date()
      };

      logger.info(`Resumen de flota calculado: ${totalAlertasCriticas} alertas críticas, ${totalAlertasProximas} próximas en ${aeronaves.length} aeronaves`);
      
      return resumenFlota;

    } catch (error) {
      logger.error('Error calculando resumen de flota:', error);
      throw error;
    }
  }

  /**
   * Calcula una alerta individual para un intervalo específico
   */
  private static calcularAlertaIntervalo(
    horasActuales: number,
    intervalo: any,
    config: IConfiguracionAlerta
  ): IAlertaMonitoreo {
    const rangoIntervalo = intervalo.horaFinal - intervalo.horaInicial;
    const umbralAlertaProxima = rangoIntervalo * (config.porcentajeAlertaProxima / 100);
    
    let estado: EstadoAlerta;
    let tipoAlerta: TipoAlerta;
    let horasRestantes: number | undefined;
    let horasVencidas: number | undefined;
    let prioridad: number;

    // Determinar si la aeronave está dentro del intervalo
    if (horasActuales < intervalo.horaInicial) {
      // La aeronave aún no ha alcanzado el intervalo
      estado = EstadoAlerta.OK;
      tipoAlerta = TipoAlerta.INFORMATIVO;
      horasRestantes = intervalo.horaInicial - horasActuales;
      prioridad = 3;
    } else if (horasActuales >= intervalo.horaInicial && horasActuales <= intervalo.horaFinal) {
      // La aeronave está dentro del intervalo - evaluar proximidad al final
      const horasEnIntervalo = horasActuales - intervalo.horaInicial;
      const porcentajeCompletado = (horasEnIntervalo / rangoIntervalo) * 100;

      if (porcentajeCompletado >= (100 - config.porcentajeAlertaProxima)) {
        estado = EstadoAlerta.PROXIMO;
        tipoAlerta = TipoAlerta.PREVENTIVO;
        horasRestantes = intervalo.horaFinal - horasActuales;
        prioridad = 2;
      } else {
        estado = EstadoAlerta.OK;
        tipoAlerta = TipoAlerta.INFORMATIVO;
        horasRestantes = intervalo.horaFinal - horasActuales;
        prioridad = 3;
      }
    } else {
      // La aeronave ha superado el intervalo
      if (horasActuales > (intervalo.horaFinal + config.horasMinimesTolerancia)) {
        estado = EstadoAlerta.VENCIDO;
        tipoAlerta = TipoAlerta.CRITICO;
        horasVencidas = horasActuales - intervalo.horaFinal;
        prioridad = 1;
      } else {
        estado = EstadoAlerta.PROXIMO;
        tipoAlerta = TipoAlerta.PREVENTIVO;
        horasVencidas = horasActuales - intervalo.horaFinal;
        prioridad = 2;
      }
    }

    // Calcular porcentaje completado
    const porcentajeCompletado = Math.min(
      ((horasActuales - intervalo.horaInicial) / rangoIntervalo) * 100,
      100
    );

    // Calcular fecha aproximada de próximo vencimiento (si aplica)
    let fechaProximoVencimiento: Date | undefined;
    if (horasRestantes && horasRestantes > 0) {
      // Asumir 8 horas de vuelo promedio por mes (ajustable)
      const horasPorMes = 8;
      const mesesRestantes = horasRestantes / horasPorMes;
      fechaProximoVencimiento = new Date();
      fechaProximoVencimiento.setMonth(fechaProximoVencimiento.getMonth() + mesesRestantes);
    }

    return {
      descripcionCodigo: intervalo.descripcionCodigo,
      horaInicial: intervalo.horaInicial,
      horaFinal: intervalo.horaFinal,
      horasActuales,
      estado,
      tipoAlerta,
      horasRestantes,
      horasVencidas,
      porcentajeCompletado: Math.max(0, porcentajeCompletado),
      fechaProximoVencimiento,
      prioridad
    };
  }

  /**
   * Obtiene intervalos de control activos
   */
  static async obtenerIntervalosActivos() {
    try {
      return await CatalogoControlMonitoreo.find({ estado: 'ACTIVO' })
        .sort({ horaInicial: 1 });
    } catch (error) {
      logger.error('Error obteniendo intervalos activos:', error);
      throw error;
    }
  }

  /**
   * Actualiza la configuración de alertas
   */
  static validarConfiguracion(config: Partial<IConfiguracionAlerta>): IConfiguracionAlerta {
    return {
      porcentajeAlertaProxima: config.porcentajeAlertaProxima || MonitoreoService.CONFIG_DEFECTO.porcentajeAlertaProxima,
      diasAnticipacion: config.diasAnticipacion || MonitoreoService.CONFIG_DEFECTO.diasAnticipacion,
      horasMinimesTolerancia: config.horasMinimesTolerancia || MonitoreoService.CONFIG_DEFECTO.horasMinimesTolerancia
    };
  }
}

export default MonitoreoService;