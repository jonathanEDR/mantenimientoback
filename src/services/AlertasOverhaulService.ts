/**
 * SERVICIO DE ALERTAS INTEGRADAS PARA OVERHAULS
 * 
 * PROBLEMA RESUELTO:
 * Anteriormente las alertas anticipadas estaban separadas de la configuración de overhauls,
 * causando alertas incorrectas que no consideraban los ciclos de overhaul del componente.
 * 
 * SOLUCIÓN:
 * Este servicio centraliza el cálculo de alertas basándose en:
 * 1. Configuración de overhauls (intervalo, ciclo actual)
 * 2. Alertas anticipadas integradas en overhauls
 * 3. Horas restantes hasta el PRÓXIMO overhaul (no hasta el límite total)
 * 
 * FLUJO CORRECTO:
 * - Motor con límite 2000h
 * - Overhauls cada 500h 
 * - Alerta 50h antes de cada overhaul
 * - Alertas en: 450h, 950h, 1450h, 1950h (no solo a 1950h)
 */

import { Types } from 'mongoose';
import { EstadoMonitoreoComponente, IEstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { IResultadoSemaforo, ColorSemaforo } from '../types/semaforoPersonalizado';
import SemaforoCalculatorService from './SemaforoCalculatorService';
import logger from '../utils/logger';

export interface IAlertaOverhaul {
  componenteId: string;
  valorActual: number;
  proximoOverhaulEn: number;
  horasRestantesOverhaul: number;
  alertaAnticipadaOverhaul: number;
  requiereAlerta: boolean;
  requiereOverhaul: boolean;
  estado: 'OK' | 'PROXIMO' | 'VENCIDO' | 'OVERHAUL_REQUERIDO';
  // ===== SISTEMA LEGACY (COMPATIBILIDAD) =====
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  // ===== NUEVO SISTEMA DE SEMÁFORO =====
  semaforo?: IResultadoSemaforo; // Resultado del cálculo de semáforo personalizable
  usaSemaforo: boolean; // Si está usando el nuevo sistema de semáforo
  cicloActual: number;
  ciclosMaximos: number;
  mensaje: string;
}

export class AlertasOverhaulService {
  
  /**
   * Calcula alertas integradas para un componente con overhauls habilitados
   * Incluye soporte para el nuevo sistema de semáforo personalizable
   */
  static calcularAlertaOverhaul(estado: IEstadoMonitoreoComponente): IAlertaOverhaul {
    const config = estado.configuracionOverhaul;
    
    if (!config?.habilitarOverhaul) {
      throw new Error('Este método solo aplica para componentes con overhauls habilitados');
    }

    // Calcular próximo overhaul basándose en ciclo actual
    const proximoOverhaulEn = (config.cicloActual + 1) * config.intervaloOverhaul;
    const horasRestantesOverhaul = proximoOverhaulEn - estado.valorActual;
    
    // Obtener umbral de alerta del semáforo (por defecto 50 horas si no hay config)
    const alertaAnticipada = config.semaforoPersonalizado?.umbrales?.rojo || 50;

    // ===== NUEVO SISTEMA DE SEMÁFORO =====
    const usaSemaforo = config.semaforoPersonalizado?.habilitado || false;
    let semaforo: IResultadoSemaforo | undefined;
    
    if (usaSemaforo && config.semaforoPersonalizado) {
      try {
        semaforo = SemaforoCalculatorService.calcularSemaforo(
          Math.max(0, horasRestantesOverhaul),
          config.intervaloOverhaul,
          config.semaforoPersonalizado
        );
      } catch (error) {
        logger.error('Error calculando semáforo para overhaul:', error);
        // Fallback al sistema legacy
        semaforo = undefined;
      }
    }

    // Determinar estado basándose en semáforo o sistema legacy
    let requiereAlerta: boolean;
    let estadoFinal: 'OK' | 'PROXIMO' | 'VENCIDO' | 'OVERHAUL_REQUERIDO' = 'OK';
    let mensaje = '';

    const requiereOverhaulAhora = estado.valorActual >= proximoOverhaulEn;
    const componenteVencido = estado.valorActual >= estado.valorLimite;

    // LÓGICA INTEGRADA DE ALERTAS Y OVERHAULS
    if (componenteVencido && config.cicloActual >= config.ciclosOverhaul) {
      // Componente definitivamente vencido - máximo overhauls alcanzado
      estadoFinal = 'VENCIDO';
      mensaje = `Componente vencido - Máximo overhauls (${config.ciclosOverhaul}) alcanzado`;
      requiereAlerta = true;
    } else if (requiereOverhaulAhora) {
      // Necesita overhaul ahora mismo
      estadoFinal = 'OVERHAUL_REQUERIDO';
      mensaje = usaSemaforo && semaforo 
        ? `${semaforo.descripcion} - Overhaul requerido ahora`
        : `Overhaul requerido - ${estado.valorActual}h (intervalo: ${config.intervaloOverhaul}h)`;
      requiereAlerta = true;
    } else if (componenteVencido && config.cicloActual < config.ciclosOverhaul) {
      // Vencido pero puede hacer overhaul
      estadoFinal = 'OVERHAUL_REQUERIDO';
      mensaje = `Componente vencido requiere overhaul - ${estado.valorActual}/${estado.valorLimite}h`;
      requiereAlerta = true;
    } else {
      // Usar semáforo si está habilitado, sino lógica legacy
      if (usaSemaforo && semaforo) {
        requiereAlerta = semaforo.requiereAtencion;
        if (semaforo.color === 'ROJO' || semaforo.color === 'NARANJA') {
          estadoFinal = 'PROXIMO';
        } else {
          estadoFinal = 'OK';
        }
        mensaje = `${semaforo.descripcion} - ${horasRestantesOverhaul}h restantes`;
      } else {
        // Sistema legacy
        requiereAlerta = horasRestantesOverhaul <= alertaAnticipada && horasRestantesOverhaul > 0;
        if (requiereAlerta) {
          estadoFinal = 'PROXIMO';
          mensaje = `Próximo a overhaul - faltan ${horasRestantesOverhaul}h (alerta: ${alertaAnticipada}h)`;
        } else {
          estadoFinal = 'OK';
          mensaje = `Estado OK - próximo overhaul en ${horasRestantesOverhaul}h`;
        }
      }
    }

    return {
      componenteId: estado.componenteId.toString(),
      valorActual: estado.valorActual,
      proximoOverhaulEn,
      horasRestantesOverhaul: Math.max(0, horasRestantesOverhaul),
      alertaAnticipadaOverhaul: alertaAnticipada,
      requiereAlerta,
      requiereOverhaul: requiereOverhaulAhora || (componenteVencido && config.cicloActual < config.ciclosOverhaul),
      estado: estadoFinal,
      // ===== SISTEMA LEGACY (ya no usamos criticidad) =====
      criticidad: 'MEDIA', // Deprecated - usar semáforo en su lugar
      // ===== NUEVO SISTEMA DE SEMÁFORO =====
      semaforo,
      usaSemaforo,
      cicloActual: config.cicloActual,
      ciclosMaximos: config.ciclosOverhaul,
      mensaje
    };
  }

  /**
   * Obtiene todas las alertas de overhauls para una aeronave
   */
  static async obtenerAlertasOverhaulAeronave(aeronaveId: string): Promise<IAlertaOverhaul[]> {
    try {
      // Buscar todos los estados de monitoreo con overhauls habilitados para componentes de esta aeronave
      const estadosConOverhauls = await EstadoMonitoreoComponente.find({
        'configuracionOverhaul.habilitarOverhaul': true
      }).populate({
        path: 'componenteId',
        match: { aeronaveActual: new Types.ObjectId(aeronaveId) },
        select: 'numeroSerie nombre categoria aeronaveActual'
      }).exec();

      // Filtrar solo los que tienen componente válido (aeronave coincidente)
      const estadosValidos = estadosConOverhauls.filter(estado => estado.componenteId);

      const alertas: IAlertaOverhaul[] = [];
      
      for (const estado of estadosValidos) {
        try {
          const alerta = this.calcularAlertaOverhaul(estado);
          // Solo incluir si requiere alerta
          if (alerta.requiereAlerta) {
            alertas.push(alerta);
          }
        } catch (error) {
          logger.error(`Error calculando alerta para componente ${estado.componenteId}:`, error);
        }
      }

      return alertas.sort((a, b) => {
        // Ordenar por criticidad y luego por horas restantes
        const criticidadOrder = { 'CRITICA': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
        const criticidadDiff = criticidadOrder[b.criticidad] - criticidadOrder[a.criticidad];
        if (criticidadDiff !== 0) return criticidadDiff;
        
        return a.horasRestantesOverhaul - b.horasRestantesOverhaul;
      });

    } catch (error) {
      logger.error('Error obteniendo alertas de overhaul para aeronave:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las alertas de overhauls para toda la flota
   */
  static async obtenerAlertasOverhaulFlota(): Promise<IAlertaOverhaul[]> {
    try {
      const estadosConOverhauls = await EstadoMonitoreoComponente.find({
        'configuracionOverhaul.habilitarOverhaul': true
      }).populate('componenteId', 'numeroSerie nombre categoria aeronaveActual').exec();

      const alertas: IAlertaOverhaul[] = [];
      
      for (const estado of estadosConOverhauls) {
        if (estado.componenteId) {
          try {
            const alerta = this.calcularAlertaOverhaul(estado);
            if (alerta.requiereAlerta) {
              alertas.push(alerta);
            }
          } catch (error) {
            logger.error(`Error calculando alerta para componente ${estado.componenteId}:`, error);
          }
        }
      }

      return alertas.sort((a, b) => {
        const criticidadOrder = { 'CRITICA': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
        const criticidadDiff = criticidadOrder[b.criticidad] - criticidadOrder[a.criticidad];
        if (criticidadDiff !== 0) return criticidadDiff;
        
        return a.horasRestantesOverhaul - b.horasRestantesOverhaul;
      });

    } catch (error) {
      logger.error('Error obteniendo alertas de overhaul para flota:', error);
      throw error;
    }
  }
}

export default AlertasOverhaulService;