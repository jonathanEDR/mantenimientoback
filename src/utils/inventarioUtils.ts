import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import logger from './logger';

export interface PropagacionResult {
  success: boolean;
  componentesActualizados: number;
  estadosMonitoreoActualizados?: number; // 🆕 Contador de estados actualizados
  errores: string[];
  detalles: {
    aeronaveId: string;
    horasAnteriores: number;
    horasNuevas: number;
    incrementoHoras: number;
    componentesProcessados: Array<{
      componenteId: string;
      numeroSerie: string;
      nombre: string;
      actualizado: boolean;
      estadosMonitoreoActualizados?: number; // 🆕 Estados por componente
      error?: string;
    }>;
  };
}

/**
 * Propaga las horas de vuelo de una aeronave a todos sus componentes instalados
 * @param aeronaveId - ID de la aeronave
 * @param horasNuevas - Nuevas horas de vuelo de la aeronave
 * @returns Resultado de la propagación con detalles completos
 */
export async function propagarHorasAComponentes(
  aeronaveId: string, 
  horasNuevas: number
): Promise<PropagacionResult> {
  const result: PropagacionResult = {
    success: false,
    componentesActualizados: 0,
    estadosMonitoreoActualizados: 0, // 🆕 Inicializar contador
    errores: [],
    detalles: {
      aeronaveId,
      horasAnteriores: 0,
      horasNuevas,
      incrementoHoras: 0,
      componentesProcessados: []
    }
  };

  try {
    // Verificar que la aeronave existe
    const aeronave = await Aeronave.findById(aeronaveId);
    if (!aeronave) {
      result.errores.push('Aeronave no encontrada');
      return result;
    }

    const horasAnteriores = aeronave.horasVuelo || 0;
    const incrementoHoras = horasNuevas - horasAnteriores;

    result.detalles.horasAnteriores = horasAnteriores;
    result.detalles.incrementoHoras = incrementoHoras;

    // Validaciones de negocio
    if (incrementoHoras < 0) {
      result.errores.push('Las nuevas horas no pueden ser menores a las actuales');
      return result;
    }

    if (incrementoHoras === 0) {
      result.success = true;
      logger.info(`No hay incremento de horas para aeronave ${aeronave.matricula}`);
      return result;
    }

    // Obtener componentes instalados en la aeronave
    const componentesInstalados = await Componente.find({
      aeronaveActual: aeronaveId,
      estado: 'INSTALADO'
    });

    logger.info(`Encontrados ${componentesInstalados.length} componentes instalados en aeronave ${aeronave.matricula}`);

    // Procesar cada componente
    for (const componente of componentesInstalados) {
      const componenteInfo: {
        componenteId: string;
        numeroSerie: string;
        nombre: string;
        actualizado: boolean;
        error?: string;
      } = {
        componenteId: componente._id.toString(),
        numeroSerie: componente.numeroSerie,
        nombre: componente.nombre,
        actualizado: false
      };

      try {
        // Verificar que el componente tiene vida útil en horas
        const tieneVidaUtilHoras = componente.vidaUtil.some(
          (vida: any) => vida.unidad === 'HORAS'
        );

        if (!tieneVidaUtilHoras) {
          componenteInfo.error = 'Componente no tiene vida útil en horas';
          result.detalles.componentesProcessados.push(componenteInfo);
          continue;
        }

        // Actualizar horas acumuladas
        await Componente.findByIdAndUpdate(
          componente._id,
          {
            $inc: {
              'vidaUtil.$[elem].acumulado': incrementoHoras
            }
          },
          {
            arrayFilters: [{ 'elem.unidad': 'HORAS' }],
            runValidators: true
          }
        );

        // Recalcular horas restantes
        await Componente.findByIdAndUpdate(
          componente._id,
          [
            {
              $set: {
                'vidaUtil': {
                  $map: {
                    input: '$vidaUtil',
                    as: 'vida',
                    in: {
                      $mergeObjects: [
                        '$$vida',
                        {
                          $cond: {
                            if: { $eq: ['$$vida.unidad', 'HORAS'] },
                            then: {
                              restante: {
                                $max: [
                                  0,
                                  { $subtract: ['$$vida.limite', '$$vida.acumulado'] }
                                ]
                              }
                            },
                            else: {}
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          ]
        );

        componenteInfo.actualizado = true;
        result.componentesActualizados++;
        
        // 🆕 ACTUALIZAR ESTADOS DE MONITOREO DEL COMPONENTE
        let estadosActualizadosComponente = 0;
        try {
          const EstadoMonitoreoComponente = (await import('../models/EstadoMonitoreoComponente')).EstadoMonitoreoComponente;
          
          // Buscar todos los estados de monitoreo de este componente
          const estadosMonitoreo = await EstadoMonitoreoComponente.find({ 
            componenteId: componente._id 
          });

          // Actualizar cada estado de monitoreo
          for (const estado of estadosMonitoreo) {
            await EstadoMonitoreoComponente.findByIdAndUpdate(
              estado._id,
              {
                $inc: { valorActual: incrementoHoras }
              }
            );
            
            estadosActualizadosComponente++;
            result.estadosMonitoreoActualizados = (result.estadosMonitoreoActualizados || 0) + 1;
            
            logger.debug(`Estado de monitoreo ${estado._id} actualizado: +${incrementoHoras} horas`);
          }

          if (estadosMonitoreo.length > 0) {
            logger.info(`${estadosMonitoreo.length} estados de monitoreo actualizados para componente ${componente.numeroSerie}`);
          }

        } catch (monitoreoError) {
          logger.warn(`Error actualizando estados de monitoreo para componente ${componente.numeroSerie}:`, monitoreoError);
          // No fallar la propagación general por errores de monitoreo
        }
        
        componenteInfo.estadosMonitoreoActualizados = estadosActualizadosComponente;
        
        logger.debug(`Componente ${componente.numeroSerie} actualizado con ${incrementoHoras} horas`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        componenteInfo.error = errorMsg;
        result.errores.push(`Error actualizando componente ${componente.numeroSerie}: ${errorMsg}`);
        logger.error(`Error actualizando componente ${componente.numeroSerie}:`, error);
      }

      result.detalles.componentesProcessados.push(componenteInfo);
    }

    result.success = result.errores.length === 0 || result.componentesActualizados > 0;
    
    logger.info(`Propagación completada para aeronave ${aeronave.matricula}: ${result.componentesActualizados} componentes actualizados, ${result.errores.length} errores`);

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido en propagación';
    result.errores.push(errorMsg);
    logger.error('Error en propagación de horas:', error);
    return result;
  }
}

/**
 * Valida que un estado de aeronave sea válido
 * @param estado - Estado a validar
 * @returns true si el estado es válido
 */
export function validarEstadoAeronave(estado: string): boolean {
  const estadosValidos = ['Operativo', 'En Mantenimiento', 'Fuera de Servicio', 'En Reparación'];
  return estadosValidos.includes(estado);
}

/**
 * Obtiene los próximos mantenimientos de componentes de una aeronave
 * @param aeronaveId - ID de la aeronave
 * @returns Lista de componentes con mantenimientos próximos
 */
export async function obtenerProximosMantenimientos(aeronaveId: string) {
  try {
    const componentesConMantenimiento = await Componente.find({
      aeronaveActual: aeronaveId,
      estado: 'INSTALADO',
      alertasActivas: true
    }).select('numeroSerie nombre categoria vidaUtil mantenimientoProgramado proximaInspeccion');

    return componentesConMantenimiento.map(componente => {
      const proximosVencimientos = componente.vidaUtil
        .filter((vida: any) => vida.restante !== undefined && vida.restante <= 100)
        .map((vida: any) => ({
          tipo: vida.unidad,
          limite: vida.limite,
          acumulado: vida.acumulado,
          restante: vida.restante
        }));

      return {
        componenteId: componente._id,
        numeroSerie: componente.numeroSerie,
        nombre: componente.nombre,
        categoria: componente.categoria,
        proximosVencimientos,
        proximaInspeccion: componente.proximaInspeccion
      };
    });

  } catch (error) {
    logger.error('Error obteniendo próximos mantenimientos:', error);
    throw error;
  }
}