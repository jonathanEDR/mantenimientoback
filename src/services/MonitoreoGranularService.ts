import { Types } from 'mongoose';
import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import logger from '../utils/logger';

// Interfaces específicas para monitoreo granular
export interface IAlertaComponente {
  componenteId: string;
  numeroSerie: string;
  nombre: string;
  categoria: string;
  controlDescripcion: string;
  valorActual: number;
  valorLimite: number;
  unidad: string;
  estado: 'OK' | 'PROXIMO' | 'VENCIDO';
  progreso: number;
  fechaProximaRevision: string;
  alertaActiva: boolean;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
}

export interface IResumenMonitoreoGranular {
  aeronaveId: string;
  matricula: string;
  tipo: string;
  modelo: string;
  horasVuelo: number;
  componentesMonitoreados: number;
  alertasComponentes: IAlertaComponente[];
  resumen: {
    componentesOk: number;
    componentesProximos: number;
    componentesVencidos: number;
    componentesCriticos: number;
  };
  ultimaActualizacion: Date;
}

export interface IResumenFlotaGranular {
  totalAeronaves: number;
  aeronavesConAlertas: number;
  totalComponentesMonitoreados: number;
  totalAlertasComponentes: number;
  aeronaves: IResumenMonitoreoGranular[];
  alertasPrioritarias: IAlertaComponente[];
  generadoEn: Date;
}

/**
 * Servicio para monitoreo granular basado en estados reales de componentes
 */
export class MonitoreoGranularService {
  
  /**
   * Calcula el estado de monitoreo de una aeronave basándose en sus componentes
   */
  static async calcularEstadoAeronave(aeronaveId: string): Promise<IResumenMonitoreoGranular> {
    try {
      // Obtener la aeronave
      const aeronave = await Aeronave.findById(aeronaveId);
      if (!aeronave) {
        throw new Error(`Aeronave con ID ${aeronaveId} no encontrada`);
      }

      // Obtener componentes instalados de la aeronave
      const componentesInstalados = await Componente.find({
        aeronaveActual: aeronave._id,
        estado: 'INSTALADO'
      });

      if (componentesInstalados.length === 0) {
        logger.warn(`No se encontraron componentes instalados para aeronave ${aeronave.matricula}`);
        return {
          aeronaveId: aeronave._id.toString(),
          matricula: aeronave.matricula,
          tipo: aeronave.tipo,
          modelo: aeronave.modelo,
          horasVuelo: aeronave.horasVuelo,
          componentesMonitoreados: 0,
          alertasComponentes: [],
          resumen: {
            componentesOk: 0,
            componentesProximos: 0,
            componentesVencidos: 0,
            componentesCriticos: 0
          },
          ultimaActualizacion: new Date()
        };
      }

      // Procesar alertas directamente de los componentes instalados
      const alertasComponentes: IAlertaComponente[] = [];
      
      for (const componente of componentesInstalados) {
        // Verificar vida útil
        for (const vidaUtil of componente.vidaUtil) {
          if (vidaUtil.limite && vidaUtil.acumulado !== undefined) {
            const progreso = (Number(vidaUtil.acumulado) / Number(vidaUtil.limite)) * 100;
            let estado: 'OK' | 'PROXIMO' | 'VENCIDO' = 'OK';
            let criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'BAJA';
            
            if (progreso >= 100) {
              estado = 'VENCIDO';
              criticidad = 'CRITICA';
            } else if (progreso >= 90) {
              estado = 'PROXIMO';
              criticidad = 'ALTA';
            } else if (progreso >= 80) {
              estado = 'PROXIMO';
              criticidad = 'MEDIA';
            }
            
            // Solo agregar si tiene alerta
            if (estado !== 'OK' || componente.alertasActivas) {
              const alerta: IAlertaComponente = {
                componenteId: componente._id.toString(),
                numeroSerie: componente.numeroSerie,
                nombre: componente.nombre,
                categoria: componente.categoria,
                controlDescripcion: `Vida Útil (${vidaUtil.unidad})`,
                valorActual: Number(vidaUtil.acumulado),
                valorLimite: Number(vidaUtil.limite),
                unidad: String(vidaUtil.unidad),
                estado,
                progreso: Math.round(progreso),
                fechaProximaRevision: componente.proximaInspeccion?.toISOString() || new Date().toISOString(),
                alertaActiva: componente.alertasActivas || estado !== 'OK',
                criticidad
              };
              alertasComponentes.push(alerta);
            }
          }
        }
        
        // Verificar mantenimiento programado
        for (const mantenimiento of componente.mantenimientoProgramado) {
          if (mantenimiento.estado && ['VENCIDO', 'PROXIMO'].includes(String(mantenimiento.estado))) {
            let criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'MEDIA';
            if (mantenimiento.estado === 'VENCIDO') {
              criticidad = 'CRITICA';
            }
            
            const alerta: IAlertaComponente = {
              componenteId: componente._id.toString(),
              numeroSerie: componente.numeroSerie,
              nombre: componente.nombre,
              categoria: componente.categoria,
              controlDescripcion: `Mantenimiento ${mantenimiento.tipo}`,
              valorActual: Number(mantenimiento.horasProximoVencimiento) || 0,
              valorLimite: (Number(mantenimiento.horasProximoVencimiento) || 0) + (Number(mantenimiento.alertaAnticipada) || 50),
              unidad: 'HORAS',
              estado: mantenimiento.estado as 'OK' | 'PROXIMO' | 'VENCIDO',
              progreso: mantenimiento.estado === 'VENCIDO' ? 100 : 95,
              fechaProximaRevision: mantenimiento.proximoVencimiento && mantenimiento.proximoVencimiento instanceof Date ? mantenimiento.proximoVencimiento.toISOString() : new Date().toISOString(),
              alertaActiva: true,
              criticidad
            };
            alertasComponentes.push(alerta);
          }
        }
      }

      // Calcular resumen
      const resumen = {
        componentesOk: componentesInstalados.length - alertasComponentes.length,
        componentesProximos: alertasComponentes.filter(a => a.estado === 'PROXIMO').length,
        componentesVencidos: alertasComponentes.filter(a => a.estado === 'VENCIDO').length,
        componentesCriticos: alertasComponentes.filter(a => a.criticidad === 'CRITICA').length
      };

      const resultado: IResumenMonitoreoGranular = {
        aeronaveId: aeronave._id.toString(),
        matricula: aeronave.matricula,
        tipo: aeronave.tipo,
        modelo: aeronave.modelo,
        horasVuelo: aeronave.horasVuelo,
        componentesMonitoreados: componentesInstalados.length,
        alertasComponentes,
        resumen,
        ultimaActualizacion: new Date()
      };

      return resultado;

    } catch (error) {
      logger.error('Error calculando estado granular de aeronave:', error);
      throw error;
    }
  }

  /**
   * Calcula el resumen de monitoreo granular para toda la flota
   */
  static async calcularResumenFlotaGranular(): Promise<IResumenFlotaGranular> {
    try {
      // Obtener todas las aeronaves
      const aeronaves = await Aeronave.find().sort({ matricula: 1 });
      
      const resumenesAeronaves: IResumenMonitoreoGranular[] = [];
      let totalComponentesMonitoreados = 0;
      let totalAlertasComponentes = 0;

      // Calcular estado para cada aeronave
      for (const aeronave of aeronaves) {
        try {
          const resumenAeronave = await MonitoreoGranularService.calcularEstadoAeronave(
            aeronave._id.toString()
          );
          
          resumenesAeronaves.push(resumenAeronave);
          totalComponentesMonitoreados += resumenAeronave.componentesMonitoreados;
          totalAlertasComponentes += resumenAeronave.alertasComponentes.length;
          
        } catch (error) {
          logger.error(`Error calculando aeronave ${aeronave.matricula}:`, error);
          // Continuar con las demás aeronaves
        }
      }

      // Obtener alertas prioritarias (críticas y vencidas)
      const alertasPrioritarias: IAlertaComponente[] = [];
      
      resumenesAeronaves.forEach(aeronave => {
        aeronave.alertasComponentes
          .filter(alerta => alerta.criticidad === 'CRITICA' || alerta.estado === 'VENCIDO')
          .forEach(alerta => alertasPrioritarias.push(alerta));
      });

      // Ordenar por criticidad
      alertasPrioritarias.sort((a, b) => {
        const criticidadOrder = { 'CRITICA': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
        return criticidadOrder[b.criticidad] - criticidadOrder[a.criticidad];
      });

      const resultado: IResumenFlotaGranular = {
        totalAeronaves: aeronaves.length,
        aeronavesConAlertas: resumenesAeronaves.filter(a => a.alertasComponentes.length > 0).length,
        totalComponentesMonitoreados,
        totalAlertasComponentes,
        aeronaves: resumenesAeronaves,
        alertasPrioritarias: alertasPrioritarias.slice(0, 20), // Top 20 alertas más críticas
        generadoEn: new Date()
      };

      return resultado;

    } catch (error) {
      logger.error('Error calculando resumen granular de flota:', error);
      throw error;
    }
  }

  /**
   * Obtiene alertas críticas de componentes para una aeronave específica
   */
  static async obtenerAlertasCriticasAeronave(aeronaveId: string): Promise<IAlertaComponente[]> {
    try {
      const resumen = await MonitoreoGranularService.calcularEstadoAeronave(aeronaveId);
      
      return resumen.alertasComponentes.filter(alerta => 
        alerta.criticidad === 'CRITICA' || 
        alerta.estado === 'VENCIDO' ||
        (alerta.estado === 'PROXIMO' && alerta.progreso > 95)
      );

    } catch (error) {
      logger.error(`Error obteniendo alertas críticas para aeronave ${aeronaveId}:`, error);
      throw error;
    }
  }
}